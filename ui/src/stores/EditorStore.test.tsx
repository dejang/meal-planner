import { useEditor } from "../test-support/editor";
import { act, renderHook } from "@testing-library/react";
import { recipe, analysis, deferred } from "../api/fixtures";
import { expect, it, vi } from "vitest";
import { open } from "@tauri-apps/plugin-dialog";
import { commands, type Error as ApiError } from "../api";
import { useRecipesActions } from "./RecipesStore";
import { usePlanActions } from "./PlanStore";
import { EditorScope } from "./EditorStore";

it.each(["", " \n "])(
  "discards an untitled new draft on close (%j)",
  async (title) => {
    const { result } = renderHook(useEditor, { wrapper: EditorScope });
    act(() => {
      result.current.actions.openNew();
      result.current.actions.patchDraft({ title, ingredients: "1 onion" });
    });
    await act(() => result.current.actions.close());
    expect(result.current.draft).toBeNull();
    expect(commands.createRecipe).not.toHaveBeenCalled();
    expect(commands.updateRecipe).not.toHaveBeenCalled();
    expect(
      vi.mocked(useRecipesActions).mock.results[0].value.reload,
    ).not.toHaveBeenCalled();
  },
);

it.each(["new", "existing", "imported"])(
  "saves a %s draft on close and refreshes both peer stores",
  async (source) => {
    const { result } = renderHook(useEditor, { wrapper: EditorScope });
    if (source === "existing") {
      await act(() => result.current.actions.openRecipe("recipe-1"));
    } else {
      act(() => {
        if (source === "new") result.current.actions.openNew();
        else
          result.current.actions.openImported(
            {
              title: "Soup",
              ingredients: ["1 onion", "2 carrots"],
              instructions: ["Chop", "Simmer"],
              servings: 2,
              image: { bytes: "jpeg", width: 2, height: 2 },
            },
            "https://recipes.example/soup",
          );
      });
    }
    act(() =>
      result.current.actions.patchDraft({ title: "Edited soup", servings: 3 }),
    );
    expect(commands.createRecipe).not.toHaveBeenCalled();
    expect(commands.updateRecipe).not.toHaveBeenCalled();
    const draft = result.current.draft;
    await act(() => result.current.actions.close());
    const input = {
      title: "Edited soup",
      ingredients: draft?.ingredients,
      instructions: draft?.instructions,
      servings: 3,
      analysis: null,
      image: draft?.image,
    };
    if (source === "existing")
      expect(commands.updateRecipe).toHaveBeenCalledWith("recipe-1", input);
    else expect(commands.createRecipe).toHaveBeenCalledWith(input);
    expect(
      vi.mocked(useRecipesActions).mock.results[0].value.reload,
    ).toHaveBeenCalledOnce();
    expect(
      vi.mocked(usePlanActions).mock.results[0].value.reload,
    ).toHaveBeenCalledOnce();
    expect(result.current.draft).toBeNull();
  },
);

it("reloads persisted drafts but does not fetch unsaved ones", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  act(() => result.current.actions.openNew());
  await act(() => result.current.actions.reload());
  expect(commands.getRecipe).not.toHaveBeenCalled();
  await act(() => result.current.actions.openRecipe("recipe-1"));
  expect(result.current.draft).toMatchObject({
    id: "recipe-1",
    title: "Soup",
    ingredients: "1 onion",
    imageVersion: "v1",
    image: { kind: "keep" },
  });
  vi.mocked(commands.getRecipe).mockResolvedValueOnce({
    status: "ok",
    data: { ...recipe(), title: "Reloaded" },
  });
  await act(() => result.current.actions.reload());
  expect(result.current.draft?.title).toBe("Reloaded");
});

it.each([false, true])(
  "keeps the current draft when opening a recipe fails (existing: %s)",
  async (existing) => {
    const { result } = renderHook(useEditor, { wrapper: EditorScope });
    if (existing)
      await act(() => result.current.actions.openRecipe("recipe-1"));
    const draft = result.current.draft;
    const response = deferred<Awaited<ReturnType<typeof commands.getRecipe>>>();
    vi.mocked(commands.getRecipe).mockReturnValueOnce(response.promise);
    let opening: Promise<void>;
    act(() => {
      opening = result.current.actions.openRecipe("missing");
    });
    expect(result.current.draft).toBe(draft);
    expect(result.current.saving).toBe(false);
    await act(async () => {
      response.resolve({
        status: "error",
        error: { kind: "not_found", detail: "Recipe not found" },
      });
      await opening;
    });
    expect(result.current.draft).toBe(draft);
    expect(result.current.error).toBe("Recipe not found");
    await act(() => result.current.actions.close());
    expect(commands.createRecipe).not.toHaveBeenCalled();
  },
);

