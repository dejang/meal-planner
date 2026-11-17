import type { AnalysisResponse } from "@/api";

export function servingsDivisor(servings: number): number {
  return Math.max(1, Math.trunc(servings) || 1);
}

export function caloriesPerServing(calories: number, servings: number): number {
  return Math.floor(Math.max(0, calories) / servingsDivisor(servings));
}

export function caloriesPerServingLabel(
  analysis: AnalysisResponse | null,
  servings: number,
): string {
  return analysis
    ? `${caloriesPerServing(analysis.calories, servings)} kcal`
    : "Nutrition not available";
}
