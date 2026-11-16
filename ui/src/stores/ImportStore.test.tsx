import { ok } from "../test-support/ipc";
import { AppScopes } from "../test-support/scopes";
import { commands } from "../api";
import { openUrl } from "@tauri-apps/plugin-opener";
import { analysis, deferred } from "../api/fixtures";
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useEditorActions, useDraftRecipe } from "./EditorStore";
import {
  useImportLinkError,
  useImportActions,
  useImportError,
  useImportImporting,
  useImportOpen,
  useImportSupportedSites,
  useImportUrl,
} from "./ImportStore";

function useImportSnapshot() {
  return {
    actions: useImportActions(),
    editor: useEditorActions(),
    draft: useDraftRecipe(),
    open: useImportOpen(),
    url: useImportUrl(),
    importing: useImportImporting(),
    error: useImportError(),
    sites: useImportSupportedSites(),
    linkError: useImportLinkError(),
  };
}

it.each([new Error("Connection lost"), "Connection lost"])(
  "reports supported-site load failures and clears the error on retry: %s",
  async (failure) => {
    const { result } = renderHook(useImportSnapshot, { wrapper: AppScopes });
    vi.mocked(commands.supportedSites).mockRejectedValueOnce(failure);
    await act(() => result.current.actions.reload());
    expect(commands.supportedSites).toHaveBeenCalledOnce();
    expect(result.current.error).toBe("Connection lost");
    expect(result.current.sites).toEqual([]);
    const sites = [{ name: "Recipe site", domains: ["recipes.example"] }];
    vi.mocked(commands.supportedSites).mockResolvedValueOnce(sites);
    await act(() => result.current.actions.reload());
    expect(result.current.error).toBeNull();
    expect(result.current.sites).toEqual(sites);
  },
);

it("clears link and form errors when reopening the import dialog", async () => {
  const { result } = renderHook(useImportSnapshot, { wrapper: AppScopes });
  act(() => result.current.actions.open());
  vi.mocked(commands.supportedSites).mockRejectedValueOnce(
    new Error("Load failed"),
  );
  await act(() => result.current.actions.reload());
  vi.mocked(openUrl).mockRejectedValueOnce(new Error("Cannot open browser"));
  await act(() => result.current.actions.openSite("https://recipes.example/"));
  expect(result.current.error).toBe("Load failed");
  expect(result.current.linkError).toBe("Cannot open browser");
  act(() => result.current.actions.close());
  expect(result.current.open).toBe(false);
  act(() => result.current.actions.open());
  expect(result.current.open).toBe(true);
  expect(result.current.error).toBeNull();
  expect(result.current.linkError).toBeNull();
});

it.each([null, { bytes: "aW1hZ2U=", width: 640, height: 480 }])(
  "imports a new editable draft with image %j without persisting it",
  async (image) => {
    const { result } = renderHook(useImportSnapshot, { wrapper: AppScopes });
    const imported = {
      title: "Soup",
      ingredients: ["1 carrot", "2 potatoes"],
      instructions: ["Chop", "Simmer"],
      servings: 3,
      image,
    };
    const nutrition = analysis();
    const response =
      deferred<Awaited<ReturnType<typeof commands.importRecipe>>>();
    vi.mocked(commands.importRecipe).mockReturnValueOnce(response.promise);
    vi.mocked(commands.analyzeIngredients).mockResolvedValueOnce(ok(nutrition));
    let pending!: Promise<void>;
    act(() => {
      result.current.actions.open();
      result.current.actions.setUrl("  https://recipes.example/soup  ");
      pending = result.current.actions.importRecipe();
    });
    expect(result.current.importing).toBe(true);
    await act(() => result.current.actions.importRecipe());
    expect(commands.importRecipe).toHaveBeenCalledExactlyOnceWith(
      "https://recipes.example/soup",
    );
    await act(async () => {
      response.resolve(ok(imported));
      await pending;
    });
    expect(commands.analyzeIngredients).toHaveBeenCalledExactlyOnceWith(
      imported.ingredients,
    );
    expect(commands.createRecipe).not.toHaveBeenCalled();
    expect(commands.updateRecipe).not.toHaveBeenCalled();
    expect(result.current.draft).toEqual({
      id: null,
      title: "Soup",
      ingredients: "1 carrot\n2 potatoes",
      instructions: "Chop\nSimmer\n\nhttps://recipes.example/soup",
      servings: 3,
      analysis: nutrition,
      image: image ? { kind: "set", image } : { kind: "keep" },
      imageVersion: null,
      imageSource: null,
    });
    expect(result.current.open).toBe(false);
    expect(result.current.url).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.importing).toBe(false);
  },
);

