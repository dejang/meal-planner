use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct Recipe {
    pub id: Uuid,
    pub title: String,
    pub ingredients: String,
    pub instructions: String,
    pub servings: u32,
    pub analysis: Option<AnalysisResponse>,
    pub image_version: Option<Uuid>,
}

impl Default for Recipe {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            title: String::new(),
            ingredients: String::new(),
            instructions: String::new(),
            servings: 1,
            analysis: None,
            image_version: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct RecipeInput {
    pub title: String,
    pub ingredients: String,
    pub instructions: String,
    pub servings: u32,
    pub analysis: Option<AnalysisResponse>,
    pub image: ImageChange,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "image", rename_all = "snake_case")]
pub enum ImageChange {
    Keep,
    Remove,
    Set(ResizedImage),
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct WeeklyPlan {
    pub days: [Vec<Uuid>; 6],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct MealPosition {
    pub day: u32,
    pub row: u32,
}

impl WeeklyPlan {
    pub fn drop_recipe(&mut self, id: Uuid) {
        for day in &mut self.days {
            day.retain(|recipe_id| *recipe_id != id);
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct ImportedRecipe {
    pub title: String,
    pub ingredients: Vec<String>,
    pub instructions: Vec<String>,
    pub servings: u32,
    pub image: Option<ResizedImage>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct ResizedImage {
    #[serde(with = "base64_bytes")]
    #[specta(type = String)]
    pub bytes: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

mod base64_bytes {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&STANDARD.encode(bytes))
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
        STANDARD
            .decode(String::deserialize(deserializer)?)
            .map_err(serde::de::Error::custom)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct SupportedSite {
    pub name: String,
    pub domains: Vec<String>,
}

pub type DayTotals = AnalysisResponse;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct ShoppingItem {
    pub food_id: String,
    pub name: String,
    pub weight: f32,
}

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct Nutrient {
    pub label: String,
    pub quantity: f32,
    pub unit: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct Ingredient {
    pub text: String,
    pub parsed: Option<Vec<ParsedNutrient>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ParsedNutrient {
    pub quantity: f32,
    pub measure: Option<String>,
    pub food_match: Option<String>,
    pub food: String,
    pub food_id: String,
    pub weight: f32,
    pub retained_weight: f32,
    pub nutrients: HashMap<String, Nutrient>,
    #[serde(rename = "measureURI")]
    pub measure_uri: Option<String>,
    pub status: String,
}

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub uri: String,
    #[serde(rename = "yield", alias = "_yield")]
    pub yield_amount: f32,
    pub calories: i32,
    #[serde(rename = "totalCO2Emissions")]
    pub total_co2_emissions: f32,
    pub co2_emissions_class: String,
    pub total_weight: f32,
    pub diet_labels: Vec<String>,
    pub health_labels: Vec<String>,
    pub cautions: Vec<String>,
    pub total_nutrients: HashMap<String, Nutrient>,
    pub total_daily: HashMap<String, Nutrient>,
    pub ingredients: Vec<Ingredient>,
    pub cuisine_type: Vec<String>,
    pub meal_type: Vec<String>,
    pub dish_type: Vec<String>,
    #[serde(rename = "totalNutrientsKCal")]
    pub total_nutrients_kcal: HashMap<String, Nutrient>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};

    #[test]
    fn ipc_preserves_edamam_keys_and_encodes_images_as_base64() {
        let wire: Value =
            serde_json::from_str(include_str!("../tests/fixtures/analysis.json")).unwrap();
        let analysis: AnalysisResponse = serde_json::from_value(wire.clone()).unwrap();
        assert_wire_equal(&serde_json::to_value(&analysis).unwrap(), &wire);
        let mut legacy = wire;
        let yield_value = legacy.as_object_mut().unwrap().remove("yield").unwrap();
        legacy["_yield"] = yield_value;
        assert_eq!(
            serde_json::from_value::<AnalysisResponse>(legacy).unwrap(),
            analysis
        );

        let image = ResizedImage {
            bytes: vec![255, 216, 255],
            width: 2,
            height: 3,
        };
        let wire = json!({"bytes": "/9j/", "width": 2, "height": 3});
        assert_eq!(serde_json::to_value(&image).unwrap(), wire);
        assert_eq!(serde_json::from_value::<ResizedImage>(wire).unwrap(), image);
        assert!(serde_json::from_value::<ResizedImage>(
            json!({"bytes":"!", "width":2, "height":3})
        )
        .is_err());
    }

    fn assert_wire_equal(actual: &Value, expected: &Value) {
        match (actual, expected) {
            (Value::Number(actual), Value::Number(expected)) => {
                assert_eq!(
                    actual.as_f64().unwrap() as f32,
                    expected.as_f64().unwrap() as f32
                );
            }
            (Value::Object(actual), Value::Object(expected)) => {
                assert!(actual.keys().eq(expected.keys()));
                for (key, expected) in expected {
                    assert_wire_equal(&actual[key], expected);
                }
            }
            (Value::Array(actual), Value::Array(expected)) => {
                assert_eq!(actual.len(), expected.len());
                for (actual, expected) in actual.iter().zip(expected) {
                    assert_wire_equal(actual, expected);
                }
            }
            _ => assert_eq!(actual, expected),
        }
    }

    #[test]
    fn drop_recipe_removes_every_occurrence_without_reordering_other_meals() {
        let removed = Uuid::new_v4();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut plan = WeeklyPlan {
            days: [
                vec![removed, first, removed, second],
                vec![removed, removed],
                vec![],
                vec![second, first],
                vec![first, removed],
                vec![removed],
            ],
        };
        plan.drop_recipe(removed);
        assert_eq!(
            plan.days,
            [
                vec![first, second],
                vec![],
                vec![],
                vec![second, first],
                vec![first],
                vec![]
            ]
        );
        let snapshot = plan.clone();
        plan.drop_recipe(removed);
        assert_eq!(plan, snapshot);
    }
}
