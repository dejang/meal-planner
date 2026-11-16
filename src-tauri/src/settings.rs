use std::{
    path::Path,
    sync::{Arc, Mutex},
};

use meal_planner_core::{Error, Result};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri_plugin_store::{Store, StoreExt};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct Credentials {
    pub app_id: String,
    pub api_key: String,
}

pub struct Settings<R: tauri::Runtime> {
    store: Mutex<Arc<Store<R>>>,
}

impl<R: tauri::Runtime> Settings<R> {
    pub fn new(app: &tauri::App<R>, app_data_dir: &Path) -> Result<Self> {
        let store = app
            .store_builder(app_data_dir.join("settings.json"))
            .disable_auto_save()
            .build()
            .map_err(storage_error)?;
        Ok(Self {
            store: Mutex::new(store),
        })
    }

    pub fn get_credentials(&self) -> Result<Credentials> {
        let store = self.store.lock()?;
        store
            .get("edamam")
            .map(serde_json::from_value)
            .transpose()
            .map(|credentials| credentials.unwrap_or_default())
            .map_err(storage_error)
    }

    pub fn save_credentials(&self, credentials: Credentials) -> Result<()> {
        let store = self.store.lock()?;
        let key = "edamam";
        let value = serde_json::to_value(credentials).map_err(storage_error)?;
        let previous = store.get(key);
        store.set(key, value);
        if let Err(error) = store.save() {
            match previous {
                Some(value) => store.set(key, value),
                None => {
                    store.delete(key);
                }
            }
            return Err(storage_error(error));
        }
        Ok(())
    }
}

fn storage_error(error: impl std::fmt::Display) -> Error {
    Error::Storage(error.to_string())
}
