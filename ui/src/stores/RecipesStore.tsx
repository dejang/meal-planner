import { useState } from "react";
import {
  createSelectorHook,
  createKeyedSelectorHook,
  Store,
} from "bonsai-react";
import { commands, unwrap, type Recipe } from "@/api";
import { createStoreContext } from "@/stores/core/context";
import { errorMessage } from "@/stores/core/error";
import { usePlanActions } from "@/stores/PlanStore";

export interface RecipesState {
  recipes: Record<string, Recipe>;
  visibleIds: string[];
  query: string;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

class RecipesStore extends Store<RecipesState> {
  private request = 0;
  private retryFailed = (): Promise<void> => this.actions.reload();

  constructor(readonly plan: ReturnType<typeof usePlanActions>) {
    super({
      recipes: {},
      visibleIds: [],
      query: "",
      selectedId: null,
      loading: false,
      error: null,
    });
    void this.actions.reload();
  }

  private reportError(error: unknown, retry: () => Promise<void>): void {
    this.retryFailed = retry;
    this.update({
      error: errorMessage(error),
    });
  }

  private async load(refresh: boolean): Promise<void> {
    const request = ++this.request;
    const query = this.getSnapshot().query;
    this.update({ loading: true, error: null });
    try {
      let recipes = this.getSnapshot().recipes;
      if (refresh || !query) {
        const result = await commands.listRecipes();
        if (request !== this.request) return;
        recipes = Object.fromEntries(
          unwrap(result).map((recipe) => [recipe.id, recipe]),
        );
      }
      let visibleIds = Object.keys(recipes);
      if (query) {
        const result = await commands.searchRecipes(query);
        if (request !== this.request) return;
        const matches = unwrap(result);
        recipes = {
          ...recipes,
          ...Object.fromEntries(matches.map((recipe) => [recipe.id, recipe])),
        };
        visibleIds = matches.map((recipe) => recipe.id);
      }
      const selectedId = this.getSnapshot().selectedId;
      this.update({
        recipes,
        visibleIds,
        selectedId: selectedId && recipes[selectedId] ? selectedId : null,
      });
    } catch (error) {
      if (request === this.request)
        this.reportError(error, this.actions.reload);
    } finally {
      if (request === this.request) this.update({ loading: false });
    }
  }

  readonly actions = {
    reload: (): Promise<void> => this.load(true),
    retry: (): Promise<void> => this.retryFailed(),
    setQuery: (query: string): Promise<void> => {
      this.update({ query });
      return this.load(false);
    },
    select: (selectedId: string | null): void => {
      this.update({ selectedId });
    },
    deleteRecipe: async (id: string): Promise<void> => {
      this.update({ error: null });
      try {
        const result = await commands.deleteRecipe(id);
        unwrap(result);
        if (this.getSnapshot().selectedId === id)
          this.update({ selectedId: null });
        await Promise.all([this.actions.reload(), this.plan.reload()]);
      } catch (error) {
        this.reportError(error, () => this.actions.deleteRecipe(id));
      }
    },
  };
}

const context = createStoreContext(() => {
  const plan = usePlanActions();
  return useState(() => new RecipesStore(plan))[0];
});

export function RecipesScope({ children }: { children: React.ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function useRecipesVisibleIds() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.visibleIds),
  )();
}

export function useRecipesQuery() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.query),
  )();
}

export function useRecipesSelectedId() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.selectedId),
  )();
}

export function useRecipesLoading() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.loading),
  )();
}

export function useRecipesError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.error),
  )();
}

export function useRecipe(id: string): Recipe | undefined {
  return context.useScopedHook((store) =>
    createKeyedSelectorHook(
      store,
      (id: string) =>
        (state): Recipe | undefined =>
          state.recipes[id],
    ),
  )(id);
}

export function useRecipesActions() {
  return context.useActions();
}
