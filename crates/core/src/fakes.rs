use std::{collections::HashMap, sync::Mutex};

use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    AnalysisResponse, Error, ImageChange, ImportedRecipe, NutritionalAnalyzer, Recipe,
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
    images: HashMap<Uuid, ResizedImage>,
}

impl Storage for FakeStorage {
    fn load_recipes(&self) -> Result<Vec<Recipe>> {
        Ok(self.state.lock()?.recipes.clone())
    }

    fn insert_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()> {
        let mut state = self.state.lock()?;
        if state.recipes.iter().any(|stored| stored.id == recipe.id) {
            return Err(Error::Storage(format!("Duplicate recipe: {}", recipe.id)));
        }
        state.apply_image(recipe.id, image);
        state.recipes.push(recipe.clone());
        Ok(())
    }

    fn update_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()> {
        let mut state = self.state.lock()?;
        let stored = state
            .recipes
            .iter_mut()
            .find(|stored| stored.id == recipe.id)
            .ok_or(Error::NotFound(recipe.id))?;
        *stored = recipe.clone();
        state.apply_image(recipe.id, image);
        Ok(())
    }

    fn delete_recipe(&self, id: Uuid) -> Result<()> {
        let mut state = self.state.lock()?;
        let index = state
            .recipes
            .iter()
            .position(|recipe| recipe.id == id)
            .ok_or(Error::NotFound(id))?;
        state.recipes.remove(index);
        state.plan.drop_recipe(id);
        state.images.remove(&id);
        Ok(())
    }

    fn load_image(&self, id: Uuid) -> Result<Option<ResizedImage>> {
        Ok(self.state.lock()?.images.get(&id).cloned())
    }

    fn load_plan(&self) -> Result<WeeklyPlan> {
        Ok(self.state.lock()?.plan.clone())
    }

    fn save_plan(&self, plan: &WeeklyPlan) -> Result<()> {
        self.state.lock()?.plan = plan.clone();
        Ok(())
    }
}

impl StoredState {
    fn apply_image(&mut self, id: Uuid, image: &ImageChange) {
        match image {
            ImageChange::Keep => {}
            ImageChange::Remove => {
                self.images.remove(&id);
            }
            ImageChange::Set(image) => {
                self.images.insert(id, image.clone());
            }
        }
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
        let mut first = Recipe {
            title: "First".into(),
            ..Recipe::default()
        };
        let second = Recipe {
            title: "Second".into(),
            ..Recipe::default()
        };
        storage.insert_recipe(&first, &ImageChange::Keep).unwrap();
        storage.insert_recipe(&second, &ImageChange::Keep).unwrap();
        assert!(matches!(
            storage.insert_recipe(&first, &ImageChange::Keep),
            Err(Error::Storage(_))
        ));
        first.title = "Updated".into();
        storage.update_recipe(&first, &ImageChange::Keep).unwrap();
        assert_eq!(
            storage.load_recipes().unwrap(),
            vec![first.clone(), second.clone()]
        );

        let mut plan = WeeklyPlan::default();
        plan.days[2] = vec![first.id, second.id, first.id];
        storage.save_plan(&plan).unwrap();
        assert_eq!(storage.load_plan().unwrap(), plan);
        plan.drop_recipe(first.id);
        storage.delete_recipe(first.id).unwrap();
        assert_eq!(storage.load_recipes().unwrap(), vec![second]);
        assert_eq!(storage.load_plan().unwrap(), plan);
        for result in [
            storage.update_recipe(&first, &ImageChange::Keep),
            storage.delete_recipe(first.id),
        ] {
            assert_eq!(result, Err(Error::NotFound(first.id)));
        }
        assert_eq!(storage.load_plan().unwrap(), plan);

        assert_eq!(storage.load_image(first.id).unwrap(), None);
    }
}
