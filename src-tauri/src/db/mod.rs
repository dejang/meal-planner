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
mod tests;
