import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MobileHeader } from "@/components/mobile/MobileHeader";

it("renders the screen title and optional action", () => {
  const { rerender } = render(
    <MobileHeader title="Recipe" action={<button>Save</button>} />,
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "Recipe" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  rerender(<MobileHeader title="Planner" />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Planner" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
