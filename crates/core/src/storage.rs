use uuid::Uuid;

use crate::{ImageChange, Recipe, ResizedImage, Result, WeeklyPlan};

pub trait Storage: Send + Sync {
    fn load_recipes(&self) -> Result<Vec<Recipe>>;

    fn insert_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()>;
    fn update_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()>;

    fn delete_recipe(&self, id: Uuid) -> Result<()>;
    fn load_image(&self, id: Uuid) -> Result<Option<ResizedImage>>;
    fn load_plan(&self) -> Result<WeeklyPlan>;
    fn save_plan(&self, plan: &WeeklyPlan) -> Result<()>;
}
