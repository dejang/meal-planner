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
mod tests {
    use std::{collections::HashMap, time::Duration};

    use meal_planner_core::{image::resize_image, Error, ImportedRecipe, RecipeImporter, Result};
    use serde_json::{json, Value};

    use super::JsonLdExtractor;

    fn import_from_server(
        responses: impl FnOnce(u16) -> Vec<(u16, Vec<u8>)>,
        url: impl FnOnce(u16) -> String,
    ) -> Result<ImportedRecipe> {
        let (address, server) = crate::test_support::serve_http(responses, |_| {})
            .unwrap_or_else(|error| panic!("start local recipe server: {error}"));
        let mut builder = reqwest::Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(3));
        let mut importer = JsonLdExtractor::new(reqwest::Client::new());
        for domain in importer
            .supported_sites()
            .into_iter()
            .flat_map(|site| site.domains)
        {
            builder = builder
                .resolve(&domain, address)
                .resolve(&format!("www.{domain}"), address);
        }
        importer.client = builder
            .build()
            .unwrap_or_else(|error| panic!("build local recipe HTTP client: {error}"));
        let result = tauri::async_runtime::block_on(importer.import(&url(address.port())));
        server
            .join()
            .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
            .unwrap_or_else(|error| panic!("serve recipe HTTP response: {error}"));
        result
    }

    fn recipe_schema() -> Value {
        json!({
            "@type": "Recipe",
            "name": "Soup",
            "recipeIngredient": ["carrot"],
            "recipeInstructions": "Cook"
        })
    }

    fn page(schema: Value) -> Vec<u8> {
        format!(r#"<script type="application/ld+json">{schema}</script>"#).into_bytes()
    }

    #[test]
    fn rejects_invalid_and_lookalike_urls() {
        let importer = JsonLdExtractor::new(reqwest::Client::new());
        for (url, message) in [
            ("not a URL", "Enter a valid recipe URL"),
            (
                "ftp://spanishsabores.com/recipe",
                "Recipe URLs must use HTTP or HTTPS",
            ),
            (
                "https://example.com/recipe",
                "Recipes from example.com are not supported yet",
            ),
            (
                "https://spanishsabores.com.evil.test/recipe",
                "Recipes from spanishsabores.com.evil.test are not supported yet",
            ),
            (
                "https://spanishsabores.com@evil.test/recipe",
                "Recipes from evil.test are not supported yet",
            ),
            (
                "https://www.www.spanishsabores.com/recipe",
                "Recipes from www.spanishsabores.com are not supported yet",
            ),
        ] {
            assert_eq!(
                tauri::async_runtime::block_on(importer.import(url)),
                Err(Error::Import(message.into()))
            );
        }
    }

    #[test]
    fn reports_page_failures() {
        for (status, body, message) in [
            (404, vec![], "Recipe site returned HTTP status 404"),
            (201, vec![], "Recipe site returned HTTP status 201"),
            (200, vec![255], "Recipe page was not valid UTF-8"),
            (
                200,
                b"<script type=\"application/ld+json\">invalid</script>".to_vec(),
                "The page did not contain structured recipe data",
            ),
        ] {
            assert_eq!(
                import_from_server(
                    |_| vec![(status, body)],
                    |port| format!("http://spanishsabores.com:{port}/"),
                ),
                Err(Error::Import(message.into()))
            );
        }
        let result = import_from_server(
            |_| Vec::new(),
            |port| format!("http://spanishsabores.com:{port}/"),
        );
        assert!(matches!(result, Err(Error::Import(message))
        if message.starts_with("Could not download recipe: ")));
    }

    #[test]
    fn validates_structured_recipe_fields() {
        for (field, value, message) in [
            ("name", json!(" "), "Recipe title was missing"),
            (
                "recipeIngredient",
                json!([null, " "]),
                "Recipe ingredients were missing",
            ),
            (
                "recipeInstructions",
                json!([null, {"text":" "}]),
                "Recipe instructions were missing",
            ),
        ] {
            let mut schema = recipe_schema();
            schema[field] = value;
            assert_eq!(
                import_from_server(
                    |_| vec![(200, page(schema))],
                    |port| format!("http://spanishsabores.com:{port}/"),
                ),
                Err(Error::Import(message.into()))
            );
        }
    }

    #[test]
    fn extracts_nested_schema_and_normalizes_fields() {
        for (yield_value, servings) in [
            (json!(3), 3),
            (json!([0, "6 servings"]), 6),
            (json!(null), 1),
        ] {
            let schema = json!([{"nested":{"@type":["Thing", "Recipe"], "name":" Soup ",
            "recipeIngredient":[null, " carrot ", " "], "recipeYield":yield_value,
            "recipeInstructions":[" Chop ", {"itemListElement":[{"text":" Cook "}]}]}}]);
            let recipe = import_from_server(
                |_| {
                    vec![(
                        200,
                        format!(
                            r#"<script type="application/ld+json">invalid</script>
            <script type="application/ld+json">{{"@type":"WebPage"}}</script>
            <script type="application/ld+json">{schema}</script>
            <script type="application/ld+json">{{"@type":"Recipe","name":"Ignored"}}</script>"#
                        )
                        .into_bytes(),
                    )]
                },
                |port| format!("http://spanishsabores.com:{port}/"),
            )
            .unwrap_or_else(|error| {
                panic!("import nested schema with yield {yield_value}: {error}")
            });
            assert_eq!(recipe.title, "Soup");
            assert_eq!(recipe.ingredients, ["carrot"]);
            assert_eq!(recipe.instructions, ["Chop", "Cook"]);
            assert_eq!(recipe.servings, servings);
            assert_eq!(recipe.image, None);
        }
    }

    #[test]
    fn image_failures_do_not_fail_the_import() {
        for (image, response) in [
            (None, None),
            (Some(json!(null)), None),
            (Some(json!("invalid URL")), None),
            (Some(json!({"url":"LOCAL"})), Some((404, vec![]))),
            (
                Some(json!({"contentUrl":"LOCAL"})),
                Some((200, b"not an image".to_vec())),
            ),
        ] {
            let recipe = import_from_server(
                |port| {
                    let mut schema = recipe_schema();
                    if let Some(image) = image {
                        schema["image"] = serde_json::from_str(
                            &image
                                .to_string()
                                .replace("LOCAL", &format!("http://127.0.0.1:{port}/image")),
                        )
                        .unwrap_or_else(|error| panic!("parse local image URL fixture: {error}"));
                    }
                    let mut responses = vec![(200, page(schema))];
                    responses.extend(response);
                    responses
                },
                |port| format!("http://spanishsabores.com:{port}/"),
            )
            .unwrap_or_else(|error| panic!("import recipe despite failed image: {error}"));
            assert_eq!(recipe.title, "Soup");
            assert_eq!(recipe.image, None);
        }
    }

    #[test]
    fn imports_registered_sites_with_resized_images() {
        let image = include_bytes!("fixtures/wide.png");
        let expected_image =
            resize_image(image).unwrap_or_else(|error| panic!("resize wide.png fixture: {error}"));
        assert_eq!((expected_image.width, expected_image.height), (1200, 1));
        let importer = JsonLdExtractor::new(reqwest::Client::new());
        let sites: HashMap<_, _> = importer
            .supported_sites()
            .into_iter()
            .map(|site| (site.name, site.domains))
            .collect();
        for (name, fixture, image_domain, expected) in [
            (
                "Healthy Fitness Meals",
                include_str!("fixtures/healthy_fitness_meals.html"),
                "https://healthyfitnessmeals.com",
                ImportedRecipe {
                    title: "Cottage Cheese Scrambled Eggs".into(),
                    ingredients: vec![
                        "5 large eggs".into(),
                        "1/2 cup cottage cheese".into(),
                        "1 tbsp olive oil".into(),
                    ],
                    instructions: vec![
                        "Whisk the eggs and cottage cheese.".into(),
                        "Heat the oil in a pan.".into(),
                    ],
                    servings: 2,
                    image: Some(expected_image.clone()),
                },
            ),
            (
                "Spanish Sabores",
                include_str!("fixtures/spanish_sabores.html"),
                "https://spanishsabores.com",
                ImportedRecipe {
                    title: "Spanish Cod and Potato Stew".into(),
                    ingredients: vec![
                        "1/4 cup extra virgin olive oil".into(),
                        "1 large onion (diced)".into(),
                        "1 pound dried salt cod (desalinated and chopped)".into(),
                        "4 medium red potatoes (peeled and cut in wedges)".into(),
                    ],
                    instructions: vec![
                        "Sauté the onion and leek in the olive oil.".into(),
                        "Add the cod and potatoes.".into(),
                        "Simmer until the potatoes are tender.".into(),
                    ],
                    servings: 4,
                    image: Some(expected_image.clone()),
                },
            ),
        ] {
            let domains = sites
                .get(name)
                .unwrap_or_else(|| panic!("fixture site {name} is not registered"));
            for domain in domains {
                for prefix in ["", "www."] {
                    let recipe = import_from_server(
                        |port| {
                            vec![
                                (
                                    200,
                                    fixture
                                        .replacen(
                                            image_domain,
                                            &format!("http://{domain}:{port}"),
                                            1,
                                        )
                                        .into_bytes(),
                                ),
                                (200, image.to_vec()),
                            ]
                        },
                        |port| format!(" http://{prefix}{domain}:{port}/recipe#recipe "),
                    )
                    .unwrap_or_else(|error| {
                        panic!("import {name} fixture from {prefix}{domain}: {error}")
                    });
                    assert_eq!(recipe, expected);
                }
            }
        }
    }
}
