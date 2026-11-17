import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MobileHeader } from "@/components/mobile/MobileHeader";

it("groups navigation around the title separately from optional actions", () => {
  const { rerender } = render(
    <MobileHeader
      title="Recipe"
      leading={<button>Previous</button>}
      trailing={<button>Next</button>}
      action={<button>Save</button>}
    />,
  );
  const title = screen.getByRole("heading", { level: 1, name: "Recipe" });
  expect(Array.from(title.parentElement!.children)).toEqual([
    screen.getByRole("button", { name: "Previous" }),
    title,
    screen.getByRole("button", { name: "Next" }),
  ]);
  expect(
    title.parentElement!.contains(screen.getByRole("button", { name: "Save" })),
  ).toBe(false);
  rerender(<MobileHeader title="Planner" />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Planner" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
