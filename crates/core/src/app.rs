use std::sync::{Arc, Mutex};

use indexmap::IndexMap;
use uuid::Uuid;

use crate::{
    nutrition, shopping, AnalysisResponse, DayTotals, Error, ImportedRecipe, MealPosition,
    NutritionalAnalyzer, Recipe, RecipeImporter, RecipeInput, ResizedImage, Result, ShoppingItem,
    Storage, SupportedSite, WeeklyPlan,
};

struct State {
    recipes: IndexMap<Uuid, Recipe>,
    plan: WeeklyPlan,
}

impl State {
    fn recipe(&self, id: Uuid) -> Result<&Recipe> {
        self.recipes.get(&id).ok_or(Error::NotFound(id))
    }
}

pub struct App {
    state: Mutex<State>,
    storage: Arc<dyn Storage>,
    analyzer: Arc<dyn NutritionalAnalyzer>,
    importer: Arc<dyn RecipeImporter>,
}

impl App {
    pub fn new(
        storage: Arc<dyn Storage>,
        analyzer: Arc<dyn NutritionalAnalyzer>,
        importer: Arc<dyn RecipeImporter>,
    ) -> Result<Self> {
        let state = State {
            recipes: storage
                .load_recipes()?
                .into_iter()
                .map(|recipe| (recipe.id, recipe))
                .collect(),
            plan: storage.load_plan()?,
        };
        Ok(Self {
            state: Mutex::new(state),
            storage,
            analyzer,
            importer,
        })
    }

    pub fn create_recipe(&self, input: RecipeInput) -> Result<Recipe> {
        let (recipe, image) = input.into_recipe(Uuid::new_v4(), None)?;
        let mut state = self.state.lock()?;
        self.storage.insert_recipe(&recipe, &image)?;
        state.recipes.insert(recipe.id, recipe.clone());
        Ok(recipe)
    }

    pub fn update_recipe(&self, id: Uuid, input: RecipeInput) -> Result<Recipe> {
        let mut state = self.state.lock()?;
        let previous = state.recipes.get_mut(&id).ok_or(Error::NotFound(id))?;
        let (recipe, image) = input.into_recipe(id, previous.image_version)?;
        self.storage.update_recipe(&recipe, &image)?;
        *previous = recipe.clone();
        Ok(recipe)
    }

    pub fn get_recipe(&self, id: Uuid) -> Result<Recipe> {
        self.state.lock()?.recipe(id).cloned()
    }

    pub fn search_recipes(&self, query: &str) -> Result<Vec<Recipe>> {
        let query = query.to_lowercase();
        Ok(self
            .state
            .lock()?
            .recipes
            .values()
            .filter(|recipe| recipe.title.to_lowercase().contains(&query))
            .cloned()
            .collect())
    }

    pub fn list_recipes(&self) -> Result<Vec<Recipe>> {
        Ok(self.state.lock()?.recipes.values().cloned().collect())
    }

    pub fn delete_recipe(&self, id: Uuid) -> Result<()> {
        let mut state = self.state.lock()?;
        self.storage.delete_recipe(id)?;
        state.recipes.shift_remove(&id);
        state.plan.drop_recipe(id);
        Ok(())
    }

    pub fn get_plan(&self) -> Result<WeeklyPlan> {
        Ok(self.state.lock()?.plan.clone())
    }

    pub fn add_recipe_to_plan(
        &self,
        position: MealPosition,
        recipe_id: Uuid,
    ) -> Result<WeeklyPlan> {
        self.edit_plan(|plan, state| plan.add(position, state.recipe(recipe_id)?))
    }

    pub fn move_meal(&self, from: MealPosition, to: MealPosition) -> Result<WeeklyPlan> {
        self.edit_plan(|plan, _| plan.move_meal(from, to))
    }

    pub fn remove_from_day(&self, position: MealPosition) -> Result<WeeklyPlan> {
        self.edit_plan(|plan, _| plan.remove(position))
    }

    pub fn clear_day(&self, day: u32) -> Result<WeeklyPlan> {
        self.edit_plan(|plan, _| plan.clear_day(day))
    }

