use meal_planner_core::{AnalysisResponse, App, Result};
use tauri::State;

#[tauri::command]
#[specta::specta]
pub async fn analyze_ingredients(
    app: State<'_, App>,
    lines: Vec<String>,
) -> Result<AnalysisResponse> {
    app.analyze_ingredients(&lines).await
}
