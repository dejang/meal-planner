import { useCallback } from "react";
import type { Recipe } from "@/api";
import { Button } from "@/components/Button";
import { NutritionLabel } from "@/components/NutritionLabel";
import { PaperWindowHeader } from "@/components/PaperDialog";
import { useEditorActions } from "@/stores/EditorStore";
import { useRecipesActions } from "@/stores/RecipesStore";

export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const actions = useRecipesActions();
  const editor = useEditorActions();
  const listenForShortcuts = useCallback(() => {
    function keydown(event: KeyboardEvent) {
      if (
        document.querySelector("dialog[open]") ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, [contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (event.key === "Escape") actions.select(null);
      if (event.key === "Delete") {
        void actions.deleteRecipe(recipe.id);
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [actions, recipe.id]);
  return (
    <aside
      ref={listenForShortcuts}
      className="gallery-detail surface-frame"
      aria-label="Recipe details"
    >
      <PaperWindowHeader
        title={recipe.title}
        onClose={() => actions.select(null)}
      />
      <div className="gallery-detail-actions">
        <Button
          onClick={() => {
            void editor.openRecipe(recipe.id);
            actions.select(null);
          }}
        >
          Edit
        </Button>
        <Button onClick={() => void actions.deleteRecipe(recipe.id)}>
          Delete
        </Button>
      </div>
      <h3>Ingredients</h3>
      {recipe.analysis?.ingredients.length ? (
        <ul className="gallery-ingredients">
          {recipe.analysis.ingredients.map((ingredient, index) => {
            const detail = ingredient.parsed?.[0];
            return (
              <li key={index}>
                {detail ? (
                  <>
                    <span>{detail.food}</span>
                    <span>
                      {detail.quantity} {detail.measure ?? "N/A"}
                    </span>
                  </>
                ) : (
                  ingredient.text
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gallery-lines">{recipe.ingredients}</p>
      )}
      <h3>Cooking Instructions</h3>
      {recipe.instructions
        .split("\n")
        .map((line, index) =>
          line.trim() ? <p key={index}>{line.trim()}</p> : null,
        )}
      {recipe.analysis && (
        <NutritionLabel
          analysis={recipe.analysis}
          servings={recipe.servings}
          servingsLabel="Calories per portion"
        />
      )}
    </aside>
  );
}
