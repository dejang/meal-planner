use meal_planner_core::{Error, Recipe, Result, Storage, WeeklyPlan};
use uuid::Uuid;

pub struct SqliteStorage;

impl Storage for SqliteStorage {
    fn load_recipes(&self) -> Result<Vec<Recipe>> {
        Ok(Vec::new())
    }

    fn load_plan(&self) -> Result<WeeklyPlan> {
        Ok(WeeklyPlan::default())
    }

    fn insert_recipe(&self, _recipe: &Recipe) -> Result<()> {
        Err(Error::NotImplemented("Insert recipe storage".into()))
    }

    fn update_recipe(&self, _recipe: &Recipe) -> Result<()> {
        Err(Error::NotImplemented("Update recipe storage".into()))
    }

    fn delete_recipe(&self, _id: Uuid, _plan: &WeeklyPlan) -> Result<()> {
        Err(Error::NotImplemented("Delete recipe storage".into()))
    }

    fn save_plan(&self, _plan: &WeeklyPlan) -> Result<()> {
        Err(Error::NotImplemented("Plan storage".into()))
    }
}