    pub fn copy_previous_day(&self, day: u32) -> Result<WeeklyPlan> {
        self.edit_plan(|plan, _| plan.copy_previous_day(day))
    }

    fn edit_plan(
        &self,
        edit: impl FnOnce(&mut WeeklyPlan, &State) -> Result<()>,
    ) -> Result<WeeklyPlan> {
        let mut state = self.state.lock()?;
        let mut plan = state.plan.clone();
        edit(&mut plan, &state)?;
        self.storage.save_plan(&plan)?;
        state.plan = plan.clone();
        Ok(plan)
    }

    pub fn day_totals(&self, day: u32) -> Result<DayTotals> {
        let state = self.state.lock()?;
        nutrition::day_totals(state.plan.day(day)?.iter().map(|id| state.recipe(*id)))
    }

    pub fn shopping_list(&self) -> Result<Vec<ShoppingItem>> {
        let state = self.state.lock()?;
        shopping::shopping_list(state.plan.days.iter().flatten().map(|id| state.recipe(*id)))
    }

    pub async fn import_recipe(&self, url: &str) -> Result<ImportedRecipe> {
        self.importer.import(url).await
    }

    pub fn supported_sites(&self) -> Vec<SupportedSite> {
        self.importer.supported_sites()
    }

    pub async fn analyze_ingredients(&self, lines: &[String]) -> Result<AnalysisResponse> {
        self.analyzer.analyze(lines).await
    }

