import { commands, ok } from "@/test-support/ipc";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { WeeklyPlan } from "@/api";
import MobileShell from "@/mobile/MobileShell";
import Planner from "@/mobile/planner";
import Gallery from "@/features/gallery";
import { analysis, recipe } from "@/test-support/fixtures";
import { AppScopes } from "@/test-support/scopes";
import { useDrawerOpen, useDrawerRecipeId } from "@/stores/DrawerStore";

beforeEach(() => {
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([
      recipe({ id: "soup", title: "Soup", analysis: analysis() }),
      recipe({
        id: "salad",
        title: "Salad",
        servings: 1,
        analysis: analysis(),
      }),
    ]),
  );
  vi.mocked(commands.getPlan).mockResolvedValue(
    ok({ days: [["soup", "salad"], ["salad"], [], [], [], []] }),
  );
  vi.mocked(commands.dayTotals).mockImplementation(async (day) =>
    ok({
      ...analysis(),
      calories: 300 + day * 100,
      totalNutrients: { FAT: { label: "Fat", quantity: 20 + day, unit: "g" } },
      totalDaily: { FAT: { label: "Fat", quantity: 26 + day, unit: "%" } },
    }),
  );
});

async function mountPlanner() {
  const user = userEvent.setup();
  render(<Planner active />, { wrapper: AppScopes });
  await screen.findByText("100 kcal");
  await waitFor(() => expect(commands.dayTotals).toHaveBeenCalledTimes(6));
  return user;
}

