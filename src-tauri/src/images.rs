use std::error::Error as _;
use std::sync::Mutex;

use meal_planner_core::{image::resize_image, App, Error, ImageStore, ResizedImage, Result};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::{http, Manager, Runtime, UriSchemeContext, UriSchemeResponder};
use uuid::Uuid;

pub struct LocalImages {
    connection: Mutex<Connection>,
}

impl LocalImages {
    pub fn new(connection: Connection) -> Self {
        Self {
            connection: Mutex::new(connection),
        }
    }
}

impl ImageStore for LocalImages {
    fn put(&self, recipe_id: Uuid, image: &ResizedImage) -> Result<Uuid> {
        let version = Uuid::new_v4();
        self.connection
            .lock()?
            .execute(
                "INSERT INTO images (id, recipe_id, width, height, data, version)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(recipe_id) DO UPDATE SET
             width = excluded.width, height = excluded.height,
             data = excluded.data, version = excluded.version",
                params![
                    Uuid::new_v4().to_string(),
                    recipe_id.to_string(),
                    image.width,
                    image.height,
                    image.bytes,
                    version.to_string(),
                ],
            )
            .map_err(Error::storage)?;
        Ok(version)
    }

    fn get(&self, recipe_id: Uuid) -> Result<Option<ResizedImage>> {
        self.connection
            .lock()?
            .query_row(
                "SELECT data, width, height FROM images WHERE recipe_id = ?1",
                [recipe_id.to_string()],
                |row| {
                    Ok(ResizedImage {
                        bytes: row.get(0)?,
                        width: row.get(1)?,
                        height: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(Error::storage)
    }

    fn remove(&self, recipe_id: Uuid) -> Result<()> {
        self.connection
            .lock()?
            .execute(
                "DELETE FROM images WHERE recipe_id = ?1",
                [recipe_id.to_string()],
            )
            .map_err(Error::storage)?;
        Ok(())
    }
}

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
mod tests;
