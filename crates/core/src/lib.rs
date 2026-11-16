mod app;
mod compute;
mod error;
#[cfg(any(test, feature = "fakes"))]
pub mod fakes;
pub mod image;
mod plan;
mod recipe_store;
mod traits;
mod types;

pub use app::App;
pub use error::{Error, Result};
pub use traits::{ImageStore, NutritionalAnalyzer, RecipeImporter, Storage};
pub use types::*;

#[cfg(test)]
mod tests {
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };

    use crate::{
        fakes::{FakeAnalyzer, FakeImporter, FakeStorage},
        AnalysisResponse, App, Error, ImageStore, Recipe, Result, Storage, WeeklyPlan,
    };
    use uuid::Uuid;

    pub(crate) fn app(storage: Arc<dyn Storage>, images: Arc<dyn ImageStore>) -> App {
        App::new(
            storage,
            images,
            Arc::new(FakeAnalyzer::new(Ok(AnalysisResponse::default()))),
            Arc::new(FakeImporter::new(
                Err(Error::Import("Unused".into())),
                vec![],
            )),
        )
        .unwrap()
    }

    #[derive(Default)]
    pub(crate) struct FailingStorage {
        inner: FakeStorage,
        pub(crate) fail_writes: AtomicBool,
    }

    impl FailingStorage {
        fn check_write(&self) -> Result<()> {
            if self.fail_writes.load(Ordering::SeqCst) {
                Err(Error::Storage("Write failed".into()))
            } else {
                Ok(())
            }
        }
    }

    impl Storage for FailingStorage {
        fn load_recipes(&self) -> Result<Vec<Recipe>> {
            self.inner.load_recipes()
        }

        fn insert_recipe(&self, recipe: &Recipe) -> Result<()> {
            self.check_write()?;
            self.inner.insert_recipe(recipe)
        }

        fn update_recipe(&self, recipe: &Recipe) -> Result<()> {
            self.check_write()?;
            self.inner.update_recipe(recipe)
        }

        fn delete_recipe(&self, id: Uuid, plan: &WeeklyPlan) -> Result<()> {
            self.check_write()?;
            self.inner.delete_recipe(id, plan)
        }

        fn load_plan(&self) -> Result<WeeklyPlan> {
            self.inner.load_plan()
        }

        fn save_plan(&self, plan: &WeeklyPlan) -> Result<()> {
            self.check_write()?;
            self.inner.save_plan(plan)
        }
    }
}
