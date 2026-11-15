use std::sync::{Arc, Mutex};

use uuid::Uuid;

use crate::{
    compute, plan,
    recipe_store::{self, RecipeStore},
    AnalysisResponse, DayTotals, ImageStore, ImportedRecipe, MealPosition, NutritionalAnalyzer,
    Recipe, RecipeImporter, RecipeInput, ResizedImage, Result, ShoppingItem, Storage,
    SupportedSite, WeeklyPlan,
};

pub(crate) struct State {
    pub(crate) recipes: RecipeStore,
    pub(crate) plan: WeeklyPlan,
}

pub struct App {
    state: Mutex<State>,
    storage: Arc<dyn Storage>,
    images: Arc<dyn ImageStore>,
    analyzer: Arc<dyn NutritionalAnalyzer>,
    importer: Arc<dyn RecipeImporter>,
}

impl App {
    pub fn new(
        storage: Arc<dyn Storage>,
        images: Arc<dyn ImageStore>,
        analyzer: Arc<dyn NutritionalAnalyzer>,
        importer: Arc<dyn RecipeImporter>,
    ) -> Result<Self> {
        let state = State {
            recipes: RecipeStore::new(storage.load_recipes()?),
            plan: storage.load_plan()?,
        };
        Ok(Self {
            state: Mutex::new(state),
            storage,
            images,
            analyzer,
            importer,
        })
    }

    pub fn create_recipe(&self, input: RecipeInput) -> Result<Recipe> {
        recipe_store::create(
            &mut *self.state.lock()?,
            self.storage.as_ref(),
            self.images.as_ref(),
            input,
        )
    }

    pub fn update_recipe(&self, id: Uuid, input: RecipeInput) -> Result<Recipe> {
        recipe_store::update(
            &mut *self.state.lock()?,
            self.storage.as_ref(),
            self.images.as_ref(),
            id,
            input,
        )
    }

    pub fn get_recipe(&self, id: Uuid) -> Result<Recipe> {
        self.state.lock()?.recipes.get(id).cloned()
    }

    pub fn search_recipes(&self, query: &str) -> Result<Vec<Recipe>> {
        Ok(self.state.lock()?.recipes.search(query))
    }

    pub fn list_recipes(&self) -> Result<Vec<Recipe>> {
        Ok(self.state.lock()?.recipes.list())
    }

    pub fn delete_recipe(&self, id: Uuid) -> Result<()> {
        recipe_store::delete(
            &mut *self.state.lock()?,
            self.storage.as_ref(),
            self.images.as_ref(),
            id,
        )
    }

    pub fn get_plan(&self) -> Result<WeeklyPlan> {
        Ok(self.state.lock()?.plan.clone())
    }

    pub fn add_to_day(&self, position: MealPosition, recipe_id: Uuid) -> Result<WeeklyPlan> {
        plan::add(
            &mut *self.state.lock()?,
            self.storage.as_ref(),
            position,
            recipe_id,
        )
    }

    pub fn move_meal(&self, from: MealPosition, to: MealPosition) -> Result<WeeklyPlan> {
        plan::move_meal(&mut *self.state.lock()?, self.storage.as_ref(), from, to)
    }

    pub fn remove_from_day(&self, position: MealPosition) -> Result<WeeklyPlan> {
        plan::remove(&mut *self.state.lock()?, self.storage.as_ref(), position)
    }

    pub fn clear_day(&self, day: u32) -> Result<WeeklyPlan> {
        plan::clear_day(&mut *self.state.lock()?, self.storage.as_ref(), day)
    }

    pub fn copy_previous_day(&self, day: u32) -> Result<WeeklyPlan> {
        plan::copy_previous_day(&mut *self.state.lock()?, self.storage.as_ref(), day)
    }

    pub fn day_totals(&self, day: u32) -> Result<DayTotals> {
        compute::day_totals(&*self.state.lock()?, day)
    }

    pub fn shopping_list(&self) -> Result<Vec<ShoppingItem>> {
        compute::shopping_list(&*self.state.lock()?)
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
        self.images.get(recipe_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        fakes::{FakeAnalyzer, FakeImageStore, FakeImporter, FakeStorage},
        Error,
    };

    #[test]
    fn app_loads_ordered_snapshots_and_delegates_services_without_non_send_futures() {
        fn assert_send<T: Send>(value: T) -> T {
            value
        }
        let storage = Arc::new(FakeStorage::default());
        let images = Arc::new(FakeImageStore::default());
        let first = Recipe {
            title: "Zucchini SOUP".into(),
            ingredients: "  carrot\n\n onion \n".into(),
            ..Recipe::default()
        };
        let second = Recipe {
            title: "Apple".into(),
            ..Recipe::default()
        };
        storage.insert_recipe(&first).unwrap();
        storage.insert_recipe(&second).unwrap();
        let mut plan = WeeklyPlan::default();
        plan.days[0] = vec![second.id];
        storage.save_plan(&plan).unwrap();
        let image = ResizedImage {
            bytes: vec![255, 216, 255],
            width: 1,
            height: 1,
        };
        images.put(first.id, &image).unwrap();
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
        let app = App::new(storage.clone(), images, analyzer.clone(), importer.clone()).unwrap();
        let _: &(dyn Send + Sync) = &app;
        assert_eq!(
            app.list_recipes().unwrap(),
            vec![first.clone(), second.clone()]
        );
        for (query, expected) in [
            ("", vec![first.clone(), second]),
            ("sOuP", vec![first.clone()]),
            ("carrot", vec![]),
        ] {
            assert_eq!(app.search_recipes(query).unwrap(), expected);
        }
        assert_eq!(app.get_recipe(first.id).unwrap(), first);
        let missing = Uuid::new_v4();
        assert_eq!(app.get_recipe(missing), Err(Error::NotFound(missing)));
        assert_eq!(app.get_plan().unwrap(), plan);
        assert_eq!(app.image(first.id).unwrap(), Some(image));
        assert_eq!(app.image(missing).unwrap(), None);
        assert_eq!(app.supported_sites(), sites);
        assert_eq!(
            pollster::block_on(assert_send(
                app.import_recipe("https://example.test/recipe")
            ))
            .unwrap(),
            imported
        );
        let lines = vec!["1 carrot".into()];
        assert_eq!(
            pollster::block_on(assert_send(app.analyze_ingredients(&lines))).unwrap(),
            analysis
        );
        assert_eq!(analyzer.requests().unwrap(), vec![lines]);
        assert_eq!(
            importer.requests().unwrap(),
            vec!["https://example.test/recipe"]
        );
    }
}
