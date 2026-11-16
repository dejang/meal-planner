import { ok } from "../test-support/ipc";
import { AppScopes } from "../test-support/scopes";
import { commands } from "../api";
import {
  useImportActions,
  useImportError,
  useImportLinkError,
} from "./ImportStore";
import { openUrl } from "@tauri-apps/plugin-opener";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  useSettingsActions,
  useSettingsCredentials,
  useSettingsError,
  useSettingsLoadFailed,
  useSettingsLoading,
  useSettingsLinkError,
  useSettingsSaving,
  useSettingsStartupCredentials,
} from "./SettingsStore";

function useSettingsSnapshot() {
  return {
    actions: useSettingsActions(),
    credentials: useSettingsCredentials(),
    startupCredentials: useSettingsStartupCredentials(),
    loadFailed: useSettingsLoadFailed(),
    loading: useSettingsLoading(),
    saving: useSettingsSaving(),
    error: useSettingsError(),
    linkError: useSettingsLinkError(),
  };
}

it("loads, edits, saves and refreshes credentials", async () => {
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({ app_id: "app", api_key: "key" }),
  );
  const { result } = renderHook(useSettingsSnapshot, {
    wrapper: AppScopes,
  });
  expect(result.current.startupCredentials).toBeNull();
  let pending: Promise<void>;
  act(() => {
    pending = result.current.actions.reload();
  });
  expect(result.current.loading).toBe(true);
  await act(async () => pending);
  expect(result.current.loading).toBe(false);
  expect(result.current.credentials).toEqual({ app_id: "app", api_key: "key" });
  expect(commands.getCredentials).toHaveBeenCalledOnce();

  const draft = { app_id: "new-app", api_key: "new-key" };
  act(() => result.current.actions.setCredentials(draft));
  expect(result.current.credentials).toEqual(draft);
  vi.mocked(commands.getCredentials).mockResolvedValueOnce(
    ok({
      app_id: "persisted-app",
      api_key: "persisted-key",
    }),
  );
  act(() => {
    pending = result.current.actions.save();
    void result.current.actions.save();
  });
  expect(result.current.saving).toBe(true);
  await act(async () => pending);
  expect(commands.saveCredentials).toHaveBeenCalledExactlyOnceWith(draft);
  expect(commands.getCredentials).toHaveBeenCalledTimes(2);
  expect(
    vi.mocked(commands.getCredentials).mock.invocationCallOrder[1],
  ).toBeGreaterThan(
    vi.mocked(commands.saveCredentials).mock.invocationCallOrder[0],
  );
  expect(result.current.credentials).toEqual({
    app_id: "persisted-app",
    api_key: "persisted-key",
  });
  expect(result.current.saving).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.startupCredentials).toEqual({
    app_id: "app",
    api_key: "key",
  });
});

it.each(
  [
    {
      store: "settings",
      snapshot: useSettingsSnapshot,
      wrapper: AppScopes,
    },
    {
      store: "import",
      snapshot: function useImportLinks() {
        return {
          actions: useImportActions(),
          error: useImportError(),
          linkError: useImportLinkError(),
        };
      },
      wrapper: AppScopes,
    },
  ].flatMap((store) =>
    [new Error("Cannot open browser"), "Cannot open browser"].map((error) => ({
      ...store,
      error,
    })),
  ),
)(
  "$store reports opener failures independently and clears them on retry: $error",
  async ({ error, snapshot, wrapper }) => {
    const { result } = renderHook(() => snapshot(), { wrapper });
    vi.mocked(commands.getCredentials).mockRejectedValueOnce(
      new Error("Load failed"),
    );
    vi.mocked(commands.supportedSites).mockRejectedValueOnce(
      new Error("Load failed"),
    );
    await act(() => result.current.actions.reload());
    expect(result.current.error).toBe("Load failed");
    vi.mocked(openUrl).mockRejectedValueOnce(error);
    await act(() => result.current.actions.openSite("https://www.edamam.com/"));
    expect(result.current.linkError).toBe("Cannot open browser");
    expect(result.current.error).toBe("Load failed");
    await act(() => result.current.actions.openSite("https://www.edamam.com/"));
    expect(openUrl).toHaveBeenLastCalledWith("https://www.edamam.com/");
    expect(result.current.linkError).toBeNull();
    expect(result.current.error).toBe("Load failed");
  },
);

it.each([
  {
    operation: "reload",
    error: { kind: "storage", detail: "Cannot read" },
    message: "Cannot read",
  },
  {
    operation: "save",
    error: new Error("Cannot save"),
    message: "Cannot save",
  },
] as const)(
  "preserves credentials on $operation failure and allows retry",
  async ({ operation, error, message }) => {
    const { result } = renderHook(useSettingsSnapshot, {
      wrapper: AppScopes,
    });
    const draft = { app_id: "app", api_key: "key" };
    act(() => result.current.actions.setCredentials(draft));
    const command =
      operation === "reload"
        ? commands.getCredentials
        : commands.saveCredentials;
    if (error instanceof Error) vi.mocked(command).mockRejectedValueOnce(error);
    else vi.mocked(command).mockResolvedValueOnce({ status: "error", error });
    await act(() => result.current.actions[operation]());
    expect(result.current.credentials).toEqual(draft);
    expect(result.current.error).toBe(message);
    expect(result.current.loadFailed).toBe(operation === "reload");
    expect(result.current.loading).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.startupCredentials).toBeNull();
    vi.mocked(commands.getCredentials).mockResolvedValue(ok(draft));
    await act(() => result.current.actions[operation]());
    expect(result.current.error).toBeNull();
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.startupCredentials).toEqual(draft);
  },
);
