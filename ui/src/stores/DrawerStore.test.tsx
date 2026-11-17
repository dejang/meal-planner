import { commands, ok } from "@/test-support/ipc";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  DrawerMode,
  useDrawerActions,
  useDrawerOpen,
  useDrawerMode,
  useDrawerRecipeId,
} from "@/stores/DrawerStore";
import {
  useDraftRecipe,
  useEditorActions,
  useEditorError,
} from "@/stores/EditorStore";
import { AppScopes } from "@/test-support/scopes";
import { deferred, recipe } from "@/test-support/fixtures";

function useDrawer() {
  return {
    state: {
      open: useDrawerOpen(),
      mode: useDrawerMode(),
      recipeId: useDrawerRecipeId(),
    },
    actions: useDrawerActions(),
    draft: useDraftRecipe(),
    editor: useEditorActions(),
    error: useEditorError(),
  };
}

it("opens a recipe in view without creating a draft and closes the selection", async () => {
  const { result } = renderHook(useDrawer, { wrapper: AppScopes });
  expect(result.current.state.open).toBe(false);
  await act(() => result.current.actions.openRecipe("recipe-1"));
  expect(result.current.state).toEqual({
    open: true,
    mode: DrawerMode.View,
    recipeId: "recipe-1",
  });
  expect(result.current.draft).toBeNull();
  expect(commands.getRecipe).not.toHaveBeenCalled();
  await act(() => result.current.actions.close());
  expect(result.current.state).toEqual({
    open: false,
    mode: DrawerMode.View,
    recipeId: null,
  });
});

it.each([
  {
    mode: DrawerMode.Edit,
    action: "openEdit" as const,
    draftId: "recipe-1",
    save: commands.updateRecipe,
  },
  {
    mode: DrawerMode.Create,
    action: "openCreate" as const,
    draftId: null,
    save: commands.createRecipe,
  },
])(
  "opens $mode using the editor and saves before switching to view",
  async ({ mode, action, draftId, save }) => {
    const { result } = renderHook(useDrawer, { wrapper: AppScopes });
    await act(() => result.current.actions[action]("recipe-1"));
    expect(result.current.state.mode).toBe(mode);
    expect(result.current.state.open).toBe(true);
    expect(result.current.draft?.id).toBe(draftId);
    act(() => result.current.editor.patchDraft({ title: "Dinner" }));
    await act(() => result.current.actions.switchToView("recipe-2"));
    expect(save).toHaveBeenCalled();
    expect(result.current.draft).toBeNull();
    expect(result.current.state).toEqual({
      open: true,
      mode: DrawerMode.View,
      recipeId: "recipe-2",
    });
  },
);

it.each([
  {
    action: "openRecipe" as const,
    expected: { open: true, mode: DrawerMode.View, recipeId: "recipe-2" },
  },
  {
    action: "openEdit" as const,
    expected: { open: true, mode: DrawerMode.Edit, recipeId: "recipe-2" },
  },
  {
    action: "openCreate" as const,
    expected: { open: true, mode: DrawerMode.Create, recipeId: null },
  },
  {
    action: "close" as const,
    expected: { open: false, mode: DrawerMode.View, recipeId: null },
  },
])(
  "saves a desktop editor draft before $action and preserves it if saving fails",
  async ({ action, expected }) => {
    const { result } = renderHook(useDrawer, { wrapper: AppScopes });
    await act(() => result.current.editor.openRecipe("recipe-1"));
    act(() =>
      result.current.editor.patchDraft({ title: "Unsaved desktop edit" }),
    );
    const initialDrawer = result.current.state;
    vi.mocked(commands.updateRecipe).mockResolvedValueOnce({
      status: "error",
      error: { kind: "not_found", detail: "Save failed" },
    });
    await act(() => result.current.actions[action]("recipe-2"));
    expect(result.current.state).toEqual(initialDrawer);
    expect(result.current.draft?.title).toBe("Unsaved desktop edit");
    expect(result.current.error).toContain("Save failed");
    await act(() => result.current.actions[action]("recipe-2"));
    expect(commands.updateRecipe).toHaveBeenLastCalledWith(
      "recipe-1",
      expect.objectContaining({ title: "Unsaved desktop edit" }),
    );
    expect(result.current.state).toEqual(expected);
    expect(result.current.draft?.title).not.toBe("Unsaved desktop edit");
  },
);

it("does not reopen an editor when a pending recipe load completes after close", async () => {
  const pending = deferred<Awaited<ReturnType<typeof commands.getRecipe>>>();
  vi.mocked(commands.getRecipe).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useDrawer, { wrapper: AppScopes });
  let opening!: Promise<void>;
  await act(async () => {
    opening = result.current.actions.openEdit("recipe-1");
  });
  await act(() => result.current.actions.close());
  await act(async () => {
    pending.resolve(ok(recipe()));
    await opening;
  });
  expect(result.current.state.open).toBe(false);
  expect(result.current.draft).toBeNull();
});

it.each([true, false])(
  "waits for the same in-flight save on repeated close (success: %s)",
  async (success) => {
    const pending =
      deferred<Awaited<ReturnType<typeof commands.createRecipe>>>();
    vi.mocked(commands.createRecipe).mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useDrawer, { wrapper: AppScopes });
    await act(() => result.current.actions.openCreate());
    act(() => result.current.editor.patchDraft({ title: "Dinner" }));
    let first!: Promise<void>;
    let second!: Promise<void>;
    let secondClosed = false;
    await act(async () => {
      first = result.current.actions.close();
      second = result.current.actions.close().then(() => {
        secondClosed = true;
      });
    });
    expect(secondClosed).toBe(false);
    expect(result.current.state.open).toBe(true);
    expect(commands.createRecipe).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve(
        success
          ? ok(recipe())
          : {
              status: "error",
              error: { kind: "not_found", detail: "Save failed" },
            },
      );
      await Promise.all([first, second]);
    });
    expect(result.current.state.open).toBe(!success);
    expect(result.current.state.mode).toBe(
      success ? DrawerMode.View : DrawerMode.Create,
    );
    expect(result.current.draft?.title ?? null).toBe(success ? null : "Dinner");
    expect(commands.createRecipe).toHaveBeenCalledOnce();
  },
);
