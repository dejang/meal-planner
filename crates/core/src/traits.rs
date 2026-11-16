use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    AnalysisResponse, ImportedRecipe, Recipe, ResizedImage, Result, SupportedSite, WeeklyPlan,
};

#[async_trait]
pub trait NutritionalAnalyzer: Send + Sync {
    async fn analyze(&self, lines: &[String]) -> Result<AnalysisResponse>;
}

#[async_trait]
pub trait RecipeImporter: Send + Sync {
    async fn import(&self, url: &str) -> Result<ImportedRecipe>;
    fn supported_sites(&self) -> Vec<SupportedSite>;
}

pub trait Storage: Send + Sync {
    fn load_recipes(&self) -> Result<Vec<Recipe>>;
    fn insert_recipe(&self, recipe: &Recipe) -> Result<()>;
    fn update_recipe(&self, recipe: &Recipe) -> Result<()>;
    fn delete_recipe(&self, id: Uuid, plan: &WeeklyPlan) -> Result<()>;
    fn load_plan(&self) -> Result<WeeklyPlan>;
    fn save_plan(&self, plan: &WeeklyPlan) -> Result<()>;
}

pub trait ImageStore: Send + Sync {
    fn put(&self, recipe_id: Uuid, image: &ResizedImage) -> Result<Uuid>;
    fn get(&self, recipe_id: Uuid) -> Result<Option<ResizedImage>>;
    fn remove(&self, recipe_id: Uuid) -> Result<()>;
}
