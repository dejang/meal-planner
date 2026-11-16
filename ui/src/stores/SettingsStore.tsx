import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import { createOpenSiteAction } from "./core/openSite";
import { commands, unwrap, type Credentials } from "../api";
import { createStoreContext } from "./core/context";
import { errorMessage } from "./core/error";

export interface SettingsState {
  credentials: Credentials;
  startupCredentials: Credentials | null;
  loadFailed: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  linkError: string | null;
}

class SettingsStore extends Store<SettingsState> {
  constructor() {
    super({
      credentials: { app_id: "", api_key: "" },
      startupCredentials: null,
      loadFailed: false,
      loading: false,
      saving: false,
      error: null,
      linkError: null,
    });
  }

  readonly actions = {
    openSite: createOpenSiteAction((linkError) => this.update({ linkError })),
    reload: async (): Promise<void> => {
      if (this.getSnapshot().loading) return;
      this.update({ loading: true, loadFailed: false, error: null });
      try {
        const credentials = unwrap(await commands.getCredentials());
        this.update({
          credentials,
          startupCredentials:
            this.getSnapshot().startupCredentials ?? credentials,
        });
      } catch (error) {
        this.update({
          error: errorMessage(error),
          loadFailed: true,
        });
      } finally {
        this.update({ loading: false });
      }
    },
    setCredentials: (credentials: Credentials): void => {
      this.update({ credentials });
    },
    save: async (): Promise<void> => {
      const { credentials, loading, saving } = this.getSnapshot();
      if (loading || saving) return;
      this.update({ saving: true, loadFailed: false, error: null });
      try {
        unwrap(await commands.saveCredentials(credentials));
        await this.actions.reload();
      } catch (error) {
        this.update({
          error: errorMessage(error),
        });
      } finally {
        this.update({ saving: false });
      }
    },
  };
}

const context = createStoreContext(
  () => useState(() => new SettingsStore())[0],
);

export function SettingsScope({ children }: { children: React.ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function useSettingsCredentials() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.credentials),
  )();
}

export function useSettingsStartupCredentials() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.startupCredentials),
  )();
}

export function useSettingsLoadFailed() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.loadFailed),
  )();
}

export function useSettingsLoading() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.loading),
  )();
}

export function useSettingsSaving() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.saving),
  )();
}

export function useSettingsError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.error),
  )();
}

export function useSettingsLinkError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.linkError),
  )();
}

export function useSettingsActions() {
  return context.useActions();
}
