import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import type { ImportedRecipe, RecipeInput } from "../api";
import { createStoreContext } from "./core/context";
import { usePlanActions } from "./PlanStore";
import { useRecipesActions } from "./RecipesStore";

export interface RecipeDraft extends RecipeInput {
  id: string | null;
  imageVersion: string | null;
}

export interface EditorState {
  draft: RecipeDraft | null;
  saving: boolean;
  analyzing: boolean;
  loadingImage: boolean;
  error: string | null;
}

class EditorStore extends Store<EditorState> {
  constructor(
    readonly recipes: ReturnType<typeof useRecipesActions>,
    readonly plan: ReturnType<typeof usePlanActions>,
  ) {
    super({
      draft: null,
      saving: false,
      analyzing: false,
      loadingImage: false,
      error: null,
    });
  }

  readonly actions = {
    reload: async (): Promise<void> => {},
    openNew: (): void => {
      this.update({
        draft: {
          id: null,
          title: "",
          ingredients: "",
          instructions: "",
          servings: 1,
          analysis: null,
          image: { kind: "keep" },
          imageVersion: null,
        },
        error: null,
      });
    },
    openRecipe: async (_id: string): Promise<void> => {},
    assertCanImport: (): void => {
      if (this.getSnapshot().draft !== null) {
        throw new Error(
          "Close the current new recipe before importing another one",
        );
      }
    },
    openImported: (recipe: ImportedRecipe, sourceUrl: string): void => {
      this.actions.assertCanImport();
      this.update({
        draft: {
          id: null,
          title: recipe.title,
          ingredients: recipe.ingredients.join("\n"),
          instructions: `${recipe.instructions.join("\n")}\n\n${sourceUrl}`,
          servings: recipe.servings,
          analysis: null,
          image: recipe.image
            ? { kind: "set", image: recipe.image }
            : { kind: "keep" },
          imageVersion: null,
        },
        error: null,
      });
    },
    close: (): void => {
      this.update({ draft: null, error: null });
    },
    patchDraft: (patch: Partial<RecipeInput>): void => {
      const draft = this.getSnapshot().draft;
      if (draft) this.update({ draft: { ...draft, ...patch } });
    },
    save: async (): Promise<void> => {},
    analyzeIngredients: async (): Promise<void> => {},
    loadImageFile: async (_path: string): Promise<void> => {},
    loadImageUrl: async (_url: string): Promise<void> => {},
  };
}

const context = createStoreContext(() => {
  const recipes = useRecipesActions();
  const plan = usePlanActions();
  return useState(() => new EditorStore(recipes, plan))[0];
});

export function EditorScope({ children }: { children: React.ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function useEditorDraft() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.draft),
  )();
}

export function useEditorOpen() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.draft !== null),
  )();
}

export function useEditorSaving() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.saving),
  )();
}

export function useEditorAnalyzing() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.analyzing),
  )();
}

export function useEditorLoadingImage() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.loadingImage),
  )();
}

export function useEditorError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.error),
  )();
}

export function useEditorActions() {
  return context.useActions();
}
