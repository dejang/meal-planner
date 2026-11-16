import type { MealPosition } from "@/api";

export interface RecipeDragPayload {
  recipeId: string;
  position: MealPosition | null;
}

export function isGalleryRecipeDrag(
  payload: RecipeDragPayload | undefined,
): payload is RecipeDragPayload & { position: null } {
  return payload?.position === null;
}
