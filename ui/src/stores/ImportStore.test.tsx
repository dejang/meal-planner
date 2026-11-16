import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PlanScope } from "./PlanStore";
import { RecipesScope } from "./RecipesStore";
import { EditorScope, useEditorActions, useEditorDraft } from "./EditorStore";
import {
  ImportScope,
  useImportActions,
  useImportError,
  useImportImporting,
  useImportOpen,
  useImportSupportedSites,
  useImportUrl,
} from "./ImportStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(openUrl).mockReset();
});

function Scopes({ children }: { children: ReactNode }) {
  return (
    <PlanScope>
      <RecipesScope>
        <EditorScope>
          <ImportScope>{children}</ImportScope>
        </EditorScope>
      </RecipesScope>
    </PlanScope>
  );
}

function useImportSnapshot() {
  return {
    actions: useImportActions(),
    editor: useEditorActions(),
    draft: useEditorDraft(),
    open: useImportOpen(),
    url: useImportUrl(),
    importing: useImportImporting(),
    error: useImportError(),
    sites: useImportSupportedSites(),
  };
}

it("opens a supported site in the browser through the opener plugin", async () => {
  vi.mocked(openUrl).mockResolvedValueOnce(undefined);
  const { result } = renderHook(useImportSnapshot, { wrapper: Scopes });
  await act(() => result.current.actions.openSite("https://recipes.example/"));
  expect(openUrl).toHaveBeenCalledExactlyOnceWith("https://recipes.example/");
});

it.each([new Error("Connection lost"), "Connection lost"])(
  "reports supported-site load failures and clears the error on retry: %s",
  async (failure) => {
    const { result } = renderHook(useImportSnapshot, { wrapper: Scopes });
    vi.mocked(invoke).mockRejectedValueOnce(failure);
    await act(() => result.current.actions.reload());
    expect(invoke).toHaveBeenCalledWith("supported_sites");
    expect(result.current.error).toBe("Connection lost");
    expect(result.current.sites).toEqual([]);
    const sites = [{ name: "Recipe site", domains: ["recipes.example"] }];
    vi.mocked(invoke).mockResolvedValueOnce(sites);
    await act(() => result.current.actions.reload());
    expect(result.current.error).toBeNull();
    expect(result.current.sites).toEqual(sites);
  },
);

it.each([null, { bytes: "aW1hZ2U=", width: 640, height: 480 }])(
  "imports a new editable draft with image %j without persisting it",
  async (image) => {
    const { result } = renderHook(useImportSnapshot, { wrapper: Scopes });
    const imported = {
      title: "Soup",
      ingredients: ["1 carrot", "2 potatoes"],
      instructions: ["Chop", "Simmer"],
      servings: 3,
      image,
    };
    let resolveImport!: (value: typeof imported) => void;
    vi.mocked(invoke).mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    let pending!: Promise<void>;
    act(() => {
      result.current.actions.open();
      result.current.actions.setUrl("  https://recipes.example/soup  ");
      pending = result.current.actions.importRecipe();
    });
    expect(result.current.importing).toBe(true);
    await act(() => result.current.actions.importRecipe());
    expect(invoke).toHaveBeenCalledWith("import_recipe", {
      url: "https://recipes.example/soup",
    });
    await act(async () => {
      resolveImport(imported);
      await pending;
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.current.draft).toEqual({
      id: null,
      title: "Soup",
      ingredients: "1 carrot\n2 potatoes",
      instructions: "Chop\nSimmer\n\nhttps://recipes.example/soup",
      servings: 3,
      analysis: null,
      image: image ? { kind: "set", image } : { kind: "keep" },
      imageVersion: null,
    });
    expect(result.current.open).toBe(false);
    expect(result.current.url).toBe("");
    expect(result.current.error).toBeNull();
    expect(result.current.importing).toBe(false);
  },
);

it("ignores blank input and protects an existing draft before requesting an import", async () => {
  const { result } = renderHook(useImportSnapshot, { wrapper: Scopes });
  act(() => {
    result.current.actions.open();
    result.current.actions.setUrl("   ");
  });
  await act(() => result.current.actions.importRecipe());
  expect(invoke).not.toHaveBeenCalled();
  expect(result.current.error).toBeNull();
  act(() => {
    result.current.editor.openNew();
    result.current.editor.patchDraft({ title: "Unfinished recipe" });
    result.current.actions.setUrl("https://recipes.example/soup");
  });
  const draft = result.current.draft;
  await act(() => result.current.actions.importRecipe());
  expect(invoke).not.toHaveBeenCalled();
  expect(result.current.draft).toBe(draft);
  expect(result.current.error).toBe(
    "Close the current new recipe before importing another one",
  );
  expect(result.current.open).toBe(true);
  expect(result.current.importing).toBe(false);
});

it("does not replace a draft opened while the import was pending", async () => {
  const { result } = renderHook(useImportSnapshot, { wrapper: Scopes });
  let resolveImport!: (value: unknown) => void;
  vi.mocked(invoke).mockReturnValue(
    new Promise((resolve) => {
      resolveImport = resolve;
    }),
  );
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
    resolveImport({
      title: "Imported",
      ingredients: [],
      instructions: [],
      servings: 1,
      image: null,
    });
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
    failure: { kind: "import", detail: "Unsupported website" },
    message: "Unsupported website",
  },
  { failure: new Error("Connection lost"), message: "Connection lost" },
])("reports $message and allows retry", async ({ failure, message }) => {
  const { result } = renderHook(useImportSnapshot, { wrapper: Scopes });
  vi.mocked(invoke).mockRejectedValue(failure);
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
  vi.mocked(invoke).mockResolvedValue({
    title: "Soup",
    ingredients: [],
    instructions: [],
    servings: 1,
    image: null,
  });
  await act(() => result.current.actions.importRecipe());
  expect(result.current.error).toBeNull();
  expect(result.current.draft?.title).toBe("Soup");
  expect(result.current.open).toBe(false);
});
