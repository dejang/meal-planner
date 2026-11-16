import { useDraggable } from "@dnd-kit/core";
import { caloriesPerServing } from "@/lib/nutrition";
import { RecipePhoto } from "@/components/RecipePhoto";
import { Button, ButtonVariant } from "@/components/Button";
import type { RecipeDragPayload } from "@/lib/recipeDrag";
import { useRecipe, useRecipesActions } from "@/stores/RecipesStore";

export function RecipeCard({
  id,
  selected,
}: {
  id: string;
  selected: boolean;
}) {
  const recipe = useRecipe(id);
  const actions = useRecipesActions();
  const payload: RecipeDragPayload = { recipeId: id, position: null };
  const drag = useDraggable({ id: `gallery-${id}`, data: payload });
  if (!recipe) return null;
  return (
    <article
      ref={drag.setNodeRef}
      className={`gallery-card surface-frame ${selected ? "gallery-card-selected" : ""}`}
      style={{ opacity: drag.isDragging ? 0.5 : 1 }}
      onPointerDown={(event) => drag.listeners?.onPointerDown?.(event)}
    >
      <div className="gallery-card-body">
        <h2 className="recipe-title">
          <button
            className="gallery-card-open"
            aria-current={selected ? "true" : undefined}
            onClick={() => actions.select(id)}
          >
            <span className="gallery-card-title">{recipe.title}</span>
          </button>
        </h2>
        <RecipePhoto
          recipeId={id}
          imageVersion={recipe.image_version}
          alt={recipe.title}
        />
        <span className="gallery-card-details">
          <strong>
            {recipe.analysis
              ? `${caloriesPerServing(recipe.analysis.calories, recipe.servings)} kcal`
              : "Nutrition not available"}
          </strong>
          <span>{recipe.servings} servings</span>
        </span>
      </div>
      <Button
        variant={ButtonVariant.Quiet}
        ref={drag.setActivatorNodeRef}
        {...drag.attributes}
        onKeyDown={(event) => drag.listeners?.onKeyDown?.(event)}
        className="gallery-drag-handle"
        aria-label={`Drag to planner: ${recipe.title}`}
      >
        Drag to planner
      </Button>
    </article>
  );
}
