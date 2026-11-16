use std::collections::HashMap;

use crate::{app::State, plan::day_index, DayTotals, Nutrient, Result, ShoppingItem};

pub(crate) fn day_totals(state: &State, day: u32) -> Result<DayTotals> {
    let day = day_index(&state.plan, day)?;
    let meals = &state.plan.days[day];
    let food_label_codes = [
        "FAT", "FASAT", "FATRN", "CHOLE", "NA", "CHOCDF", "FIBTG", "SUGAR", "PROCNT",
    ];
    let vitamins = [
        "VITA_RAE", "THIA", "RIBF", "NIA", "VITB6A", "VITB12", "VITC", "VITD", "TOCPHA", "VITK1",
    ];
    let minerals = ["CA", "MG", "ZN", "FE", "P", "K", "NA", "FOLDFE"];
    let default_nutrient = Nutrient::default();
    let mut total = DayTotals::default();
    for id in meals {
        let recipe = state.recipes.get(*id)?;
        let Some(analysis) = &recipe.analysis else {
            continue;
        };
        let mut merged = DayTotals {
            calories: analysis.calories / recipe.servings as i32 + total.calories,
            ..Default::default()
        };
        for code in food_label_codes.iter().chain(&vitamins).chain(&minerals) {
            for (source, previous, destination) in [
                (
                    &analysis.total_nutrients,
                    &total.total_nutrients,
                    &mut merged.total_nutrients,
                ),
                (
                    &analysis.total_daily,
                    &total.total_daily,
                    &mut merged.total_daily,
                ),
            ] {
                let nutrient = source.get(*code).unwrap_or(&default_nutrient);
                let previous = previous.get(*code).unwrap_or(&default_nutrient);
                destination.insert(
                    (*code).into(),
                    Nutrient {
                        label: nutrient.label.clone(),
                        quantity: nutrient.quantity / recipe.servings as f32 + previous.quantity,
                        unit: nutrient.unit.clone(),
                    },
                );
            }
        }
        total = merged;
    }
    Ok(total)
}

pub(crate) fn shopping_list(state: &State) -> Result<Vec<ShoppingItem>> {
    let mut list = HashMap::new();
    for id in state.plan.days.iter().flatten() {
        let recipe = state.recipes.get(*id)?;
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
    use std::sync::Arc;

    use crate::{
        fakes::{FakeAnalyzer, FakeImageStore, FakeImporter, FakeStorage},
        AnalysisResponse, App, Error, Ingredient, Nutrient, ParsedNutrient, Recipe, Storage,
        WeeklyPlan,
    };

    fn app(recipes: &[Recipe], plan: WeeklyPlan) -> App {
        let storage = Arc::new(FakeStorage::default());
        for recipe in recipes {
            storage.insert_recipe(recipe).unwrap();
        }
        storage.save_plan(&plan).unwrap();
        App::new(
            storage,
            Arc::new(FakeImageStore::default()),
            Arc::new(FakeAnalyzer::new(Ok(AnalysisResponse::default()))),
            Arc::new(FakeImporter::new(
                Err(Error::Import("unused".into())),
                vec![],
            )),
        )
        .unwrap()
    }

    fn nutrient(label: &str, quantity: f32, unit: &str) -> Nutrient {
        Nutrient {
            label: label.into(),
            quantity,
            unit: unit.into(),
        }
    }

    #[test]
    fn day_totals_match_legacy_per_serving_fold_and_skip_missing_analysis() {
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
        let plan = WeeklyPlan {
            days: [
                vec![first.id, second.id, unanalyzed.id],
                vec![first.id, first.id],
                vec![unanalyzed.id],
                vec![],
                vec![second.id, first.id],
                vec![second.id],
            ],
        };
        let app = app(&[first, second, unanalyzed], plan);
        for day in [2, 3] {
            assert_eq!(app.day_totals(day).unwrap(), AnalysisResponse::default());
        }
        for (day, calories, quantity, daily, fat, fat_daily, newest) in [
            (0, 74, 5.0, 8.0, 4.0, 6.0, "second"),
            (1, 100, 8.0, 12.0, 8.0, 12.0, "first"),
            (4, 74, 5.0, 8.0, 4.0, 6.0, "first"),
            (5, 24, 1.0, 2.0, 0.0, 0.0, "second"),
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
            assert_eq!(app.day_totals(day).unwrap(), expected, "day {day}");
        }
        for day in [6, u32::MAX] {
            assert!(matches!(app.day_totals(day), Err(Error::InvalidInput(_))));
        }
    }

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
    fn shopping_list_matches_legacy_first_parse_aggregation_and_name_order() {
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
        let plan = WeeklyPlan {
            days: [
                vec![first.id, unanalyzed.id],
                vec![],
                vec![],
                vec![],
                vec![],
                vec![second.id, first.id],
            ],
        };
        let app = app(&[first, second, unanalyzed], plan);
        let items = app.shopping_list().unwrap();
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
    }
}
