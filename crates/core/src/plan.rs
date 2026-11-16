use uuid::Uuid;

use crate::{app::State, Error, MealPosition, Result, Storage, WeeklyPlan};

pub(crate) fn add(
    state: &mut State,
    storage: &dyn Storage,
    position: MealPosition,
    recipe_id: Uuid,
) -> Result<WeeklyPlan> {
    state.recipes.get(recipe_id)?;
    let mut plan = state.plan.clone();
    insert_at(&mut plan, position, recipe_id)?;
    persist(state, storage, plan)
}

pub(crate) fn move_meal(
    state: &mut State,
    storage: &dyn Storage,
    from: MealPosition,
    to: MealPosition,
) -> Result<WeeklyPlan> {
    let mut plan = state.plan.clone();
    let recipe_id = remove_at(&mut plan, from)?;
    insert_at(&mut plan, to, recipe_id)?;
    persist(state, storage, plan)
}

pub(crate) fn remove(
    state: &mut State,
    storage: &dyn Storage,
    position: MealPosition,
) -> Result<WeeklyPlan> {
    let mut plan = state.plan.clone();
    remove_at(&mut plan, position)?;
    persist(state, storage, plan)
}

pub(crate) fn clear_day(state: &mut State, storage: &dyn Storage, day: u32) -> Result<WeeklyPlan> {
    let mut plan = state.plan.clone();
    day_mut(&mut plan, day)?.clear();
    persist(state, storage, plan)
}

pub(crate) fn copy_previous_day(
    state: &mut State,
    storage: &dyn Storage,
    day: u32,
) -> Result<WeeklyPlan> {
    let mut plan = state.plan.clone();
    let day = day_index(&plan, day)?;
    let previous = day
        .checked_sub(1)
        .ok_or_else(|| Error::InvalidInput("Day 0 has no previous day".into()))?;
    plan.days[day] = plan.days[previous].clone();
    persist(state, storage, plan)
}

pub(crate) fn day_index(plan: &WeeklyPlan, day: u32) -> Result<usize> {
    if day as usize >= plan.days.len() {
        return Err(Error::InvalidInput(format!("Day {day} is outside 0..=5")));
    }
    Ok(day as usize)
}

fn day_mut(plan: &mut WeeklyPlan, day: u32) -> Result<&mut Vec<Uuid>> {
    let index = day_index(plan, day)?;
    Ok(&mut plan.days[index])
}

fn insert_at(plan: &mut WeeklyPlan, position: MealPosition, recipe_id: Uuid) -> Result<()> {
    let day = day_mut(plan, position.day)?;
    day.insert((position.row as usize).min(day.len()), recipe_id);
    Ok(())
}

fn remove_at(plan: &mut WeeklyPlan, position: MealPosition) -> Result<Uuid> {
    let day = day_mut(plan, position.day)?;
    let row = position.row as usize;
    if row >= day.len() {
        return Err(Error::InvalidInput(format!(
            "Row {} is outside day {}",
            position.row, position.day
        )));
    }
    Ok(day.remove(row))
}

fn persist(state: &mut State, storage: &dyn Storage, plan: WeeklyPlan) -> Result<WeeklyPlan> {
    storage.save_plan(&plan)?;
    state.plan = plan.clone();
    Ok(plan)
}

#[cfg(test)]
mod tests {
    use std::sync::{atomic::Ordering, Arc};

    use crate::{
        fakes::FakeImageStore,
        tests::{app, FailingStorage},
        App, Error, MealPosition, Recipe, Storage, WeeklyPlan,
    };
    use uuid::Uuid;

    struct Fixture {
        app: App,
        storage: Arc<FailingStorage>,
        initial: WeeklyPlan,
    }

    impl Fixture {
        fn new() -> Self {
            let storage = Arc::new(FailingStorage::default());
            let ids = recipe_ids();
            let recipes = ids.map(|id| Recipe {
                id,
                ..Recipe::default()
            });
            for recipe in &recipes {
                storage.insert_recipe(recipe).unwrap();
            }
            let [a, b, c] = ids;
            let initial = WeeklyPlan {
                days: [
                    vec![a, b, a, c],
                    vec![b, c],
                    vec![],
                    vec![],
                    vec![],
                    vec![c],
                ],
            };
            storage.save_plan(&initial).unwrap();
            let app = app(storage.clone(), Arc::new(FakeImageStore::default()));
            Self {
                app,
                storage,
                initial,
            }
        }

        fn assert_plan(&self, expected: &WeeklyPlan) {
            assert_eq!(&self.app.get_plan().unwrap(), expected);
            assert_eq!(&self.storage.load_plan().unwrap(), expected);
        }
    }

    fn recipe_ids() -> [Uuid; 3] {
        [1, 2, 3].map(Uuid::from_u128)
    }

    fn position(day: u32, row: u32) -> MealPosition {
        MealPosition { day, row }
    }

    #[test]
    fn add_inserts_and_clamps_at_day_boundaries() {
        let [a, b, c] = recipe_ids();
        for (day, row, expected_day) in [
            (0, 0, vec![b, a, b, a, c]),
            (0, 2, vec![a, b, b, a, c]),
            (0, 4, vec![a, b, a, c, b]),
            (0, u32::MAX, vec![a, b, a, c, b]),
            (2, 0, vec![b]),
            (2, u32::MAX, vec![b]),
            (5, 1, vec![c, b]),
        ] {
            let fixture = Fixture::new();
            let mut expected = fixture.initial.clone();
            expected.days[day as usize] = expected_day;
            assert_eq!(
                fixture.app.add_to_day(position(day, row), b).unwrap(),
                expected
            );
            fixture.assert_plan(&expected);
        }
    }