it.each(["image", "analysis"])(
  "saves despite a pending %s failure and reports the error",
  async (source) => {
    const { result } = renderHook(useEditor, { wrapper: EditorScope });
    const response = deferred<{ status: "error"; error: ApiError }>();
    if (source === "image")
      vi.mocked(commands.loadImageUrl).mockReturnValueOnce(response.promise);
    else
      vi.mocked(commands.analyzeIngredients).mockReturnValueOnce(
        response.promise,
      );
    const persisted =
      deferred<Awaited<ReturnType<typeof commands.createRecipe>>>();
    vi.mocked(commands.createRecipe).mockReturnValueOnce(persisted.promise);
    act(() => {
      result.current.actions.openNew();
      result.current.actions.patchDraft({
        title: "Soup",
        ingredients: "1 onion",
      });
      if (source === "image")
        void result.current.actions.loadImageUrl("image-url");
      else void result.current.actions.analyzeIngredients();
    });
    let saving: Promise<void>;
    act(() => {
      saving = result.current.actions.close();
    });
    await act(async () => {
      response.resolve({
        status: "error",
        error: {
          kind: source === "image" ? "image" : "analysis",
          detail: "Offline",
        },
      });
      await response.promise;
    });
    expect(result.current.error).toBe("Offline");
    expect(commands.createRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Soup",
        ingredients: "1 onion",
        analysis: null,
        image: { kind: "keep" },
      }),
    );
    await act(async () => {
      persisted.resolve({ status: "ok", data: recipe() });
      await saving;
    });
    expect(result.current.draft).toBeNull();
    expect(
      vi.mocked(useRecipesActions).mock.results[0].value.reload,
    ).toHaveBeenCalledOnce();
    expect(
      vi.mocked(usePlanActions).mock.results[0].value.reload,
    ).toHaveBeenCalledOnce();
  },
);

it("does not create twice when a cache refresh fails after persistence", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  vi.mocked(
    vi.mocked(useRecipesActions).mock.results[0].value.reload,
  ).mockRejectedValueOnce(new Error("Reload failed"));
  act(() => {
    result.current.actions.openNew();
    result.current.actions.patchDraft({ title: "Soup" });
  });
  await act(() => result.current.actions.close());
  expect(result.current.error).toBe("Reload failed");
  expect(result.current.draft?.id).toBe("recipe-1");
  await act(() => result.current.actions.close());
  expect(commands.createRecipe).toHaveBeenCalledOnce();
  expect(commands.updateRecipe).toHaveBeenCalledOnce();
  expect(result.current.draft).toBeNull();
});

it.each<{ error: ApiError; message: string }>([
  { error: { kind: "storage", detail: "Disk full" }, message: "Disk full" },
  {
    error: { kind: "lock_poisoned" },
    message:
      "Recipe storage is unavailable. Please restart the app and try again.",
  },
])(
  "retains a failed save for retry without refreshing peers ($error.kind)",
  async ({ error, message }) => {
    const { result } = renderHook(useEditor, { wrapper: EditorScope });
    act(() => {
      result.current.actions.openNew();
      result.current.actions.patchDraft({ title: "Soup" });
    });
    vi.mocked(commands.createRecipe).mockResolvedValueOnce({
      status: "error",
      error,
    });
    await act(() => result.current.actions.close());
    expect(result.current.error).toBe(message);
    expect(result.current.draft?.title).toBe("Soup");
    expect(result.current.saving).toBe(false);
    expect(
      vi.mocked(usePlanActions).mock.results[0].value.reload,
    ).not.toHaveBeenCalled();
    await act(() => result.current.actions.close());
    expect(result.current.draft).toBeNull();
  },
);

it("waits for image and analysis before saving and ignores duplicate close requests", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  const image = { bytes: "jpeg", width: 20, height: 10 };
  const nutrition = analysis();
  const imageResult =
    deferred<Awaited<ReturnType<typeof commands.loadImageUrl>>>();
  const analysisResult =
    deferred<Awaited<ReturnType<typeof commands.analyzeIngredients>>>();
  vi.mocked(commands.loadImageUrl).mockReturnValue(imageResult.promise);
  vi.mocked(commands.analyzeIngredients).mockReturnValue(
    analysisResult.promise,
  );
  act(() => {
    result.current.actions.openNew();
    result.current.actions.patchDraft({
      title: "Soup",
      ingredients: " 1 onion \n\n2 carrots\n",
    });
    void result.current.actions.loadImageUrl("https://example.com/soup.jpg");
    void result.current.actions.analyzeIngredients();
  });
  expect(result.current.loadingImage).toBe(true);
  expect(result.current.analyzing).toBe(true);
  let saving: Promise<void>;
  act(() => {
    saving = result.current.actions.close();
  });
  await act(() => result.current.actions.close());
  expect(commands.createRecipe).not.toHaveBeenCalled();
  await act(async () => {
    imageResult.resolve({ status: "ok", data: image });
    analysisResult.resolve({ status: "ok", data: nutrition });
    await saving;
  });
  expect(commands.analyzeIngredients).toHaveBeenCalledWith([
    "1 onion",
    "2 carrots",
  ]);
  expect(commands.createRecipe).toHaveBeenCalledOnce();
  expect(commands.createRecipe).toHaveBeenCalledWith(
    expect.objectContaining({
      image: { kind: "set", image },
      analysis: nutrition,
    }),
  );
  expect(result.current.draft).toBeNull();
});

