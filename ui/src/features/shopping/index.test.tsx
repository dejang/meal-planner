import { commands, ok } from "@/test-support/ipc";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DialogSize, PaperDialog } from "@/components/PaperDialog";
import { usePlanActions } from "@/stores/PlanStore";
import { deferred } from "@/test-support/fixtures";
import { AppScopes } from "@/test-support/scopes";
import Shopping from "@/features/shopping";

let resize: ResizeObserverCallback;

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.mocked(commands.shoppingList).mockResolvedValue(
    ok(
      Array.from({ length: 17 }, (_, index) => ({
        food_id: String(index),
        name: `Ingredient ${index}`,
        weight: index + 0.5,
      })),
    ),
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

it("loads on opening, retains column contents on resize and refresh, and delegates closing", async () => {
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
  const { result } = renderHook(usePlanActions, {
    wrapper: ({ children }) => (
      <AppScopes>
        {children}
        {dialog}
      </AppScopes>
    ),
  });
  await screen.findByText("Ingredient 16");
  expect(commands.getPlan).toHaveBeenCalledOnce();
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
  const response =
    deferred<Awaited<ReturnType<typeof commands.shoppingList>>>();
  vi.mocked(commands.shoppingList).mockReturnValueOnce(response.promise);
  let refreshing!: Promise<void>;
  await act(async () => {
    refreshing = result.current.reload();
  });
  expect(commands.getPlan).toHaveBeenCalledTimes(2);
  expect(screen.getAllByRole("table")).toHaveLength(3);
  expect(screen.queryByRole("status")).toBeNull();
  expect(
    screen
      .getAllByRole("table")[0]
      .closest("[aria-busy]")
      ?.getAttribute("aria-busy"),
  ).toBe("true");
  await act(async () => {
    response.resolve(ok([]));
    await refreshing;
  });
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
])("shows store state: $text", async ({ loading, error, role, text }) => {
  const response =
    deferred<Awaited<ReturnType<typeof commands.shoppingList>>>();
  vi.mocked(commands.shoppingList).mockReturnValueOnce(response.promise);
  render(<Shopping onClose={vi.fn()} />, { wrapper: AppScopes });
  expect(await screen.findByRole("status")).toBeTruthy();
  if (!loading) {
    await act(async () => {
      if (error)
        response.resolve({
          status: "error",
          error: { kind: "storage", detail: error },
        });
      else response.resolve(ok([]));
    });
  }
  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.queryAllByRole("table")).toHaveLength(0);
  if (role) expect(screen.getByRole(role).textContent).toBe(text);
});
