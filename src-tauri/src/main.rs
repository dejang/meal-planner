#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    if std::env::args().any(|arg| arg == "--export-bindings") {
        meal_planner_desktop_lib::export_bindings::<tauri::Wry>(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../ui/src/api/bindings.ts"
        ))?;
        return Ok(());
    }

    meal_planner_desktop_lib::run();
    Ok(())
}
