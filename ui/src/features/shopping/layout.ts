import type { ShoppingItem } from "../../api";

export function formatWeight(weight: number): string {
  const grams = Math.fround(weight);
  return `${Math.abs(grams) < 1e21 ? grams.toFixed(0) : BigInt(grams).toString()} g`;
}

interface ShoppingLayout {
  columnCount: number;
  columns: ShoppingItem[][];
}

export function shoppingColumns(
  items: ShoppingItem[],
  width: number,
  minimumColumnWidth: number,
  columnGap: number,
): ShoppingLayout {
  const count = Math.min(
    Math.max(
      1,
      Math.floor((width + columnGap) / (minimumColumnWidth + columnGap)),
    ),
    Math.max(1, items.length),
  );
  const rows = Math.max(1, Math.ceil(items.length / count));
  return {
    columnCount: count,
    columns: Array.from(
      { length: Math.ceil(items.length / rows) },
      (_, column) => items.slice(column * rows, (column + 1) * rows),
    ),
  };
}
