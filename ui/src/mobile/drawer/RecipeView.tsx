import { useState } from "react";
import { RecipePhoto } from "@/components/RecipePhoto";
import { NutritionLabel } from "@/components/NutritionLabel";
import { DayPills } from "@/components/mobile/DayPills";
import {
  useRecipe,
  useRecipesError,
  useRecipesLoading,
} from "@/stores/RecipesStore";
import {
  usePlanActions,
  usePlanWeeklyPlan,
  usePlanLoading,
  usePlanError,
} from "@/stores/PlanStore";
import { caloriesPerServingLabel } from "@/lib/nutrition";

export default function RecipeView({ recipeId }: { recipeId: string }) {
  const recipe = useRecipe(recipeId);
  const loading = useRecipesLoading();
  const recipeError = useRecipesError();
  const plan = usePlanWeeklyPlan();
  const actions = usePlanActions();
  const busy = usePlanLoading();
  const error = usePlanError();
  const [addedDay, setAddedDay] = useState<number>();
  const confirmed =
    !error && addedDay !== undefined && plan.days[addedDay].includes(recipeId);
  if (!recipe)
    return (
      <p role="status">
        {recipeError ?? (loading ? "Loading recipe…" : "Recipe not found.")}
      </p>
    );
  return (
    <>
      <RecipePhoto
        className="recipe-drawer-photo"
        recipeId={recipe.id}
        imageVersion={recipe.image_version}
        alt={recipe.title}
      />
      <p className="recipe-drawer-summary">
        {caloriesPerServingLabel(recipe.analysis, recipe.servings)} ·{" "}
        {recipe.servings} portions
      </p>
      <section aria-label="Add to Plan">
        <h3>Add to Plan</h3>
        <DayPills
          label="Add to Plan"
          disabled={busy}
          confirmedDay={confirmed ? addedDay : undefined}
          onSelect={async (day) => {
            setAddedDay(undefined);
            await actions.addToDay(
              { day, row: plan.days[day].length },
              recipe.id,
            );
            setAddedDay(day);
          }}
        />
        {confirmed && <p role="status">Added to D{addedDay! + 1}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
      <section>
        <h3>Ingredients</h3>
        <ul className="recipe-drawer-ingredients">
          {(recipe.analysis?.ingredients.length
            ? recipe.analysis.ingredients
            : recipe.ingredients
                .split("\n")
                .map((text) => ({ text, parsed: null }))
          )
            .filter((ingredient) => ingredient.text.trim())
            .map((ingredient, index) => {
              const detail = ingredient.parsed?.[0];
              return (
                <li className="mobile-ingredient" key={index}>
                  {detail ? (
                    <>
                      <span>{detail.food}</span>
                      <span>
                        {detail.quantity} {detail.measure ?? ""}
                      </span>
                    </>
                  ) : (
                    ingredient.text
                  )}
                </li>
              );
            })}
        </ul>
      </section>
      <section>
        <h3>Cooking Instructions</h3>
        <ol className="recipe-drawer-steps">
          {recipe.instructions
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, index) => (
              <li className="mobile-step" key={index}>
                <h4>Step {index + 1}</h4>
                <p>{line}</p>
              </li>
            ))}
        </ol>
      </section>
      {recipe.analysis && (
        <NutritionLabel
          analysis={recipe.analysis}
          servings={recipe.servings}
          servingsLabel="Calories per portion"
        />
      )}
    </>
  );
}
