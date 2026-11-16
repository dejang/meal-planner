use meal_planner_core::{App, ResizedImage, Result};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub async fn load_image_file(path: String) -> Result<ResizedImage> {
    crate::images::load_file(&path).await
}

#[tauri::command]
#[specta::specta]
pub async fn load_image_url(url: String) -> Result<ResizedImage> {
    crate::images::load_url(&url).await
}

#[tauri::command]
#[specta::specta]
pub fn image(app: State<'_, App>, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
    app.image(recipe_id)
}