it("ignores blank input and protects an existing draft before requesting an import", async () => {
  const { result } = renderHook(useImportSnapshot, { wrapper: AppScopes });
  act(() => {
    result.current.actions.open();
    result.current.actions.setUrl("   ");
  });
  await act(() => result.current.actions.importRecipe());
  expect(commands.importRecipe).not.toHaveBeenCalled();
  expect(commands.analyzeIngredients).not.toHaveBeenCalled();
  expect(result.current.error).toBeNull();
  act(() => {
    result.current.editor.openNew();
    result.current.editor.patchDraft({ title: "Unfinished recipe" });
    result.current.actions.setUrl("https://recipes.example/soup");
  });
  const draft = result.current.draft;
  await act(() => result.current.actions.importRecipe());
  expect(commands.importRecipe).not.toHaveBeenCalled();
  expect(commands.analyzeIngredients).not.toHaveBeenCalled();
  expect(result.current.draft).toBe(draft);
  expect(result.current.error).toBe(
    "Close the current new recipe before importing another one",
  );
  expect(result.current.open).toBe(true);
  expect(result.current.importing).toBe(false);
});

it("does not replace a draft opened while the import was pending", async () => {
  const { result } = renderHook(useImportSnapshot, { wrapper: AppScopes });
  const response =
    deferred<Awaited<ReturnType<typeof commands.importRecipe>>>();
  vi.mocked(commands.importRecipe).mockReturnValueOnce(response.promise);
  let pending!: Promise<void>;
  act(() => {
    result.current.actions.open();
    result.current.actions.setUrl("https://recipes.example/soup");
    pending = result.current.actions.importRecipe();
    result.current.editor.openNew();
    result.current.editor.patchDraft({ title: "Keep me" });
  });
  const draft = result.current.draft;
  await act(async () => {
    response.resolve(
      ok({
        title: "Imported",
        ingredients: [],
        instructions: [],
        servings: 1,
        image: null,
      }),
    );
    await pending;
  });
  expect(result.current.draft).toBe(draft);
  expect(result.current.error).toBe(
    "Close the current new recipe before importing another one",
  );
  expect(result.current.open).toBe(true);
  expect(result.current.importing).toBe(false);
});

it.each([
  {
    failure: { kind: "import" as const, detail: "Unsupported website" },
    message: "Unsupported website",
  },
  { failure: new Error("Connection lost"), message: "Connection lost" },
])("reports $message and allows retry", async ({ failure, message }) => {
  const { result } = renderHook(useImportSnapshot, { wrapper: AppScopes });
  if (failure instanceof Error)
    vi.mocked(commands.importRecipe).mockRejectedValue(failure);
  else
    vi.mocked(commands.importRecipe).mockResolvedValue({
      status: "error",
      error: failure,
    });
  act(() => {
    result.current.actions.open();
    result.current.actions.setUrl("https://recipes.example/soup");
  });
  await act(() => result.current.actions.importRecipe());
  expect(result.current.error).toBe(message);
  expect(result.current.importing).toBe(false);
  expect(result.current.open).toBe(true);
  expect(result.current.url).toBe("https://recipes.example/soup");
  expect(result.current.draft).toBeNull();
  vi.mocked(commands.importRecipe).mockResolvedValue(
    ok({
      title: "Soup",
      ingredients: [],
      instructions: [],
      servings: 1,
      image: null,
    }),
  );
  await act(() => result.current.actions.importRecipe());
  expect(result.current.error).toBeNull();
  expect(result.current.draft?.title).toBe("Soup");
  expect(result.current.open).toBe(false);
});
