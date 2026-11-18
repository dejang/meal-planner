import { useState } from "react";
import { Button } from "@/components/Button";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { PageDots } from "@/components/mobile/PageDots";
import { SwipePager } from "@/components/mobile/SwipePager";
import { NutritionLabel } from "@/components/NutritionLabel";
import {
  usePlanActions,
  usePlanDayTotals,
  usePlanError,
  usePlanLoading,
  usePlanWeeklyPlan,
} from "@/stores/PlanStore";
import PlannedMeal from "@/mobile/planner/PlannedMeal";
import RecipePicker from "@/mobile/planner/RecipePicker";
import "@/mobile/planner/planner.css";

export default function Planner({ active }: { active: boolean }) {
  const [activeDay, setActiveDay] = useState(0);
  const plan = usePlanWeeklyPlan();
  const totals = usePlanDayTotals();
  const loading = usePlanLoading();
  const error = usePlanError();
  const actions = usePlanActions();

  return (
    <div className="mobile-planner" aria-busy={loading}>
      <SwipePager
        label="Planned days"
        activeIndex={activeDay}
        onActiveIndexChange={setActiveDay}
        pageGroupLabel={(index) => `Day ${index + 1} meals`}
        renderControls={({ activeIndex, count, previous, next, select }) => (
          <div className="mobile-plan-controls">
            <MobileHeader
              title={`Day ${activeIndex + 1}`}
              leading={
                <Button
                  aria-label="Previous day"
                  disabled={activeIndex === 0}
                  onClick={previous}
                >
                  ‹
                </Button>
              }
              trailing={
                <Button
                  aria-label="Next day"
                  disabled={activeIndex === count - 1}
                  onClick={next}
                >
                  ›
                </Button>
              }
              action={
                <div className="mobile-plan-actions">
                  {activeIndex > 0 && (
                    <Button
                      disabled={loading}
                      onClick={() => void actions.copyPreviousDay(activeIndex)}
                    >
                      Copy Prev
                    </Button>
                  )}
                  <Button
                    disabled={loading || plan.days[activeIndex].length === 0}
                    onClick={() => void actions.clearDay(activeIndex)}
                  >
                    Clear
                  </Button>
                </div>
              }
            />
            {error && (
              <div role="alert" className="mobile-plan-error safe-area-sides">
                {error}
                <Button onClick={() => void actions.reload()}>Retry</Button>
              </div>
            )}
            <PageDots
              count={count}
              activeIndex={activeIndex}
              onSelect={select}
              label="Choose day"
              dotLabel={(index) => `Go to Day ${index + 1}`}
            />
          </div>
        )}
      >
        {plan.days.map((meals, day) => (
          <div className="mobile-plan-day safe-area-sides" key={day}>
            {meals.length ? (
              <ol className="mobile-plan-meals" aria-label="Planned meals">
                {meals.map((recipeId, row) => (
                  <PlannedMeal
                    key={`${row}-${recipeId}`}
                    recipeId={recipeId}
                    position={{ day, row }}
                    count={meals.length}
                  />
                ))}
              </ol>
            ) : (
              <RecipePicker
                key={active && activeDay === day ? "active" : "inactive"}
                day={day}
              />
            )}
            {totals[day] && (
              <NutritionLabel
                analysis={totals[day]}
                servingsLabel={`Day ${day + 1} total`}
              />
            )}
          </div>
        ))}
      </SwipePager>
    </div>
  );
}
