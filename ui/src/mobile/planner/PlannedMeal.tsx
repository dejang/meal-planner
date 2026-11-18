import type { MealPosition } from "@/api";
import { Button } from "@/components/Button";
import { RecipePhoto } from "@/components/RecipePhoto";
import { caloriesPerServingLabel } from "@/lib/nutrition";
import { useDrawerActions } from "@/stores/DrawerStore";
import { usePlanActions, usePlanLoading } from "@/stores/PlanStore";
import { useRecipe } from "@/stores/RecipesStore";

export default function PlannedMeal({
  recipeId,
  position,
  count,
}: {
  recipeId: string;
  position: MealPosition;
  count: number;
}) {
  const recipe = useRecipe(recipeId);
  const plan = usePlanActions();
  const loading = usePlanLoading();
  const drawer = useDrawerActions();
  const title = recipe?.title ?? "Recipe unavailable";

  return (
    <li className="mobile-plan-meal surface-frame mobile-card">
      <button
        type="button"
        className="mobile-plan-recipe mobile-pressable"
        disabled={!recipe}
        onClick={() => void drawer.openRecipe(recipeId)}
      >
        <RecipePhoto
          recipeId={recipeId}
          imageVersion={recipe?.image_version}
          alt=""
        />
        <span className="mobile-plan-recipe-text">
          <strong className="mobile-card-title">{title}</strong>{" "}
          {recipe && (
            <span className="mobile-meta">
              {caloriesPerServingLabel(recipe.analysis, recipe.servings)}
            </span>
          )}
        </span>
      </button>
      <div className="mobile-plan-reorder">
        <Button
          aria-label={`Move ${title} up`}
          disabled={loading || position.row === 0}
          onClick={() =>
            void plan.moveMeal(position, { ...position, row: position.row - 1 })
          }
        >
          ↑
        </Button>
        <Button
          aria-label={`Move ${title} down`}
          disabled={loading || position.row === count - 1}
          onClick={() =>
            void plan.moveMeal(position, { ...position, row: position.row + 1 })
          }
        >
          ↓
        </Button>
      </div>
      <Button
        aria-label={`Remove ${title}`}
        disabled={loading}
        onClick={() => void plan.removeFromDay(position)}
      >
        ×
      </Button>
    </li>
  );
}
