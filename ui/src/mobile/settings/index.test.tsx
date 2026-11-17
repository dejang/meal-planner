import { commands, ok } from "@/test-support/ipc";
import { openUrl } from "@tauri-apps/plugin-opener";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SettingsScope } from "@/stores/SettingsStore";
import { AppScopes } from "@/test-support/scopes";
import MobileShell from "@/mobile/MobileShell";
import Settings from "@/mobile/settings";

it.each([
  { app_id: "old-app", api_key: "old-key", welcome: false },
  { app_id: "", api_key: "", welcome: true },
])(
  "loads credentials, masks the key, and confirms only successful saves: $welcome",
  async ({ app_id, api_key, welcome }) => {
    vi.mocked(commands.getCredentials).mockResolvedValue(
      ok({ app_id, api_key }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<Settings active />, {
      wrapper: SettingsScope,
    });
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    const app = screen.getByLabelText<HTMLInputElement>("Edamam APP ID");
    const key = screen.getByLabelText<HTMLInputElement>("Edamam API Key");
    expect(app.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Loading credentials…");
    await waitFor(() => expect(app.disabled).toBe(false));
    expect(app.value).toBe(app_id);
    expect(key.value).toBe(api_key);
    expect(
      Boolean(screen.queryByRole("complementary", { name: "Welcome" })),
    ).toBe(welcome);
    expect(key.type).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show API key" }));
    expect(key.type).toBe("text");
    expect(key.value).toBe(api_key);
    await user.click(screen.getByRole("button", { name: "Hide API key" }));
    expect(key.type).toBe("password");
    await user.clear(app);
    await user.type(app, "new-app");
    await user.clear(key);
    await user.type(key, "new-key");

    vi.mocked(commands.saveCredentials).mockRejectedValueOnce(
      new Error("Cannot save"),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Cannot save");
    expect(screen.queryByText("Credentials saved.")).toBeNull();
    expect(app.value).toBe("new-app");
    expect(key.value).toBe("new-key");

    vi.mocked(commands.getCredentials).mockResolvedValueOnce(
      ok({ app_id: "new-app", api_key: "new-key" }),
    );
    let finishSave!: (result: ReturnType<typeof ok<null>>) => void;
    vi.mocked(commands.saveCredentials).mockReturnValueOnce(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Saving…" })
        .disabled,
    ).toBe(true);
    expect(app.disabled).toBe(true);
    expect(screen.queryByText("Credentials saved.")).toBeNull();
    finishSave(ok(null));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Credentials saved."),
    );
    expect(commands.saveCredentials).toHaveBeenLastCalledWith({
      app_id: "new-app",
      api_key: "new-key",
    });
    expect(app.value).toBe("new-app");
    expect(key.value).toBe("new-key");
    expect(screen.queryByRole("complementary", { name: "Welcome" })).toBeNull();
    await user.type(app, "-edited");
    expect(screen.queryByText("Credentials saved.")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Welcome" })).toBeNull();
    rerender(<Settings active key="remounted" />);
    expect(screen.queryByRole("complementary", { name: "Welcome" })).toBeNull();
  },
);

it("offers nonblocking onboarding for missing credentials", async () => {
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({ app_id: "", api_key: "" }),
  );
  const user = userEvent.setup();
  render(<MobileShell />, { wrapper: AppScopes });
  await user.click(screen.getByRole("button", { name: "Settings" }));
  const welcome = await screen.findByRole("complementary", { name: "Welcome" });
  expect(welcome.textContent).toContain("free Recipe Nutrition API plan");
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Explorer" }));
  expect(
    screen
      .getByRole("region", { name: "Explorer" })
      .getAttribute("data-active"),
  ).toBe("true");
});

it("allows retry after a load failure without showing onboarding prematurely", async () => {
  vi.mocked(commands.getCredentials).mockRejectedValueOnce(
    new Error("Cannot load"),
  );
  const user = userEvent.setup();
  render(<Settings active />, { wrapper: SettingsScope });
  expect((await screen.findByRole("alert")).textContent).toBe("Cannot load");
  expect(screen.queryByRole("complementary", { name: "Welcome" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Retry loading" }));
  expect(
    await screen.findByRole("complementary", { name: "Welcome" }),
  ).toBeTruthy();
});

it("opens Edamam through the opener and lets users retry browser failures", async () => {
  const user = userEvent.setup();
  render(<Settings active />, { wrapper: SettingsScope });
  vi.mocked(openUrl).mockRejectedValueOnce(new Error("Cannot open browser"));
  await user.click(screen.getByRole("button", { name: "Visit edamam.com" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Cannot open browser",
  );
  await user.click(screen.getByRole("button", { name: "Visit edamam.com" }));
  expect(openUrl).toHaveBeenLastCalledWith("https://www.edamam.com/");
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
