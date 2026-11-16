import { commands, ok } from "@/test-support/ipc";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AnalysisResponse, ShoppingItem, WeeklyPlan } from "@/api";
import type { RecipeDragPayload } from "@/lib/recipeDrag";
import { AppScopes } from "@/test-support/scopes";
import {
  usePlanActions,
  usePlanDayTotals,
  usePlanError,
  usePlanLoading,
  usePlanShoppingItems,
  usePlanWeeklyPlan,
} from "@/stores/PlanStore";

interface CommandCase {
  command: (typeof commands)[keyof ReturnType<typeof usePlanActions> &
    keyof typeof commands];
  run: (actions: ReturnType<typeof usePlanActions>) => Promise<void>;
  args: unknown[];
  getPlanCalls: number;
}

function mountPlan() {
  const plan: WeeklyPlan = {
    days: [["soup", "salad"], ["soup"], [], [], [], []],
  };
  const analysis: AnalysisResponse = {
    uri: "",
    yield: 1,
    calories: 320,
    totalCO2Emissions: 0,
    co2EmissionsClass: "",
    totalWeight: 0,
    dietLabels: [],
    healthLabels: [],
    cautions: [],
    totalNutrients: {},
    totalDaily: {},
    ingredients: [],
    cuisineType: [],
    mealType: [],
    dishType: [],
    totalNutrientsKCal: {},
  };
  const shoppingItems = [{ food_id: "tomato", name: "Tomatoes", weight: 125 }];
  vi.mocked(commands.getPlan).mockResolvedValue(ok(plan));
  vi.mocked(commands.dayTotals).mockImplementation(async (day) =>
    ok({ ...analysis, calories: day * 100 }),
  );
  vi.mocked(commands.shoppingList).mockResolvedValue(ok(shoppingItems));
  const hook = renderHook(
    () => ({
      actions: usePlanActions(),
      plan: usePlanWeeklyPlan(),
      totals: usePlanDayTotals(),
      shopping: usePlanShoppingItems(),
      loading: usePlanLoading(),
      error: usePlanError(),
    }),
    { wrapper: AppScopes },
  );
  const replacementAnalysis = { ...analysis, calories: 999 };
  const replacementShoppingItems = shoppingItems.map((item) => ({
    ...item,
    weight: 250,
  }));
  const changed: WeeklyPlan = { days: [[], ["soup"], [], [], [], []] };
  async function prepareChange() {
    await act(async () => {
      await hook.result.current.actions.reload();
    });
    vi.mocked(commands.dayTotals).mockResolvedValue(ok(replacementAnalysis));
    vi.mocked(commands.shoppingList).mockResolvedValue(
      ok(replacementShoppingItems),
    );
    vi.mocked(commands.clearDay).mockResolvedValueOnce(ok(changed));
  }
  return {
    ...hook,
    plan,
    analysis,
    shoppingItems,
    replacementAnalysis,
    replacementShoppingItems,
    changed,
    prepareChange,
  };
}

it.each([
  {
    command: commands.getPlan,
    run: (actions) => actions.reload(),
    args: [],
    getPlanCalls: 1,
  },
  {
    command: commands.addToDay,
    run: (actions) => actions.addToDay({ day: 2, row: 0 }, "soup"),
    args: [{ day: 2, row: 0 }, "soup"],
    getPlanCalls: 0,
  },
  {
    command: commands.moveMeal,
    run: (actions) => actions.moveMeal({ day: 0, row: 1 }, { day: 1, row: 0 }),
    args: [
      { day: 0, row: 1 },
      { day: 1, row: 0 },
    ],
    getPlanCalls: 0,
  },
  {
    command: commands.removeFromDay,
    run: (actions) => actions.removeFromDay({ day: 0, row: 1 }),
    args: [{ day: 0, row: 1 }],
    getPlanCalls: 0,
  },
  {
    command: commands.clearDay,
    run: (actions) => actions.clearDay(3),
    args: [3],
    getPlanCalls: 0,
  },
  {
    command: commands.copyPreviousDay,
    run: (actions) => actions.copyPreviousDay(4),
    args: [4],
    getPlanCalls: 0,
  },
] satisfies CommandCase[])(
  "stores command result and refreshes all projections ($args)",
  async ({ command, run, args, getPlanCalls }) => {
    const { result, plan, analysis, shoppingItems } = mountPlan();
    vi.mocked(command).mockResolvedValue(ok(plan));
    expect(result.current.plan.days).toEqual([[], [], [], [], [], []]);
    await act(async () => {
      await run(result.current.actions);
    });
    expect(command).toHaveBeenCalledExactlyOnceWith(...args);
    expect(result.current.plan).toEqual(plan);
    expect(result.current.totals).toEqual(
      plan.days.map((_, day) => ({ ...analysis, calories: day * 100 })),
    );
    expect(commands.dayTotals).toHaveBeenCalledTimes(6);
    for (const day of plan.days.keys())
      expect(commands.dayTotals).toHaveBeenCalledWith(day);
    expect(commands.shoppingList).toHaveBeenCalledTimes(1);
    expect(result.current.shopping).toEqual(shoppingItems);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(commands.getPlan).toHaveBeenCalledTimes(getPlanCalls);
  },
);

