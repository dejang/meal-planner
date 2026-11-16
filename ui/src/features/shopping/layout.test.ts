import { expect, it } from "vitest";
import type { ShoppingItem } from "../../api";
import { formatWeight, shoppingColumns } from "./layout";

it.each<[number, string]>([
  [0, "0 g"],
  [0.3, "0 g"],
  [12.5, "13 g"],
  [99.9, "100 g"],
  [1000, "1000 g"],
  [123456792, "123456792 g"],
  [123456790, "123456792 g"],
  [-12.5, "-13 g"],
  [
    Math.fround(3.4028234663852886e38),
    "340282346638528859811704183484516925440 g",
  ],
])("formats %s grams like the legacy sheet", (weight, expected) => {
  expect(formatWeight(weight)).toBe(expected);
});

it.each([
  { width: 200, count: 0, columnCount: 1, columns: [] },
  { width: 2000, count: 1, columnCount: 1, columns: [["0"]] },
  { width: 200, count: 4, columnCount: 1, columns: [["0", "1", "2", "3"]] },
  { width: 671, count: 4, columnCount: 1, columns: [["0", "1", "2", "3"]] },
  {
    width: 672,
    count: 4,
    columnCount: 2,
    columns: [
      ["0", "1"],
      ["2", "3"],
    ],
  },
  {
    width: 1023,
    count: 5,
    columnCount: 2,
    columns: [
      ["0", "1", "2"],
      ["3", "4"],
    ],
  },
  {
    width: 1024,
    count: 5,
    columnCount: 3,
    columns: [["0", "1"], ["2", "3"], ["4"]],
  },
  {
    width: 2000,
    count: 6,
    columnCount: 5,
    columns: [
      ["0", "1"],
      ["2", "3"],
      ["4", "5"],
    ],
  },
])(
  "splits $count items at width $width in reading order",
  ({ width, count, columnCount, columns }) => {
    const items: ShoppingItem[] = Array.from({ length: count }, (_, index) => ({
      food_id: String(index),
      name: `Ingredient ${index}`,
      weight: index + 0.25,
    }));
    const layout = shoppingColumns(items, width, 320, 32);
    expect(layout.columnCount).toBe(columnCount);
    expect(layout.columns.flat()).toEqual(items);
    expect(
      layout.columns.map((column) => column.map((item) => item.food_id)),
    ).toEqual(columns);
  },
);
