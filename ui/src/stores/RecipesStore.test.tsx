import { commands, ok } from "@/test-support/ipc";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { deferred, recipe } from "@/test-support/fixtures";
import { AppScopes, settleScopeLoads } from "@/test-support/scopes";
import {
  useRecipe,
  useRecipesActions,
  useRecipesError,
  useRecipesLoading,
  useRecipesQuery,
  useRecipesSelectedId,
  useRecipesVisibleIds,
} from "@/stores/RecipesStore";

function useGalleryState() {
  const selectedId = useRecipesSelectedId();
  return {
    ids: useRecipesVisibleIds(),
    query: useRecipesQuery(),
    loading: useRecipesLoading(),
    error: useRecipesError(),
    selectedId,
    selected: useRecipe(selectedId ?? ""),
    actions: useRecipesActions(),
  };
}

beforeEach(() => {
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([recipe({ id: "a", title: "a" }), recipe({ id: "b", title: "b" })]),
  );
});

it("loads recipes, retains selection through search, and reapplies the query on reload", async () => {
  const { result } = renderHook(useGalleryState, { wrapper: AppScopes });
  await act(() => result.current.actions.reload());
  expect(result.current.ids).toEqual(["a", "b"]);
  act(() => result.current.actions.select("b"));
  vi.mocked(commands.searchRecipes).mockResolvedValue(
    ok([recipe({ id: "a", title: "a" })]),
  );
  await act(() => result.current.actions.setQuery("rice"));
  expect(commands.searchRecipes).toHaveBeenCalledWith("rice");
  expect(result.current.query).toBe("rice");
  expect(result.current.ids).toEqual(["a"]);
  expect(result.current.selected?.id).toBe("b");
  await act(() => result.current.actions.reload());
  expect(commands.searchRecipes).toHaveBeenCalledTimes(2);
  expect(result.current.ids).toEqual(["a"]);
  await act(() => result.current.actions.setQuery(""));
  expect(result.current.ids).toEqual(["a", "b"]);
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([recipe({ id: "a", title: "a" })]),
  );
  await act(() => result.current.actions.reload());
  expect(result.current.selectedId).toBeNull();
});

it("ignores stale search results without rolling back selection made during a request", async () => {
  const { result } = renderHook(useGalleryState, { wrapper: AppScopes });
  await act(() => result.current.actions.reload());
  const response =
    deferred<Awaited<ReturnType<typeof commands.searchRecipes>>>();
  vi.mocked(commands.searchRecipes).mockReturnValueOnce(response.promise);
  let first!: Promise<void>;
  act(() => {
    first = result.current.actions.setQuery("old");
  });
  expect(result.current.loading).toBe(true);
  act(() => result.current.actions.select("b"));
  vi.mocked(commands.searchRecipes).mockResolvedValueOnce(
    ok([recipe({ id: "b", title: "b" }), recipe({ id: "a", title: "a" })]),
  );
  await act(() => result.current.actions.setQuery("new"));
  await act(async () => {
    response.resolve(ok([]));
    await first;
  });
  expect(result.current.ids).toEqual(["b", "a"]);
  expect(result.current.selectedId).toBe("b");
  expect(result.current.query).toBe("new");
  expect(result.current.loading).toBe(false);
});

it("deletes a selected recipe and refreshes both recipe and plan caches", async () => {
  const { result } = renderHook(useGalleryState, { wrapper: AppScopes });
  await settleScopeLoads();
  await act(() => result.current.actions.reload());
  act(() => result.current.actions.select("b"));
  vi.mocked(commands.deleteRecipe).mockResolvedValue(ok(null));
  vi.mocked(commands.listRecipes).mockResolvedValue(
    ok([recipe({ id: "a", title: "a" })]),
  );
  await act(() => result.current.actions.deleteRecipe("b"));
  expect(commands.deleteRecipe).toHaveBeenCalledWith("b");
  expect(result.current.ids).toEqual(["a"]);
  expect(result.current.selectedId).toBeNull();
  expect(commands.getPlan).toHaveBeenCalledOnce();
  expect(commands.shoppingList).toHaveBeenCalledOnce();
});

it.each([
  {
    operation: "list",
    setup: () =>
      vi.mocked(commands.listRecipes).mockResolvedValueOnce({
        status: "error",
        error: { kind: "storage", detail: "Unavailable" },
      }),
    action: (actions: ReturnType<typeof useRecipesActions>) => actions.reload(),
    verifyRetry: () => expect(commands.listRecipes).toHaveBeenCalledTimes(3),
  },
  {
    operation: "search",
    setup: () =>
      vi.mocked(commands.searchRecipes).mockResolvedValueOnce({
        status: "error",
        error: { kind: "storage", detail: "Unavailable" },
      }),
    action: (actions: ReturnType<typeof useRecipesActions>) =>
      actions.setQuery("rice"),
    verifyRetry: () => expect(commands.searchRecipes).toHaveBeenCalledTimes(2),
  },
  {
    operation: "delete",
    setup: () =>
      vi.mocked(commands.deleteRecipe).mockResolvedValueOnce({
        status: "error",
        error: { kind: "storage", detail: "Unavailable" },
      }),
    action: (actions: ReturnType<typeof useRecipesActions>) =>
      actions.deleteRecipe("b"),
    verifyRetry: () => expect(commands.deleteRecipe).toHaveBeenCalledTimes(2),
  },
])(
  "reports $operation failures and retries the failed operation",
  async ({ setup, action, verifyRetry }) => {
    const { result } = renderHook(useGalleryState, { wrapper: AppScopes });
    await settleScopeLoads();
    await act(() => result.current.actions.reload());
    act(() => result.current.actions.select("b"));
    vi.mocked(commands.deleteRecipe).mockResolvedValue(ok(null));
    setup();
    await act(async () => {
      await action(result.current.actions);
    });
    expect(result.current.error).toBe("Unavailable");
    expect(result.current.loading).toBe(false);
    expect(result.current.ids).toEqual(["a", "b"]);
    expect(result.current.selectedId).toBe("b");
    expect(commands.getPlan).not.toHaveBeenCalled();
    vi.mocked(commands.listRecipes).mockResolvedValue(
      ok([recipe({ id: "a", title: "a" })]),
    );
    vi.mocked(commands.searchRecipes).mockResolvedValue(
      ok([recipe({ id: "a", title: "a" })]),
    );
    await act(() => result.current.actions.retry());
    expect(result.current.error).toBeNull();
    expect(result.current.ids).toEqual(["a"]);
    expect(result.current.selectedId).toBeNull();
    verifyRetry();
  },
);