    pub fn image(&self, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
        self.storage.load_image(recipe_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        fakes::{FakeAnalyzer, FakeImporter, FakeStorage},
        ImageChange,
    };
    use std::sync::atomic::{AtomicBool, Ordering};

    fn app(storage: Arc<dyn Storage>) -> Result<App> {
        App::new(
            storage,
            Arc::new(FakeAnalyzer::new(Ok(AnalysisResponse::default()))),
            Arc::new(FakeImporter::new(
                Err(Error::Import("Unused".into())),
                vec![],
            )),
        )
    }

    #[derive(Default)]
    struct FailingStorage {
        inner: FakeStorage,
        fail_writes: AtomicBool,
    }

    impl FailingStorage {
        fn check_write(&self) -> Result<()> {
            if self.fail_writes.load(Ordering::SeqCst) {
                Err(Error::Storage("Write failed".into()))
            } else {
                Ok(())
            }
        }
    }

    impl Storage for FailingStorage {
        fn load_recipes(&self) -> Result<Vec<Recipe>> {
            self.inner.load_recipes()
        }

        fn insert_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()> {
            self.check_write()?;
            self.inner.insert_recipe(recipe, image)
        }

        fn update_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()> {
            self.check_write()?;
            self.inner.update_recipe(recipe, image)
        }

        fn delete_recipe(&self, id: Uuid) -> Result<()> {
            self.check_write()?;
            self.inner.delete_recipe(id)
        }

        fn load_image(&self, id: Uuid) -> Result<Option<ResizedImage>> {
            self.inner.load_image(id)
        }

        fn load_plan(&self) -> Result<WeeklyPlan> {
            self.inner.load_plan()
        }

        fn save_plan(&self, plan: &WeeklyPlan) -> Result<()> {
            self.check_write()?;
            self.inner.save_plan(plan)
        }
    }

    fn input(title: &str, image: ImageChange) -> RecipeInput {
        RecipeInput {
            title: title.into(),
            ingredients: "1 carrot".into(),
            instructions: "Cook".into(),
            servings: 2,
            analysis: Some(AnalysisResponse {
                calories: 100,
                ..Default::default()
            }),
            image,
        }
    }

    #[test]
    fn app_loads_ordered_snapshots_and_delegates_services_without_non_send_futures(
    ) -> crate::Result<()> {
        fn assert_send<T: Send>(value: T) -> T {
            value
        }
        let storage = Arc::new(FakeStorage::default());
        let first = Recipe {
            image_version: Some(Uuid::new_v4()),
            title: "Zucchini SOUP".into(),
            ingredients: "  carrot\n\n onion \n".into(),
            ..Recipe::default()
        };
        let second = Recipe {
            title: "Apple".into(),
            ..Recipe::default()
        };
        let image = ResizedImage {
            bytes: vec![255, 216, 255],
            width: 1,
            height: 1,
        };
        storage.insert_recipe(&first, &ImageChange::Set(image.clone()))?;
        storage.insert_recipe(&second, &ImageChange::Keep)?;
        let mut plan = WeeklyPlan::default();
        plan.days[0] = vec![second.id];
        storage.save_plan(&plan)?;
        let imported = ImportedRecipe {
            title: "Imported".into(),
            ingredients: vec!["1 carrot".into()],
            instructions: vec!["Cook".into()],
            servings: 2,
            image: Some(image.clone()),
        };
        let sites = vec![SupportedSite {
            name: "Example".into(),
            domains: vec!["example.test".into()],
        }];
        let analysis = AnalysisResponse {
            calories: 123,
            ..Default::default()
        };
        let analyzer = Arc::new(FakeAnalyzer::new(Ok(analysis.clone())));
        let importer = Arc::new(FakeImporter::new(Ok(imported.clone()), sites.clone()));
        let app = App::new(storage.clone(), analyzer.clone(), importer.clone())?;
        let _: &(dyn Send + Sync) = &app;
        assert_eq!(app.list_recipes()?, vec![first.clone(), second.clone()]);
        for (query, expected) in [
            ("", vec![first.clone(), second]),
            ("sOuP", vec![first.clone()]),
            ("carrot", vec![]),
        ] {
            assert_eq!(app.search_recipes(query)?, expected);
        }
        assert_eq!(app.get_recipe(first.id)?, first);
        let missing = Uuid::new_v4();
        assert_eq!(app.get_recipe(missing), Err(Error::NotFound(missing)));
        assert_eq!(app.get_plan()?, plan);
        for day in [6, u32::MAX] {
            assert!(matches!(app.day_totals(day), Err(Error::InvalidInput(_))));
        }
        assert_eq!(app.image(first.id)?, Some(image));
        assert_eq!(app.image(missing)?, None);
        assert_eq!(app.supported_sites(), sites);
        assert_eq!(
            pollster::block_on(assert_send(
                app.import_recipe("https://example.test/recipe")
            ))?,
            imported
        );
        let lines = vec!["1 carrot".into()];
        assert_eq!(
            pollster::block_on(assert_send(app.analyze_ingredients(&lines)))?,
            analysis
        );
        assert_eq!(analyzer.requests()?, vec![lines]);
        assert_eq!(importer.requests()?, vec!["https://example.test/recipe"]);
        Ok(())
    }

    #[test]
    fn create_appends_and_update_replaces_fields_without_reordering() -> crate::Result<()> {
        let storage = Arc::new(FakeStorage::default());
        let first = Recipe {
            title: "Zucchini".into(),
            ingredients: "2 zucchini".into(),
            instructions: "Roast".into(),
            analysis: Some(AnalysisResponse::default()),
            ..Recipe::default()
        };
        let second = Recipe {
            title: "Apple".into(),
            ..Recipe::default()
        };
        storage.insert_recipe(&first, &ImageChange::Keep)?;
        storage.insert_recipe(&second, &ImageChange::Keep)?;
        let app = app(storage.clone())?;
        let created = app.create_recipe(input("Soup", ImageChange::Keep))?;
        assert_eq!(created.title, "Soup");
        assert_eq!(created.ingredients, "1 carrot");
        assert_eq!(created.instructions, "Cook");
        assert_eq!(created.servings, 2);
        assert_eq!(
            created.analysis.as_ref().map(|analysis| analysis.calories),
            Some(100)
        );
        assert_eq!(created.image_version, None);
        let updated = app.update_recipe(
            first.id,
            RecipeInput {
                title: "New soup".into(),
                ingredients: String::new(),
                instructions: "Serve cold".into(),
                servings: 3,
                analysis: None,
                image: ImageChange::Keep,
            },
        )?;
        assert_eq!(
            updated,
            Recipe {
                id: first.id,
                title: "New soup".into(),
                ingredients: String::new(),
                instructions: "Serve cold".into(),
                servings: 3,
                analysis: None,
                image_version: None,
            }
        );
        let expected = vec![updated.clone(), second, created.clone()];
        assert_eq!(app.get_recipe(first.id)?, updated);
        assert_eq!(app.get_recipe(created.id)?, created);
        assert_eq!(app.list_recipes()?, expected);
        assert_eq!(storage.load_recipes()?, expected);
        assert_eq!(app.search_recipes("SOUP")?, vec![updated, created]);
        Ok(())
    }

    #[test]
    fn image_changes_refresh_versions_and_keep_or_remove_content() -> crate::Result<()> {
        let storage = Arc::new(FakeStorage::default());
        let app = app(storage.clone())?;
        let image = ResizedImage {
            bytes: vec![1, 2, 3],
            width: 1,
            height: 1,
        };
        for change in [
            ImageChange::Keep,
            ImageChange::Remove,
            ImageChange::Set(image.clone()),
        ] {
            let recipe = app.create_recipe(input("Image", change.clone()))?;
            let expected = if matches!(change, ImageChange::Set(_)) {
                Some(image.clone())
            } else {
                None
            };
            assert_eq!(app.image(recipe.id)?, expected);
            assert_eq!(recipe.image_version.is_some(), expected.is_some());
            assert_eq!(app.get_recipe(recipe.id)?, recipe);
            assert_eq!(storage.load_recipes()?.last(), Some(&recipe));
        }
        let mut recipe = app
            .list_recipes()?
            .pop()
            .unwrap_or_else(|| panic!("expected the newly created image recipe"));
        for change in [
            ImageChange::Keep,
            ImageChange::Set(ResizedImage {
                bytes: vec![4, 5],
                width: 2,
                height: 1,
            }),
            ImageChange::Remove,
        ] {
            let previous = recipe.clone();
            recipe = app.update_recipe(recipe.id, input("Updated", change.clone()))?;
            match change {
                ImageChange::Keep => {
                    assert_eq!(recipe.image_version, previous.image_version);
                    assert_eq!(app.image(recipe.id)?, Some(image.clone()));
                }
                ImageChange::Set(image) => {
                    assert!(recipe.image_version.is_some());
                    assert_ne!(recipe.image_version, previous.image_version);
                    assert_eq!(app.image(recipe.id)?, Some(image));
                }
                ImageChange::Remove => {
                    assert_eq!(recipe.image_version, None);
                    assert_eq!(app.image(recipe.id)?, None);
                }
            }
            assert_eq!(app.get_recipe(recipe.id)?, recipe);
            assert_eq!(storage.load_recipes()?.last(), Some(&recipe));
        }
        Ok(())
    }

    #[test]
    fn delete_removes_all_planned_occurrences_and_image() -> crate::Result<()> {
        let storage = Arc::new(FakeStorage::default());
        let removed = Recipe {
            image_version: Some(Uuid::new_v4()),
            ..Recipe::default()
        };
        let retained = Recipe::default();
        storage.insert_recipe(
            &removed,
            &ImageChange::Set(ResizedImage {
                bytes: vec![1],
                width: 1,
                height: 1,
            }),
        )?;
        storage.insert_recipe(&retained, &ImageChange::Keep)?;
        let mut plan = WeeklyPlan::default();
        plan.days[0] = vec![removed.id, retained.id, removed.id];
        plan.days[3] = vec![removed.id, retained.id];
        storage.save_plan(&plan)?;
        let app = app(storage.clone())?;
        app.delete_recipe(removed.id)?;
        plan.days[0] = vec![retained.id];
        plan.days[3] = vec![retained.id];
        assert_eq!(app.get_plan()?, plan);
        assert_eq!(storage.load_plan()?, plan);
        assert_eq!(app.list_recipes()?, vec![retained.clone()]);
        assert_eq!(storage.load_recipes()?, vec![retained]);
        assert_eq!(app.get_recipe(removed.id), Err(Error::NotFound(removed.id)));
        assert_eq!(app.image(removed.id)?, None);
        Ok(())
    }

    #[test]
    fn unknown_mutation_ids_and_zero_servings_are_rejected() -> crate::Result<()> {
        let storage = Arc::new(FakeStorage::default());
        let app = app(storage.clone())?;
        let missing = Uuid::new_v4();
        assert_eq!(
            app.update_recipe(missing, input("Missing", ImageChange::Keep)),
            Err(Error::NotFound(missing))
        );
        assert_eq!(app.delete_recipe(missing), Err(Error::NotFound(missing)));
        let recipe = app.create_recipe(input("Valid", ImageChange::Keep))?;
        let mut invalid = input("Invalid", ImageChange::Remove);
        invalid.servings = 0;
        for result in [
            app.create_recipe(invalid.clone()),
            app.update_recipe(recipe.id, invalid),
        ] {
            assert!(matches!(result, Err(Error::InvalidInput(_))));
        }
        assert_eq!(app.list_recipes()?, vec![recipe.clone()]);
        assert_eq!(storage.load_recipes()?, vec![recipe]);
        Ok(())
    }

    #[test]
    fn storage_write_failures_leave_cached_and_persisted_state_unchanged() -> crate::Result<()> {
        let storage = Arc::new(FailingStorage::default());
        let recipe = Recipe {
            image_version: Some(Uuid::new_v4()),
            ..Recipe::default()
        };
        let image = ResizedImage {
            bytes: vec![1],
            width: 1,
            height: 1,
        };
        storage.insert_recipe(&recipe, &ImageChange::Set(image.clone()))?;
        let mut plan = WeeklyPlan::default();
        plan.days[1] = vec![recipe.id];
        storage.save_plan(&plan)?;
        let app = app(storage.clone())?;
        storage.fail_writes.store(true, Ordering::SeqCst);
        let error = Error::Storage("Write failed".into());
        for result in [
            app.create_recipe(input("New", ImageChange::Keep)),
            app.update_recipe(recipe.id, input("Changed", ImageChange::Remove)),
        ] {
            assert_eq!(result, Err(error.clone()));
        }
        assert_eq!(app.delete_recipe(recipe.id), Err(error));
        assert_eq!(app.list_recipes()?, vec![recipe.clone()]);
        assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);
        assert_eq!(app.get_recipe(recipe.id)?, recipe);
        assert_eq!(app.get_plan()?, plan);
        assert_eq!(storage.load_plan()?, plan);
        assert_eq!(app.image(recipe.id)?, Some(image));
        Ok(())
    }

