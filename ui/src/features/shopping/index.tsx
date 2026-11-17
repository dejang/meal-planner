import { useLayoutEffect, useRef, useState } from "react";
import { PaperWindowHeader } from "@/components/PaperDialog";
import {
  usePlanError,
  usePlanLoading,
  usePlanShoppingItems,
} from "@/stores/PlanStore";
import { formatWeight, shoppingColumns } from "@/features/shopping/layout";
import { ShoppingState } from "@/features/shopping/ShoppingState";
import "@/features/shopping/shopping.css";

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
  const sheet = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const layout = shoppingColumns(items, width, minimumColumnWidth, columnGap);

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
            <ShoppingState
              loading={loading}
              error={error}
              itemCount={items.length}
              emptyClassName="shopping-empty"
            />
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
