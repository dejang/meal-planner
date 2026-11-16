mod schema;

use std::time::Duration;

use async_trait::async_trait;
use meal_planner_core::{
    image::resize_image, Error, ImportedRecipe, RecipeImporter, Result, SupportedSite,
};
use reqwest::Client;
use url::Url;

pub struct JsonLdExtractor {
    client: Client,
}

impl JsonLdExtractor {
    pub fn new() -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent(concat!("MealPlanner/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| Error::Import(format!("Could not create HTTP client: {error}")))?;
        Ok(Self { client })
    }
}

#[async_trait]
impl RecipeImporter for JsonLdExtractor {
    async fn import(&self, url: &str) -> Result<ImportedRecipe> {
        let url =
            Url::parse(url.trim()).map_err(|_| Error::Import("Enter a valid recipe URL".into()))?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err(Error::Import("Recipe URLs must use HTTP or HTTPS".into()));
        }
        let host = url
            .host_str()
            .ok_or_else(|| Error::Import("Recipe URL does not contain a domain".into()))?;
        let host = host.strip_prefix("www.").unwrap_or(host);
        if !self
            .supported_sites()
            .iter()
            .any(|site| site.domains.iter().any(|domain| domain == host))
        {
            return Err(Error::Import(format!(
                "Recipes from {host} are not supported yet"
            )));
        }
        let download_failed =
            |error: reqwest::Error| Error::Import(format!("Could not download recipe: {error}"));
        let response = self.client.get(url).send().await.map_err(download_failed)?;
        if response.status() != reqwest::StatusCode::OK {
            return Err(Error::Import(format!(
                "Recipe site returned HTTP status {}",
                response.status().as_u16()
            )));
        }
        let bytes = response.bytes().await.map_err(download_failed)?;
        let html = std::str::from_utf8(&bytes)
            .map_err(|_| Error::Import("Recipe page was not valid UTF-8".into()))?;
        let (mut recipe, image_url) =
            schema::extract_json_ld_recipe(html).map_err(Error::Import)?;
        if let Some(image_url) = image_url {
            if let Ok(response) = self.client.get(image_url).send().await {
                if response.status().is_success() {
                    if let Ok(bytes) = response.bytes().await {
                        recipe.image =
                            tauri::async_runtime::spawn_blocking(move || resize_image(&bytes))
                                .await
                                .ok()
                                .and_then(std::result::Result::ok);
                    }
                }
            }
        }
        Ok(recipe)
    }

    fn supported_sites(&self) -> Vec<SupportedSite> {
        [
            (
                "Healthy Fitness Meals",
                vec!["healthyfitnessmeals.com", "healthyfitnessrecipes.com"],
            ),
            ("Spanish Sabores", vec!["spanishsabores.com"]),
        ]
        .into_iter()
        .map(|(name, domains)| SupportedSite {
            name: name.into(),
            domains: domains.into_iter().map(str::to_string).collect(),
        })
        .collect()
    }
}

#[cfg(test)]
mod tests;