it("keeps header actions in sync with all six days through navigation and settled swipes", async () => {
  const user = await mountPlanner();
  expect(screen.queryByRole("button", { name: "Copy Prev" })).toBeNull();
  const header = screen.getByRole("banner");
  expect(
    Array.from(header.querySelectorAll("button, h1")).map(
      (element) => element.getAttribute("aria-label") ?? element.textContent,
    ),
  ).toEqual(["Previous day", "Day 1", "Next day", "Clear"]);
  expect(
    (screen.getByRole("button", { name: "Previous day" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  for (let day = 2; day <= 6; day++) {
    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect(screen.getByRole("heading", { name: `Day ${day}` })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Copy Prev" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      screen
        .getByRole("button", { name: `Go to Day ${day}` })
        .getAttribute("aria-current"),
    ).toBe("page");
  }
  expect(
    (screen.getByRole("button", { name: "Next day" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Previous day" }));
  expect(screen.getByRole("heading", { name: "Day 5" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Go to Day 1" }));
  const viewport = screen.getByRole("group", {
    name: "Planned days swipe area",
  });
  Object.defineProperty(viewport, "clientWidth", { value: 390 });
  fireEvent.touchStart(viewport);
  viewport.scrollLeft = 390;
  fireEvent.scroll(viewport);
  fireEvent.touchEnd(viewport);
  fireEvent(viewport, new Event("scrollend"));
  expect(screen.getByRole("heading", { name: "Day 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy Prev" })).toBeTruthy();
  viewport.scrollLeft = 0;
  fireEvent(viewport, new Event("scrollend"));
  expect(screen.getByRole("heading", { name: "Day 1" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Copy Prev" })).toBeNull();
});

it("shows plan errors after the day heading and reloads the plan on retry", async () => {
  vi.mocked(commands.getPlan).mockRejectedValueOnce(
    new Error("Plan unavailable"),
  );
  const user = userEvent.setup();
  render(<Planner active />, { wrapper: AppScopes });

  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Plan unavailable");
  const heading = screen.getByRole("heading", { name: "Day 1" });
  expect(heading.compareDocumentPosition(alert)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );

  await user.click(within(alert).getByRole("button", { name: "Retry" }));
  await screen.findByText("100 kcal");
  expect(commands.getPlan).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alert")).toBeNull();
});

it.each([
  {
    name: "remove",
    button: "Remove Soup",
    day: 0,
    command: commands.removeFromDay,
    args: [{ day: 0, row: 0 }],
    meals: ["salad"],
  },
  {
    name: "clear",
    button: "Clear",
    day: 0,
    command: commands.clearDay,
    args: [0],
    meals: [],
  },
  {
    name: "copy previous",
    button: "Copy Prev",
    day: 1,
    command: commands.copyPreviousDay,
    args: [1],
    meals: ["soup", "salad"],
  },
  {
    name: "move down",
    button: "Move Soup down",
    day: 0,
    command: commands.moveMeal,
    args: [
      { day: 0, row: 0 },
      { day: 0, row: 1 },
    ],
    meals: ["salad", "soup"],
  },
  {
    name: "move up",
    button: "Move Salad up",
    day: 0,
    command: commands.moveMeal,
    args: [
      { day: 0, row: 1 },
      { day: 0, row: 0 },
    ],
    meals: ["salad", "soup"],
  },
])(
  "updates the active day's meals and totals after $name",
  async ({ button, day, command, args, meals }) => {
    const user = await mountPlanner();
    const changed: WeeklyPlan = {
      days: [["soup", "salad"], ["salad"], [], [], [], []],
    };
    changed.days[day] = meals;
    vi.mocked(command).mockResolvedValueOnce(ok(changed));
    vi.mocked(commands.dayTotals).mockResolvedValue(
      ok({ ...analysis(), calories: 777 }),
    );
    await user.click(
      screen.getByRole("button", { name: `Go to Day ${day + 1}` }),
    );
    const page = within(
      screen.getByRole("group", { name: `Day ${day + 1} meals` }),
    );
    await user.click(
      button === "Clear" || button === "Copy Prev"
        ? screen.getByRole("button", { name: button })
        : page.getByRole("button", { name: button }),
    );
    await waitFor(() =>
      expect(command).toHaveBeenCalledExactlyOnceWith(...args),
    );
    await waitFor(() =>
      expect(
        page.getByRole("region", { name: "Nutrition Facts" }).textContent,
      ).toContain("777"),
    );
    expect(
      page
        .queryAllByRole("listitem")
        .map((item) => item.querySelector("strong")?.textContent),
    ).toEqual(meals.map((id) => (id === "soup" ? "Soup" : "Salad")));
    if (!meals.length) expect(page.getByText("No meals planned")).toBeTruthy();
  },
);

function DrawerState() {
  const open = useDrawerOpen();
  const id = useDrawerRecipeId();
  return <output aria-label="Drawer selection">{open ? id : "closed"}</output>;
}

it("opens the shared recipe drawer and displays per-portion calories and each day's USDA totals", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Planner active />
      <DrawerState />
    </>,
    { wrapper: AppScopes },
  );
  await screen.findByText("100 kcal");
  const first = within(screen.getByRole("group", { name: "Day 1 meals" }));
  expect(first.getByText("200 kcal")).toBeTruthy();
  const label = within(first.getByRole("region", { name: "Nutrition Facts" }));
  expect(await label.findByText("300")).toBeTruthy();
  expect(label.getByText("20g")).toBeTruthy();
  expect(label.getByText("26%")).toBeTruthy();
  await user.click(first.getByRole("button", { name: "Soup 100 kcal" }));
  expect(screen.getByLabelText("Drawer selection").textContent).toBe("soup");
  await user.click(screen.getByRole("button", { name: "Next day" }));
  const second = within(screen.getByRole("group", { name: "Day 2 meals" }));
  expect(second.getByText("400")).toBeTruthy();
  expect(second.getByText("21g")).toBeTruthy();
  expect(second.getByText("27%")).toBeTruthy();
  await user.click(second.getByRole("button", { name: "Vitamins & Minerals" }));
  expect(
    second
      .getByRole("button", { name: "Vitamins & Minerals" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});

it("adds a picked recipe to an empty day", async () => {
  const user = await mountPlanner();
  vi.mocked(commands.addToDay).mockResolvedValueOnce(
    ok({ days: [["soup", "salad"], ["salad"], ["soup"], [], [], []] }),
  );
  await user.click(screen.getByRole("button", { name: "Go to Day 3" }));
  const page = within(screen.getByRole("group", { name: "Day 3 meals" }));
  await user.click(page.getByRole("button", { name: "Pick a recipe" }));
  await user.click(page.getByRole("button", { name: "Soup" }));
  await waitFor(() =>
    expect(commands.addToDay).toHaveBeenCalledExactlyOnceWith(
      { day: 2, row: 0 },
      "soup",
    ),
  );
  expect(await page.findByText("100 kcal")).toBeTruthy();
  expect(page.queryByText("No meals planned")).toBeNull();
});

it("keeps picker searches separate from Explorer and resets them on reopening", async () => {
  const user = userEvent.setup();
  vi.mocked(commands.searchRecipes).mockImplementation(async (query) =>
    ok(
      [
        recipe({ id: "soup", title: "Soup" }),
        recipe({ id: "salad", title: "Salad" }),
      ].filter((item) =>
        item.title.toLowerCase().includes(query.toLowerCase()),
      ),
    ),
  );
  render(
    <>
      <Planner active />
      <Gallery />
    </>,
    { wrapper: AppScopes },
  );
  const gallery = within(screen.getByRole("region", { name: "Gallery" }));
  await gallery.findByRole("button", { name: "Soup" });
  const explorerSearch = gallery.getByRole("searchbox", {
    name: "Search recipes",
  });
  await user.type(explorerSearch, "Salad");
  await waitFor(() =>
    expect(gallery.queryByRole("button", { name: "Soup" })).toBeNull(),
  );

  await user.click(screen.getByRole("button", { name: "Go to Day 3" }));
  const page = within(screen.getByRole("group", { name: "Day 3 meals" }));
  await user.click(page.getByRole("button", { name: "Pick a recipe" }));
  await page.findByRole("button", { name: "Soup" });
  expect(page.getByRole("button", { name: "Salad" })).toBeTruthy();
  await user.type(
    page.getByRole("searchbox", { name: "Search recipes" }),
    "Soup",
  );
  await waitFor(() =>
    expect(page.queryByRole("button", { name: "Salad" })).toBeNull(),
  );
  expect((explorerSearch as HTMLInputElement).value).toBe("Salad");
  expect(gallery.getByRole("button", { name: "Salad" })).toBeTruthy();
  expect(gallery.queryByRole("button", { name: "Soup" })).toBeNull();

  await user.click(page.getByRole("button", { name: "Close recipe picker" }));
  await user.click(page.getByRole("button", { name: "Pick a recipe" }));
  expect(
    (
      page.getByRole("searchbox", {
        name: "Search recipes",
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  await page.findByRole("button", { name: "Salad" });
  expect(page.getByRole("button", { name: "Soup" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Go to Day 4" }));
  const otherDay = within(screen.getByRole("group", { name: "Day 4 meals" }));
  await user.click(otherDay.getByRole("button", { name: "Pick a recipe" }));
  expect(
    (
      otherDay.getByRole("searchbox", {
        name: "Search recipes",
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  await otherDay.findByRole("button", { name: "Salad" });
  expect(otherDay.getByRole("button", { name: "Soup" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Go to Day 3" }));
  expect(page.getByRole("button", { name: "Pick a recipe" })).toBeTruthy();
});

it("does not offer a recipe deleted in Explorer after leaving the picker open", async () => {
  const user = userEvent.setup();
  const soup = recipe({ id: "soup", title: "Soup" });
  const salad = recipe({ id: "salad", title: "Salad" });
  let recipes = [soup, salad];
  vi.mocked(commands.getPlan).mockResolvedValue(
    ok({ days: [[], [], [], [], [], []] }),
  );
  vi.mocked(commands.listRecipes).mockImplementation(async () => ok(recipes));
  vi.mocked(commands.getRecipe).mockResolvedValue(ok(soup));
  vi.mocked(commands.deleteRecipe).mockImplementation(async (id) => {
    recipes = recipes.filter((item) => item.id !== id);
    return ok(null);
  });
  render(<MobileShell />, { wrapper: AppScopes });
  const plannerTab = screen.getByRole("button", { name: "Weekly Plan" });
  await user.click(plannerTab);
  const page = within(screen.getByRole("group", { name: "Day 1 meals" }));
  await user.click(page.getByRole("button", { name: "Pick a recipe" }));
  await page.findByRole("button", { name: "Soup" });

  await user.click(screen.getByRole("button", { name: "Explorer" }));
  await user.click(screen.getByRole("button", { name: "Soup" }));
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(screen.getByRole("button", { name: "Confirm delete" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Soup" })).toBeNull(),
  );

  await user.click(plannerTab);
  await user.click(page.getByRole("button", { name: "Pick a recipe" }));
  await page.findByRole("button", { name: "Salad" });
  expect(page.queryByRole("button", { name: "Soup" })).toBeNull();
});
