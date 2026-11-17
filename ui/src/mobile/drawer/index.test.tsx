import { commands, ok } from "@/test-support/ipc";
import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AppScopes } from "@/test-support/scopes";
import { analysis, recipe, deferred } from "@/test-support/fixtures";
import { useDrawerActions } from "@/stores/DrawerStore";
import RecipeDrawer from "@/mobile/drawer";
import { open } from "@tauri-apps/plugin-dialog";

function Harness() {
  const drawer = useDrawerActions();
  return (
    <>
      <button onClick={() => drawer.openRecipe("recipe-1")}>Inspect recipe</button>
      <button onClick={drawer.openCreate}>Create recipe</button>
      <RecipeDrawer />
    </>
  );
}

it("shows recipe details, numbered nonempty steps and confirms planning only after persistence", async () => {
  const user = userEvent.setup();
  const nutrition = analysis();
  nutrition.ingredients = [{ text: "1 onion", parsed: null }];
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([recipe({ analysis: nutrition, instructions: "Chop\n\n Simmer " })]),
  );
  const response = deferred<Awaited<ReturnType<typeof commands.addToDay>>>();
  vi.mocked(commands.addToDay).mockReturnValueOnce(response.promise);
  render(<Harness />, { wrapper: AppScopes });
  await user.click(screen.getByRole("button", { name: "Inspect recipe" }));
  const dialog = screen.getByRole("dialog", { name: "Soup" });
  expect(
    within(dialog).getByRole("img", { name: "Soup" }).getAttribute("src"),
  ).toBe("https://images.test/soup.jpg");
  expect(within(dialog).getByText("1 onion")).toBeTruthy();
  expect(within(dialog).getByText("Step 1")).toBeTruthy();
  expect(within(dialog).getByText("Step 2")).toBeTruthy();
  expect(within(dialog).queryByText("Step 3")).toBeNull();
  expect(within(dialog).getByRole("region", { name: "Nutrition Facts" })).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "D3" }));
  expect(commands.addToDay).toHaveBeenCalledExactlyOnceWith(
    { day: 2, row: 0 },
    "recipe-1",
  );
  expect(screen.queryByText("Added to D3")).toBeNull();
  await act(async () => response.resolve(ok({ days: [[], [], ["recipe-1"], [], [], []] })));
  expect(await screen.findByText("Added to D3")).toBeTruthy();
});

it("discards edits on Cancel, preserves failed saves, saves explicitly, and confirms deletion", async () => {
  const user = userEvent.setup();
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([recipe()]));
  render(<Harness />, { wrapper: AppScopes });
  await user.click(screen.getByRole("button", { name: "Inspect recipe" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.clear(screen.getByRole("textbox", { name: "Title" }));
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Discard me");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(commands.updateRecipe).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: "Soup" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.clear(screen.getByRole("textbox", { name: "Title" }));
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Dinner");
  vi.mocked(commands.updateRecipe).mockResolvedValueOnce({
    status: "error",
    error: { kind: "storage", detail: "Save failed" },
  });
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Save failed");
  expect(commands.updateRecipe).toHaveBeenCalledTimes(1);
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([recipe({ title: "Dinner" })]));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("dialog", { name: "Dinner" })).toBeTruthy();
  expect(commands.updateRecipe).toHaveBeenLastCalledWith(
    "recipe-1",
    expect.objectContaining({ title: "Dinner" }),
  );
  expect(commands.getPlan).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(commands.deleteRecipe).not.toHaveBeenCalled();
  vi.mocked(commands.deleteRecipe).mockResolvedValue(ok(null));
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([]));
  await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  expect(commands.deleteRecipe).toHaveBeenCalledExactlyOnceWith("recipe-1");
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull());
  expect(commands.getPlan).toHaveBeenCalledTimes(3);
});

it("imports into a new draft, updates photo and nutrition, and persists only on Save", async () => {
  const user = userEvent.setup();
  vi.mocked(commands.supportedSites).mockResolvedValue([
    { name: "Example recipes", domains: ["recipes.example"] },
  ]);
  vi.mocked(commands.importRecipe).mockResolvedValue(ok({
    title: "Imported soup",
    ingredients: ["1 carrot"],
    instructions: ["Boil"],
    servings: 4,
    image: null,
  }));
  vi.mocked(open).mockResolvedValue("/photos/soup.jpg");
  const image = { bytes: "aW1hZ2U=", width: 20, height: 10 };
  vi.mocked(commands.loadImageFile).mockResolvedValue(ok(image));
  vi.mocked(commands.loadImageUrl).mockResolvedValue(ok(image));
  render(<Harness />, { wrapper: AppScopes });
  await user.click(screen.getByRole("button", { name: "Create recipe" }));
  await user.click(screen.getByText("Supported sites"));
  expect(screen.getByText("Example recipes")).toBeTruthy();
  await user.type(screen.getByRole("textbox", { name: "Recipe URL" }), "https://recipes.example/soup");
  await user.click(screen.getByRole("button", { name: "Import" }));
  expect(await screen.findByDisplayValue("Imported soup")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Ingredients" })).toHaveProperty("value", "1 carrot");
  expect(screen.getByRole("region", { name: "Nutrition Facts" })).toBeTruthy();
  expect(commands.createRecipe).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Choose recipe photo" }));
  expect(commands.loadImageFile).toHaveBeenCalledWith("/photos/soup.jpg");
  await user.clear(screen.getByRole("textbox", { name: "Image URL" }));
  await user.type(screen.getByRole("textbox", { name: "Image URL" }), "https://images.example/soup.jpg");
  await user.tab();
  expect(commands.loadImageUrl).toHaveBeenCalledWith("https://images.example/soup.jpg");
  await user.click(screen.getByRole("button", { name: "Increase Portions" }));
  await user.type(screen.getByRole("textbox", { name: "Ingredients" }), "\n2 onions");
  await user.tab();
  expect(commands.analyzeIngredients).toHaveBeenLastCalledWith(["1 carrot", "2 onions"]);
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(commands.createRecipe).toHaveBeenCalledWith(expect.objectContaining({
    title: "Imported soup", servings: 5, image: { kind: "set", image },
  }));
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull());
  await user.click(screen.getByRole("button", { name: "Create recipe" }));
  await user.type(screen.getByRole("textbox", { name: "Title" }), "Discard new draft");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
  expect(commands.createRecipe).toHaveBeenCalledTimes(1);
});
