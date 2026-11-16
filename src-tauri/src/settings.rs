use meal_planner_core::{Error, Result};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
pub struct Credentials {
    pub app_id: String,
    pub api_key: String,
}

pub struct Settings;

impl Settings {
    pub fn get_credentials(&self) -> Result<Credentials> {
        Err(Error::NotImplemented("Read credentials".into()))
    }

    pub fn save_credentials(&self, _credentials: Credentials) -> Result<()> {
        Err(Error::NotImplemented("Save credentials".into()))
    }
}
