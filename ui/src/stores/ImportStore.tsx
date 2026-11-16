import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import type { SupportedSite } from "../api";
import { createStoreContext } from "./core/context";
import { useEditorActions } from "./EditorStore";

export interface ImportState {
  open: boolean;
  url: string;
  supportedSites: SupportedSite[];
  importing: boolean;
  error: string | null;
}

class ImportStore extends Store<ImportState> {
  constructor(readonly editor: ReturnType<typeof useEditorActions>) {
    super({
      open: false,
      url: "",
      supportedSites: [],
      importing: false,
      error: null,
    });
  }

  readonly actions = {
    reload: async (): Promise<void> => {},
    open: (): void => {
      this.update({ open: true, error: null });
    },
    close: (): void => {
      this.update({ open: false });
    },
    setUrl: (url: string): void => {
      this.update({ url });
    },
    importRecipe: async (): Promise<void> => {},
  };
}

const context = createStoreContext(() => {
  const editor = useEditorActions();
  return useState(() => new ImportStore(editor))[0];
});

export function ImportScope({ children }: { children: React.ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function useImportOpen() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.open),
  )();
}

export function useImportUrl() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.url),
  )();
}

export function useImportSupportedSites() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.supportedSites),
  )();
}

export function useImportImporting() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.importing),
  )();
}

export function useImportError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.error),
  )();
}

export function useImportActions() {
  return context.useActions();
}