it.each([
  {
    fail: () =>
      vi.mocked(commands.clearDay).mockResolvedValueOnce({
        status: "error",
        error: { kind: "storage", detail: "Disk full" },
      }),
    message: "Disk full",
  },
  {
    fail: () =>
      vi
        .mocked(commands.clearDay)
        .mockRejectedValueOnce(new Error("Connection lost")),
    message: "Connection lost",
  },
])(
  "preserves the plan on command failure and permits retry: $message",
  async ({ fail, message }) => {
    const { result, plan } = mountPlan();
    await act(async () => {
      await result.current.actions.reload();
    });
    const previousTotals = result.current.totals;
    fail();
    await act(async () => {
      await result.current.actions.clearDay(0);
    });
    expect(result.current.error).toBe(message);
    expect(result.current.plan).toEqual(plan);
    expect(result.current.totals).toBe(previousTotals);
    expect(result.current.loading).toBe(false);
    await act(async () => {
      await result.current.actions.reload();
    });
    expect(result.current.error).toBeNull();
  },
);

it.each([
  {
    projection: "totals",
    fail: () =>
      vi.mocked(commands.dayTotals).mockResolvedValueOnce({
        status: "error",
        error: { kind: "analysis", detail: "Refresh failed" },
      }),
    calories: [0, 100, 200, 300, 400, 500],
    weights: [250],
  },
  {
    projection: "shopping",
    fail: () =>
      vi
        .mocked(commands.shoppingList)
        .mockRejectedValueOnce(new Error("Refresh failed")),
    calories: [999, 999, 999, 999, 999, 999],
    weights: [125],
  },
])(
  "keeps old $projection on failure and saves the other projection",
  async ({ fail, calories, weights }) => {
    const { result, changed, prepareChange } = mountPlan();
    await prepareChange();
    fail();
    await act(async () => {
      await result.current.actions.clearDay(0);
    });
    expect(result.current.plan).toEqual(changed);
    expect(result.current.totals.map((total) => total?.calories)).toEqual(
      calories,
    );
    expect(result.current.shopping.map((item) => item.weight)).toEqual(weights);
    expect(result.current.error).toBe("Refresh failed");
    expect(result.current.loading).toBe(false);
  },
);

