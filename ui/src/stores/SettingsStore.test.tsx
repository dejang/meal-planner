import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  SettingsScope,
  useSettingsActions,
  useSettingsCredentials,
  useSettingsError,
  useSettingsLoadFailed,
  useSettingsLoading,
  useSettingsLinkError,
  useSettingsSaving,
  useSettingsStartupCredentials,
} from "./SettingsStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(openUrl).mockReset().mockResolvedValue();
});

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
  vi.mocked(invoke).mockResolvedValue({ app_id: "app", api_key: "key" });
  const { result } = renderHook(useSettingsSnapshot, {
    wrapper: SettingsScope,
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
  expect(invoke).toHaveBeenCalledWith("get_credentials");

  const draft = { app_id: "new-app", api_key: "new-key" };
  act(() => result.current.actions.setCredentials(draft));
  expect(result.current.credentials).toEqual(draft);
  vi.mocked(invoke).mockResolvedValueOnce(null).mockResolvedValueOnce({
    app_id: "persisted-app",
    api_key: "persisted-key",
  });
  act(() => {
    pending = result.current.actions.save();
    void result.current.actions.save();
  });
  expect(result.current.saving).toBe(true);
  await act(async () => pending);
  expect(invoke).toHaveBeenCalledWith("save_credentials", {
    credentials: draft,
  });
  expect(vi.mocked(invoke).mock.calls.map(([name]) => name)).toEqual([
    "get_credentials",
    "save_credentials",
    "get_credentials",
  ]);
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

it.each([new Error("Cannot open browser"), "Cannot open browser"])(
  "reports opener failures and clears them on retry: %s",
  async (error) => {
    const { result } = renderHook(useSettingsSnapshot, {
      wrapper: SettingsScope,
    });
    vi.mocked(openUrl).mockRejectedValueOnce(error);
    await act(() => result.current.actions.openSite("https://www.edamam.com/"));
    expect(result.current.linkError).toBe("Cannot open browser");
    await act(() => result.current.actions.openSite("https://www.edamam.com/"));
    expect(openUrl).toHaveBeenLastCalledWith("https://www.edamam.com/");
    expect(result.current.linkError).toBeNull();
    expect(result.current.error).toBeNull();
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
      wrapper: SettingsScope,
    });
    const draft = { app_id: "app", api_key: "key" };
    act(() => result.current.actions.setCredentials(draft));
    vi.mocked(invoke).mockRejectedValueOnce(error);
    await act(() => result.current.actions[operation]());
    expect(result.current.credentials).toEqual(draft);
    expect(result.current.error).toBe(message);
    expect(result.current.loadFailed).toBe(operation === "reload");
    expect(result.current.loading).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.startupCredentials).toBeNull();
    vi.mocked(invoke).mockResolvedValue(draft);
    await act(() => result.current.actions[operation]());
    expect(result.current.error).toBeNull();
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.startupCredentials).toEqual(draft);
  },
);
