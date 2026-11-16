import { DragOverlay, useDndContext } from "@dnd-kit/core";
import {
  isGalleryRecipeDrag,
  type RecipeDragPayload,
} from "../../lib/recipeDrag";
import { MealTitle } from "./MealCard";

export function PlanDragOverlay() {
  const { active } = useDndContext();
  const payload = active?.data.current as RecipeDragPayload | undefined;
  return (
    (!active || (payload && !isGalleryRecipeDrag(payload))) && (
      <DragOverlay dropAnimation={null}>
        {payload && (
          <div className="planner-meal">
            <MealTitle recipeId={payload.recipeId} />
          </div>
        )}
      </DragOverlay>
    )
  );
}
