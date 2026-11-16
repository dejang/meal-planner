import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DialogSize, PaperDialog } from "../../components/PaperDialog";
import {
  usePlanActions,
  usePlanError,
  usePlanLoading,
  usePlanShoppingItems,
} from "../../stores/PlanStore";
import Shopping from ".";

vi.mock("../../stores/PlanStore", () => ({
  usePlanActions: vi.fn(),
  usePlanError: vi.fn(),
  usePlanLoading: vi.fn(),
  usePlanShoppingItems: vi.fn(),
}));

let resize: ResizeObserverCallback;

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.mocked(usePlanActions).mockReturnValue({
    reload: vi.fn().mockResolvedValue(undefined),
    addToDay: vi.fn(),
    moveMeal: vi.fn(),
    removeFromDay: vi.fn(),
    clearDay: vi.fn(),
    copyPreviousDay: vi.fn(),
  });
  vi.mocked(usePlanError).mockReturnValue(null);
  vi.mocked(usePlanLoading).mockReturnValue(false);
  vi.mocked(usePlanShoppingItems).mockReturnValue(
    Array.from({ length: 17 }, (_, index) => ({
      food_id: String(index),
      name: `Ingredient ${index}`,
      weight: index + 0.5,
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});

it("loads on opening, retains column contents on height changes, and delegates closing", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return new DOMRect(0, 0, this.closest("dialog")?.open ? 1024 : 0, 800);
    },
  );
  const onClose = vi.fn();
  const dialog = (
    <PaperDialog
      title="Shopping list"
      size={DialogSize.Shopping}
      showHeader={false}
      onClose={onClose}
    >
      <Shopping onClose={onClose} />
    </PaperDialog>
  );
  const view = render(dialog);
  expect(usePlanActions().reload).toHaveBeenCalledOnce();
  expect(screen.getAllByRole("table")).toHaveLength(3);
  act(() =>
    resize(
      [{ contentRect: { width: 672, height: 800 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  );
  expect(screen.getAllByRole("table")).toHaveLength(2);
  act(() =>
    resize(
      [{ contentRect: { width: 1024, height: 800 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  );
  const columns = screen.getAllByRole("table");
  expect(columns).toHaveLength(3);
  expect(within(columns[0]).getByText("Ingredient 5")).toBeTruthy();
  expect(within(columns[1]).getByText("Ingredient 6")).toBeTruthy();
  expect(within(columns[2]).getByText("Ingredient 16")).toBeTruthy();
  expect(screen.getByText("17 g")).toBeTruthy();
  const contents = columns.map((column) => column.textContent);
  act(() =>
    resize(
      [{ contentRect: { width: 1024, height: 120 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    ),
  );
  expect(
    screen.getAllByRole("table").map((column) => column.textContent),
  ).toEqual(contents);
  const close = screen.getByRole("button", { name: "Close shopping list" });
  expect(close.getAttribute("title")).toBe("Close shopping list");
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledOnce();
  view.unmount();
  vi.mocked(usePlanLoading).mockReturnValue(true);
  render(dialog);
  expect(usePlanActions().reload).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole("table")).toHaveLength(3);
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    screen
      .getAllByRole("table")[0]
      .closest("[aria-busy]")
      ?.getAttribute("aria-busy"),
  ).toBe("true");
});

it.each([
  {
    loading: true,
    error: null,
    role: "status",
    text: "Loading shopping list…",
  },
  {
    loading: false,
    error: null,
    role: null,
    text: "Your shopping list is empty.",
  },
  {
    loading: false,
    error: "Cannot read shopping list",
    role: "alert",
    text: "Cannot read shopping list",
  },
])("shows store state: $text", ({ loading, error, role, text }) => {
  vi.mocked(usePlanShoppingItems).mockReturnValue([]);
  vi.mocked(usePlanLoading).mockReturnValue(loading);
  vi.mocked(usePlanError).mockReturnValue(error);
  render(<Shopping onClose={vi.fn()} />);
  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryAllByRole("table")).toHaveLength(0);
  if (role) expect(screen.getByRole(role).textContent).toBe(text);
});
