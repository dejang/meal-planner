import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PaperWindowHeader } from "../../components/PaperDialog";
import {
  usePlanActions,
  usePlanError,
  usePlanLoading,
  usePlanShoppingItems,
} from "../../stores/PlanStore";
import { formatWeight, shoppingColumns } from "./layout";
import "./shopping.css";

interface ShoppingProps {
  onClose: () => void;
  minimumColumnWidth?: number;
  columnGap?: number;
}

export default function Shopping({
  onClose,
  minimumColumnWidth = 320,
  columnGap = 32,
}: ShoppingProps) {
  const items = usePlanShoppingItems();
  const loading = usePlanLoading();
  const error = usePlanError();
  const actions = usePlanActions();
  const sheet = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const layout = shoppingColumns(items, width, minimumColumnWidth, columnGap);

  useEffect(() => {
    void actions.reload();
  }, [actions]);

  useLayoutEffect(() => {
    const element = sheet.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="shopping-sheet">
      <PaperWindowHeader
        title="Shopping list"
        closeLabel="Close shopping list"
        onClose={onClose}
      />
      <div className="shopping-surface" aria-busy={loading}>
        <div className="shopping-scroll">
          <div ref={sheet}>
            {loading && items.length === 0 && (
              <p role="status">Loading shopping list…</p>
            )}
            {error && <p role="alert">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <div className="shopping-empty">
                <p>Your shopping list is empty.</p>
                <p>Add meals to your planner to get started.</p>
              </div>
            )}
            <div
              className="shopping-columns"
              style={{
                gap: columnGap,
                gridTemplateColumns: `repeat(${layout.columnCount}, minmax(0, 1fr))`,
              }}
            >
              {layout.columns.map((column, index) => (
                <table
                  key={index}
                  aria-label={`Shopping list column ${index + 1}`}
                >
                  <thead>
                    <tr>
                      <th scope="col">Ingredient</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {column.map((item) => (
                      <tr key={item.food_id}>
                        <td>{item.name}</td>
                        <td>{formatWeight(item.weight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
