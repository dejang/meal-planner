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
            .map_err(Error::storage)?;
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
            .map_err(Error::storage)
    }

    pub fn save_credentials(&self, credentials: Credentials) -> Result<()> {
        let store = self.store.lock()?;
        let key = "edamam";
        let value = serde_json::to_value(credentials).map_err(Error::storage)?;
        let previous = store.get(key);
        store.set(key, value);
        if let Err(error) = store.save() {
            match previous {
                Some(value) => store.set(key, value),
                None => {
                    store.delete(key);
                }
            }
            return Err(Error::storage(error));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{Credentials, Settings};
    use crate::test_support::{mock_app, TestResult};

    #[test]
    fn failed_credential_saves_preserve_the_previous_value() -> TestResult {
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
}
