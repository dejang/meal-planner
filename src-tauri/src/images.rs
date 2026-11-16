use meal_planner_core::{Error, ImageStore, ResizedImage, Result};
use tauri::{http, Runtime, UriSchemeContext, UriSchemeResponder};
use uuid::Uuid;

pub struct LocalImages;

impl ImageStore for LocalImages {
    fn put(&self, _recipe_id: Uuid, _image: &ResizedImage) -> Result<()> {
        Err(Error::NotImplemented("Save image".into()))
    }

    fn get(&self, _recipe_id: Uuid) -> Result<Option<ResizedImage>> {
        Err(Error::NotImplemented("Read image".into()))
    }

    fn remove(&self, _recipe_id: Uuid) -> Result<()> {
        Err(Error::NotImplemented("Remove image".into()))
    }
}

pub async fn load_file(_path: &str) -> Result<ResizedImage> {
    Err(Error::NotImplemented("Load image file".into()))
}

pub async fn load_url(_url: &str) -> Result<ResizedImage> {
    Err(Error::NotImplemented("Load image URL".into()))
}

pub fn protocol_handler<R: Runtime>(
    _context: UriSchemeContext<'_, R>,
    _request: http::Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let mut response = http::Response::new(
        Error::NotImplemented("Image protocol".into())
            .to_string()
            .into_bytes(),
    );
    *response.status_mut() = http::StatusCode::NOT_IMPLEMENTED;
    response.headers_mut().insert(
        http::header::CONTENT_TYPE,
        http::HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    responder.respond(response);
}
