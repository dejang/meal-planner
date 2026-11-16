use meal_planner_core::Result;
use tauri::State;

use crate::settings::{Credentials, Settings};

#[tauri::command]
#[specta::specta]
pub fn get_credentials(settings: State<'_, Settings>) -> Result<Credentials> {
    settings.get_credentials()
}

#[tauri::command]
#[specta::specta]
pub fn save_credentials(settings: State<'_, Settings>, credentials: Credentials) -> Result<()> {
    settings.save_credentials(credentials)
}
