use async_trait::async_trait;
use meal_planner_core::{AnalysisResponse, Error, NutritionalAnalyzer, Result};

pub struct EdamamClient;

#[async_trait]
impl NutritionalAnalyzer for EdamamClient {
    async fn analyze(&self, _lines: &[String]) -> Result<AnalysisResponse> {
        Err(Error::NotImplemented("Ingredient analysis".into()))
    }
}