    #[test]
    fn moves_use_after_removal_rows_and_preserve_occurrences() {
        let [a, b, c] = recipe_ids();
        for (from, to, first, second, third, last) in [
            (
                (0, 0),
                (0, 0),
                vec![a, b, a, c],
                vec![b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 0),
                (0, 1),
                vec![b, a, a, c],
                vec![b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 0),
                (0, 3),
                vec![b, a, c, a],
                vec![b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 0),
                (0, 4),
                vec![b, a, c, a],
                vec![b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 0),
                (0, u32::MAX),
                vec![b, a, c, a],
                vec![b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 3),
                (0, 0),
                vec![c, a, b, a],
                vec![b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 2),
                (1, 0),
                vec![a, b, c],
                vec![a, b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 1),
                (1, 1),
                vec![a, a, c],
                vec![b, b, c],
                vec![],
                vec![c],
            ),
            (
                (0, 1),
                (1, u32::MAX),
                vec![a, a, c],
                vec![b, c, b],
                vec![],
                vec![c],
            ),
            (
                (5, 0),
                (1, 2),
                vec![a, b, a, c],
                vec![b, c, c],
                vec![],
                vec![],
            ),
            ((0, 1), (2, 0), vec![a, a, c], vec![b, c], vec![b], vec![c]),
        ] {
            let fixture = Fixture::new();
            let expected = WeeklyPlan {
                days: [first, second, third, vec![], vec![], last],
            };
            assert_eq!(
                fixture
                    .app
                    .move_meal(position(from.0, from.1), position(to.0, to.1))
                    .unwrap(),
                expected
            );
            fixture.assert_plan(&expected);
        }
    }

    #[test]
    fn remove_deletes_only_the_selected_occurrence() {
        let [a, b, c] = recipe_ids();
        for (day, row, remaining) in [
            (0, 0, vec![b, a, c]),
            (0, 2, vec![a, b, c]),
            (0, 3, vec![a, b, a]),
            (5, 0, vec![]),
        ] {
            let fixture = Fixture::new();
            let mut expected = fixture.initial.clone();
            expected.days[day as usize] = remaining;
            assert_eq!(
                fixture.app.remove_from_day(position(day, row)).unwrap(),
                expected
            );
            fixture.assert_plan(&expected);
        }
    }

    #[test]
    fn clear_replaces_only_the_selected_day() {
        for day in [0, 2, 5] {
            let fixture = Fixture::new();
            let mut expected = fixture.initial.clone();
            expected.days[day as usize].clear();
            assert_eq!(fixture.app.clear_day(day).unwrap(), expected);
            fixture.assert_plan(&expected);
        }
    }

    #[test]
    fn copy_replaces_target_with_previous_day_including_an_empty_day() {
        for day in [1, 2, 5] {
            let fixture = Fixture::new();
            let mut expected = fixture.initial.clone();
            expected.days[day as usize] = fixture.initial.days[day as usize - 1].clone();
            assert_eq!(fixture.app.copy_previous_day(day).unwrap(), expected);
            fixture.assert_plan(&expected);
        }
    }

    #[test]
    fn invalid_input_leaves_memory_and_storage_unchanged() {
        let [a, _, _] = recipe_ids();
        let fixture = Fixture::new();
        for day in [6, 7, u32::MAX] {
            for result in [
                fixture.app.add_to_day(position(day, 0), a),
                fixture.app.move_meal(position(day, 0), position(0, 0)),
                fixture.app.move_meal(position(0, 0), position(day, 0)),
                fixture.app.remove_from_day(position(day, 0)),
                fixture.app.clear_day(day),
                fixture.app.copy_previous_day(day),
            ] {
                assert_eq!(
                    result,
                    Err(Error::InvalidInput(format!("Day {day} is outside 0..=5")))
                );
            }
        }
        for (day, row) in [(0, 4), (0, u32::MAX), (2, 0), (5, 1)] {
            for result in [
                fixture.app.remove_from_day(position(day, row)),
                fixture.app.move_meal(position(day, row), position(1, 0)),
            ] {
                assert!(matches!(result, Err(Error::InvalidInput(_))));
            }
        }
        assert!(matches!(
            fixture.app.copy_previous_day(0),
            Err(Error::InvalidInput(_))
        ));
        let missing = Uuid::new_v4();
        assert_eq!(
            fixture.app.add_to_day(position(0, 0), missing),
            Err(Error::NotFound(missing))
        );
        fixture.assert_plan(&fixture.initial);
    }

    #[test]
    fn failed_saves_do_not_publish_mutations_and_can_be_retried() {
        let [_, b, _] = recipe_ids();
        let fixture = Fixture::new();
        fixture.storage.fail_writes.store(true, Ordering::SeqCst);
        for result in [
            fixture.app.add_to_day(position(0, 0), b),
            fixture.app.move_meal(position(0, 0), position(1, 0)),
            fixture.app.remove_from_day(position(0, 0)),
            fixture.app.clear_day(0),
            fixture.app.copy_previous_day(1),
        ] {
            assert_eq!(result, Err(Error::Storage("Write failed".into())));
        }
        fixture.assert_plan(&fixture.initial);
        fixture.storage.fail_writes.store(false, Ordering::SeqCst);
        let mut expected = fixture.initial.clone();
        expected.days[0].clear();
        assert_eq!(fixture.app.clear_day(0).unwrap(), expected);
        fixture.assert_plan(&expected);
    }
}
