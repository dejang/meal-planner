import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import MealCard from "./MealCard";

const removeFromDay = vi.hoisted(() => vi.fn());

vi.mock("../../stores/EditorStore", () => ({
  useEditorActions: () => ({ openRecipe: vi.fn() }),
}));
vi.mock("../../stores/PlanStore", () => ({
  usePlanActions: () => ({ removeFromDay }),
}));
vi.mock("../../stores/RecipesStore", () => ({
  useRecipe: () => ({ title: "Soup" }),
}));

it("opens meal actions outside the draggable scroll column and restores focus on Escape", () => {
  const { container } = render(
    <DndContext>
      <div className="planner-day-scroll">
        <MealCard recipeId="soup" position={{ day: 1, row: 2 }} />
      </div>
    </DndContext>,
  );
  const card = screen.getByRole("button", { name: "Soup" });
  fireEvent.contextMenu(card, { clientX: 30, clientY: 40 });
  const menu = screen.getByRole("menu", { name: "Meal actions" });
  expect(menu.parentElement).toBe(document.body);
  expect(container.contains(menu)).toBe(false);
  expect(menu.closest('[role="button"]')).toBeNull();
  expect(menu.style.left).toBe("30px");
  expect(menu.style.top).toBe("40px");
  const edit = screen.getByRole("menuitem", { name: "Edit" });
  const remove = screen.getByRole("menuitem", { name: "Remove" });
  expect(menu.tabIndex).toBe(-1);
  expect(document.activeElement).toBe(edit);
  for (const [key, expected] of [
    ["ArrowDown", remove],
    ["ArrowDown", edit],
    ["ArrowUp", remove],
    ["ArrowUp", edit],
    ["End", remove],
    ["Home", edit],
  ] as const) {
    fireEvent.keyDown(document.activeElement!, { key });
    expect(document.activeElement).toBe(expected);
  }
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(card);
  fireEvent.keyDown(card, { key: "F10", shiftKey: true });
  const removeAction = screen.getByRole("menuitem", { name: "Remove" });
  fireEvent.pointerDown(removeAction);
  fireEvent.mouseDown(removeAction);
  fireEvent.blur(screen.getByRole("menuitem", { name: "Edit" }), {
    relatedTarget: null,
  });
  fireEvent.mouseUp(removeAction);
  fireEvent.click(removeAction);
  expect(removeFromDay).toHaveBeenCalledExactlyOnceWith({ day: 1, row: 2 });
  expect(screen.queryByRole("menu")).toBeNull();
});
