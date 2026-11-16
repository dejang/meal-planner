use std::sync::PoisonError;

use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type, thiserror::Error)]
#[serde(tag = "kind", content = "detail", rename_all = "snake_case")]
pub enum Error {
    #[error("Recipe not found: {0}")]
    NotFound(Uuid),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    #[error("Storage error: {0}")]
    Storage(String),
    #[error("Image error: {0}")]
    Image(String),
    #[error("Analysis error: {0}")]
    Analysis(String),
    #[error("Import error: {0}")]
    Import(String),
    #[error("Application state lock poisoned")]
    LockPoisoned,
}

impl From<image::ImageError> for Error {
    fn from(error: image::ImageError) -> Self {
        Self::Image(error.to_string())
    }
}

impl<T> From<PoisonError<T>> for Error {
    fn from(_: PoisonError<T>) -> Self {
        Self::LockPoisoned
    }
}
