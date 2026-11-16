import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import type {
  AnalysisResponse,
  MealPosition,
  ShoppingItem,
  WeeklyPlan,
} from "../api";
import { commands, unwrap } from "../api";
import { createStoreContext } from "./core/context";
import { errorMessage } from "./core/error";

export interface PlanState {
  plan: WeeklyPlan;
  dayTotals: (AnalysisResponse | null)[];
  shoppingItems: ShoppingItem[];
  loading: boolean;
  error: string | null;
}

class PlanStore extends Store<PlanState> {
  constructor() {
    super({
      plan: { days: [[], [], [], [], [], []] },
      dayTotals: [null, null, null, null, null, null],
      shoppingItems: [],
      loading: false,
      error: null,
    });
  }

  readonly actions = {
    reload: async (): Promise<void> => {
      this.update({ loading: true, error: null });
      try {
        const [plan, shopping, ...totals] = await Promise.all([
          commands.getPlan(),
          commands.shoppingList(),
          ...Array.from({ length: 6 }, (_, day) => commands.dayTotals(day)),
        ] as const);
        this.update({
          plan: unwrap(plan),
          shoppingItems: unwrap(shopping),
          dayTotals: totals.map(unwrap),
          loading: false,
        });
      } catch (error) {
        this.update({
          loading: false,
          error: errorMessage(error),
        });
      }
    },
    addToDay: async (
      _position: MealPosition,
      _recipeId: string,
    ): Promise<void> => {},
    moveMeal: async (
      _from: MealPosition,
      _to: MealPosition,
    ): Promise<void> => {},
    removeFromDay: async (_position: MealPosition): Promise<void> => {},
    clearDay: async (_day: number): Promise<void> => {},
    copyPreviousDay: async (_day: number): Promise<void> => {},
  };
}

const context = createStoreContext(() => useState(() => new PlanStore())[0]);

export function PlanScope({ children }: { children: React.ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function usePlanWeeklyPlan() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.plan),
  )();
}

export function usePlanDayTotals() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.dayTotals),
  )();
}

export function usePlanShoppingItems() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.shoppingItems),
  )();
}

export function usePlanLoading() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.loading),
  )();
}

export function usePlanError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.error),
  )();
}

export function usePlanActions() {
  return context.useActions();
}
