import { commands, ok } from "@/test-support/ipc";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import MobileShell from "@/mobile/MobileShell";
import { AppScopes } from "@/test-support/scopes";
import { analysis, recipe } from "@/test-support/fixtures";

it("shares an Explorer plan addition with the planner, drawer and shopping list", async () => {
  const soup = recipe({ analysis: analysis() });
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([soup]));
  vi.mocked(commands.addToDay).mockResolvedValueOnce(
    ok({ days: [[soup.id], [], [], [], [], []] }),
  );
  const user = userEvent.setup();
  render(<MobileShell />, { wrapper: AppScopes });
  const explorer = screen.getByRole("region", { name: "Explorer" });
  explorer.scrollTop = 120;
  await user.click(await screen.findByRole("button", { name: "Soup" }));
  const drawer = screen.getByRole("dialog", { name: "Soup" });
  vi.mocked(commands.shoppingList).mockResolvedValueOnce(
    ok([{ food_id: "onion", name: "Onion", weight: 80 }]),
  );
  await user.click(within(drawer).getByRole("button", { name: "D1" }));
  await within(drawer).findByText("Added to D1");
  await user.click(within(drawer).getByRole("button", { name: "Close" }));
  await user.click(screen.getByRole("button", { name: "Weekly Plan" }));
  await user.click(screen.getByRole("button", { name: "Soup 100 kcal" }));
  expect(screen.getByRole("dialog", { name: "Soup" })).toBe(drawer);
  await user.click(within(drawer).getByRole("button", { name: "Close" }));
  await user.click(screen.getByRole("button", { name: "Shop" }));
  expect(screen.getByRole("row", { name: "Onion 80 g" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("form", { name: "Edamam credentials" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Explorer" }));
  expect(screen.getByRole("region", { name: "Explorer" }).scrollTop).toBe(120);
  expect(screen.queryByRole("form", { name: "Edamam credentials" })).toBeNull();
});

it("surfaces a failed edit request and allows returning to the recipe", async () => {
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([recipe()]));
  vi.mocked(commands.getRecipe).mockResolvedValueOnce({
    status: "error",
    error: { kind: "not_found", detail: "Recipe no longer exists" },
  });
  const user = userEvent.setup();
  render(<MobileShell />, { wrapper: AppScopes });
  await user.click(await screen.findByRole("button", { name: "Soup" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const editor = screen.getByRole("dialog", { name: "Edit Recipe" });
  expect(within(editor).getByRole("alert").textContent).toContain(
    "Recipe no longer exists",
  );
  await user.click(within(editor).getByRole("button", { name: "Cancel" }));
  await user.click(
    within(screen.getByRole("dialog", { name: "Soup" })).getByRole("button", {
      name: "Close",
    }),
  );
  expect(screen.queryByRole("alert")).toBeNull();
});
