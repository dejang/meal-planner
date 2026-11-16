use meal_planner_core::{App, Recipe, RecipeInput, Result};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn create_recipe(app: State<'_, App>, input: RecipeInput) -> Result<Recipe> {
    app.create_recipe(input)
}

#[tauri::command]
#[specta::specta]
pub fn update_recipe(app: State<'_, App>, id: Uuid, input: RecipeInput) -> Result<Recipe> {
    app.update_recipe(id, input)
}

#[tauri::command]
#[specta::specta]
pub fn get_recipe(app: State<'_, App>, id: Uuid) -> Result<Recipe> {
    app.get_recipe(id)
}

#[tauri::command]
#[specta::specta]
pub fn search_recipes(app: State<'_, App>, query: String) -> Result<Vec<Recipe>> {
    app.search_recipes(&query)
}

#[tauri::command]
#[specta::specta]
pub fn list_recipes(app: State<'_, App>) -> Result<Vec<Recipe>> {
    app.list_recipes()
}

#[tauri::command]
#[specta::specta]
pub fn delete_recipe(app: State<'_, App>, id: Uuid) -> Result<()> {
    app.delete_recipe(id)
}
