use async_trait::async_trait;
use meal_planner_core::{Error, ImportedRecipe, RecipeImporter, Result, SupportedSite};

pub struct JsonLdExtractor;

#[async_trait]
impl RecipeImporter for JsonLdExtractor {
    async fn import(&self, _url: &str) -> Result<ImportedRecipe> {
        Err(Error::NotImplemented("Recipe import".into()))
    }

    fn supported_sites(&self) -> Vec<SupportedSite> {
        Vec::new()
    }
}
