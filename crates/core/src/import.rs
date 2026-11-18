use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{ResizedImage, Result};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct ImportedRecipe {
    pub title: String,
    pub ingredients: Vec<String>,
    pub instructions: Vec<String>,
    pub servings: u32,
    pub image: Option<ResizedImage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct SupportedSite {
    pub name: String,
    pub domains: Vec<String>,
}

#[async_trait]
pub trait RecipeImporter: Send + Sync {
    async fn import(&self, url: &str) -> Result<ImportedRecipe>;
    fn supported_sites(&self) -> Vec<SupportedSite>;
}
