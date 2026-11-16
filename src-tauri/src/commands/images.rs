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
pub async fn load_image_url(
    client: State<'_, reqwest::Client>,
    url: String,
) -> Result<ResizedImage> {
    crate::images::load_url(&client, &url).await
}

#[tauri::command]
#[specta::specta]
pub fn image(app: State<'_, App>, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
    app.image(recipe_id)
}

#[cfg(test)]
mod tests;
