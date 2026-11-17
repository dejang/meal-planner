import { RecipePhoto } from "@/components/RecipePhoto";
import { caloriesPerServingLabel } from "@/lib/nutrition";
import { useId } from "react";
import { useDrawerActions } from "@/stores/DrawerStore";
import { useRecipe } from "@/stores/RecipesStore";

export function RecipeCard({ id }: { id: string }) {
  const recipe = useRecipe(id);
  const drawer = useDrawerActions();
  const metaId = useId();
  if (!recipe) return null;

  return (
    <li>
      <button
        type="button"
        className="explorer-card surface-frame mobile-card mobile-pressable"
        aria-label={recipe.title}
        aria-describedby={metaId}
        onClick={() => void drawer.openRecipe(id)}
      >
        <RecipePhoto
          recipeId={id}
          imageVersion={recipe.image_version}
          alt={recipe.title}
        />
        <span className="explorer-card-title mobile-card-title">
          {recipe.title}
        </span>
        <span id={metaId} className="mobile-meta">
          {caloriesPerServingLabel(recipe.analysis, recipe.servings)}
          {" · "}
          {recipe.servings} {recipe.servings === 1 ? "portion" : "portions"}
        </span>
      </button>
    </li>
  );
}
