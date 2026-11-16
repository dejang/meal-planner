import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { SettingsScope, useSettingsActions } from "../../stores/SettingsStore";
import Settings, { Welcome } from ".";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(openUrl).mockReset().mockResolvedValue();
});

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
    vi.mocked(invoke).mockResolvedValue({ app_id, api_key });
    render(
      <StrictMode>
        <SettingsScope>
          <Welcome />
        </SettingsScope>
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
  vi.mocked(invoke).mockResolvedValue({ app_id: "", api_key: "" });
  const user = userEvent.setup();
  render(
    <SettingsScope>
      <Welcome />
      <Reload />
    </SettingsScope>,
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
  await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("recovers a failed startup load through Settings without showing Welcome early", async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error("Cannot load credentials"));
  const user = userEvent.setup();
  render(
    <SettingsScope>
      <Welcome />
      <Settings />
    </SettingsScope>,
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Cannot load credentials",
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  vi.mocked(invoke).mockResolvedValue({ app_id: "", api_key: "" });
  await user.click(screen.getByRole("button", { name: "Retry loading" }));
  expect(await screen.findByRole("dialog", { name: "Welcome" })).toBeTruthy();
});

it.each(["Edamam API Key", "Edamam APP ID"])(
  "does not open Welcome when clearing or saving an empty %s in Settings",
  async (label) => {
    vi.mocked(invoke).mockResolvedValue({ app_id: "app", api_key: "key" });
    const user = userEvent.setup();
    render(
      <SettingsScope>
        <Welcome />
        <Settings />
      </SettingsScope>,
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
    vi.mocked(invoke)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(credentials);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect((field as HTMLInputElement).disabled).toBe(false),
    );
    expect(invoke).toHaveBeenCalledWith("save_credentials", { credentials });
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("dialog", { name: "Welcome" })).toBeNull();
  },
);

it("preserves edits on save failure and persists them on retry", async () => {
  vi.mocked(invoke).mockResolvedValue({
    app_id: "old-app",
    api_key: "old-key",
  });
  const user = userEvent.setup();
  render(
    <SettingsScope>
      <Settings />
    </SettingsScope>,
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
  vi.mocked(invoke).mockRejectedValueOnce(new Error("Cannot save"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Cannot save");
  expect(screen.queryByRole("button", { name: "Retry loading" })).toBeNull();
  expect((key as HTMLInputElement).value).toBe("new-key");
  expect((app as HTMLInputElement).value).toBe("new-app");
  vi.mocked(invoke)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ app_id: "new-app", api_key: "new-key" });
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith("save_credentials", {
      credentials: { app_id: "new-app", api_key: "new-key" },
    }),
  );
  expect((key as HTMLInputElement).value).toBe("new-key");
  expect((app as HTMLInputElement).value).toBe("new-app");
});

it("reloads saved credentials when Settings reopens without Welcome", async () => {
  vi.mocked(invoke).mockResolvedValue({ app_id: "app", api_key: "saved-key" });
  const user = userEvent.setup();
  const { rerender } = render(
    <SettingsScope>
      <Settings />
    </SettingsScope>,
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Edamam API Key") as HTMLInputElement).value,
    ).toBe("saved-key"),
  );
  await user.clear(screen.getByLabelText("Edamam API Key"));
  await user.type(screen.getByLabelText("Edamam API Key"), "unsaved-key");
  rerender(<SettingsScope>{null}</SettingsScope>);
  rerender(
    <SettingsScope>
      <Settings />
    </SettingsScope>,
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Edamam API Key") as HTMLInputElement).value,
    ).toBe("saved-key"),
  );
  expect(invoke).toHaveBeenCalledTimes(2);
  expect(invoke).toHaveBeenLastCalledWith("get_credentials");
});
