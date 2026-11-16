use serde_json::{json, Value};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY},
    webview::InvokeRequest,
    WebviewUrl, WebviewWindowBuilder,
};

pub(super) fn mock_app() -> Result<tauri::App<tauri::test::MockRuntime>, tauri::Error> {
    mock_builder()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(crate::commands::builder().invoke_handler())
        .build(mock_context(noop_assets()))
}

pub(super) type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub(super) fn serve_http(
    responses: impl FnOnce(u16) -> Vec<(u16, Vec<u8>)>,
    check_request: impl Fn(&[u8]) + Send + 'static,
) -> TestResult<(
    std::net::SocketAddr,
    std::thread::JoinHandle<TestResult<()>>,
)> {
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
        time::{Duration, Instant},
    };

    let listener = TcpListener::bind("127.0.0.1:0")?;
    let address = listener.local_addr()?;
    listener.set_nonblocking(true)?;
    let responses = responses(address.port());
    let server = thread::spawn(move || {
        let mut request = Vec::new();
        for (status, body) in responses {
            let deadline = Instant::now() + Duration::from_secs(10);
            let mut stream = loop {
                match listener.accept() {
                    Ok((stream, _)) => break stream,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(Instant::now() < deadline, "HTTP request did not arrive");
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => return Err(error.into()),
                }
            };
            stream.set_nonblocking(false)?;
            stream.set_read_timeout(Some(Duration::from_secs(10)))?;
            stream.set_write_timeout(Some(Duration::from_secs(10)))?;
            request.clear();
            while !request.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                stream.read_exact(&mut byte)?;
                request.push(byte[0]);
            }
            check_request(&request);
            write!(
                stream,
                "HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )?;
            stream.write_all(&body)?;
        }
        Ok(())
    });
    Ok((address, server))
}

#[test]
fn bindings_are_current() -> TestResult {
    let directory = tempfile::tempdir()?;
    let path = directory.path().join("bindings.ts");
    crate::commands::export::<tauri::test::MockRuntime>(&path)
        .map_err(|error| error.to_string())?;
    assert_eq!(
        std::fs::read_to_string(path)?,
        include_str!("../../ui/src/api/bindings.ts"),
        "Run pnpm --dir ui run bindings:generate and include the generated file"
    );
    Ok(())
}

#[test]
fn registered_commands_dispatch_against_the_desktop_state() -> TestResult {
    let directory = tempfile::tempdir()?;
    let app = mock_app()?;
    crate::setup_state(&app, directory.path())?;
    assert!(directory.path().join("meal_planner.sqlite").is_file());
    let window = WebviewWindowBuilder::new(&app, "main", WebviewUrl::default()).build()?;
    let id = "00000000-0000-0000-0000-000000000001";
    let input = json!({
        "title": "Soup", "ingredients": "carrot", "instructions": "Cook", "servings": 2,
        "analysis": null, "image": {"kind": "keep"}
    });
    let position = json!({"day": 0, "row": 0});
    let empty_plan = json!({"days": [[], [], [], [], [], []]});
    let missing_image = directory.path().join("missing.jpg");
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
            Ok(serde_json::to_value(
                meal_planner_core::DayTotals::default(),
            )?),
        ),
        ("shopping_list", json!({}), Ok(json!([]))),
        (
            "import_recipe",
            json!({"url": "https://example.test/recipe"}),
            Err(
                json!({"kind":"import", "detail":"Recipes from example.test are not supported yet"}),
            ),
        ),
        (
            "supported_sites",
            json!({}),
            Ok(json!([
                {"name": "Healthy Fitness Meals", "domains": ["healthyfitnessmeals.com", "healthyfitnessrecipes.com"]},
                {"name": "Spanish Sabores", "domains": ["spanishsabores.com"]}
            ])),
        ),
        (
            "analyze_ingredients",
            json!({"lines": ["1 carrot"]}),
            Err(json!({"kind":"analysis", "detail":"Edamam credentials are missing"})),
        ),
        ("image", json!({"recipeId": id}), Ok(Value::Null)),
        (
            "load_image_file",
            json!({"path": missing_image.to_str().ok_or("Desktop test image path is not UTF-8")?}),
            Err(json!({"kind": "image", "detail": format!(
                "Cannot read image file '{}': {}",
                missing_image.display(),
                std::fs::read(&missing_image).unwrap_err(),
            )})),
        ),
        (
            "load_image_url",
            json!({"url": "not a url"}),
            Err(
                json!({"kind":"image", "detail":"Invalid image URL 'not a url': relative URL without a base"}),
            ),
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
    let url = "tauri://localhost".parse::<url::Url>()?;
    let request = |cmd: &str, payload| InvokeRequest {
        cmd: cmd.into(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url: url.clone(),
        body: InvokeBody::Json(payload),
        headers: Default::default(),
        invoke_key: INVOKE_KEY.into(),
    };
    for (cmd, payload, expected) in cases {
        let response = get_ipc_response(&window, request(cmd, payload)).map(|body| {
            body.deserialize::<Value>()
                .unwrap_or_else(|error| panic!("Invalid IPC response body for {cmd}: {error}"))
        });
        assert_eq!(response, expected, "{cmd}");
    }
    let created = get_ipc_response(&window, request("create_recipe", json!({"input": input})))
        .map_err(|error| format!("Create recipe IPC failed: {error}"))?
        .deserialize::<meal_planner_core::Recipe>()?;
    let storage = crate::storage::SqliteStorage::new(crate::db::open(directory.path())?);
    assert_eq!(
        meal_planner_core::Storage::load_recipes(&storage)?,
        vec![created]
    );
    assert!(directory.path().join("settings.json").is_file());
    let reopened_app = mock_app()?;
    let settings = crate::settings::Settings::new(&reopened_app, directory.path())?;
    assert_eq!(
        settings.get_credentials()?,
        crate::settings::Credentials {
            app_id: "app".into(),
            api_key: "key".into(),
        }
    );
    Ok(())
}

#[test]
fn failed_credential_saves_preserve_the_previous_value() -> TestResult {
    use crate::settings::{Credentials, Settings};
    for previous in [
        None,
        Some(Credentials {
            app_id: "old-app".into(),
            api_key: "old-key".into(),
        }),
    ] {
        let directory = tempfile::tempdir()?;
        let app = mock_app()?;
        let settings = Settings::new(&app, directory.path())?;
        let path = directory.path().join("settings.json");
        if let Some(credentials) = previous.clone() {
            settings.save_credentials(credentials)?;
            std::fs::remove_file(&path)?;
        }
        std::fs::create_dir(&path)?;
        assert!(matches!(
            settings.save_credentials(Credentials {
                app_id: "new-app".into(),
                api_key: "new-key".into(),
            }),
            Err(meal_planner_core::Error::Storage(_))
        ));
        assert_eq!(settings.get_credentials()?, previous.unwrap_or_default());
    }
    Ok(())
}
