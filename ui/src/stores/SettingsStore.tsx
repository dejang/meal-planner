import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import type { Credentials } from "../api";
import { createStoreContext } from "./core/context";

export interface SettingsState {
  credentials: Credentials;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

class SettingsStore extends Store<SettingsState> {
  constructor() {
    super({
      credentials: { app_id: "", api_key: "" },
      loading: false,
      saving: false,
      error: null,
    });
  }

  readonly actions = {
    reload: async (): Promise<void> => {},
    setCredentials: (credentials: Credentials): void => {
      this.update({ credentials });
    },
    save: async (): Promise<void> => {},
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

export function useSettingsActions() {
  return context.useActions();
}
