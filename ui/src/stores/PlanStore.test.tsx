import { invoke } from "@tauri-apps/api/core";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import {
  PlanScope,
  usePlanActions,
  usePlanDayTotals,
  usePlanError,
  usePlanLoading,
  usePlanShoppingItems,
  usePlanWeeklyPlan,
} from "./PlanStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "get_plan")
      return { days: [["recipe"], [], [], [], [], []] };
    if (command === "shopping_list") {
      return [{ food_id: "apple", name: "Apple", weight: 120 }];
    }
    if (command === "day_totals") {
      return {
        uri: "",
        yield: 1,
        calories: Number((args as { day: number }).day) + 100,
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
    }
    throw new Error(`Unexpected command: ${command}`);
  });
});

function usePlanSnapshot() {
  return {
    actions: usePlanActions(),
    plan: usePlanWeeklyPlan(),
    totals: usePlanDayTotals(),
    shopping: usePlanShoppingItems(),
    loading: usePlanLoading(),
    error: usePlanError(),
  };
}

it("reloads all projections and exposes loading until IPC completes", async () => {
  const { result } = renderHook(usePlanSnapshot, { wrapper: PlanScope });
  let pending: Promise<void>;
  act(() => {
    pending = result.current.actions.reload();
  });
  expect(result.current.loading).toBe(true);
  await act(async () => pending);
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
  expect(result.current.plan.days).toEqual([["recipe"], [], [], [], [], []]);
  expect(result.current.shopping).toEqual([
    { food_id: "apple", name: "Apple", weight: 120 },
  ]);
  expect(result.current.totals.map((total) => total?.calories)).toEqual([
    100, 101, 102, 103, 104, 105,
  ]);
  expect(invoke).toHaveBeenCalledWith("get_plan");
  expect(invoke).toHaveBeenCalledWith("shopping_list");
  expect(
    vi
      .mocked(invoke)
      .mock.calls.filter(([command]) => command === "day_totals")
      .map(([, args]) => args),
  ).toEqual([
    { day: 0 },
    { day: 1 },
    { day: 2 },
    { day: 3 },
    { day: 4 },
    { day: 5 },
  ]);
});

it.each([
  {
    command: "day_totals",
    error: { kind: "lock_poisoned" },
    message: "lock_poisoned",
  },
  {
    command: "shopping_list",
    error: new Error("Desktop connection lost"),
    message: "Desktop connection lost",
  },
])(
  "reports $message without partially replacing state and recovers on reload",
  async ({ command, error, message }) => {
    const { result } = renderHook(usePlanSnapshot, { wrapper: PlanScope });
    await act(() => result.current.actions.reload());
    const previous = result.current;
    const successfulInvoke = vi.mocked(invoke).getMockImplementation()!;
    vi.mocked(invoke).mockImplementation(async (name, args, options) => {
      if (name === command) throw error;
      return successfulInvoke(name, args, options);
    });
    await act(() => result.current.actions.reload());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(message);
    expect(result.current.plan).toBe(previous.plan);
    expect(result.current.shopping).toBe(previous.shopping);
    expect(result.current.totals).toBe(previous.totals);
    vi.mocked(invoke).mockImplementation(successfulInvoke);
    await act(() => result.current.actions.reload());
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  },
);
