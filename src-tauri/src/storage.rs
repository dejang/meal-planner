use std::sync::{Arc, Mutex};

use meal_planner_core::{Error, Recipe, Result, Storage, WeeklyPlan};
use rusqlite::{params, Connection};
use uuid::Uuid;

pub struct SqliteStorage {
    connection: Arc<Mutex<Connection>>,
}

impl SqliteStorage {
    pub fn new(connection: Arc<Mutex<Connection>>) -> Self {
        Self { connection }
    }

    fn write_recipe(&self, sql: &str, recipe: &Recipe) -> Result<usize> {
        let analysis = recipe
            .analysis
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(Error::storage)?;
        self.connection
            .lock()?
            .execute(
                sql,
                params![
                    recipe.id.to_string(),
                    recipe.title,
                    recipe.ingredients,
                    recipe.instructions,
                    recipe.servings,
                    analysis,
                ],
            )
            .map_err(Error::storage)
    }
}

impl Storage for SqliteStorage {
    fn load_recipes(&self) -> Result<Vec<Recipe>> {
        let connection = self.connection.lock()?;
        let mut statement = connection
            .prepare(
                "SELECT r.id, r.title, r.ingredients, r.instructions, r.servings,
                        r.analysis, i.version
                 FROM recipes r LEFT JOIN images i ON i.recipe_id = r.id
                 ORDER BY r.position",
            )
            .map_err(Error::storage)?;
        let mut rows = statement.query([]).map_err(Error::storage)?;
        let mut recipes = Vec::new();
        while let Some(row) = rows.next().map_err(Error::storage)? {
            let id: String = row.get(0).map_err(Error::storage)?;
            let analysis: Option<String> = row.get(5).map_err(Error::storage)?;
            let image_version: Option<String> = row.get(6).map_err(Error::storage)?;
            recipes.push(Recipe {
                id: Uuid::parse_str(&id).map_err(Error::storage)?,
                title: row.get(1).map_err(Error::storage)?,
                ingredients: row.get(2).map_err(Error::storage)?,
                instructions: row.get(3).map_err(Error::storage)?,
                servings: row.get(4).map_err(Error::storage)?,
                analysis: analysis
                    .as_deref()
                    .map(serde_json::from_str)
                    .transpose()
                    .map_err(Error::storage)?,
                image_version: image_version
                    .as_deref()
                    .map(Uuid::parse_str)
                    .transpose()
                    .map_err(Error::storage)?,
            });
        }
        Ok(recipes)
    }

    fn load_plan(&self) -> Result<WeeklyPlan> {
        let connection = self.connection.lock()?;
        let mut statement = connection
            .prepare("SELECT day, recipe_id FROM plan ORDER BY day, position")
            .map_err(Error::storage)?;
        let mut rows = statement.query([]).map_err(Error::storage)?;
        let mut plan = WeeklyPlan::default();
        while let Some(row) = rows.next().map_err(Error::storage)? {
            let day: u32 = row.get(0).map_err(Error::storage)?;
            let id: String = row.get(1).map_err(Error::storage)?;
            plan.days[day as usize].push(Uuid::parse_str(&id).map_err(Error::storage)?);
        }
        Ok(plan)
    }

    fn insert_recipe(&self, recipe: &Recipe) -> Result<()> {
        self.write_recipe(
            "INSERT INTO recipes (id, position, title, ingredients, instructions, servings, analysis)
             VALUES (?1, (SELECT COALESCE(MAX(position), -1) + 1 FROM recipes),
                     ?2, ?3, ?4, ?5, ?6)",
            recipe,
        )?;
        Ok(())
    }

    fn update_recipe(&self, recipe: &Recipe) -> Result<()> {
        let changed = self.write_recipe(
            "UPDATE recipes SET title = ?2, ingredients = ?3, instructions = ?4,
                                servings = ?5, analysis = ?6 WHERE id = ?1",
            recipe,
        )?;
        if changed == 0 {
            return Err(Error::NotFound(recipe.id));
        }
        Ok(())
    }

    fn delete_recipe(&self, id: Uuid, _plan: &WeeklyPlan) -> Result<()> {
        let changed = self
            .connection
            .lock()?
            .execute("DELETE FROM recipes WHERE id = ?1", [id.to_string()])
            .map_err(Error::storage)?;
        if changed == 0 {
            return Err(Error::NotFound(id));
        }
        Ok(())
    }

    fn save_plan(&self, plan: &WeeklyPlan) -> Result<()> {
        let mut connection = self.connection.lock()?;
        let transaction = connection.transaction().map_err(Error::storage)?;
        transaction
            .execute("DELETE FROM plan", [])
            .map_err(Error::storage)?;
        {
            let mut statement = transaction
                .prepare("INSERT INTO plan (day, position, recipe_id) VALUES (?1, ?2, ?3)")
                .map_err(Error::storage)?;
            for (day, recipes) in plan.days.iter().enumerate() {
                for (position, id) in recipes.iter().enumerate() {
                    statement
                        .execute(params![day as i64, position as i64, id.to_string()])
                        .map_err(Error::storage)?;
                }
            }
        }
        transaction.commit().map_err(Error::storage)
    }
}

#[cfg(test)]
mod tests;
