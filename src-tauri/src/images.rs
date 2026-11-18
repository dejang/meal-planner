use std::error::Error as _;

use meal_planner_core::{image::resize_image, App, Error, ResizedImage, Result};
use tauri::{http, Manager, Runtime, UriSchemeContext, UriSchemeResponder};
use uuid::Uuid;

pub async fn load_file(path: &str) -> Result<ResizedImage> {
    let bytes = tokio::fs::read(path)
        .await
        .map_err(|error| Error::Image(format!("Cannot read image file '{path}': {error}")))?;
    resize(bytes).await
}

pub async fn load_url(client: &reqwest::Client, url: &str) -> Result<ResizedImage> {
    let parsed_url = url::Url::parse(url)
        .map_err(|error| Error::Image(format!("Invalid image URL '{url}': {error}")))?;
    let response = client
        .get(parsed_url)
        .send()
        .await
        .map_err(|error| download_error("Cannot download image", error))?;
    if !response.status().is_success() {
        return Err(Error::Image(format!(
            "Cannot download image: HTTP {}",
            response.status()
        )));
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|error| download_error("Cannot read downloaded image", error))?;
    resize(bytes.to_vec()).await
}

fn download_error(context: &str, error: reqwest::Error) -> Error {
    let mut message = format!("{context}: {error}");
    let mut source = error.source();
    while let Some(cause) = source {
        message.push_str(": ");
        message.push_str(&cause.to_string());
        source = cause.source();
    }
    Error::Image(message)
}

async fn resize(bytes: Vec<u8>) -> Result<ResizedImage> {
    tauri::async_runtime::spawn_blocking(move || resize_image(&bytes))
        .await
        .map_err(|error| Error::Image(format!("Cannot resize image: {error}")))?
}

pub fn protocol_handler<R: Runtime>(
    context: UriSchemeContext<'_, R>,
    request: http::Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = context.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        responder.respond(protocol_response(app.state::<App>().inner(), &request));
    });
}

fn protocol_response(app: &App, request: &http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let image = match Uuid::parse_str(request.uri().path().trim_start_matches('/')) {
        Ok(id) => app.image(id),
        Err(_) => Ok(None),
    };
    let (status, content_type, body) = match image {
        Ok(Some(image)) => (http::StatusCode::OK, "image/jpeg", image.bytes),
        Ok(None) => (
            http::StatusCode::NOT_FOUND,
            "text/plain; charset=utf-8",
            Vec::new(),
        ),
        Err(error) => (
            http::StatusCode::INTERNAL_SERVER_ERROR,
            "text/plain; charset=utf-8",
            error.to_string().into_bytes(),
        ),
    };
    let mut response = http::Response::new(body);
    *response.status_mut() = status;
    response.headers_mut().insert(
        http::header::CONTENT_TYPE,
        http::HeaderValue::from_static(content_type),
    );
    response
}

#[cfg(test)]
mod tests {
    use super::protocol_response;
    use crate::{storage::SqliteStorage, test_support::TestResult};
    use meal_planner_core::{ImageChange, Recipe, ResizedImage, Storage};
    use tauri::{http, Manager};
    use uuid::Uuid;

    #[test]
    fn protocol_serves_platform_urls_and_reports_missing_images_and_storage_errors() -> TestResult {
        let directory = tempfile::tempdir()?;
        let app = crate::test_support::mock_app()?;
        crate::setup_state(&app, directory.path())?;
        let connection = crate::db::open(directory.path())?;
        let storage = SqliteStorage::new(crate::db::open(directory.path())?);
        let recipe = Recipe {
            image_version: Some(Uuid::new_v4()),
            ..Recipe::default()
        };
        let id = recipe.id;
        let image = ResizedImage {
            bytes: vec![255, 216, 255],
            width: 1,
            height: 1,
        };
        storage.insert_recipe(&recipe, &ImageChange::Set(image.clone()))?;
        for origin in [
            "image://localhost",
            "http://image.localhost",
            "https://image.localhost",
        ] {
            for (path, status) in [
                (format!("{id}?v=ignored"), http::StatusCode::OK),
                (Uuid::new_v4().to_string(), http::StatusCode::NOT_FOUND),
                ("invalid".into(), http::StatusCode::NOT_FOUND),
            ] {
                let request = http::Request::builder()
                    .uri(format!("{origin}/{path}"))
                    .body(Vec::new())?;
                let response =
                    protocol_response(app.state::<meal_planner_core::App>().inner(), &request);
                assert_eq!(response.status(), status);
                if status == http::StatusCode::OK {
                    assert_eq!(response.headers()[http::header::CONTENT_TYPE], "image/jpeg");
                    assert_eq!(response.body(), &image.bytes);
                }
            }
        }
        connection.execute("DROP TABLE images", [])?;
        let request = http::Request::builder()
            .uri(format!("image://localhost/{id}"))
            .body(Vec::new())?;
        let response = protocol_response(app.state::<meal_planner_core::App>().inner(), &request);
        assert_eq!(response.status(), http::StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(
            response.headers()[http::header::CONTENT_TYPE],
            "text/plain; charset=utf-8"
        );
        assert!(String::from_utf8(response.into_body())?.contains("no such table"));
        Ok(())
    }
}
