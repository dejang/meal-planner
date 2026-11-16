use meal_planner_core::{Error, Recipe, Storage, WeeklyPlan};
use rusqlite::{params, Connection};
use uuid::Uuid;

use super::SqliteStorage;
use crate::db;

fn insert_image(connection: &Connection, recipe_id: Uuid, version: Uuid) -> rusqlite::Result<()> {
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
    let storage = SqliteStorage::new(db::open(directory.path())?);
    let mut recipe = Recipe {
        title: "Soup 🥕".into(),
        ingredients: "1 carrot\nwater".into(),
        instructions: "Simmer\nServe".into(),
        servings: 2,
        analysis: Some(serde_json::from_str(include_str!(
            "../../../crates/core/tests/fixtures/analysis.json"
        ))?),
        image_version: Some(Uuid::new_v4()),
        ..Recipe::default()
    };
    storage.insert_recipe(&recipe)?;
    assert!(matches!(
        storage.insert_recipe(&recipe),
        Err(Error::Storage(_))
    ));
    recipe.image_version = None;
    assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);

    let connection = db::open(directory.path())?;
    let stored: String =
        connection.query_row("SELECT analysis FROM recipes", [], |row| row.get(0))?;
    assert_eq!(
        Some(serde_json::from_str::<meal_planner_core::AnalysisResponse>(
            &stored
        )?),
        recipe.analysis
    );
    let version = Uuid::new_v4();
    insert_image(&connection, recipe.id, version)?;
    recipe.image_version = Some(version);
    assert_eq!(storage.load_recipes()?, vec![recipe.clone()]);

    recipe.title = "Updated soup".into();
    recipe.ingredients = "2 carrots".into();
    recipe.instructions = "Boil".into();
    recipe.servings = 4;
    recipe.analysis = None;
    recipe.image_version = Some(Uuid::new_v4());
    storage.update_recipe(&recipe)?;
    recipe.image_version = Some(version);
    assert_eq!(storage.load_recipes()?, vec![recipe]);
    let analysis: Option<String> =
        connection.query_row("SELECT analysis FROM recipes", [], |row| row.get(0))?;
    assert_eq!(analysis, None);
    let missing = Recipe::default();
    assert_eq!(
        storage.update_recipe(&missing),
        Err(Error::NotFound(missing.id))
    );
    Ok(())
}

#[test]
fn recipe_order_survives_updates_deletion_and_reopening() -> Result<(), Box<dyn std::error::Error>>
{
    let directory = tempfile::tempdir()?;
    let storage = SqliteStorage::new(db::open(directory.path())?);
    let mut recipes = [(3, "Zulu"), (1, "Alpha"), (2, "Middle")].map(|(id, title)| Recipe {
        id: Uuid::from_u128(id),
        title: title.into(),
        ..Recipe::default()
    });
    for recipe in &recipes {
        storage.insert_recipe(recipe)?;
    }
    recipes[0].title = "Changed".into();
    storage.update_recipe(&recipes[0])?;
    storage.delete_recipe(recipes[1].id, &WeeklyPlan::default())?;
    let appended = Recipe::default();
    storage.insert_recipe(&appended)?;
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
        storage.insert_recipe(recipe)?;
    }
    let [a, b, c] = recipes.map(|recipe| recipe.id);
    let connection = db::open(directory.path())?;
    let mut statement =
        connection.prepare("SELECT day, position, recipe_id FROM plan ORDER BY day, position")?;
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
        storage.insert_recipe(recipe)?;
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
    storage.delete_recipe(removed.id, &plan)?;
    assert_eq!(storage.load_recipes()?, vec![kept.clone()]);
    assert_eq!(storage.load_plan()?, plan);
    let image_recipes = connection
        .prepare("SELECT recipe_id FROM images")?
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    assert_eq!(image_recipes, vec![kept.id.to_string()]);
    assert_eq!(
        storage.delete_recipe(removed.id, &plan),
        Err(Error::NotFound(removed.id))
    );
    Ok(())
}
