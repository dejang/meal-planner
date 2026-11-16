mod analysis;
mod compute;
mod images;
mod import;
mod plan;
mod recipes;
mod settings;

#[cfg(any(debug_assertions, test))]
pub fn export<R: tauri::Runtime>(
    path: impl AsRef<std::path::Path>,
) -> Result<(), Box<dyn std::error::Error>> {
    builder::<R>().export(specta_typescript::Typescript::default(), path)?;
    Ok(())
}

pub fn builder<R: tauri::Runtime>() -> tauri_specta::Builder<R> {
    tauri_specta::Builder::new()
        .disable_serde_phases()
        .commands(tauri_specta::collect_commands![
            recipes::create_recipe,
            recipes::update_recipe,
            recipes::get_recipe,
            recipes::search_recipes,
            recipes::list_recipes,
            recipes::delete_recipe,
            plan::get_plan,
            plan::add_to_day,
            plan::move_meal,
            plan::remove_from_day,
            plan::clear_day,
            plan::copy_previous_day,
            compute::day_totals,
            compute::shopping_list,
            import::import_recipe,
            import::supported_sites,
            analysis::analyze_ingredients,
            images::image,
            images::load_image_file,
            images::load_image_url,
            settings::get_credentials::<tauri::Wry>,
            settings::save_credentials::<tauri::Wry>,
        ])
}
