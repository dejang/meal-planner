import { useState } from "react";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { usePlanActions, usePlanLoading } from "@/stores/PlanStore";
import {
  RecipesScope,
  useRecipe,
  useRecipesActions,
  useRecipesError,
  useRecipesLoading,
  useRecipesQuery,
  useRecipesVisibleIds,
} from "@/stores/RecipesStore";

function RecipeChoice({ recipeId, day }: { recipeId: string; day: number }) {
  const recipe = useRecipe(recipeId)!;
  const plan = usePlanActions();
  const loading = usePlanLoading();
  return (
    <li>
      <Button
        disabled={loading}
        onClick={() => void plan.addToDay({ day, row: 0 }, recipeId)}
      >
        {recipe.title}
      </Button>
    </li>
  );
}

function RecipeSearch({ day }: { day: number }) {
  const ids = useRecipesVisibleIds();
  const query = useRecipesQuery();
  const recipes = useRecipesActions();
  const loading = useRecipesLoading();
  const error = useRecipesError();

  return (
    <div className="mobile-plan-picker" aria-busy={loading}>
      <label>
        Search recipes
        <TextInput
          type="search"
          value={query}
          onChange={(event) => void recipes.setQuery(event.target.value)}
        />
      </label>
      {error && (
        <div role="alert">
          {error}
          <Button onClick={() => void recipes.retry()}>Retry recipes</Button>
        </div>
      )}
      {!loading && !error && ids.length === 0 && <p>No recipes found.</p>}
      <ul aria-label="Choose a recipe">
        {ids.map((id) => (
          <RecipeChoice key={id} recipeId={id} day={day} />
        ))}
      </ul>
    </div>
  );
}

export default function RecipePicker({ day }: { day: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mobile-plan-empty surface-frame mobile-card">
      <h2>No meals planned</h2>
      <p>Pick something delicious for Day {day + 1}.</p>
      <Button aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Close recipe picker" : "Pick a recipe"}
      </Button>
      {open && (
        <RecipesScope>
          <RecipeSearch day={day} />
        </RecipesScope>
      )}
    </div>
  );
}
