mod schema;

use async_trait::async_trait;
use meal_planner_core::{Error, ImportedRecipe, RecipeImporter, Result, SupportedSite};
use reqwest::Client;
use url::Url;

pub struct JsonLdExtractor {
    client: Client,
}

impl JsonLdExtractor {
    pub fn new(client: Client) -> Self {
        Self { client }
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
            recipe.image = crate::images::load_url(&self.client, &image_url).await.ok();
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
