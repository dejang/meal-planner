import { DragOverlay, useDndContext } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import { RecipePhoto } from "../../components/RecipePhoto";
import {
  isGalleryRecipeDrag,
  type RecipeDragPayload,
} from "../../lib/recipeDrag";
import { useRecipe } from "../../stores/RecipesStore";

export function RecipeDragOverlay() {
  const { active } = useDndContext();
  const payload = active?.data.current as RecipeDragPayload | undefined;
  const draggedRecipe = useRecipe(
    isGalleryRecipeDrag(payload) ? payload.recipeId : "",
  );
  return (
    (!active || isGalleryRecipeDrag(payload)) && (
      <DragOverlay
        dropAnimation={null}
        style={{ width: 100, height: 100 }}
        modifiers={[
          ({ transform, activatorEvent, activeNodeRect }) => {
            const pointer = activatorEvent
              ? getEventCoordinates(activatorEvent)
              : null;
            if (!pointer || !activeNodeRect) return transform;
            return {
              ...transform,
              x: transform.x + pointer.x - activeNodeRect.left,
              y: transform.y + pointer.y - activeNodeRect.top,
            };
          },
        ]}
      >
        {draggedRecipe && (
          <div className="gallery-drag-preview surface-frame">
            <RecipePhoto
              recipeId={draggedRecipe.id}
              imageVersion={draggedRecipe.image_version}
              alt={draggedRecipe.title}
            />
          </div>
        )}
      </DragOverlay>
    )
  );
}