it.each([
  {
    name: "same day down",
    from: { day: 0, row: 0 },
    target: { day: 0, row: 2 },
    expectedMove: [
      [
        { day: 0, row: 0 },
        { day: 0, row: 1 },
      ],
    ],
    expectedAdd: [],
    refreshes: 1,
  },
  {
    name: "same day up",
    from: { day: 0, row: 1 },
    target: { day: 0, row: 0 },
    expectedMove: [
      [
        { day: 0, row: 1 },
        { day: 0, row: 0 },
      ],
    ],
    expectedAdd: [],
    refreshes: 1,
  },
  {
    name: "dropped on itself",
    from: { day: 0, row: 0 },
    target: { day: 0, row: 0 },
    expectedMove: [],
    expectedAdd: [],
    refreshes: 0,
  },
  {
    name: "dropped immediately after itself",
    from: { day: 0, row: 0 },
    target: { day: 0, row: 1 },
    expectedMove: [],
    expectedAdd: [],
    refreshes: 0,
  },
  {
    name: "another day",
    from: { day: 0, row: 0 },
    target: { day: 1, row: 1 },
    expectedMove: [
      [
        { day: 0, row: 0 },
        { day: 1, row: 1 },
      ],
    ],
    expectedAdd: [],
    refreshes: 1,
  },
  {
    name: "gallery drop",
    from: null,
    target: { day: 1, row: 1 },
    expectedMove: [],
    expectedAdd: [[{ day: 1, row: 1 }, "soup"]],
    refreshes: 1,
  },
])(
  "handles $name through plan actions",
  async ({ from, target, expectedMove, expectedAdd, refreshes }) => {
    const { result, plan } = mountPlan();
    vi.mocked(commands.addToDay).mockResolvedValue(ok(plan));
    vi.mocked(commands.moveMeal).mockResolvedValue(ok(plan));
    const payload: RecipeDragPayload = { recipeId: "soup", position: from };
    await act(async () => {
      await result.current.actions.dropRecipe(payload, target);
    });
    expect(vi.mocked(commands.moveMeal).mock.calls).toEqual(expectedMove);
    expect(vi.mocked(commands.addToDay).mock.calls).toEqual(expectedAdd);
    expect(commands.dayTotals).toHaveBeenCalledTimes(6 * refreshes);
    expect(commands.shoppingList).toHaveBeenCalledTimes(refreshes);
  },
);

it.each([
  {
    pending: "totals" as const,
    loaded: "shopping" as const,
    delay: (wait: Promise<void>, analysis: AnalysisResponse) =>
      vi.mocked(commands.dayTotals).mockImplementationOnce(async () => {
        await wait;
        return ok(analysis);
      }),
  },
  {
    pending: "shopping" as const,
    loaded: "totals" as const,
    delay: (
      wait: Promise<void>,
      _analysis: AnalysisResponse,
      shopping: ShoppingItem[],
    ) =>
      vi.mocked(commands.shoppingList).mockImplementationOnce(async () => {
        await wait;
        return ok(shopping);
      }),
  },
])(
  "keeps current $pending while saving $loaded immediately",
  async ({ pending, loaded, delay }) => {
    const {
      result,
      replacementAnalysis,
      replacementShoppingItems,
      changed,
      prepareChange,
    } = mountPlan();
    await prepareChange();
    const previous = {
      totals: result.current.totals,
      shopping: result.current.shopping,
    };
    let release!: () => void;
    delay(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
      replacementAnalysis,
      replacementShoppingItems,
    );
    let refresh!: Promise<void>;
    await act(async () => {
      refresh = result.current.actions.clearDay(0);
    });
    expect(result.current.plan).toEqual(changed);
    expect(result.current.loading).toBe(true);
    expect(result.current[pending]).toBe(previous[pending]);
    expect(result.current[loaded]).not.toBe(previous[loaded]);
    await act(async () => {
      release();
      await refresh;
    });
    expect(result.current.totals[0]?.calories).toBe(999);
    expect(result.current.shopping[0]?.weight).toBe(250);
    expect(result.current.loading).toBe(false);
  },
);

it("serializes reload and mutations so an older snapshot cannot replace a mutation", async () => {
  const { result, plan } = mountPlan();
  let resolvePlan!: (
    value: Awaited<ReturnType<typeof commands.getPlan>>,
  ) => void;
  const deferred = new Promise<Awaited<ReturnType<typeof commands.getPlan>>>(
    (resolve) => {
      resolvePlan = resolve;
    },
  );
  vi.mocked(commands.getPlan).mockReturnValueOnce(deferred);
  const changed: WeeklyPlan = { days: [[], ["salad"], [], [], [], []] };
  vi.mocked(commands.moveMeal).mockResolvedValueOnce(ok(changed));
  let reload: Promise<void>;
  let move: Promise<void>;
  await act(async () => {
    reload = result.current.actions.reload();
    move = result.current.actions.moveMeal(
      { day: 0, row: 1 },
      { day: 1, row: 0 },
    );
  });
  expect(result.current.loading).toBe(true);
  expect(commands.moveMeal).not.toHaveBeenCalled();
  await act(async () => {
    resolvePlan(ok(plan));
    await reload;
    await move;
  });
  expect(result.current.plan).toEqual(changed);
  expect(result.current.loading).toBe(false);
  expect(commands.dayTotals).toHaveBeenCalledTimes(12);
});
