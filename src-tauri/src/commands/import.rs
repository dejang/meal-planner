use meal_planner_core::{App, ImportedRecipe, Result, SupportedSite};
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn import_recipe(app: State<'_, App>, url: String) -> Result<ImportedRecipe> {
    app.import_recipe(&url).await
}

#[tauri::command]
#[specta::specta]
pub fn supported_sites(app: State<'_, App>) -> Vec<SupportedSite> {
    app.supported_sites()
}
