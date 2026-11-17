import { commands, ok } from "@/test-support/ipc";
import { act, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { PlanScope, usePlanActions } from "@/stores/PlanStore";
import Shopping from "@/mobile/shopping";

it("displays aggregated weights, checks items locally, and refreshes after plan changes", async () => {
  const items = [
    { food_id: "tomato", name: "Tomatoes", weight: 125.5 },
    { food_id: "rice", name: "Rice", weight: 1500 },
  ];
  vi.mocked(commands.shoppingList).mockResolvedValue(ok(items));
  const user = userEvent.setup();
  const { result } = renderHook(usePlanActions, {
    wrapper: ({ children }) => (
      <PlanScope>
        {children}
        <Shopping active />
      </PlanScope>
    ),
  });

  const table = await screen.findByRole("table", { name: "Shopping list" });
  expect(screen.getByRole("heading", { name: "Shopping List" })).toBeTruthy();
  expect(screen.getByText("2 items")).toBeTruthy();
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Ingredient", "Amount"]);
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(within(table).getByText("126 g")).toBeTruthy();
  expect(within(table).getByText("1500 g")).toBeTruthy();
  expect(commands.shoppingList).toHaveBeenCalledOnce();

  const tomato = screen.getByRole<HTMLInputElement>("checkbox", {
    name: "Tomatoes",
  });
  const rice = screen.getByRole<HTMLInputElement>("checkbox", { name: "Rice" });
  await user.click(tomato);
  expect(tomato.checked).toBe(true);
  expect(tomato.closest("tr")?.getAttribute("data-checked")).toBe("true");
  expect(rice.checked).toBe(false);
  await user.click(tomato);
  expect(tomato.checked).toBe(false);
  expect(tomato.closest("tr")?.getAttribute("data-checked")).toBe("false");
  await user.click(rice);
  expect(rice.checked).toBe(true);
  expect(commands.shoppingList).toHaveBeenCalledOnce();
  expect(commands.getPlan).toHaveBeenCalledOnce();

  vi.mocked(commands.clearDay).mockResolvedValue(
    ok({ days: [[], [], [], [], [], []] }),
  );
  vi.mocked(commands.shoppingList).mockResolvedValue(
    ok([{ ...items[1], weight: 750 }]),
  );
  await act(() => result.current.clearDay(0));
  expect(commands.shoppingList).toHaveBeenCalledTimes(2);
  expect(screen.getByText("1 item")).toBeTruthy();
  expect(screen.getByText("750 g")).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "Tomatoes" })).toBeNull();
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Rice" }).checked,
  ).toBe(true);
});
