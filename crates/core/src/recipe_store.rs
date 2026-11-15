use std::collections::HashMap;

use uuid::Uuid;

use crate::{app::State, Error, ImageStore, Recipe, RecipeInput, Result, Storage};

pub(crate) struct RecipeStore {
    recipes: HashMap<Uuid, Recipe>,
    order: Vec<Uuid>,
}

impl RecipeStore {
    pub(crate) fn new(recipes: Vec<Recipe>) -> Self {
        Self {
            order: recipes.iter().map(|recipe| recipe.id).collect(),
            recipes: recipes
                .into_iter()
                .map(|recipe| (recipe.id, recipe))
                .collect(),
        }
    }

    pub(crate) fn get(&self, id: Uuid) -> Result<&Recipe> {
        self.recipes.get(&id).ok_or(Error::NotFound(id))
    }

    fn ordered(&self) -> impl Iterator<Item = &Recipe> {
        self.order.iter().filter_map(|id| self.recipes.get(id))
    }

    pub(crate) fn list(&self) -> Vec<Recipe> {
        self.ordered().cloned().collect()
    }

    pub(crate) fn search(&self, query: &str) -> Vec<Recipe> {
        let query = query.to_lowercase();
        self.ordered()
            .filter(|recipe| recipe.title.to_lowercase().contains(&query))
            .cloned()
            .collect()
    }
}

pub(crate) fn create(
    _state: &mut State,
    _storage: &dyn Storage,
    _images: &dyn ImageStore,
    _input: RecipeInput,
) -> Result<Recipe> {
    todo!()
}

pub(crate) fn update(
    _state: &mut State,
    _storage: &dyn Storage,
    _images: &dyn ImageStore,
    _id: Uuid,
    _input: RecipeInput,
) -> Result<Recipe> {
    todo!()
}

pub(crate) fn delete(
    _state: &mut State,
    _storage: &dyn Storage,
    _images: &dyn ImageStore,
    _id: Uuid,
) -> Result<()> {
    todo!()
}
