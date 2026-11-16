use std::{collections::HashMap, sync::Mutex};

use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    AnalysisResponse, Error, ImageStore, ImportedRecipe, NutritionalAnalyzer, Recipe,
    RecipeImporter, ResizedImage, Result, Storage, SupportedSite, WeeklyPlan,
};

#[derive(Default)]
pub struct FakeStorage {
    state: Mutex<StoredState>,
}

#[derive(Default)]
struct StoredState {
    recipes: Vec<Recipe>,
    plan: WeeklyPlan,
}

impl Storage for FakeStorage {
    fn load_recipes(&self) -> Result<Vec<Recipe>> {
        Ok(self.state.lock()?.recipes.clone())
    }

    fn insert_recipe(&self, recipe: &Recipe) -> Result<()> {
        let mut state = self.state.lock()?;
        if state.recipes.iter().any(|stored| stored.id == recipe.id) {
            return Err(Error::Storage(format!("Duplicate recipe: {}", recipe.id)));
        }
        state.recipes.push(recipe.clone());
        Ok(())
    }

    fn update_recipe(&self, recipe: &Recipe) -> Result<()> {
        let mut state = self.state.lock()?;
        let stored = state
            .recipes
            .iter_mut()
            .find(|stored| stored.id == recipe.id)
            .ok_or(Error::NotFound(recipe.id))?;
        *stored = recipe.clone();
        Ok(())
    }

    fn delete_recipe(&self, id: Uuid, plan: &WeeklyPlan) -> Result<()> {
        let mut state = self.state.lock()?;
        let index = state
            .recipes
            .iter()
            .position(|recipe| recipe.id == id)
            .ok_or(Error::NotFound(id))?;
        state.recipes.remove(index);
        state.plan = plan.clone();
        Ok(())
    }

    fn load_plan(&self) -> Result<WeeklyPlan> {
        Ok(self.state.lock()?.plan.clone())
    }

    fn save_plan(&self, plan: &WeeklyPlan) -> Result<()> {
        self.state.lock()?.plan = plan.clone();
        Ok(())
    }
}

#[derive(Default)]
pub struct FakeImageStore {
    images: Mutex<HashMap<Uuid, ResizedImage>>,
}

impl ImageStore for FakeImageStore {
    fn put(&self, recipe_id: Uuid, image: &ResizedImage) -> Result<Uuid> {
        self.images.lock()?.insert(recipe_id, image.clone());
        Ok(Uuid::new_v4())
    }

    fn get(&self, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
        Ok(self.images.lock()?.get(&recipe_id).cloned())
    }

    fn remove(&self, recipe_id: Uuid) -> Result<()> {
        self.images.lock()?.remove(&recipe_id);
        Ok(())
    }
}

struct Recorder<Request, Response> {
    requests: Mutex<Vec<Request>>,
    response: Result<Response>,
}

impl<Request: Clone, Response: Clone> Recorder<Request, Response> {
    fn new(response: Result<Response>) -> Self {
        Self {
            requests: Mutex::new(Vec::new()),
            response,
        }
    }

    fn record(&self, request: Request) -> Result<Response> {
        self.requests.lock()?.push(request);
        self.response.clone()
    }

    fn requests(&self) -> Result<Vec<Request>> {
        Ok(self.requests.lock()?.clone())
    }
}

pub struct FakeAnalyzer {
    recorder: Recorder<Vec<String>, AnalysisResponse>,
}

impl FakeAnalyzer {
    pub fn new(response: Result<AnalysisResponse>) -> Self {
        Self {
            recorder: Recorder::new(response),
        }
    }

    pub fn requests(&self) -> Result<Vec<Vec<String>>> {
        self.recorder.requests()
    }
}

#[async_trait]
impl NutritionalAnalyzer for FakeAnalyzer {
    async fn analyze(&self, lines: &[String]) -> Result<AnalysisResponse> {
        self.recorder.record(lines.to_vec())
    }
}

pub struct FakeImporter {
    recorder: Recorder<String, ImportedRecipe>,
    sites: Vec<SupportedSite>,
}

impl FakeImporter {
    pub fn new(response: Result<ImportedRecipe>, sites: Vec<SupportedSite>) -> Self {
        Self {
            recorder: Recorder::new(response),
            sites,
        }
    }

    pub fn requests(&self) -> Result<Vec<String>> {
        self.recorder.requests()
    }
}

#[async_trait]
impl RecipeImporter for FakeImporter {
    async fn import(&self, url: &str) -> Result<ImportedRecipe> {
        self.recorder.record(url.to_owned())
    }

    fn supported_sites(&self) -> Vec<SupportedSite> {
        self.sites.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fake_storage_and_images_preserve_mutations() {
        let storage = FakeStorage::default();
        let images = FakeImageStore::default();
        let mut first = Recipe {
            title: "First".into(),
            ..Recipe::default()
        };
        let second = Recipe {
            title: "Second".into(),
            ..Recipe::default()
        };
        storage.insert_recipe(&first).unwrap();
        storage.insert_recipe(&second).unwrap();
        assert!(matches!(
            storage.insert_recipe(&first),
            Err(Error::Storage(_))
        ));
        first.title = "Updated".into();
        storage.update_recipe(&first).unwrap();
        assert_eq!(
            storage.load_recipes().unwrap(),
            vec![first.clone(), second.clone()]
        );

        let mut plan = WeeklyPlan::default();
        plan.days[2] = vec![first.id, second.id, first.id];
        storage.save_plan(&plan).unwrap();
        assert_eq!(storage.load_plan().unwrap(), plan);
        plan.drop_recipe(first.id);
        storage.delete_recipe(first.id, &plan).unwrap();
        assert_eq!(storage.load_recipes().unwrap(), vec![second]);
        assert_eq!(storage.load_plan().unwrap(), plan);
        for result in [
            storage.update_recipe(&first),
            storage.delete_recipe(first.id, &WeeklyPlan::default()),
        ] {
            assert_eq!(result, Err(Error::NotFound(first.id)));
        }
        assert_eq!(storage.load_plan().unwrap(), plan);

        assert_eq!(images.get(first.id).unwrap(), None);
        for bytes in [vec![1, 2], vec![3, 4, 5]] {
            let image = ResizedImage {
                bytes,
                width: 2,
                height: 1,
            };
            images.put(first.id, &image).unwrap();
            assert_eq!(images.get(first.id).unwrap(), Some(image));
        }
        images.remove(first.id).unwrap();
        images.remove(first.id).unwrap();
        assert_eq!(images.get(first.id).unwrap(), None);
    }
}
