#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod edamam;
mod images;
mod importer;
mod settings;
mod storage;

use std::sync::{Arc, Mutex};

use meal_planner_core::App;
use tauri::Manager;

fn setup_state<R: tauri::Runtime>(
    app: &tauri::App<R>,
    app_data_dir: &std::path::Path,
) -> meal_planner_core::Result<()> {
    let connection = Arc::new(Mutex::new(db::open(app_data_dir)?));
    let settings = Arc::new(settings::Settings::new(app, app_data_dir)?);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(concat!("MealPlanner/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| {
            meal_planner_core::Error::Image(format!("Cannot create download client: {error}"))
        })?;
    app.manage(App::new(
        Arc::new(storage::SqliteStorage::new(connection.clone())),
        Arc::new(images::LocalImages::new(connection)),
        Arc::new(edamam::EdamamClient::new(settings.clone())?),
        Arc::new(importer::JsonLdExtractor::new(client.clone())),
    )?);
    app.manage(client);
    app.manage(settings);
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    if std::env::args().any(|arg| arg == "--export-bindings") {
        commands::export::<tauri::Wry>(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../ui/src/api/bindings.ts"
        ))?;
        return Ok(());
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("image", images::protocol_handler)
        .invoke_handler(commands::builder().invoke_handler())
        .setup(|app| {
            setup_state(app, &app.path().app_data_dir()?)?;
            Ok(())
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

#[cfg(test)]
mod tests;
