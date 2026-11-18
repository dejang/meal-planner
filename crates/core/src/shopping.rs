use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;

use crate::{Recipe, Result};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Type)]
pub struct ShoppingItem {
    pub food_id: String,
    pub name: String,
    pub weight: f32,
}

pub(crate) fn shopping_list<'a>(
    meals: impl Iterator<Item = Result<&'a Recipe>>,
) -> Result<Vec<ShoppingItem>> {
    let mut list = HashMap::new();
    for meal in meals {
        let recipe = meal?;
        let Some(analysis) = &recipe.analysis else {
            continue;
        };
        for ingredient in &analysis.ingredients {
            let Some(food) = ingredient.parsed.as_ref().and_then(|parsed| parsed.first()) else {
                continue;
            };
            let item = list
                .entry(food.food_id.clone())
                .or_insert_with(|| ShoppingItem {
                    food_id: food.food_id.clone(),
                    name: food.food.clone(),
                    weight: 0.0,
                });
            item.weight += food.weight / recipe.servings as f32;
        }
    }
    let mut items: Vec<ShoppingItem> = list.into_values().collect();
    items.sort_unstable_by(|left, right| left.food_id.cmp(&right.food_id));
    items.sort_by_cached_key(|item| item.name.to_lowercase());
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AnalysisResponse, Ingredient, ParsedNutrient};

    fn food(id: &str, name: &str, weight: f32) -> ParsedNutrient {
        ParsedNutrient {
            quantity: 1.0,
            measure: None,
            food_match: None,
            food: name.into(),
            food_id: id.into(),
            weight,
            retained_weight: 999.0,
            nutrients: Default::default(),
            measure_uri: None,
            status: "OK".into(),
        }
    }

    #[test]
    fn shopping_list_groups_first_parses_by_food_and_sorts_by_name() -> crate::Result<()> {
        let first = Recipe {
            servings: 2,
            analysis: Some(AnalysisResponse {
                ingredients: vec![
                    Ingredient {
                        text: "two alternatives".into(),
                        parsed: Some(vec![
                            food("z", "apple", 100.5),
                            food("ignored", "wrong", 900.0),
                        ]),
                    },
                    Ingredient {
                        text: "same id again".into(),
                        parsed: Some(vec![food("z", "renamed apple", 20.0)]),
                    },
                    Ingredient {
                        text: "unparsed".into(),
                        parsed: None,
                    },
                    Ingredient {
                        text: "empty".into(),
                        parsed: Some(vec![]),
                    },
                    Ingredient {
                        text: "same name different id".into(),
                        parsed: Some(vec![food("a", "APPLE", 40.0)]),
                    },
                    Ingredient {
                        text: "last alphabetically".into(),
                        parsed: Some(vec![food("b", "Zucchini", 60.0)]),
                    },
                ],
                ..Default::default()
            }),
            ..Default::default()
        };
        let second = Recipe {
            servings: 4,
            analysis: Some(AnalysisResponse {
                ingredients: vec![Ingredient {
                    text: "more apple".into(),
                    parsed: Some(vec![food("z", "another name", 81.0)]),
                }],
                ..Default::default()
            }),
            ..Default::default()
        };
        let unanalyzed = Recipe::default();
        let meals = [&first, &unanalyzed, &second, &first];
        let items = shopping_list(meals.into_iter().map(Ok))?;
        assert_eq!(
            items
                .iter()
                .map(|item| (item.food_id.as_str(), item.name.as_str()))
                .collect::<Vec<_>>(),
            vec![("a", "APPLE"), ("z", "apple"), ("b", "Zucchini")]
        );
        for (item, expected_weight) in items.iter().zip([40.0, 140.75, 60.0]) {
            assert!((item.weight - expected_weight).abs() < 0.001);
        }
        Ok(())
    }
}
