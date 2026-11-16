#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod edamam;
mod images;
mod importer;
mod settings;
mod storage;

use std::sync::Arc;

use meal_planner_core::App;
use tauri::Manager;

fn setup_state<R: tauri::Runtime>(app: &tauri::App<R>) -> meal_planner_core::Result<()> {
    app.manage(App::new(
        Arc::new(storage::SqliteStorage),
        Arc::new(images::LocalImages),
        Arc::new(edamam::EdamamClient),
        Arc::new(importer::JsonLdExtractor),
    )?);
    app.manage(settings::Settings);
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(debug_assertions)]
    if std::env::args().any(|arg| arg == "--export-bindings") {
        commands::export::<tauri::Wry>(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../ui/src/api/bindings.ts"
        ))?;
        return Ok(());
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("image", images::protocol_handler)
        .invoke_handler(commands::builder().invoke_handler())
        .setup(|app| {
            setup_state(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};
    use tauri::{
        ipc::{CallbackFn, InvokeBody},
        test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY},
        webview::InvokeRequest,
        WebviewUrl, WebviewWindowBuilder,
    };

    #[test]
    fn bindings_are_current() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("bindings.ts");
        crate::commands::export::<tauri::test::MockRuntime>(&path).unwrap();
        assert_eq!(
            std::fs::read_to_string(path).unwrap(),
            include_str!("../../ui/src/api/bindings.ts"),
            "Run pnpm --dir ui run bindings:generate and include the generated file"
        );
    }

    #[test]
    fn registered_commands_dispatch_against_the_desktop_state() {
        let app = mock_builder()
            .invoke_handler(crate::commands::builder().invoke_handler())
            .build(mock_context(noop_assets()))
            .unwrap();
        crate::setup_state(&app).unwrap();
        let window = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default())
            .build()
            .unwrap();
        let id = "00000000-0000-0000-0000-000000000001";
        let input = json!({
            "title": "Soup", "ingredients": "carrot", "instructions": "Cook", "servings": 2,
            "analysis": null, "image": {"kind": "keep"}
        });
        let position = json!({"day": 0, "row": 0});
        let empty_plan = json!({"days": [[], [], [], [], [], []]});
        let cases = [
            (
                "create_recipe",
                json!({"input": input}),
                Err(json!({"kind":"not_implemented", "detail":"Insert recipe storage"})),
            ),
            (
                "update_recipe",
                json!({"id": id, "input": input}),
                Err(json!({"kind":"not_found", "detail":id})),
            ),
            (
                "get_recipe",
                json!({"id": id}),
                Err(json!({"kind":"not_found", "detail":id})),
            ),
            ("search_recipes", json!({"query": "soup"}), Ok(json!([]))),
            ("list_recipes", json!({}), Ok(json!([]))),
            (
                "delete_recipe",
                json!({"id": id}),
                Err(json!({"kind":"not_found", "detail":id})),
            ),
            ("get_plan", json!({}), Ok(empty_plan)),
            (
                "add_to_day",
                json!({"position": position, "recipeId": id}),
                Err(json!({"kind":"not_found", "detail":id})),
            ),
            (
                "move_meal",
                json!({"from": position, "to": position}),
                Err(json!({"kind":"invalid_input", "detail":"Row 0 is outside day 0"})),
            ),
            (
                "remove_from_day",
                json!({"position": position}),
                Err(json!({"kind":"invalid_input", "detail":"Row 0 is outside day 0"})),
            ),
            (
                "clear_day",
                json!({"day": 0}),
                Err(json!({"kind":"not_implemented", "detail":"Plan storage"})),
            ),
            (
                "copy_previous_day",
                json!({"day": 1}),
                Err(json!({"kind":"not_implemented", "detail":"Plan storage"})),
            ),
            (
                "day_totals",
                json!({"day": 0}),
                Ok(serde_json::to_value(meal_planner_core::DayTotals::default()).unwrap()),
            ),
            ("shopping_list", json!({}), Ok(json!([]))),
            (
                "import_recipe",
                json!({"url": "https://example.test/recipe"}),
                Err(json!({"kind":"not_implemented", "detail":"Recipe import"})),
            ),
            ("supported_sites", json!({}), Ok(json!([]))),
            (
                "analyze_ingredients",
                json!({"lines": ["1 carrot"]}),
                Err(json!({"kind":"not_implemented", "detail":"Ingredient analysis"})),
            ),
            (
                "image",
                json!({"recipeId": id}),
                Err(json!({"kind":"not_implemented", "detail":"Read image"})),
            ),
            (
                "load_image_file",
                json!({"path": "/tmp/recipe.jpg"}),
                Err(json!({"kind":"not_implemented", "detail":"Load image file"})),
            ),
            (
                "load_image_url",
                json!({"url": "https://example.test/recipe.jpg"}),
                Err(json!({"kind":"not_implemented", "detail":"Load image URL"})),
            ),
            (
                "get_credentials",
                json!({}),
                Err(json!({"kind":"not_implemented", "detail":"Read credentials"})),
            ),
            (
                "save_credentials",
                json!({"credentials": {"app_id": "app", "api_key": "key"}}),
                Err(json!({"kind":"not_implemented", "detail":"Save credentials"})),
            ),
        ];
        for (cmd, payload, expected) in cases {
            let response = get_ipc_response(
                &window,
                InvokeRequest {
                    cmd: cmd.into(),
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse().unwrap(),
                    body: InvokeBody::Json(payload),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.into(),
                },
            )
            .map(|body| body.deserialize::<Value>().unwrap());
            assert_eq!(response, expected, "{cmd}");
        }
    }
}