it.each(["file", "url"])(
  "loads a %s image into the draft and reports failures",
  async (source) => {
    const { result } = renderHook(useEditor, { wrapper: EditorScope });
    const image = { bytes: "jpeg", width: 20, height: 10 };
    const command =
      source === "file" ? commands.loadImageFile : commands.loadImageUrl;
    vi.mocked(command)
      .mockResolvedValueOnce({ status: "ok", data: image })
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "image", detail: "Bad image" },
      });
    act(() => result.current.actions.openNew());
    const load =
      source === "file"
        ? result.current.actions.loadImageFile
        : result.current.actions.loadImageUrl;
    await act(() => load("image-source"));
    expect(command).toHaveBeenCalledWith("image-source");
    expect(result.current.draft?.image).toEqual({ kind: "set", image });
    await act(() => load("bad-source"));
    expect(result.current.error).toBe("Bad image");
    expect(result.current.draft?.image).toEqual({ kind: "set", image });
    expect(result.current.loadingImage).toBe(false);
  },
);

it("keeps the loaded image when reselected during a different image load", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  const image = { bytes: "image-a", width: 20, height: 10 };
  const response =
    deferred<Awaited<ReturnType<typeof commands.loadImageUrl>>>();
  vi.mocked(commands.loadImageUrl)
    .mockResolvedValueOnce({ status: "ok", data: image })
    .mockReturnValueOnce(response.promise);
  act(() => result.current.actions.openNew());
  await act(() => result.current.actions.loadImageUrl("source-a"));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.actions.loadImageUrl("source-b");
  });
  expect(result.current.loadingImage).toBe(true);
  await act(() => result.current.actions.loadImageUrl("source-a"));
  expect(result.current.loadingImage).toBe(false);
  await act(async () => {
    response.resolve({
      status: "ok",
      data: { bytes: "image-b", width: 2, height: 2 },
    });
    await pending;
  });
  expect(result.current.draft?.image).toEqual({ kind: "set", image });
  expect(result.current.draft?.imageSource).toBe("source-a");
  expect(result.current.loadingImage).toBe(false);
  expect(commands.loadImageUrl).toHaveBeenCalledTimes(2);
});

it("chooses supported files and leaves the image alone when the picker is canceled", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  act(() => result.current.actions.openNew());
  vi.mocked(open)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce("/soup.png");
  vi.mocked(commands.loadImageFile).mockResolvedValue({
    status: "ok",
    data: { bytes: "jpeg", width: 2, height: 2 },
  });
  await act(() => result.current.actions.chooseImageFile());
  expect(commands.loadImageFile).not.toHaveBeenCalled();
  await act(() => result.current.actions.chooseImageFile());
  expect(open).toHaveBeenCalledWith({
    multiple: false,
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
    ],
  });
  expect(commands.loadImageFile).toHaveBeenCalledWith("/soup.png");
});

it("rejects stale analysis and image responses after switching drafts", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  const imageResult =
    deferred<Awaited<ReturnType<typeof commands.loadImageUrl>>>();
  const analysisResult =
    deferred<Awaited<ReturnType<typeof commands.analyzeIngredients>>>();
  vi.mocked(commands.loadImageUrl).mockReturnValue(imageResult.promise);
  vi.mocked(commands.analyzeIngredients).mockReturnValue(
    analysisResult.promise,
  );
  act(() => {
    result.current.actions.openNew();
    result.current.actions.patchDraft({ ingredients: "1 onion" });
    void result.current.actions.loadImageUrl("old-url");
    void result.current.actions.analyzeIngredients();
    result.current.actions.openNew();
    result.current.actions.patchDraft({ title: "New draft" });
  });
  await act(async () => {
    imageResult.resolve({
      status: "ok",
      data: { bytes: "old", width: 2, height: 2 },
    });
    analysisResult.resolve({ status: "ok", data: analysis() });
  });
  expect(result.current.draft).toMatchObject({
    title: "New draft",
    image: { kind: "keep" },
    analysis: null,
  });
  expect(result.current.loadingImage).toBe(false);
  expect(result.current.analyzing).toBe(false);
});

it("keeps edited ingredients from receiving stale nutrition and shows analysis errors", async () => {
  const { result } = renderHook(useEditor, { wrapper: EditorScope });
  const response =
    deferred<Awaited<ReturnType<typeof commands.analyzeIngredients>>>();
  vi.mocked(commands.analyzeIngredients)
    .mockReturnValueOnce(response.promise)
    .mockResolvedValueOnce({
      status: "error",
      error: { kind: "analysis", detail: "Check credentials" },
    });
  act(() => {
    result.current.actions.openNew();
    result.current.actions.patchDraft({ ingredients: "1 onion" });
    void result.current.actions.analyzeIngredients();
    result.current.actions.patchDraft({ ingredients: "2 carrots" });
  });
  await act(async () => {
    response.resolve({ status: "ok", data: analysis() });
  });
  expect(result.current.draft?.analysis).toBeNull();
  await act(() => result.current.actions.analyzeIngredients());
  expect(result.current.error).toBe("Check credentials");
  expect(result.current.analyzing).toBe(false);
});
