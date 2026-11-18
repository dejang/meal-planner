import { expect, it } from "vitest";
import { caloriesPerServingLabel } from "@/lib/nutrition";
import { analysis } from "@/test-support/fixtures";

it.each([
  { calories: 201, servings: 2, expected: "100 kcal" },
  { calories: 201, servings: 0, expected: "201 kcal" },
  { calories: -10, servings: 2, expected: "0 kcal" },
  { calories: null, servings: 2, expected: "Nutrition not available" },
])(
  "labels per-portion calories for $calories calories and $servings servings",
  ({ calories, servings, expected }) => {
    const nutrition = calories === null ? null : { ...analysis(), calories };
    expect(caloriesPerServingLabel(nutrition, servings)).toBe(expected);
  },
);
