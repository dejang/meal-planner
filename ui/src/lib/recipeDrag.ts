import type { MealPosition } from "../api";

export interface RecipeDragPayload {
  recipeId: string;
  position: MealPosition | null;
}
