import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import { createOpenSiteAction } from "@/stores/core/openSite";
import { commands, unwrap, type Credentials } from "@/api";
import { createStoreContext } from "@/stores/core/context";
import { errorMessage } from "@/stores/core/error";

export interface SettingsState {
  credentials: Credentials;
  persistedCredentials: Credentials | null;
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
      persistedCredentials: null,
      startupCredentials: null,
      loadFailed: false,
      loading: false,
      saving: false,
      error: null,
      linkError: null,
    });
    void this.actions.reload();
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
          persistedCredentials: credentials,
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
    save: async (): Promise<boolean> => {
      const { credentials, loading, saving } = this.getSnapshot();
      if (loading || saving) return false;
      this.update({ saving: true, loadFailed: false, error: null });
      try {
        unwrap(await commands.saveCredentials(credentials));
        this.update({ persistedCredentials: credentials });
        await this.actions.reload();
        return this.getSnapshot().error === null;
      } catch (error) {
        this.update({
          error: errorMessage(error),
        });
        return false;
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

function credentialsConfigured(credentials: Credentials | null) {
  return credentials
    ? Boolean(credentials.app_id && credentials.api_key)
    : null;
}

export function useSettingsConfigured() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) =>
      credentialsConfigured(state.persistedCredentials),
    ),
  )();
}

export function useSettingsStartupConfigured() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) =>
      credentialsConfigured(state.startupCredentials),
    ),
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
