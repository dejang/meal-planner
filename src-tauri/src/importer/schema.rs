use meal_planner_core::ImportedRecipe;
use scraper::{Html, Selector};
use serde_json::{Map, Value};

pub(super) fn extract_json_ld_recipe(
    html: &str,
) -> Result<(ImportedRecipe, Option<String>), String> {
    let document = Html::parse_document(html);
    let selector = Selector::parse(r#"script[type="application/ld+json"]"#)
        .map_err(|error| format!("Could not parse recipe JSON-LD selector: {error}"))?;

    let schema = document
        .select(&selector)
        .filter_map(|script| serde_json::from_str::<Value>(&script.inner_html()).ok())
        .find_map(find_recipe)
        .ok_or_else(|| "The page did not contain structured recipe data".to_string())?;

    let title = schema
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .ok_or_else(|| "Recipe title was missing".to_string())?
        .to_string();

    let ingredients = schema
        .get("recipeIngredient")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|ingredient| !ingredient.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|ingredients| !ingredients.is_empty())
        .ok_or_else(|| "Recipe ingredients were missing".to_string())?;

    let mut instructions = Vec::new();
    if let Some(value) = schema.get("recipeInstructions") {
        collect_instructions(value, &mut instructions);
    }
    if instructions.is_empty() {
        return Err("Recipe instructions were missing".to_string());
    }

    let image_url = schema
        .get("image")
        .and_then(first_image_url)
        .map(str::to_string);

    Ok((
        ImportedRecipe {
            title,
            ingredients,
            instructions,
            image: None,
            servings: schema
                .get("recipeYield")
                .and_then(first_positive_integer)
                .unwrap_or(1),
        },
        image_url,
    ))
}

fn find_recipe(value: Value) -> Option<Map<String, Value>> {
    match value {
        Value::Object(object) => {
            let is_recipe = match object.get("@type") {
                Some(Value::String(value)) => value == "Recipe",
                Some(Value::Array(values)) => {
                    values.iter().any(|value| value.as_str() == Some("Recipe"))
                }
                _ => false,
            };
            if is_recipe {
                return Some(object);
            }
            object.into_values().find_map(find_recipe)
        }
        Value::Array(values) => values.into_iter().find_map(find_recipe),
        _ => None,
    }
}

fn collect_instructions(value: &Value, instructions: &mut Vec<String>) {
    match value {
        Value::String(text) => push_non_empty(text, instructions),
        Value::Array(values) => {
            for value in values {
                collect_instructions(value, instructions);
            }
        }
        Value::Object(object) => {
            if let Some(text) = object.get("text").and_then(Value::as_str) {
                push_non_empty(text, instructions);
            } else if let Some(items) = object.get("itemListElement") {
                collect_instructions(items, instructions);
            }
        }
        _ => {}
    }
}

fn push_non_empty(text: &str, values: &mut Vec<String>) {
    let text = text.trim();
    if !text.is_empty() {
        values.push(text.to_string());
    }
}

fn first_image_url(value: &Value) -> Option<&str> {
    match value {
        Value::String(url) => Some(url),
        Value::Array(values) => values.iter().find_map(first_image_url),
        Value::Object(object) => object
            .get("url")
            .or_else(|| object.get("contentUrl"))
            .and_then(first_image_url),
        _ => None,
    }
}

fn first_positive_integer(value: &Value) -> Option<u32> {
    match value {
        Value::Number(number) => number.as_u64().and_then(|value| u32::try_from(value).ok()),
        Value::String(text) => text
            .split(|character: char| !character.is_ascii_digit())
            .find(|part| !part.is_empty())
            .and_then(|part| part.parse().ok()),
        Value::Array(values) => values.iter().find_map(first_positive_integer),
        _ => None,
    }
    .filter(|value| *value > 0)
}
