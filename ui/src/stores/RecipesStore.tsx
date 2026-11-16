import { useState } from "react";
import {
  createSelectorHook,
  createKeyedSelectorHook,
  Store,
} from "bonsai-react";
import type { Recipe } from "../api";
import { createStoreContext } from "./core/context";
import { usePlanActions } from "./PlanStore";

export interface RecipesState {
  recipes: Record<string, Recipe>;
  visibleIds: string[];
  query: string;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

class RecipesStore extends Store<RecipesState> {
  constructor(readonly plan: ReturnType<typeof usePlanActions>) {
    super({
      recipes: {},
      visibleIds: [],
      query: "",
      selectedId: null,
      loading: false,
      error: null,
    });
  }

  readonly actions = {
    reload: async (): Promise<void> => {},
    setQuery: async (_query: string): Promise<void> => {},
    select: (selectedId: string | null): void => {
      this.update({ selectedId });
    },
    deleteRecipe: async (_id: string): Promise<void> => {},
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
