import { useId, useState } from "react";
import type { AnalysisResponse, Nutrient } from "@/api";
import { Button } from "@/components/Button";
import { caloriesPerServing, servingsDivisor } from "@/lib/nutrition";

export interface NutritionLabelProps {
  analysis: AnalysisResponse;
  servings?: number;
  servingsLabel?: string;
  rows?: NutritionRow[];
  nutrientGroups?: string[][];
}

interface NutritionRow {
  code: string;
  label: string;
  child?: boolean;
  daily?: boolean;
}

function quantity(nutrient: Nutrient | undefined, servings: number): string {
  return `${Math.floor(Math.ceil(Math.abs(nutrient?.quantity ?? 0)) / servings)}${nutrient?.unit ?? ""}`;
}

export function NutritionLabel({
  analysis,
  servings = 1,
  servingsLabel = "Amount per day",
  rows = [
    { code: "FAT", label: "Total Fat", daily: true },
    { code: "FASAT", label: "Saturated Fat", child: true, daily: true },
    { code: "FATRN", label: "Trans Fat", child: true },
    { code: "CHOLE", label: "Cholesterol", daily: true },
    { code: "NA", label: "Sodium", daily: true },
    { code: "CHOCDF", label: "Total Carbohydrate", daily: true },
    { code: "FIBTG", label: "Dietary Fiber", child: true, daily: true },
    { code: "SUGAR", label: "Total Sugars", child: true },
    { code: "PROCNT", label: "Protein", daily: true },
  ],
  nutrientGroups = [
    [
      "VITA_RAE",
      "THIA",
      "RIBF",
      "NIA",
      "VITB6A",
      "VITB12",
      "VITC",
      "VITD",
      "TOCPHA",
      "VITK1",
    ],
    ["CA", "MG", "ZN", "FE", "P", "K", "NA", "FOLDFE"],
  ],
}: NutritionLabelProps) {
  const divisor = servingsDivisor(servings);
  const [expanded, setExpanded] = useState(false);
  const disclosureId = useId();
  return (
    <section className="nutrition-label" aria-label="Nutrition Facts">
      <div className="nutrition-facts">
        <h3 className="text-heading">Nutrition Facts</h3>
        <hr />
        <div className="nutrition-caption">{servingsLabel}</div>
        <div className="nutrition-row nutrition-calories">
          <span>Calories</span>
          <span>{caloriesPerServing(analysis.calories, servings)}</span>
        </div>
        <hr />
        <div className="nutrition-caption nutrition-daily">% Daily Value*</div>
        <hr />
        {rows.map((row) => (
          <div
            key={row.code}
            className={`nutrition-row ${row.child ? "nutrition-child" : ""}`}
          >
            <span>{row.label}</span>
            <span className="text-small">
              {quantity(analysis.totalNutrients[row.code], divisor)}
            </span>
            <span className="text-small">
              {row.daily
                ? quantity(analysis.totalDaily[row.code], divisor)
                : ""}
            </span>
          </div>
        ))}
      </div>
      <hr />
      <Button
        className="nutrition-disclosure"
        aria-expanded={expanded}
        aria-controls={disclosureId}
        onClick={() => setExpanded(!expanded)}
      >
        Vitamins &amp; Minerals
      </Button>
      <div
        id={disclosureId}
        className="nutrition-disclosure-body"
        data-expanded={expanded}
        aria-hidden={!expanded}
      >
        <div>
          {nutrientGroups.map((codes, index) => (
            <div key={index} className="nutrition-group">
              {codes.map((code) => (
                <div key={code} className="nutrition-row text-small">
                  <span>{analysis.totalDaily[code]?.label ?? ""}</span>
                  <span>{quantity(analysis.totalDaily[code], divisor)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
