import type { AnalysisResponse, Recipe } from "./index";

export function recipe(): Recipe {
  return {
    id: "recipe-1",
    title: "Soup",
    ingredients: "1 onion",
    instructions: "Simmer",
    servings: 2,
    analysis: null,
    image_version: "v1",
  };
}

export function analysis(): AnalysisResponse {
  return {
    uri: "analysis",
    yield: 2,
    calories: 200,
    totalCO2Emissions: 0,
    co2EmissionsClass: "",
    totalWeight: 100,
    dietLabels: [],
    healthLabels: [],
    cautions: [],
    totalNutrients: {},
    totalDaily: {},
    ingredients: [],
    cuisineType: [],
    mealType: [],
    dishType: [],
    totalNutrientsKCal: {},
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
