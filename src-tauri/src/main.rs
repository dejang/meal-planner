#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod edamam;
mod images;
mod importer;
mod settings;
mod storage;

use std::sync::Arc;

use meal_planner_core::App;
use tauri::Manager;

fn setup_state<R: tauri::Runtime>(
    app: &tauri::App<R>,
    app_data_dir: &std::path::Path,
) -> meal_planner_core::Result<()> {
    let connection = db::open(app_data_dir)?;
    let settings = Arc::new(settings::Settings::new(app, app_data_dir)?);
    app.manage(App::new(
        Arc::new(storage::SqliteStorage::new(connection)),
        Arc::new(images::LocalImages),
        Arc::new(edamam::EdamamClient::new(settings.clone())?),
        Arc::new(importer::JsonLdExtractor),
    )?);
    app.manage(settings);
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
            setup_state(app, &app.path().app_data_dir()?)?;
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

    fn mock_app() -> tauri::App<tauri::test::MockRuntime> {
        mock_builder()
            .plugin(tauri_plugin_store::Builder::default().build())
            .invoke_handler(crate::commands::builder().invoke_handler())
            .build(mock_context(noop_assets()))
            .unwrap()
    }

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
        let directory = tempfile::tempdir().unwrap();
        let app = mock_app();
        crate::setup_state(&app, directory.path()).unwrap();
        assert!(directory.path().join("meal_planner.sqlite").is_file());
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
                Ok(json!({"days": [[], [], [], [], [], []]})),
            ),
            (
                "copy_previous_day",
                json!({"day": 1}),
                Ok(json!({"days": [[], [], [], [], [], []]})),
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
                Err(json!({"kind":"analysis", "detail":"Edamam credentials are missing"})),
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
                Ok(json!({"app_id": "", "api_key": ""})),
            ),
            (
                "save_credentials",
                json!({"credentials": {"app_id": "app", "api_key": "key"}}),
                Ok(Value::Null),
            ),
            (
                "get_credentials",
                json!({}),
                Ok(json!({"app_id": "app", "api_key": "key"})),
            ),
        ];
        let request = |cmd: &str, payload| InvokeRequest {
            cmd: cmd.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "tauri://localhost".parse().unwrap(),
            body: InvokeBody::Json(payload),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.into(),
        };
        for (cmd, payload, expected) in cases {
            let response = get_ipc_response(&window, request(cmd, payload))
                .map(|body| body.deserialize::<Value>().unwrap());
            assert_eq!(response, expected, "{cmd}");
        }
        let created = get_ipc_response(&window, request("create_recipe", json!({"input": input})))
            .unwrap()
            .deserialize::<meal_planner_core::Recipe>()
            .unwrap();
        let storage =
            crate::storage::SqliteStorage::new(crate::db::open(directory.path()).unwrap());
        assert_eq!(
            meal_planner_core::Storage::load_recipes(&storage).unwrap(),
            vec![created]
        );
        assert!(directory.path().join("settings.json").is_file());
        let reopened_app = mock_app();
        let settings = crate::settings::Settings::new(&reopened_app, directory.path()).unwrap();
        assert_eq!(
            settings.get_credentials().unwrap(),
            crate::settings::Credentials {
                app_id: "app".into(),
                api_key: "key".into(),
            }
        );
    }

    #[test]
    fn failed_credential_saves_preserve_the_previous_value() {
        use crate::settings::{Credentials, Settings};
        for previous in [
            None,
            Some(Credentials {
                app_id: "old-app".into(),
                api_key: "old-key".into(),
            }),
        ] {
            let directory = tempfile::tempdir().unwrap();
            let app = mock_app();
            let settings = Settings::new(&app, directory.path()).unwrap();
            let path = directory.path().join("settings.json");
            if let Some(credentials) = previous.clone() {
                settings.save_credentials(credentials).unwrap();
                std::fs::remove_file(&path).unwrap();
            }
            std::fs::create_dir(&path).unwrap();
            assert!(matches!(
                settings.save_credentials(Credentials {
                    app_id: "new-app".into(),
                    api_key: "new-key".into(),
                }),
                Err(meal_planner_core::Error::Storage(_))
            ));
            assert_eq!(
                settings.get_credentials().unwrap(),
                previous.unwrap_or_default()
            );
        }
    }
}
