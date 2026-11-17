import { useState } from "react";
import { createOpenSiteAction } from "@/stores/core/openSite";
import { createSelectorHook, Store } from "bonsai-react";
import { commands, unwrap, type SupportedSite } from "@/api";
import { createStoreContext } from "@/stores/core/context";
import { errorMessage } from "@/stores/core/error";
import { useEditorActions } from "@/stores/EditorStore";

export interface ImportState {
  open: boolean;
  url: string;
  supportedSites: SupportedSite[];
  importing: boolean;
  error: string | null;
  linkError: string | null;
}

class ImportStore extends Store<ImportState> {
  constructor(readonly editor: ReturnType<typeof useEditorActions>) {
    super({
      open: false,
      url: "",
      supportedSites: [],
      importing: false,
      error: null,
      linkError: null,
    });
    void this.actions.reload();
  }

  readonly actions = {
    openSite: createOpenSiteAction((linkError) => this.update({ linkError })),
    reload: async (): Promise<void> => {
      this.update({ error: null });
      try {
        const supportedSites = await commands.supportedSites();
        this.update({ supportedSites });
      } catch (error) {
        this.update({
          error: errorMessage(error),
        });
      }
    },
    open: (): void => {
      this.update({ open: true, error: null, linkError: null });
    },
    close: (): void => {
      this.update({ open: false });
    },
    setUrl: (url: string): void => {
      this.update({ url });
    },
    importRecipe: async (): Promise<void> => {
      const { url, importing } = this.getSnapshot();
      const sourceUrl = url.trim();
      if (importing || !sourceUrl) return;
      this.update({ error: null });
      try {
        this.editor.assertCanImport();
        this.update({ importing: true });
        const recipe = unwrap(await commands.importRecipe(sourceUrl));
        this.editor.openImported(recipe, sourceUrl);
        this.update({ open: false, url: "" });
      } catch (error) {
        this.update({
          error: errorMessage(error),
        });
      } finally {
        this.update({ importing: false });
      }
    },
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

export function useImportLinkError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.linkError),
  )();
}

export function useImportActions() {
  return context.useActions();
}
