import { commands } from "@/test-support/ipc";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MobileShell from "@/mobile/MobileShell";
import { AppScopes } from "@/test-support/scopes";
import {
  useDrawerActions,
  useDrawerOpen,
  useDrawerRecipeId,
} from "@/stores/DrawerStore";

vi.mock("@/features/settings", () => ({
  Welcome: () => <div>Welcome fixture</div>,
}));
vi.mock("@/mobile/explorer", () => ({
  default: function Explorer({ active }: { active: boolean }) {
    const drawer = useDrawerActions();
    return (
      <>
        <h1 data-active={active}>Meal Explorer</h1>
        <button onClick={() => drawer.openRecipe("shared-recipe")}>
          Explorer recipe
        </button>
      </>
    );
  },
}));
vi.mock("@/mobile/planner", () => ({
  default: function Planner({ active }: { active: boolean }) {
    const drawer = useDrawerActions();
    return (
      <>
        <h1 data-active={active}>Weekly Plan</h1>
        <button onClick={() => drawer.openRecipe("shared-recipe")}>
          Planned recipe
        </button>
        <button onClick={() => drawer.openEdit("missing")}>Edit missing</button>
      </>
    );
  },
}));

vi.mock("@/mobile/shopping", () => ({
  default: ({ active }: { active: boolean }) => (
    <h1 data-active={active}>Shopping fixture</h1>
  ),
}));
vi.mock("@/mobile/settings", () => ({
  default: ({ active }: { active: boolean }) => (
    <h1 data-active={active}>Settings fixture</h1>
  ),
}));
vi.mock("@/mobile/drawer", () => ({
  default: function Drawer() {
    const open = useDrawerOpen();
    const recipeId = useDrawerRecipeId();
    const drawer = useDrawerActions();
    return (
      <div role="dialog" aria-label="Drawer fixture" hidden={!open}>
        <span>{recipeId}</span>
        <button onClick={drawer.close}>Close fixture</button>
      </div>
    );
  },
}));

it("switches all four screens while retaining panels and shares one recipe drawer across tabs", async () => {
  const user = userEvent.setup();
  render(<MobileShell />, { wrapper: AppScopes });
  const explorer = screen.getByRole("region", { name: "Explorer" });
  explorer.scrollTop = 120;
  await user.click(screen.getByRole("button", { name: "Explorer recipe" }));
  const drawer = screen.getByRole("dialog", { name: "Drawer fixture" });
  expect(drawer.textContent).toContain("shared-recipe");
  await user.click(screen.getByRole("button", { name: "Close fixture" }));
  for (const label of ["Weekly Plan", "Shop", "Settings", "Explorer"]) {
    await user.click(screen.getByRole("button", { name: label }));
    expect(
      screen.getByRole("button", { name: label }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("region", { name: label }).getAttribute("data-active"),
    ).toBe("true");
    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.getByRole("heading").getAttribute("data-active")).toBe(
      "true",
    );
    expect(screen.getByText("Welcome fixture").closest("[inert]")).toBeNull();
    expect(
      screen.getByText("Welcome fixture").closest('[aria-hidden="true"]'),
    ).toBeNull();
    expect(
      screen
        .getAllByRole("heading", { hidden: true })
        .filter((heading) => heading.getAttribute("data-active") === "false"),
    ).toHaveLength(3);
  }
  expect(screen.getByRole("region", { name: "Explorer" })).toBe(explorer);
  expect(explorer.scrollTop).toBe(120);
  await user.click(screen.getByRole("button", { name: "Weekly Plan" }));
  await user.click(screen.getByRole("button", { name: "Planned recipe" }));
  expect(screen.getByRole("dialog", { name: "Drawer fixture" })).toBe(drawer);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "File" })).toBeNull();
});

it("surfaces and dismisses recipe load errors without an editor draft", async () => {
  vi.mocked(commands.getRecipe).mockResolvedValueOnce({
    status: "error",
    error: { kind: "not_found", detail: "Recipe no longer exists" },
  });
  const user = userEvent.setup();
  render(<MobileShell />, { wrapper: AppScopes });
  await user.click(screen.getByRole("button", { name: "Weekly Plan" }));
  await user.click(screen.getByRole("button", { name: "Edit missing" }));
  expect(screen.getByRole("alert").textContent).toContain(
    "Recipe no longer exists",
  );
  await user.click(screen.getByRole("button", { name: "Close fixture" }));
  expect(screen.getByRole("alert").textContent).toContain(
    "Recipe no longer exists",
  );
  await user.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).toBeNull();
});
