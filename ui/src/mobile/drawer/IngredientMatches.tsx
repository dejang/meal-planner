import type { Ingredient } from "@/api";

export enum MatchState {
  Matched = "matched",
  Check = "check",
  Missing = "missing",
}

export interface IngredientMatchesProps {
  ingredients: Ingredient[];
  title: string;
  onSelect?: (text: string) => void;
  minWordLength?: number;
}

export function IngredientMatches({
  ingredients,
  title,
  onSelect,
  minWordLength = 3,
}: IngredientMatchesProps) {
  const words = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}]+/u)
        .filter((word) => word.length >= minWordLength)
        .map((word) => word.replace(/(es|s)$/, "")),
    );
  const rows = ingredients
    .filter((ingredient) => ingredient.text.trim())
    .map((ingredient) => {
      const foods = ingredient.parsed ?? [];
      const written = words(ingredient.text);
      const state = !foods.length
        ? MatchState.Missing
        : foods.some((food) =>
              [...words(food.food)].some((word) => written.has(word)),
            )
          ? MatchState.Matched
          : MatchState.Check;
      return { ingredient, foods, state };
    });
  const flagged = rows.filter((row) => row.state !== MatchState.Matched).length;
  return (
    <section className="ingredient-matches" aria-label={title}>
      <header className="ingredient-matches-header">
        <h3>{title}</h3>
        {flagged > 0 && (
          <span className="ingredient-matches-count">{flagged} to check</span>
        )}
      </header>
      <ul>
        {rows.map(({ ingredient, foods, state }, index) => {
          const content = (
            <>
              <span className="ingredient-matches-line">{ingredient.text}</span>
              <span className="ingredient-matches-found">
                {state === MatchState.Missing
                  ? "Left out of nutrition and shopping"
                  : foods
                      .map(
                        (food) => `${food.food} · ${Math.round(food.weight)} g`,
                      )
                      .join(", ")}
              </span>
              {state !== MatchState.Matched && (
                <span className="ingredient-matches-flag">
                  {state === MatchState.Missing ? "Not recognised" : "Check"}
                </span>
              )}
            </>
          );
          return (
            <li key={index} data-state={state}>
              {onSelect ? (
                <button
                  type="button"
                  className="ingredient-matches-row"
                  onClick={() => onSelect(ingredient.text)}
                >
                  {content}
                </button>
              ) : (
                <div className="ingredient-matches-row">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
