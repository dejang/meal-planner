use meal_planner_core::{App, DayTotals, Result, ShoppingItem};
use tauri::State;

#[tauri::command]
#[specta::specta]
pub fn day_totals(app: State<'_, App>, day: u32) -> Result<DayTotals> {
    app.day_totals(day)
}

#[tauri::command]
#[specta::specta]
pub fn shopping_list(app: State<'_, App>) -> Result<Vec<ShoppingItem>> {
    app.shopping_list()
}
