use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

use crate::{Error, Recipe, Result};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct WeeklyPlan {
    pub days: [Vec<Uuid>; 6],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct MealPosition {
    pub day: u32,
    pub row: u32,
}

impl WeeklyPlan {
    pub fn add(&mut self, position: MealPosition, recipe: &Recipe) -> Result<()> {
        let day = self.day_index(position.day)?;
        position.insert_into(&mut self.days[day], recipe.id);
        Ok(())
    }

    pub fn move_meal(&mut self, from: MealPosition, to: MealPosition) -> Result<()> {
        let (day, row) = self.occupied_slot(from)?;
        let destination = self.day_index(to.day)?;
        let meal = self.days[day].remove(row);
        to.insert_into(&mut self.days[destination], meal);
        Ok(())
    }

    pub fn remove(&mut self, position: MealPosition) -> Result<()> {
        let (day, row) = self.occupied_slot(position)?;
        self.days[day].remove(row);
        Ok(())
    }

    pub fn clear_day(&mut self, day: u32) -> Result<()> {
        let index = self.day_index(day)?;
        self.days[index].clear();
        Ok(())
    }

    pub fn copy_previous_day(&mut self, day: u32) -> Result<()> {
        let index = self.day_index(day)?;
        let previous = index
            .checked_sub(1)
            .ok_or_else(|| Error::InvalidInput("Day 0 has no previous day".into()))?;
        self.days[index] = self.days[previous].clone();
        Ok(())
    }

    pub fn drop_recipe(&mut self, id: Uuid) {
        for day in &mut self.days {
            day.retain(|recipe_id| *recipe_id != id);
        }
    }

    pub(crate) fn day(&self, day: u32) -> Result<&[Uuid]> {
        Ok(&self.days[self.day_index(day)?])
    }

    fn day_index(&self, day: u32) -> Result<usize> {
        if day as usize >= self.days.len() {
            return Err(Error::InvalidInput(format!(
                "Day {day} is outside 0..={}",
                self.days.len() - 1
            )));
        }
        Ok(day as usize)
    }

    fn occupied_slot(&self, position: MealPosition) -> Result<(usize, usize)> {
        let day = self.day_index(position.day)?;
        let row = position.row as usize;
        if row >= self.days[day].len() {
            return Err(Error::InvalidInput(format!(
                "Row {} is outside day {}",
                position.row, position.day
            )));
        }
        Ok((day, row))
    }
}

impl MealPosition {
    fn insert_into(self, day: &mut Vec<Uuid>, recipe_id: Uuid) {
        day.insert((self.row as usize).min(day.len()), recipe_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn recipe_ids() -> [Uuid; 3] {
        [1, 2, 3].map(Uuid::from_u128)
    }

    fn position(day: u32, row: u32) -> MealPosition {
        MealPosition { day, row }
    }

    fn sample_plan() -> WeeklyPlan {
        let [a, b, c] = recipe_ids();
        WeeklyPlan {
            days: [
                vec![a, b, a, c],
                vec![b, c],
                vec![],
                vec![],
                vec![],
                vec![c],
            ],
        }
    }

    #[test]
    fn add_inserts_and_clamps_at_day_boundaries() -> Result<()> {
        let [a, b, c] = recipe_ids();
        let recipe = Recipe {
            id: b,
            ..Recipe::default()
        };
        for (day, row, expected_day) in [
            (0, 0, vec![b, a, b, a, c]),
            (0, 2, vec![a, b, b, a, c]),
            (0, 4, vec![a, b, a, c, b]),
            (0, u32::MAX, vec![a, b, a, c, b]),
            (2, 0, vec![b]),
            (2, u32::MAX, vec![b]),
            (5, 1, vec![c, b]),
        ] {
            let mut plan = sample_plan();
            let mut expected = plan.clone();
            expected.days[day as usize] = expected_day;
            plan.add(position(day, row), &recipe)?;
            assert_eq!(plan, expected);
        }
        Ok(())
    }

    #[test]
    fn moves_use_after_removal_rows_and_preserve_occurrences() -> Result<()> {
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
            let mut plan = sample_plan();
            let expected = WeeklyPlan {
                days: [first, second, third, vec![], vec![], last],
            };
            plan.move_meal(position(from.0, from.1), position(to.0, to.1))?;
            assert_eq!(plan, expected);
        }
        Ok(())
    }

    #[test]
    fn remove_deletes_only_the_selected_occurrence() -> Result<()> {
        let [a, b, c] = recipe_ids();
        for (day, row, remaining) in [
            (0, 0, vec![b, a, c]),
            (0, 2, vec![a, b, c]),
            (0, 3, vec![a, b, a]),
            (5, 0, vec![]),
        ] {
            let mut plan = sample_plan();
            let mut expected = plan.clone();
            expected.days[day as usize] = remaining;
            plan.remove(position(day, row))?;
            assert_eq!(plan, expected);
        }
        Ok(())
    }

    #[test]
    fn clear_replaces_only_the_selected_day() -> Result<()> {
        for day in [0, 2, 5] {
            let mut plan = sample_plan();
            let mut expected = plan.clone();
            expected.days[day as usize].clear();
            plan.clear_day(day)?;
            assert_eq!(plan, expected);
        }
        Ok(())
    }

    #[test]
    fn copy_replaces_target_with_previous_day_including_an_empty_day() -> Result<()> {
        for day in [1, 2, 5] {
            let mut plan = sample_plan();
            let mut expected = plan.clone();
            expected.days[day as usize] = plan.days[day as usize - 1].clone();
            plan.copy_previous_day(day)?;
            assert_eq!(plan, expected);
        }
        Ok(())
    }

    #[test]
    fn invalid_positions_leave_plan_unchanged() {
        let recipe = Recipe::default();
        let mut plan = sample_plan();
        for day in [6, 7, u32::MAX] {
            for result in [
                plan.add(position(day, 0), &recipe),
                plan.move_meal(position(day, 0), position(0, 0)),
                plan.move_meal(position(0, 0), position(day, 0)),
                plan.remove(position(day, 0)),
                plan.clear_day(day),
                plan.copy_previous_day(day),
            ] {
                assert_eq!(
                    result,
                    Err(Error::InvalidInput(format!("Day {day} is outside 0..=5")))
                );
            }
        }
        for (day, row) in [(0, 4), (0, u32::MAX), (2, 0), (5, 1)] {
            for result in [
                plan.remove(position(day, row)),
                plan.move_meal(position(day, row), position(1, 0)),
            ] {
                assert!(matches!(result, Err(Error::InvalidInput(_))));
            }
        }
        assert!(matches!(
            plan.copy_previous_day(0),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(plan, sample_plan());
    }

    #[test]
    fn drop_recipe_removes_every_occurrence_without_reordering_other_meals() {
        let removed = Uuid::new_v4();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut plan = WeeklyPlan {
            days: [
                vec![removed, first, removed, second],
                vec![removed, removed],
                vec![],
                vec![second, first],
                vec![first, removed],
                vec![removed],
            ],
        };
        plan.drop_recipe(removed);
        assert_eq!(
            plan.days,
            [
                vec![first, second],
                vec![],
                vec![],
                vec![second, first],
                vec![first],
                vec![]
            ]
        );
        let snapshot = plan.clone();
        plan.drop_recipe(removed);
        assert_eq!(plan, snapshot);
    }
}
