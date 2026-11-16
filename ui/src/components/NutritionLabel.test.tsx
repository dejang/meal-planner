import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { AnalysisResponse } from "@/api";
import { NutritionLabel } from "@/components/NutritionLabel";

it.each([
  {
    name: "per-serving analysis",
    inputCalories: 503,
    props: { servings: 2, servingsLabel: "Per serving" },
    caption: "Per serving",
    calories: "251",
    fat: "6g",
    daily: "8%",
    vitamin: "51%",
  },
  {
    name: "configured nutrient layout",
    inputCalories: 503,
    props: {
      rows: [{ code: "FAT", label: "Total Fat", daily: true }],
      nutrientGroups: [["VITC", "CA"]],
    },
    caption: "Amount per day",
    calories: "503",
    fat: "12g",
    daily: "16%",
    vitamin: "102%",
    omittedRows: ["Trans Fat", "Vitamin D"],
  },
  {
    name: "day totals",
    inputCalories: 503,
    props: {},
    caption: "Amount per day",
    calories: "503",
    fat: "12g",
    daily: "16%",
    vitamin: "102%",
  },
  {
    name: "fractional servings",
    inputCalories: 503,
    props: { servings: 2.9, servingsLabel: "Per serving" },
    caption: "Per serving",
    calories: "251",
    fat: "6g",
    daily: "8%",
    vitamin: "51%",
  },
  {
    name: "negative calories and zero servings",
    inputCalories: -503,
    props: { servings: 0 },
    caption: "Amount per day",
    calories: "0",
    fat: "12g",
    daily: "16%",
    vitamin: "102%",
  },
])(
  "renders $name with legacy rounding and collapsible micronutrients",
  ({
    props,
    caption,
    inputCalories,
    calories,
    fat,
    daily,
    vitamin,
    omittedRows,
  }) => {
    const analysis: AnalysisResponse = {
      uri: "",
      yield: 2,
      calories: inputCalories,
      totalCO2Emissions: 0,
      co2EmissionsClass: "",
      totalWeight: 0,
      dietLabels: [],
      healthLabels: [],
      cautions: [],
      ingredients: [],
      cuisineType: [],
      mealType: [],
      dishType: [],
      totalNutrientsKCal: {},
      totalNutrients: {
        FAT: { label: "Fat", quantity: -11.1, unit: "g" },
        FATRN: { label: "Trans", quantity: 0.2, unit: "g" },
      },
      totalDaily: {
        FAT: { label: "Fat", quantity: 15.1, unit: "%" },
        VITC: { label: "Vitamin C", quantity: 101.2, unit: "%" },
        CA: { label: "Calcium", quantity: 7.2, unit: "%" },
        VITD: { label: "Vitamin D", quantity: 5, unit: "%" },
      },
    };
    render(<NutritionLabel analysis={analysis} {...props} />);
    const caloriesRow = screen.getByText("Calories").parentElement;
    if (!caloriesRow) throw new Error("Missing calories row");
    expect(within(caloriesRow).getByText(calories)).toBeTruthy();
    const fatRow = screen.getByText("Total Fat").parentElement;
    if (!fatRow) throw new Error("Missing fat row");
    expect(within(fatRow).getByText(fat)).toBeTruthy();
    expect(within(fatRow).getByText(daily)).toBeTruthy();
    expect(screen.getByText(caption)).toBeTruthy();
    const disclosure = screen.getByText("Nutrients").closest("details");
    expect(disclosure?.open).toBe(false);
    fireEvent.click(screen.getByText("Nutrients"));
    expect(disclosure?.open).toBe(true);
    expect(screen.getByText("Vitamin C")).toBeTruthy();
    expect(screen.getByText(vitamin)).toBeTruthy();
    expect(screen.getByText("Calcium")).toBeTruthy();
    for (const label of omittedRows ?? []) {
      expect(screen.queryByText(label)).toBeNull();
    }
    fireEvent.click(screen.getByText("Nutrients"));
    expect(disclosure?.open).toBe(false);
  },
);
