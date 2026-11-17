import { useState, type ReactNode } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import { createStoreContext } from "@/stores/core/context";
import { useEditorActions } from "@/stores/EditorStore";

export enum DrawerMode {
  View = "view",
  Edit = "edit",
  Create = "create",
}

interface DrawerState {
  open: boolean;
  mode: DrawerMode;
  recipeId: string | null;
}

class DrawerStore extends Store<DrawerState> {
  constructor(readonly editor: ReturnType<typeof useEditorActions>) {
    super({ open: false, mode: DrawerMode.View, recipeId: null });
  }

  private transition = 0;

  private async leaveDraft(): Promise<boolean> {
    const transition = ++this.transition;
    const closed = await this.editor.close();
    return closed && transition === this.transition;
  }

  readonly actions = {
    openRecipe: async (recipeId: string): Promise<void> => {
      if (await this.leaveDraft())
        this.update({ open: true, mode: DrawerMode.View, recipeId });
    },
    openEdit: async (recipeId: string): Promise<void> => {
      if (!(await this.leaveDraft())) return;
      this.update({ open: true, mode: DrawerMode.Edit, recipeId });
      await this.editor.openRecipe(recipeId);
    },
    openCreate: async (): Promise<void> => {
      if (!(await this.leaveDraft())) return;
      this.editor.openNew();
      this.update({ open: true, mode: DrawerMode.Create, recipeId: null });
    },
    switchToView: (recipeId: string): Promise<void> => {
      return this.actions.openRecipe(recipeId);
    },
    close: async (): Promise<void> => {
      if (await this.leaveDraft())
        this.update({ open: false, mode: DrawerMode.View, recipeId: null });
    },
  };
}

const context = createStoreContext(() => {
  const editor = useEditorActions();
  return useState(() => new DrawerStore(editor))[0];
});

export function DrawerScope({ children }: { children: ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function useDrawerOpen() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.open),
  )();
}

export function useDrawerMode() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.mode),
  )();
}

export function useDrawerRecipeId() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.recipeId),
  )();
}

export function useDrawerActions() {
  return context.useActions();
}
