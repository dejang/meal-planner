use std::sync::Mutex;

use meal_planner_core::{Error, ImageChange, Recipe, ResizedImage, Result, Storage, WeeklyPlan};
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

pub struct SqliteStorage {
    connection: Mutex<Connection>,
}

impl SqliteStorage {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Mutex::new(connection),
        }
    }

    fn write_recipe(&self, sql: &str, recipe: &Recipe, image: &ImageChange) -> Result<()> {
        let analysis = recipe
            .analysis
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(Error::storage)?;
        let mut connection = self.connection.lock()?;
        let transaction = connection.transaction().map_err(Error::storage)?;
        let changed = transaction
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
            .map_err(Error::storage)?;
        if changed == 0 {
            return Err(Error::NotFound(recipe.id));
        }
        match image {
            ImageChange::Keep => {}
            ImageChange::Remove => {
                transaction
                    .execute(
                        "DELETE FROM images WHERE recipe_id = ?1",
                        [recipe.id.to_string()],
                    )
                    .map_err(Error::storage)?;
            }
            ImageChange::Set(image) => {
                let version = recipe.image_version.ok_or_else(|| {
                    Error::InvalidInput("A replacement image needs a version".into())
                })?;
                transaction.execute(
                    "INSERT INTO images (id, recipe_id, width, height, data, version) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT(recipe_id) DO UPDATE SET width = excluded.width, height = excluded.height,
                                                         data = excluded.data, version = excluded.version",
                    params![Uuid::new_v4().to_string(), recipe.id.to_string(), image.width, image.height, image.bytes, version.to_string()]
                ).map_err(Error::storage)?;
            }
        }
        transaction.commit().map_err(Error::storage)
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

    fn load_image(&self, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
        self.connection
            .lock()?
            .query_row(
                "SELECT data, width, height FROM images WHERE recipe_id = ?1",
                [recipe_id.to_string()],
                |row| {
                    Ok(ResizedImage {
                        bytes: row.get(0)?,
                        width: row.get(1)?,
                        height: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(Error::storage)
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

    fn insert_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()> {
        self.write_recipe(
            "INSERT INTO recipes (id, position, title, ingredients, instructions, servings, analysis)
             VALUES (?1, (SELECT COALESCE(MAX(position), -1) + 1 FROM recipes),
                     ?2, ?3, ?4, ?5, ?6)",
            recipe, image,
        )
    }

    fn update_recipe(&self, recipe: &Recipe, image: &ImageChange) -> Result<()> {
        self.write_recipe(
            "UPDATE recipes SET title = ?2, ingredients = ?3, instructions = ?4,
                                servings = ?5, analysis = ?6 WHERE id = ?1",
            recipe,
            image,
        )
    }

    fn delete_recipe(&self, id: Uuid) -> Result<()> {
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
mod tests {
    use meal_planner_core::{Error, ImageChange, Recipe, ResizedImage, Storage, WeeklyPlan};
    use rusqlite::{params, Connection};
    use uuid::Uuid;

    use super::SqliteStorage;
    use crate::db;

    fn insert_image(
        connection: &Connection,
        recipe_id: Uuid,
        version: Uuid,
    ) -> rusqlite::Result<()> {
        connection.execute(
            "INSERT INTO images VALUES (?1, ?2, 1, 1, X'00', ?3)",
            params![
                Uuid::new_v4().to_string(),
                recipe_id.to_string(),
                version.to_string()
            ],
        )?;
        Ok(())
    }

    #[test]
    fn full_analysis_round_trips_and_image_versions_come_from_images(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let connection = db::open(directory.path())?;
        let storage = SqliteStorage::new(db::open(directory.path())?);
        let mut recipe = Recipe {
            title: "Soup 🥕".into(),
            ingredients: "1 carrot\nwater".into(),
            instructions: "Simmer\nServe".into(),
            servings: 2,
            analysis: Some(serde_json::from_str(include_str!(
                "../../crates/core/tests/fixtures/analysis.json"
            ))?),
            ..Recipe::default()
        };
        storage.insert_recipe(&recipe, &ImageChange::Keep)?;
        assert!(matches!(
            storage.insert_recipe(&recipe, &ImageChange::Keep),
            Err(Error::Storage(_))
        ));
        assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);

        let stored: String =
            connection.query_row("SELECT analysis FROM recipes", [], |row| row.get(0))?;
        assert_eq!(
            Some(serde_json::from_str::<meal_planner_core::AnalysisResponse>(
                &stored
            )?),
            recipe.analysis
        );
        let image = ResizedImage {
            bytes: vec![1, 2],
            width: 2,
            height: 1,
        };
        recipe.image_version = Some(Uuid::new_v4());
        storage.update_recipe(&recipe, &ImageChange::Set(image.clone()))?;
        assert_eq!(storage.load_image(recipe.id)?, Some(image.clone()));
        assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);

        recipe.title = "Updated soup".into();
        recipe.ingredients = "2 carrots".into();
        recipe.instructions = "Boil".into();
        recipe.servings = 4;
        recipe.analysis = None;
        storage.update_recipe(&recipe, &ImageChange::Keep)?;
        assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);
        let analysis: Option<String> =
            connection.query_row("SELECT analysis FROM recipes", [], |row| row.get(0))?;
        assert_eq!(analysis, None);
        let missing = Recipe::default();
        assert_eq!(
            storage.update_recipe(&missing, &ImageChange::Keep),
            Err(Error::NotFound(missing.id))
        );
        drop(storage);
        drop(connection);

        let storage = SqliteStorage::new(db::open(directory.path())?);
        assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);
        assert_eq!(storage.load_image(recipe.id)?, Some(image));
        let replacement = ResizedImage {
            bytes: vec![3, 4, 5],
            width: 1,
            height: 3,
        };
        recipe.image_version = Some(Uuid::new_v4());
        storage.update_recipe(&recipe, &ImageChange::Set(replacement.clone()))?;
        let reopened = SqliteStorage::new(db::open(directory.path())?);
        assert_eq!(reopened.load_image(recipe.id)?, Some(replacement));
        assert_eq!(reopened.load_recipes()?, vec![recipe.clone()]);
        recipe.image_version = None;
        for _ in 0..2 {
            storage.update_recipe(&recipe, &ImageChange::Remove)?;
            assert_eq!(reopened.load_image(recipe.id)?, None);
            assert_eq!(reopened.load_recipes()?, vec![recipe.clone()]);
        }
        Ok(())
    }

    #[test]
    fn recipe_order_survives_updates_deletion_and_reopening(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = SqliteStorage::new(db::open(directory.path())?);
        let mut recipes = [(3, "Zulu"), (1, "Alpha"), (2, "Middle")].map(|(id, title)| Recipe {
            id: Uuid::from_u128(id),
            title: title.into(),
            ..Recipe::default()
        });
        for recipe in &recipes {
            storage.insert_recipe(recipe, &ImageChange::Keep)?;
        }
        recipes[0].title = "Changed".into();
        storage.update_recipe(&recipes[0], &ImageChange::Keep)?;
        storage.delete_recipe(recipes[1].id)?;
        let appended = Recipe::default();
        storage.insert_recipe(&appended, &ImageChange::Keep)?;
        drop(storage);

        let reopened = SqliteStorage::new(db::open(directory.path())?);
        assert_eq!(
            reopened.load_recipes()?,
            vec![recipes[0].clone(), recipes[2].clone(), appended]
        );
        Ok(())
    }

    #[test]
    fn plan_snapshots_renumber_insert_move_remove_and_roll_back_failures(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = SqliteStorage::new(db::open(directory.path())?);
        let recipes = [Recipe::default(), Recipe::default(), Recipe::default()];
        for recipe in &recipes {
            storage.insert_recipe(recipe, &ImageChange::Keep)?;
        }
        let [a, b, c] = recipes.map(|recipe| recipe.id);
        let connection = db::open(directory.path())?;
        let mut statement = connection
            .prepare("SELECT day, position, recipe_id FROM plan ORDER BY day, position")?;
        let mut plan = WeeklyPlan::default();
        assert_eq!(storage.load_plan()?, plan);
        for days in [
            [vec![a, c], vec![], vec![], vec![], vec![], vec![b]],
            [vec![a, b, c], vec![], vec![], vec![], vec![], vec![b]],
            [vec![c, a], vec![b], vec![], vec![], vec![], vec![b]],
            [vec![c], vec![b], vec![], vec![], vec![], vec![b]],
            [vec![], vec![], vec![], vec![], vec![], vec![]],
        ] {
            plan.days = days;
            storage.save_plan(&plan)?;
            let reopened = SqliteStorage::new(db::open(directory.path())?);
            assert_eq!(reopened.load_plan()?, plan);
            let mut stored = statement.query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
            let expected = plan.days.iter().enumerate().flat_map(|(day, ids)| {
                ids.iter()
                    .enumerate()
                    .map(move |(position, id)| (day as i64, position as i64, id.to_string()))
            });
            for row in expected {
                assert_eq!(stored.next().transpose()?, Some(row));
            }
            assert!(stored.next().is_none(), "no extra stored plan rows");
            let mut invalid = plan.clone();
            invalid.days[0] = vec![a, Uuid::new_v4()];
            assert!(matches!(
                storage.save_plan(&invalid),
                Err(Error::Storage(_))
            ));
            assert_eq!(storage.load_plan()?, plan);
        }
        Ok(())
    }

    #[test]
    fn deleting_a_recipe_cascades_without_touching_other_recipes_or_images(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let storage = SqliteStorage::new(db::open(directory.path())?);
        let removed = Recipe::default();
        let mut kept = Recipe::default();
        for recipe in [&removed, &kept] {
            storage.insert_recipe(recipe, &ImageChange::Keep)?;
        }
        let connection = db::open(directory.path())?;
        insert_image(&connection, removed.id, Uuid::new_v4())?;
        let version = Uuid::new_v4();
        insert_image(&connection, kept.id, version)?;
        kept.image_version = Some(version);
        let mut plan = WeeklyPlan {
            days: [
                vec![removed.id, kept.id, removed.id],
                vec![],
                vec![],
                vec![],
                vec![],
                vec![removed.id],
            ],
        };
        storage.save_plan(&plan)?;
        plan.drop_recipe(removed.id);
        storage.delete_recipe(removed.id)?;
        assert_eq!(storage.load_recipes()?, vec![kept.clone()]);
        assert_eq!(storage.load_plan()?, plan);
        let image_recipes = connection
            .prepare("SELECT recipe_id FROM images")?
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        assert_eq!(image_recipes, vec![kept.id.to_string()]);
        assert_eq!(
            storage.delete_recipe(removed.id),
            Err(Error::NotFound(removed.id))
        );
        Ok(())
    }

    #[test]
    fn failed_image_writes_roll_back_the_entire_recipe_change() -> crate::test_support::TestResult {
        let directory = tempfile::tempdir()?;
        let connection = db::open(directory.path())?;
        let storage = SqliteStorage::new(db::open(directory.path())?);
        let original = Recipe {
            image_version: Some(Uuid::new_v4()),
            ..Recipe::default()
        };
        let image = ResizedImage {
            bytes: vec![1],
            width: 1,
            height: 1,
        };
        storage.insert_recipe(&original, &ImageChange::Set(image.clone()))?;
        connection.execute_batch(
        "CREATE TRIGGER reject_image BEFORE INSERT ON images BEGIN SELECT RAISE(ABORT, 'image failed'); END;
         CREATE TRIGGER reject_remove BEFORE DELETE ON images BEGIN SELECT RAISE(ABORT, 'remove failed'); END;"
    )?;
        let mut edited = Recipe {
            title: "Changed".into(),
            image_version: Some(Uuid::new_v4()),
            ..original.clone()
        };
        let replacement = ImageChange::Set(ResizedImage {
            bytes: vec![2],
            ..image.clone()
        });
        let new_recipe = Recipe {
            id: Uuid::new_v4(),
            ..edited.clone()
        };
        assert!(storage.insert_recipe(&new_recipe, &replacement).is_err());
        assert!(storage.update_recipe(&edited, &replacement).is_err());
        edited.image_version = None;
        assert!(storage
            .update_recipe(&edited, &ImageChange::Remove)
            .is_err());
        assert_eq!(storage.load_recipes()?, vec![original.clone()]);
        assert_eq!(storage.load_image(original.id)?, Some(image));
        Ok(())
    }
}