    #[test]
    fn plan_edits_publish_only_after_a_successful_save() -> crate::Result<()> {
        let storage = Arc::new(FailingStorage::default());
        let recipe = Recipe::default();
        storage.insert_recipe(&recipe, &ImageChange::Keep)?;
        let app = app(storage.clone())?;
        let from = MealPosition { day: 0, row: 0 };
        let to = MealPosition { day: 1, row: 0 };
        let missing = uuid::Uuid::new_v4();
        assert_eq!(
            app.add_recipe_to_plan(from, missing),
            Err(Error::NotFound(missing))
        );
        let mut expected = WeeklyPlan::default();
        expected.days[0].push(recipe.id);
        assert_eq!(app.add_recipe_to_plan(from, recipe.id)?, expected);
        assert_eq!(storage.load_plan()?, expected);

        storage.fail_writes.store(true, Ordering::SeqCst);
        for result in [
            app.add_recipe_to_plan(from, recipe.id),
            app.move_meal(from, to),
            app.remove_from_day(from),
            app.clear_day(0),
            app.copy_previous_day(1),
        ] {
            assert_eq!(result, Err(Error::Storage("Write failed".into())));
            assert_eq!(app.get_plan()?, expected);
            assert_eq!(storage.load_plan()?, expected);
        }
        storage.fail_writes.store(false, Ordering::SeqCst);
        expected.days[0].clear();
        expected.days[1].push(recipe.id);
        assert_eq!(app.move_meal(from, to)?, expected);
        assert_eq!(storage.load_plan()?, expected);
        Ok(())
    }
}
