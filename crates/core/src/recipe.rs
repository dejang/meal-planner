use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

use crate::{AnalysisResponse, Error, ImageChange, Result};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct Recipe {
    pub id: Uuid,
    pub title: String,
    pub ingredients: String,
    pub instructions: String,
    pub servings: u32,
    pub analysis: Option<AnalysisResponse>,
    pub image_version: Option<Uuid>,
}

impl Default for Recipe {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            title: String::new(),
            ingredients: String::new(),
            instructions: String::new(),
            servings: 1,
            analysis: None,
            image_version: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct RecipeInput {
    pub title: String,
    pub ingredients: String,
    pub instructions: String,
    pub servings: u32,
    pub analysis: Option<AnalysisResponse>,
    pub image: ImageChange,
}

impl RecipeInput {
    pub(crate) fn into_recipe(
        self,
        id: Uuid,
        previous_image: Option<Uuid>,
    ) -> Result<(Recipe, ImageChange)> {
        if self.servings == 0 {
            return Err(Error::InvalidInput("Servings must be at least one".into()));
        }
        let image_version = match self.image {
            ImageChange::Keep => previous_image,
            ImageChange::Remove => None,
            ImageChange::Set(_) => Some(Uuid::new_v4()),
        };
        Ok((
            Recipe {
                id,
                title: self.title,
                ingredients: self.ingredients,
                instructions: self.instructions,
                servings: self.servings,
                analysis: self.analysis,
                image_version,
            },
            self.image,
        ))
    }
}
