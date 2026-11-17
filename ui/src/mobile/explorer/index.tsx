import { useRef } from "react";
import { Button, ButtonVariant } from "@/components/Button";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { TextInput } from "@/components/TextInput";
import { useDrawerActions } from "@/stores/DrawerStore";
import {
  useRecipesActions,
  useRecipesError,
  useRecipesLoading,
  useRecipesQuery,
  useRecipesVisibleIds,
} from "@/stores/RecipesStore";
import { RecipeCard } from "@/mobile/explorer/RecipeCard";
import "@/mobile/explorer/explorer.css";

export default function Explorer(_props: { active: boolean }) {
  const ids = useRecipesVisibleIds();
  const query = useRecipesQuery();
  const loading = useRecipesLoading();
  const error = useRecipesError();
  const recipes = useRecipesActions();
  const drawer = useDrawerActions();
  const search = useRef<HTMLInputElement>(null);

  return (
    <>
      <MobileHeader
        title="Meal Explorer"
        action={<Button onClick={() => void drawer.openCreate()}>+ New</Button>}
      />
      <div className="explorer-content safe-area-sides">
        <div className="explorer-search">
          <TextInput
            ref={search}
            type="search"
            aria-label="Search recipes"
            placeholder="Search recipes..."
            value={query}
            onChange={(event) => void recipes.setQuery(event.target.value)}
          />
          {query && (
            <Button
              variant={ButtonVariant.Quiet}
              className="explorer-search-clear"
              aria-label="Clear search"
              onClick={() => {
                void recipes.setQuery("");
                search.current?.focus();
              }}
            >
              ×
            </Button>
          )}
        </div>
        {error && (
          <div role="alert">
            {error} <Button onClick={() => void recipes.retry()}>Retry</Button>
          </div>
        )}
        {loading && !query && ids.length === 0 && (
          <p role="status">Loading recipes…</p>
        )}
        <ul className="explorer-grid" aria-label="Recipes" aria-busy={loading}>
          {ids.map((id) => (
            <RecipeCard key={id} id={id} />
          ))}
        </ul>
        {(!loading || query) && !error && ids.length === 0 && (
          <div className="explorer-empty" role="status">
            {query ? (
              <p>No matching recipes</p>
            ) : (
              <>
                <h2 className="text-heading">Your next favorite starts here</h2>
                <p>Create a recipe or import one to start your collection.</p>
                <Button onClick={() => void drawer.openCreate()}>
                  Create or import a recipe
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
