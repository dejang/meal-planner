use std::sync::Arc;

use meal_planner_core::Result;
use tauri::{AppHandle, Manager};

use crate::settings::{Credentials, Settings};

#[tauri::command]
#[specta::specta]
pub fn get_credentials<R: tauri::Runtime>(app: AppHandle<R>) -> Result<Credentials> {
    app.state::<Arc<Settings<R>>>().get_credentials()
}

#[tauri::command]
#[specta::specta]
pub fn save_credentials<R: tauri::Runtime>(
    app: AppHandle<R>,
    credentials: Credentials,
) -> Result<()> {
    app.state::<Arc<Settings<R>>>()
        .save_credentials(credentials)
}
