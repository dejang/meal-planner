import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import App from "./App";

it("shows the meal planning workspace", () => {
  expect(renderToStaticMarkup(<App />)).toContain("<h1>Meal Planner</h1>");
});
