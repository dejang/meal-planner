import { useState } from "react";
import { ShoppingState } from "@/features/shopping/ShoppingState";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { formatWeight } from "@/features/shopping/layout";
import {
  usePlanError,
  usePlanLoading,
  usePlanShoppingItems,
} from "@/stores/PlanStore";
import "@/mobile/shopping/shopping.css";

export default function Shopping(_props: { active: boolean }) {
  const items = usePlanShoppingItems();
  const loading = usePlanLoading();
  const error = usePlanError();
  const [checked, setChecked] = useState<Set<string>>(() => new Set());

  return (
    <div className="mobile-shopping">
      <MobileHeader
        title="Shopping List"
        action={
          <span className="mobile-shopping-count mobile-meta">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
        }
      />
      <div
        className="mobile-shopping-scroll safe-area-sides mobile-content"
        role="region"
        aria-label="Shopping items"
        aria-busy={loading}
        tabIndex={0}
      >
        <ShoppingState
          loading={loading}
          error={error}
          itemCount={items.length}
          emptyClassName="mobile-shopping-empty"
        />
        {items.length > 0 && (
          <table className="mobile-ingredient" aria-label="Shopping list">
            <thead>
              <tr>
                <th scope="col">Ingredient</th>
                <th scope="col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.food_id} data-checked={checked.has(item.food_id)}>
                  <td>
                    <label className="mobile-touch-target">
                      <input
                        type="checkbox"
                        checked={checked.has(item.food_id)}
                        onChange={(event) => {
                          const selected = event.currentTarget.checked;
                          setChecked((previous) => {
                            const next = new Set(previous);
                            if (selected) next.add(item.food_id);
                            else next.delete(item.food_id);
                            return next;
                          });
                        }}
                      />
                      <span>{item.name}</span>
                    </label>
                  </td>
                  <td>{formatWeight(item.weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
