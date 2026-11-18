use meal_planner_core::{App, MealPosition, Result, WeeklyPlan};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
#[specta::specta]
pub fn get_plan(app: State<'_, App>) -> Result<WeeklyPlan> {
    app.get_plan()
}

#[tauri::command]
#[specta::specta]
pub fn add_to_day(
    app: State<'_, App>,
    position: MealPosition,
    recipe_id: Uuid,
) -> Result<WeeklyPlan> {
    app.add_recipe_to_plan(position, recipe_id)
}

#[tauri::command]
#[specta::specta]
pub fn move_meal(app: State<'_, App>, from: MealPosition, to: MealPosition) -> Result<WeeklyPlan> {
    app.move_meal(from, to)
}

#[tauri::command]
#[specta::specta]
pub fn remove_from_day(app: State<'_, App>, position: MealPosition) -> Result<WeeklyPlan> {
    app.remove_from_day(position)
}

#[tauri::command]
#[specta::specta]
pub fn clear_day(app: State<'_, App>, day: u32) -> Result<WeeklyPlan> {
    app.clear_day(day)
}

#[tauri::command]
#[specta::specta]
pub fn copy_previous_day(app: State<'_, App>, day: u32) -> Result<WeeklyPlan> {
    app.copy_previous_day(day)
}
