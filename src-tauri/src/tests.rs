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
    let dispatch = |window: &tauri::WebviewWindow<tauri::test::MockRuntime>, cmd: &str, payload| {
        get_ipc_response(
            window,
            InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: url.clone(),
                body: InvokeBody::Json(payload),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.into(),
            },
        )
        .map(|body| {
            body.deserialize::<Value>()
                .unwrap_or_else(|error| panic!("Invalid IPC response body for {cmd}: {error}"))
        })
    };
    for (cmd, payload, expected) in cases {
        assert_eq!(dispatch(&window, cmd, payload), expected, "{cmd}");
    }
    let dispatch_ok =
        |window: &tauri::WebviewWindow<tauri::test::MockRuntime>, cmd: &str, payload: Value| {
            let context = format!("{cmd} with payload {payload}");
            dispatch(window, cmd, payload).map_err(|error| format!("{context}: {error}"))
        };
    let image = dispatch_ok(
        &window,
        "load_image_file",
        json!({"path": concat!(env!("CARGO_MANIFEST_DIR"), "/src/importer/fixtures/wide.png")}),
    )?;
    let mut analyzed_input = input.clone();
    analyzed_input["analysis"] = serde_json::from_str(include_str!(
        "../../crates/core/tests/fixtures/analysis.json"
    ))?;
    analyzed_input["image"] = json!({"kind": "set", "image": image});
    let created = dispatch_ok(&window, "create_recipe", json!({"input": analyzed_input}))?;
    let created_id = &created["id"];
    assert!(created["image_version"].is_string());
    assert_eq!(
        dispatch_ok(&window, "image", json!({"recipeId": created_id}))?,
        image
    );
    let second = dispatch_ok(&window, "create_recipe", json!({"input": input}))?;
    let second_id = &second["id"];
    analyzed_input["title"] = json!("Salmon lunch");
    analyzed_input["image"] = json!({"kind": "keep"});
    let updated = dispatch_ok(
        &window,
        "update_recipe",
        json!({"id": created_id, "input": analyzed_input}),
    )?;
    assert_eq!(updated["title"], "Salmon lunch");
    assert_eq!(updated["image_version"], created["image_version"]);
    assert_eq!(
        dispatch_ok(&window, "search_recipes", json!({"query": "Salmon"}))?,
        json!([updated])
    );
    let mut plan = Value::Null;
    for (cmd, payload, days) in [
        (
            "add_to_day",
            json!({"position": position, "recipeId": created_id}),
            json!([[created_id], [], [], [], [], []]),
        ),
        (
            "add_to_day",
            json!({"position": {"day": 0, "row": 1}, "recipeId": second_id}),
            json!([[created_id, second_id], [], [], [], [], []]),
        ),
        (
            "move_meal",
            json!({"from": {"day": 0, "row": 1}, "to": position}),
            json!([[second_id, created_id], [], [], [], [], []]),
        ),
        (
            "copy_previous_day",
            json!({"day": 1}),
            json!([
                [second_id, created_id],
                [second_id, created_id],
                [],
                [],
                [],
                []
            ]),
        ),
        (
            "move_meal",
            json!({"from": {"day": 0, "row": 1}, "to": {"day": 2, "row": 0}}),
            json!([
                [second_id],
                [second_id, created_id],
                [created_id],
                [],
                [],
                []
            ]),
        ),
        (
            "clear_day",
            json!({"day": 0}),
            json!([[], [second_id, created_id], [created_id], [], [], []]),
        ),
        (
            "remove_from_day",
            json!({"position": {"day": 1, "row": 0}}),
            json!([[], [created_id], [created_id], [], [], []]),
        ),
    ] {
        plan = json!({"days": days});
        assert_eq!(dispatch_ok(&window, cmd, payload)?, plan, "{cmd}");
    }
    let totals = dispatch_ok(&window, "day_totals", json!({"day": 1}))?;
    assert_eq!(totals["calories"], 63);
    let shopping = dispatch_ok(&window, "shopping_list", json!({}))?;
    let items: Vec<meal_planner_core::ShoppingItem> = serde_json::from_value(shopping.clone())?;
    assert_eq!(items.len(), 7);
    let salmon_weight = items
        .iter()
        .find(|item| item.name == "smoked salmon")
        .ok_or("Missing salmon")?
        .weight;
    let expected_weight = 30.0_f32;
    assert!(
        (salmon_weight - expected_weight).abs() <= expected_weight * f32::EPSILON,
        "Expected {expected_weight} g of salmon, got {salmon_weight} g"
    );
    drop(window);
    drop(app);

    let reopened_app = mock_app()?;
    crate::setup_state(&reopened_app, directory.path())?;
    let window = WebviewWindowBuilder::new(&reopened_app, "main", WebviewUrl::default()).build()?;
    for (cmd, payload, expected) in [
        ("list_recipes", json!({}), json!([updated, second])),
        ("get_recipe", json!({"id": created_id}), updated),
        ("get_plan", json!({}), plan),
        ("image", json!({"recipeId": created_id}), image),
        ("day_totals", json!({"day": 1}), totals),
        ("shopping_list", json!({}), shopping),
        (
            "get_credentials",
            json!({}),
            json!({"app_id": "app", "api_key": "key"}),
        ),
    ] {
        assert_eq!(
            dispatch_ok(&window, cmd, payload)?,
            expected,
            "{cmd} after restart"
        );
    }
    dispatch_ok(&window, "delete_recipe", json!({"id": created_id}))?;
    assert_eq!(
        dispatch_ok(&window, "get_plan", json!({}))?,
        json!({"days": [[], [], [], [], [], []]})
    );
    assert_eq!(dispatch_ok(&window, "shopping_list", json!({}))?, json!([]));
    assert_eq!(
        dispatch_ok(&window, "list_recipes", json!({}))?,
        json!([second])
    );
    assert_eq!(
        dispatch_ok(&window, "image", json!({"recipeId": created_id}))?,
        Value::Null
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
