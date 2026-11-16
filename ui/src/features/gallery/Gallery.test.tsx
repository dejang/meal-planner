import { commands, ok } from "@/test-support/ipc";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type KeyboardSensorOptions,
  type PointerSensorOptions,
  useDndMonitor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { recipe } from "@/test-support/fixtures";
import Planner from "@/features/planner";
import Editor from "@/features/editor";
import { AppScopes } from "@/test-support/scopes";
import Gallery from "@/features/gallery";

beforeEach(() => {
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([
      recipe({
        id: "rice",
        title: "Rice dinner",
        ingredients: "1 cup rice\n2 cups water",
        instructions: "Boil water.\n\nAdd rice.",
        servings: 2,
        analysis: null,
        image_version: null,
      }),
      recipe({
        id: "soup",
        title: "Soup",
        ingredients: "Water",
        instructions: "Simmer.",
        servings: 1,
        analysis: null,
        image_version: null,
      }),
    ]),
  );
  vi.mocked(commands.getRecipe).mockResolvedValue(
    ok(recipe({ id: "rice", title: "Rice dinner" })),
  );
});

function renderGallery(sensor: typeof PointerSensor | typeof KeyboardSensor) {
  const started = vi.fn();
  function DragHarness() {
    useDndMonitor({ onDragStart: started });
    return (
      <>
        <Gallery />
        <Planner />
        <Editor />
      </>
    );
  }
  function Scope() {
    const sensors = useSensors(
      useSensor<PointerSensorOptions & KeyboardSensorOptions>(sensor, {
        activationConstraint: { distance: 6 },
      }),
    );
    return (
      <DndContext sensors={sensors}>
        <AppScopes>
          <DragHarness />
        </AppScopes>
      </DndContext>
    );
  }
  render(<Scope />);
  return {
    started,
    overlay: () => {
      const overlays = document.querySelectorAll<HTMLElement>(
        '[style*="position: fixed"][style*="z-index"]',
      );
      expect(overlays).toHaveLength(1);
      return overlays[0];
    },
  };
}

it("selects recipes, clears selection with Escape, and opens the editor", async () => {
  const user = userEvent.setup();
  renderGallery(PointerSensor);
  const card = await screen.findByRole("button", { name: "Rice dinner" });
  expect(screen.getByRole("region", { name: "Recipes" })).toBeTruthy();
  expect(card.getAttribute("aria-current")).toBeNull();
  await user.click(card);
  expect(card.getAttribute("aria-current")).toBe("true");
  expect(
    screen.getByRole("complementary", { name: "Recipe details" }),
  ).toBeTruthy();
  expect(screen.getByText("Boil water.")).toBeTruthy();
  expect(screen.getByText("Add rice.")).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("complementary")).toBeNull();
  expect(card.getAttribute("aria-current")).toBeNull();
  card.focus();
  await user.keyboard("{Enter}");
  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(commands.getRecipe).toHaveBeenCalledWith("rice");
  expect(
    screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Recipe title" })
      .value,
  ).toBe("Rice dinner");
  expect(screen.queryByRole("complementary")).toBeNull();
});

it.each([
  {
    target: "search input",
    focus: () => {
      screen.getByRole("searchbox", { name: "Search recipes" }).focus();
    },
  },
  {
    target: "body with an open dialog",
    focus: () => {
      render(
        <dialog open aria-label="Shopping list">
          Shopping list
        </dialog>,
      );
      (document.activeElement as HTMLElement).blur();
      expect(document.activeElement).toBe(document.body);
    },
  },
])("ignores Delete and Escape on $target", async ({ focus }) => {
  const user = userEvent.setup();
  renderGallery(PointerSensor);
  const card = await screen.findByRole("button", { name: "Rice dinner" });
  await user.click(card);
  focus();
  await user.keyboard("{Delete}{Escape}");
  expect(commands.deleteRecipe).not.toHaveBeenCalled();
  expect(
    screen.getByRole("complementary", { name: "Recipe details" }),
  ).toBeTruthy();
  expect(card.getAttribute("aria-current")).toBe("true");
});

it.each([
  {
    deletion: "button",
    deleteSelected: () =>
      fireEvent.click(screen.getByRole("button", { name: "Delete" })),
  },
  {
    deletion: "Delete key without card focus",
    deleteSelected: () => {
      (document.activeElement as HTMLElement).blur();
      fireEvent.keyDown(document, { key: "Delete" });
    },
  },
])(
  "deletes the selected recipe using the $deletion",
  async ({ deleteSelected }) => {
    const user = userEvent.setup();
    renderGallery(PointerSensor);
    await user.click(
      await screen.findByRole("button", { name: "Rice dinner" }),
    );
    vi.mocked(commands.deleteRecipe).mockResolvedValue(ok(null));
    vi.mocked(commands.listRecipes).mockResolvedValue(ok([]));
    deleteSelected();
    await waitFor(() =>
      expect(commands.deleteRecipe).toHaveBeenCalledExactlyOnceWith("rice"),
    );
    await waitFor(() => expect(screen.queryByRole("complementary")).toBeNull());
    expect(screen.getByText("No recipes yet.")).toBeTruthy();
  },
);

it("starts a keyboard drag with the shared gallery payload and removes its preview on cancel", async () => {
  const { started, overlay } = renderGallery(KeyboardSensor);
  const handle = await screen.findByRole("button", {
    name: "Drag to planner: Rice dinner",
  });
  handle.focus();
  fireEvent.keyDown(handle, { code: "Space" });
  await waitFor(() => expect(started).toHaveBeenCalledOnce());
  expect(started.mock.calls[0][0].active.data.current).toEqual({
    recipeId: "rice",
    position: null,
  });
  expect(screen.getAllByRole("img", { name: "Rice dinner" })).toHaveLength(2);
  const preview = overlay();
  expect(preview.style.width).toBe("100px");
  expect(preview.style.height).toBe("100px");
  fireEvent.keyDown(document, { code: "Escape" });
  await waitFor(() =>
    expect(screen.getAllByRole("img", { name: "Rice dinner" })).toHaveLength(1),
  );
});

it("keeps the pointer preview at the cursor when grabbed away from the card origin", async () => {
  const { overlay } = renderGallery(PointerSensor);
  const button = await screen.findByRole("button", { name: "Rice dinner" });
  const card = button.closest("article");
  if (!card) throw new Error("Missing recipe card");
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
    x: 40,
    y: 30,
    left: 40,
    top: 30,
    right: 440,
    bottom: 430,
    width: 400,
    height: 400,
    toJSON: () => ({}),
  });
  fireEvent.pointerDown(button, { clientX: 240, clientY: 180, button: 0 });
  fireEvent.pointerMove(document, { clientX: 250, clientY: 185 });
  fireEvent.pointerMove(document, { clientX: 260, clientY: 190 });
  await waitFor(() =>
    expect(screen.getAllByRole("img", { name: "Rice dinner" })).toHaveLength(2),
  );
  const preview = overlay();
  expect(preview.style.left).toBe("40px");
  expect(preview.style.top).toBe("30px");
  expect(preview.style.transform).toBe(
    "translate3d(220px, 160px, 0) scaleX(1) scaleY(1)",
  );
  fireEvent.pointerUp(document);
  await waitFor(() =>
    expect(screen.getAllByRole("img", { name: "Rice dinner" })).toHaveLength(1),
  );
});
