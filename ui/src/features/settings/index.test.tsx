import { commands, ok } from "@/test-support/ipc";
import { openUrl } from "@tauri-apps/plugin-opener";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { useSettingsActions } from "@/stores/SettingsStore";
import { AppScopes } from "@/test-support/scopes";
import Settings, { Welcome } from "@/features/settings";

function Reload() {
  const actions = useSettingsActions();
  return (
    <button onClick={() => void actions.reload()}>Reload credentials</button>
  );
}

it.each([
  { app_id: "", api_key: "", welcome: true },
  { app_id: "app", api_key: "", welcome: true },
  { app_id: "", api_key: "key", welcome: true },
  { app_id: "app", api_key: "key", welcome: false },
  { app_id: " ", api_key: " ", welcome: false },
])(
  "shows Welcome only after loading missing credentials: $app_id / $api_key",
  async ({ app_id, api_key, welcome }) => {
    vi.mocked(commands.getCredentials).mockResolvedValue(
      ok({ app_id, api_key }),
    );
    render(
      <StrictMode>
        <AppScopes>
          <Welcome />
        </AppScopes>
      </StrictMode>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {});
    expect(Boolean(screen.queryByRole("dialog", { name: "Welcome" }))).toBe(
      welcome,
    );
  },
);

it("opens Edamam and keeps Welcome dismissed after reloads", async () => {
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({ app_id: "", api_key: "" }),
  );
  const user = userEvent.setup();
  render(
    <AppScopes>
      <Welcome />
      <Reload />
    </AppScopes>,
  );
  await screen.findByRole("dialog", { name: "Welcome" });
  expect(
    screen.getByText(
      "You can use the Planner and Browse Recipe features without an Edamam account.",
    ),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("link", { name: "https://www.edamam.com" }),
  );
  expect(openUrl).toHaveBeenCalledWith("https://www.edamam.com/");
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Reload credentials" }));
  await waitFor(() => expect(commands.getCredentials).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("recovers a failed startup load through Settings without showing Welcome early", async () => {
  vi.mocked(commands.getCredentials).mockRejectedValueOnce(
    new Error("Cannot load credentials"),
  );
  const user = userEvent.setup();
  render(
    <AppScopes>
      <Welcome />
      <Settings />
    </AppScopes>,
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Cannot load credentials",
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({ app_id: "", api_key: "" }),
  );
  await user.click(screen.getByRole("button", { name: "Retry loading" }));
  expect(await screen.findByRole("dialog", { name: "Welcome" })).toBeTruthy();
});

it.each(["Edamam API Key", "Edamam APP ID"])(
  "does not open Welcome when clearing or saving an empty %s in Settings",
  async (label) => {
    vi.mocked(commands.getCredentials).mockResolvedValue(
      ok({ app_id: "app", api_key: "key" }),
    );
    const user = userEvent.setup();
    render(
      <AppScopes>
        <Welcome />
        <Settings />
      </AppScopes>,
    );
    const field = screen.getByLabelText(label);
    await waitFor(() =>
      expect((field as HTMLInputElement).disabled).toBe(false),
    );
    await user.clear(field);
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Welcome" })).toBeNull();
    const credentials = {
      app_id: label === "Edamam APP ID" ? "" : "app",
      api_key: label === "Edamam API Key" ? "" : "key",
    };
    vi.mocked(commands.getCredentials).mockResolvedValueOnce(ok(credentials));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect((field as HTMLInputElement).disabled).toBe(false),
    );
    expect(commands.saveCredentials).toHaveBeenCalledWith(credentials);
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Welcome" })).toBeNull();
  },
);

it("preserves edits on save failure and persists them on retry", async () => {
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({
      app_id: "old-app",
      api_key: "old-key",
    }),
  );
  const user = userEvent.setup();
  render(
    <AppScopes>
      <Settings />
    </AppScopes>,
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Edamam APP ID") as HTMLInputElement).value,
    ).toBe("old-app"),
  );
  const key = screen.getByLabelText("Edamam API Key");
  const app = screen.getByLabelText("Edamam APP ID");
  await user.clear(key);
  await user.type(key, "new-key");
  await user.clear(app);
  await user.type(app, "new-app");
  vi.mocked(commands.saveCredentials).mockRejectedValueOnce(
    new Error("Cannot save"),
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Cannot save");
  expect(screen.queryByRole("button", { name: "Retry loading" })).toBeNull();
  expect((key as HTMLInputElement).value).toBe("new-key");
  expect((app as HTMLInputElement).value).toBe("new-app");
  vi.mocked(commands.getCredentials).mockResolvedValueOnce(
    ok({ app_id: "new-app", api_key: "new-key" }),
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(commands.saveCredentials).toHaveBeenCalledWith({
      app_id: "new-app",
      api_key: "new-key",
    }),
  );
  expect((key as HTMLInputElement).value).toBe("new-key");
  expect((app as HTMLInputElement).value).toBe("new-app");
});

it("reloads saved credentials when Settings reopens without Welcome", async () => {
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({ app_id: "app", api_key: "saved-key" }),
  );
  const user = userEvent.setup();
  const { rerender } = render(
    <AppScopes>
      <Settings />
    </AppScopes>,
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Edamam API Key") as HTMLInputElement).value,
    ).toBe("saved-key"),
  );
  await user.clear(screen.getByLabelText("Edamam API Key"));
  await user.type(screen.getByLabelText("Edamam API Key"), "unsaved-key");
  rerender(<AppScopes>{null}</AppScopes>);
  rerender(
    <AppScopes>
      <Settings />
    </AppScopes>,
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Edamam API Key") as HTMLInputElement).value,
    ).toBe("saved-key"),
  );
  expect(commands.getCredentials).toHaveBeenCalledTimes(2);
  expect(commands.getCredentials).toHaveBeenLastCalledWith();
});
