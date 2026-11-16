import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import type { AnalysisResponse } from "../api";
import { NutritionLabel } from "./NutritionLabel";

it.each([
  {
    name: "per-serving analysis",
    props: { servings: 2, servingsLabel: "Per serving" },
    caption: "Per serving",
    calories: "251",
    fat: "6g",
    daily: "8%",
    vitamin: "51%",
  },
  {
    name: "day totals",
    props: {},
    caption: "Amount per day",
    calories: "503",
    fat: "12g",
    daily: "16%",
    vitamin: "102%",
  },
])(
  "renders $name with legacy rounding and collapsible micronutrients",
  ({ props, caption, calories, fat, daily, vitamin }) => {
    const analysis: AnalysisResponse = {
      uri: "",
      yield: 2,
      calories: 503,
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
      },
    };
    render(<NutritionLabel analysis={analysis} {...props} />);
    expect(screen.getByText(calories)).toBeTruthy();
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
    fireEvent.click(screen.getByText("Nutrients"));
    expect(disclosure?.open).toBe(false);
  },
);
