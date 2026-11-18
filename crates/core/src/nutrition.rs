use std::collections::HashMap;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{Recipe, Result};

#[async_trait]
pub trait NutritionalAnalyzer: Send + Sync {
    async fn analyze(&self, lines: &[String]) -> Result<AnalysisResponse>;
}

pub type DayTotals = AnalysisResponse;

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

pub(crate) fn day_totals<'a>(meals: impl Iterator<Item = Result<&'a Recipe>>) -> Result<DayTotals> {
    let mut total = DayTotals::default();
    for meal in meals {
        let recipe = meal?;
        if let Some(analysis) = &recipe.analysis {
            total.calories += (i64::from(analysis.calories) / i64::from(recipe.servings)) as i32;
            accumulate_nutrients(
                &mut total.total_nutrients,
                &analysis.total_nutrients,
                recipe.servings,
            );
            accumulate_nutrients(
                &mut total.total_daily,
                &analysis.total_daily,
                recipe.servings,
            );
        }
    }
    Ok(total)
}

fn accumulate_nutrients(
    total: &mut HashMap<String, Nutrient>,
    source: &HashMap<String, Nutrient>,
    servings: u32,
) {
    let codes = [
        "FAT", "FASAT", "FATRN", "CHOLE", "NA", "CHOCDF", "FIBTG", "SUGAR", "PROCNT", "VITA_RAE",
        "THIA", "RIBF", "NIA", "VITB6A", "VITB12", "VITC", "VITD", "TOCPHA", "VITK1", "CA", "MG",
        "ZN", "FE", "P", "K", "FOLDFE",
    ];
    let missing = Nutrient::default();
    for code in codes {
        let nutrient = source.get(code).unwrap_or(&missing);
        let entry = total.entry(code.to_owned()).or_default();
        entry.quantity += nutrient.quantity / servings as f32;
        entry.label.clone_from(&nutrient.label);
        entry.unit.clone_from(&nutrient.unit);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn analysis_preserves_edamam_keys_and_accepts_legacy_yield(
    ) -> std::result::Result<(), Box<dyn std::error::Error>> {
        let wire: Value = serde_json::from_str(include_str!("../tests/fixtures/analysis.json"))?;
        let analysis: AnalysisResponse = serde_json::from_value(wire.clone())?;
        assert_wire_equal(&serde_json::to_value(&analysis)?, &wire);
        let mut legacy = wire;
        let yield_value = legacy
            .as_object_mut()
            .and_then(|obj| obj.remove("yield"))
            .ok_or("fixture is missing yield")?;
        legacy["_yield"] = yield_value;
        assert_eq!(
            serde_json::from_value::<AnalysisResponse>(legacy)?,
            analysis
        );
        Ok(())
    }

    fn assert_wire_equal(actual: &Value, expected: &Value) {
        match (actual, expected) {
            (Value::Number(actual), Value::Number(expected)) => {
                assert_eq!(
                    actual.as_f64().map(|n| n as f32),
                    expected.as_f64().map(|n| n as f32)
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

    fn nutrient(label: &str, quantity: f32, unit: &str) -> Nutrient {
        Nutrient {
            label: label.into(),
            quantity,
            unit: unit.into(),
        }
    }

    #[test]
    fn day_totals_count_each_serving_and_skip_unanalyzed_recipes() -> crate::Result<()> {
        let codes = [
            "FAT", "FASAT", "FATRN", "CHOLE", "NA", "CHOCDF", "FIBTG", "SUGAR", "PROCNT",
            "VITA_RAE", "THIA", "RIBF", "NIA", "VITB6A", "VITB12", "VITC", "VITD", "TOCPHA",
            "VITK1", "CA", "MG", "ZN", "FE", "P", "K", "FOLDFE",
        ];
        let mut first_analysis = AnalysisResponse {
            calories: 101,
            total_weight: 900.0,
            diet_labels: vec!["not merged".into()],
            ..Default::default()
        };
        let mut second_analysis = AnalysisResponse {
            calories: 99,
            ..Default::default()
        };
        for (index, code) in codes.iter().enumerate() {
            let n = (index + 1) as f32;
            first_analysis
                .total_nutrients
                .insert((*code).into(), nutrient("first", 8.0 * n, "g"));
            first_analysis
                .total_daily
                .insert((*code).into(), nutrient("first daily", 12.0 * n, "%"));
            if *code != "FAT" {
                second_analysis
                    .total_nutrients
                    .insert((*code).into(), nutrient("second", 4.0 * n, "mg"));
                second_analysis
                    .total_daily
                    .insert((*code).into(), nutrient("second daily", 8.0 * n, "%"));
            }
        }
        first_analysis
            .total_nutrients
            .insert("ignored".into(), nutrient("ignored", 100.0, "g"));
        let first = Recipe {
            servings: 2,
            analysis: Some(first_analysis),
            ..Default::default()
        };
        let second = Recipe {
            servings: 4,
            analysis: Some(second_analysis),
            ..Default::default()
        };
        let unanalyzed = Recipe::default();
        for meals in [vec![&unanalyzed], vec![]] {
            assert_eq!(
                day_totals(meals.into_iter().map(Ok))?,
                AnalysisResponse::default()
            );
        }
        for (meals, calories, quantity, daily, fat, fat_daily, newest) in [
            (
                vec![&first, &second, &unanalyzed],
                74,
                5.0,
                8.0,
                4.0,
                6.0,
                "second",
            ),
            (vec![&first, &first], 100, 8.0, 12.0, 8.0, 12.0, "first"),
            (vec![&second, &first], 74, 5.0, 8.0, 4.0, 6.0, "first"),
            (vec![&second], 24, 1.0, 2.0, 0.0, 0.0, "second"),
        ] {
            let mut expected = AnalysisResponse {
                calories,
                ..Default::default()
            };
            for (index, code) in codes.iter().enumerate() {
                let n = (index + 1) as f32;
                let missing = *code == "FAT" && newest == "second";
                expected.total_nutrients.insert(
                    (*code).into(),
                    nutrient(
                        if missing { "" } else { newest },
                        if *code == "FAT" { fat } else { quantity * n },
                        if missing {
                            ""
                        } else if newest == "first" {
                            "g"
                        } else {
                            "mg"
                        },
                    ),
                );
                expected.total_daily.insert(
                    (*code).into(),
                    nutrient(
                        if missing {
                            ""
                        } else if newest == "first" {
                            "first daily"
                        } else {
                            "second daily"
                        },
                        if *code == "FAT" { fat_daily } else { daily * n },
                        if missing { "" } else { "%" },
                    ),
                );
            }
            assert_eq!(day_totals(meals.into_iter().map(Ok))?, expected);
        }
        Ok(())
    }
}
