import { useState } from "react";
import { createSelectorHook, Store } from "bonsai-react";
import { commands, unwrap } from "@/api";
import type {
  AnalysisResponse,
  MealPosition,
  ShoppingItem,
  WeeklyPlan,
} from "@/api";
import type { RecipeDragPayload } from "@/lib/recipeDrag";
import { createStoreContext } from "@/stores/core/context";
import { errorMessage } from "@/stores/core/error";

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
    void this.actions.reload();
  }

  private pending = Promise.resolve();

  private refresh(
    load: () => ReturnType<typeof commands.getPlan>,
  ): Promise<void> {
    this.pending = this.pending.then(async () => {
      this.update({ loading: true, error: null });
      try {
        const plan = unwrap(await load());
        this.update({ plan });
        const projections = await Promise.allSettled([
          Promise.all(
            plan.days.map(async (_, day) =>
              unwrap(await commands.dayTotals(day)),
            ),
          ).then((dayTotals) => this.update({ dayTotals })),
          commands
            .shoppingList()
            .then((result) => this.update({ shoppingItems: unwrap(result) })),
        ]);
        for (const projection of projections) {
          if (projection.status === "rejected") throw projection.reason;
        }
      } catch (error) {
        this.update({
          error: errorMessage(error),
        });
      } finally {
        this.update({ loading: false });
      }
    });
    return this.pending;
  }

  readonly actions = {
    reload: (): Promise<void> => this.refresh(commands.getPlan),
    addToDay: (position: MealPosition, recipeId: string): Promise<void> =>
      this.refresh(() => commands.addToDay(position, recipeId)),
    moveMeal: (from: MealPosition, to: MealPosition): Promise<void> =>
      this.refresh(() => commands.moveMeal(from, to)),
    dropRecipe: (
      payload: RecipeDragPayload,
      target: MealPosition,
    ): Promise<void> => {
      if (payload.position === null) {
        return this.actions.addToDay(target, payload.recipeId);
      }
      const from = payload.position;
      const to = {
        ...target,
        row:
          target.row - Number(from.day === target.day && from.row < target.row),
      };
      if (from.day === to.day && from.row === to.row) {
        return Promise.resolve();
      }
      return this.actions.moveMeal(from, to);
    },
    removeFromDay: (position: MealPosition): Promise<void> =>
      this.refresh(() => commands.removeFromDay(position)),
    clearDay: (day: number): Promise<void> =>
      this.refresh(() => commands.clearDay(day)),
    copyPreviousDay: (day: number): Promise<void> =>
      this.refresh(() => commands.copyPreviousDay(day)),
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
