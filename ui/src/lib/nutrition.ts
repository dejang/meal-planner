export function servingsDivisor(servings: number): number {
  return Math.max(1, Math.trunc(servings) || 1);
}

export function caloriesPerServing(calories: number, servings: number): number {
  return Math.floor(Math.max(0, calories) / servingsDivisor(servings));
}
