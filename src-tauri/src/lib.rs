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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(concat!("MealPlanner/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| {
            meal_planner_core::Error::Image(format!("Cannot create download client: {error}"))
        })?;
    app.manage(App::new(
        Arc::new(storage::SqliteStorage::new(connection)),
        Arc::new(edamam::EdamamClient::new(settings.clone())?),
        Arc::new(importer::JsonLdExtractor::new(client.clone())),
    )?);
    app.manage(client);
    app.manage(settings);
    Ok(())
}

#[cfg(debug_assertions)]
pub use commands::export as export_bindings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| panic!("Cannot run Meal Planner application: {error}"));
}

#[cfg(test)]
mod test_support {
    use tauri::test::{mock_builder, mock_context, noop_assets};

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
}
