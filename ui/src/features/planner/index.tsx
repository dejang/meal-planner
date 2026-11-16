import { useDndMonitor } from "@dnd-kit/core";
import { useEffect } from "react";
import type { MealPosition } from "@/api";
import { Button, ButtonVariant } from "@/components/Button";
import { Icon, IconName } from "@/components/Icon";
import { NutritionLabel } from "@/components/NutritionLabel";
import type { RecipeDragPayload } from "@/lib/recipeDrag";
import {
  usePlanActions,
  usePlanDayTotals,
  usePlanError,
  usePlanLoading,
  usePlanWeeklyPlan,
} from "@/stores/PlanStore";
import DropTarget from "@/features/planner/DropTarget";
import MealCard from "@/features/planner/MealCard";
import { PlanDragOverlay } from "@/features/planner/PlanDragOverlay";
import "@/features/planner/planner.css";

export default function Planner() {
  const plan = usePlanWeeklyPlan();
  const totals = usePlanDayTotals();
  const loading = usePlanLoading();
  const error = usePlanError();
  const actions = usePlanActions();

  useEffect(() => {
    void actions.reload();
  }, [actions]);

  useDndMonitor({
    onDragEnd: ({ active, over }) => {
      const payload = active.data.current as RecipeDragPayload | undefined;
      const target = over?.data.current?.position as MealPosition | undefined;
      if (!payload || !target) return;
      void actions.dropRecipe(payload, target);
    },
  });

  return (
    <div className="planner" aria-busy={loading}>
      {error && (
        <div role="alert" className="planner-error">
          {error}
          <Button onClick={() => void actions.reload()}>Retry</Button>
        </div>
      )}
      <div className="planner-days">
        {plan.days.map((meals, day) => (
          <section
            className="planner-day"
            key={day}
            aria-label={`Day ${day + 1}`}
          >
            <header className="planner-day-header on-forest">
              <h2 className="text-heading">Day {day + 1}</h2>
              {day > 0 && (
                <Button
                  variant={ButtonVariant.Quiet}
                  title="Copy from previous day"
                  aria-label="Copy from previous day"
                  onClick={() => void actions.copyPreviousDay(day)}
                >
                  <Icon name={IconName.ClipboardPaste} />
                </Button>
              )}
              <Button
                variant={ButtonVariant.Quiet}
                title="Clear"
                aria-label="Clear"
                onClick={() => void actions.clearDay(day)}
              >
                <Icon name={IconName.Trash2} />
              </Button>
            </header>
            <div className="planner-day-scroll">
              <DropTarget
                position={{ day, row: meals.length }}
                className="planner-drop-zone"
              >
                {meals.map((recipeId, row) => (
                  <MealCard
                    key={`${row}-${recipeId}`}
                    recipeId={recipeId}
                    position={{ day, row }}
                  />
                ))}
                {meals.length === 0 && (
                  <div className="planner-empty">Drop a recipe here</div>
                )}
              </DropTarget>
              {totals[day] && <NutritionLabel analysis={totals[day]} />}
            </div>
          </section>
        ))}
      </div>
      <PlanDragOverlay />
    </div>
  );
}
