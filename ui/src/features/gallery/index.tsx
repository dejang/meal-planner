import { Icon, IconName } from "@/components/Icon";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import {
  useRecipe,
  useRecipesActions,
  useRecipesError,
  useRecipesLoading,
  useRecipesQuery,
  useRecipesSelectedId,
  useRecipesVisibleIds,
} from "@/stores/RecipesStore";
import { RecipeCard } from "@/features/gallery/RecipeCard";
import { RecipeDragOverlay } from "@/features/gallery/RecipeDragOverlay";
import { RecipeDetail } from "@/features/gallery/RecipeDetail";
import "@/features/gallery/gallery.css";

export default function Gallery() {
  const ids = useRecipesVisibleIds();
  const query = useRecipesQuery();
  const selectedId = useRecipesSelectedId();
  const recipe = useRecipe(selectedId ?? "");
  const loading = useRecipesLoading();
  const error = useRecipesError();
  const actions = useRecipesActions();

  return (
    <section aria-label="Gallery" className="gallery">
      <div className="gallery-search">
        <Icon name={IconName.Search} />
        <TextInput
          type="search"
          aria-label="Search recipes"
          placeholder="Find something delicious…"
          value={query}
          onChange={(event) => void actions.setQuery(event.target.value)}
        />
      </div>
      {error && (
        <div role="alert">
          {error} <Button onClick={() => void actions.retry()}>Retry</Button>
        </div>
      )}
      <span role="status" className="gallery-status">
        {loading ? "Loading recipes…" : ""}
      </span>
      <div className="gallery-content">
        <section
          className="gallery-cards"
          aria-label="Recipes"
          aria-busy={loading}
        >
          {ids.map((id) => (
            <RecipeCard key={id} id={id} selected={selectedId === id} />
          ))}
          {!loading && !error && ids.length === 0 && (
            <p>{query ? "No recipes match your search." : "No recipes yet."}</p>
          )}
        </section>
        {recipe && <RecipeDetail recipe={recipe} />}
      </div>
      <RecipeDragOverlay />
    </section>
  );
}
