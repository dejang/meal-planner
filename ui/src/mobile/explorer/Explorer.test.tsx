import { commands, ok } from "@/test-support/ipc";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { analysis, deferred, recipe } from "@/test-support/fixtures";
import { AppScopes } from "@/test-support/scopes";
import Explorer from "@/mobile/explorer";
import {
  useDrawerMode,
  useDrawerOpen,
  useDrawerRecipeId,
} from "@/stores/DrawerStore";

function ExplorerHarness() {
  const open = useDrawerOpen();
  const mode = useDrawerMode();
  const recipeId = useDrawerRecipeId();
  return (
    <>
      <Explorer active />
      <output aria-label="Drawer state">
        {JSON.stringify({ open, mode, recipeId })}
      </output>
    </>
  );
}

it("renders photo cards with per-portion calories and opens view and create modes", async () => {
  const user = userEvent.setup();
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([
      recipe({
        id: "curry",
        title: "Chickpea Curry",
        servings: 4,
        analysis: { ...analysis(), calories: 1643 },
      }),
      recipe({
        id: "oats",
        title: "Oatmeal & Berries",
        servings: 1,
        analysis: { ...analysis(), calories: 320 },
      }),
      recipe({ id: "salad", title: "Greek Salad", image_version: null }),
    ]),
  );
  render(<ExplorerHarness />, { wrapper: AppScopes });
  const list = screen.getByRole("list", { name: "Recipes" });
  const curry = await within(list).findByRole("button", {
    name: "Chickpea Curry",
    description: "410 kcal · 4 portions",
  });
  expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  expect(
    within(curry).getByRole("img", { name: "Chickpea Curry" }),
  ).toBeTruthy();
  expect(within(curry).getByText("410 kcal · 4 portions")).toBeTruthy();
  expect(within(list).getByText("320 kcal · 1 portion")).toBeTruthy();
  expect(
    within(list).getByText("Nutrition not available · 2 portions"),
  ).toBeTruthy();
  await user.click(curry);
  await waitFor(() =>
    expect(screen.getByLabelText("Drawer state").textContent).toBe(
      JSON.stringify({ open: true, mode: "view", recipeId: "curry" }),
    ),
  );
  await user.click(screen.getByRole("button", { name: "+ New" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Drawer state").textContent).toBe(
      JSON.stringify({ open: true, mode: "create", recipeId: null }),
    ),
  );
});

it("filters live through search and clears a no-results query to restore the library", async () => {
  const user = userEvent.setup();
  const curry = recipe({ id: "curry", title: "Chickpea Curry" });
  const oats = recipe({ id: "oats", title: "Oatmeal" });
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([curry, oats]));
  const pending =
    deferred<Awaited<ReturnType<typeof commands.searchRecipes>>>();
  vi.mocked(commands.searchRecipes)
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(ok([]));
  render(<Explorer active />, { wrapper: AppScopes });
  await screen.findByRole("button", { name: "Oatmeal" });
  expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  const search = screen.getByRole("searchbox", { name: "Search recipes" });
  await user.type(search, "c");
  expect(
    screen.getByRole("list", { name: "Recipes" }).getAttribute("aria-busy"),
  ).toBe("true");
  expect(screen.queryByText("Loading recipes…")).toBeNull();
  expect(screen.getByRole("button", { name: "Oatmeal" })).toBeTruthy();
  await act(async () => pending.resolve(ok([curry])));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Oatmeal" })).toBeNull(),
  );
  expect(screen.getByRole("button", { name: "Chickpea Curry" })).toBeTruthy();
  expect(commands.searchRecipes).toHaveBeenLastCalledWith("c");
  await user.type(search, "x");
  expect(await screen.findByText("No matching recipes")).toBeTruthy();
  const pendingNoResults =
    deferred<Awaited<ReturnType<typeof commands.searchRecipes>>>();
  vi.mocked(commands.searchRecipes).mockReturnValueOnce(
    pendingNoResults.promise,
  );
  await user.type(search, "y");
  expect(commands.searchRecipes).toHaveBeenLastCalledWith("cxy");
  expect(
    screen.getByRole("list", { name: "Recipes" }).getAttribute("aria-busy"),
  ).toBe("true");
  expect(screen.getByText("No matching recipes")).toBeTruthy();
  expect(screen.queryByText("Loading recipes…")).toBeNull();
  await act(async () => pendingNoResults.resolve(ok([])));
  expect(
    screen.queryByRole("button", { name: "Create or import a recipe" }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  expect(document.activeElement).toBe(search);
  await screen.findByRole("button", { name: "Oatmeal" });
  expect((search as HTMLInputElement).value).toBe("");
  expect(screen.queryByText("No matching recipes")).toBeNull();
});

it("offers creation or import for an empty library", async () => {
  const user = userEvent.setup();
  render(<ExplorerHarness />, { wrapper: AppScopes });
  await user.click(
    await screen.findByRole("button", { name: "Create or import a recipe" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Drawer state").textContent).toBe(
      JSON.stringify({ open: true, mode: "create", recipeId: null }),
    ),
  );
  expect(screen.queryByText("No matching recipes")).toBeNull();
});

it("reports a failed load and retries without showing an empty-library prompt", async () => {
  const user = userEvent.setup();
  vi.mocked(commands.listRecipes).mockRejectedValueOnce(
    new Error("Library unavailable"),
  );
  render(<Explorer active />, { wrapper: AppScopes });
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Library unavailable",
  );
  expect(
    screen.queryByRole("button", { name: "Create or import a recipe" }),
  ).toBeNull();
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([recipe()]));
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("button", { name: "Soup" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
