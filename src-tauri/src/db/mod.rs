use std::path::Path;

use meal_planner_core::{Error, Result};
use rusqlite::{Connection, TransactionBehavior};

pub fn open(app_data_dir: &Path) -> Result<Connection> {
    std::fs::create_dir_all(app_data_dir).map_err(Error::storage)?;
    let mut connection =
        Connection::open(app_data_dir.join("meal_planner.sqlite")).map_err(Error::storage)?;
    connection
        .busy_timeout(std::time::Duration::from_secs(5))
        .map_err(Error::storage)?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(Error::storage)?;
    connection
        .pragma_update(None, "foreign_keys", true)
        .map_err(Error::storage)?;

    let migrations = [include_str!("migrations/001.sql")];
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(Error::storage)?;
    let version: u32 = transaction
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(Error::storage)?;
    if version as usize > migrations.len() {
        return Err(Error::Storage(format!(
            "Unsupported database schema version: {version}"
        )));
    }
    for (index, migration) in migrations.iter().enumerate().skip(version as usize) {
        transaction
            .execute_batch(migration)
            .map_err(Error::storage)?;
        transaction
            .pragma_update(None, "user_version", (index + 1) as u32)
            .map_err(Error::storage)?;
    }
    transaction.commit().map_err(Error::storage)?;
    Ok(connection)
}

#[cfg(test)]
mod tests {
    use rusqlite::{ffi, Error};

    use super::open;

    #[test]
    fn deleting_a_recipe_cascades_to_its_plan_and_image_only(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let connection = open(directory.path())?;
        connection.execute_batch(
            "INSERT INTO recipes VALUES ('removed', 0, 'Soup', 'Carrot', 'Cook', 2, NULL);
             INSERT INTO recipes VALUES ('kept', 1, 'Salad', 'Lettuce', 'Mix', 1, NULL);
             INSERT INTO plan VALUES (0, 0, 'removed'), (5, 0, 'removed'), (0, 1, 'kept');
             INSERT INTO images VALUES ('image1', 'removed', 1, 1, X'0102', 'version1');
             INSERT INTO images VALUES ('image2', 'kept', 2, 1, X'0304', 'version2');
             DELETE FROM recipes WHERE id = 'removed';",
        )?;

        let recipes: String =
            connection.query_row("SELECT group_concat(id) FROM recipes", [], |row| row.get(0))?;
        assert_eq!(recipes, "kept");
        let plan =
            connection.query_row("SELECT day, position, recipe_id FROM plan", [], |row| {
                Ok((
                    row.get::<_, u32>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
        assert_eq!(plan, (0, 1, "kept".into()));
        let image =
            connection.query_row("SELECT recipe_id, data, version FROM images", [], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Vec<u8>>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
        assert_eq!(image, ("kept".into(), vec![3, 4], "version2".into()));
        for table in ["plan", "images"] {
            let count: u32 =
                connection.query_row(&format!("SELECT count(*) FROM {table}"), [], |row| {
                    row.get(0)
                })?;
            assert_eq!(count, 1, "{table}");
        }
        Ok(())
    }

    #[test]
    fn concurrency_and_foreign_key_pragmas_are_active_on_every_open(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        for _ in 0..2 {
            let connection = open(directory.path())?;
            let journal_mode: String =
                connection.pragma_query_value(None, "journal_mode", |row| row.get(0))?;
            let busy_timeout: u32 =
                connection.pragma_query_value(None, "busy_timeout", |row| row.get(0))?;
            assert_eq!(journal_mode, "wal");
            assert_eq!(busy_timeout, 5000);
            match connection.execute(
                "INSERT INTO plan (day, position, recipe_id) VALUES (0, 0, 'unknown')",
                [],
            ) {
                Err(Error::SqliteFailure(error, _)) => {
                    assert_eq!(error.extended_code, ffi::SQLITE_CONSTRAINT_FOREIGNKEY);
                }
                other => panic!("Expected a foreign-key constraint failure, got {other:?}"),
            }
        }
        Ok(())
    }

    #[test]
    fn opening_waits_for_a_rollback_journal_lock_before_enabling_wal(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let connection = rusqlite::Connection::open(directory.path().join("meal_planner.sqlite"))?;
        connection.pragma_update(None, "journal_mode", "DELETE")?;
        connection.execute_batch(
            "CREATE TABLE existing_data (value TEXT); BEGIN; SELECT * FROM existing_data;",
        )?;
        let release = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(200));
            connection.execute_batch("COMMIT")
        });

        let opened = open(directory.path());
        release
            .join()
            .unwrap_or_else(|panic| std::panic::resume_unwind(panic))?;
        let connection = opened?;
        let journal_mode: String =
            connection.pragma_query_value(None, "journal_mode", |row| row.get(0))?;
        assert_eq!(journal_mode, "wal");
        Ok(())
    }

    #[test]
    fn newer_schema_versions_are_rejected() -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let connection = open(directory.path())?;
        let version: u32 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        connection.pragma_update(None, "user_version", version + 1)?;
        drop(connection);

        assert!(matches!(
            open(directory.path()),
            Err(meal_planner_core::Error::Storage(message))
                if message == format!("Unsupported database schema version: {}", version + 1)
        ));
        Ok(())
    }

    #[test]
    fn reopening_runs_migrations_idempotently_and_preserves_data(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let directory = tempfile::tempdir()?;
        let app_data_dir = directory.path().join("app-data");
        let connection = open(&app_data_dir)?;
        let analysis = r#"{"calories":123,"yield":2,"totalNutrients":{}}"#;
        connection.execute(
            "INSERT INTO recipes VALUES ('recipe', 4, 'Soup', 'Carrot', 'Cook', 2, ?1)",
            [analysis],
        )?;
        drop(connection);

        assert!(app_data_dir.join("meal_planner.sqlite").is_file());
        let connection = open(&app_data_dir)?;
        let version: u32 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
        assert_eq!(version, 1);
        let saved =
            connection.query_row("SELECT id, position, analysis FROM recipes", [], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })?;
        assert_eq!(saved, ("recipe".into(), 4, analysis.into()));
        Ok(())
    }
}
