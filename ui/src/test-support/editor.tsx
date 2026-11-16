import { beforeEach, vi } from "vitest";
import { commands, imageUrl } from "../api";
import { recipe } from "../api/fixtures";
import { useRecipesActions } from "../stores/RecipesStore";
import { usePlanActions } from "../stores/PlanStore";
import {
  useDraftRecipe,
  useEditorActions,
  useEditorAnalyzing,
  useEditorError,
  useEditorLoadingImage,
  useEditorSaving,
} from "../stores/EditorStore";

vi.mock("../api", async (importOriginal) => ({
  unwrap: (await importOriginal<typeof import("../api")>()).unwrap,
  imageUrl: vi.fn(),
  commands: {
    getRecipe: vi.fn(),
    createRecipe: vi.fn(),
    updateRecipe: vi.fn(),
    analyzeIngredients: vi.fn(),
    loadImageFile: vi.fn(),
    loadImageUrl: vi.fn(),
  },
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../stores/RecipesStore", () => ({
  useRecipesActions: vi.fn(),
}));
vi.mock("../stores/PlanStore", () => ({
  usePlanActions: vi.fn(),
}));

export function useEditor() {
  return {
    draft: useDraftRecipe(),
    actions: useEditorActions(),
    error: useEditorError(),
    saving: useEditorSaving(),
    analyzing: useEditorAnalyzing(),
    loadingImage: useEditorLoadingImage(),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(imageUrl).mockReturnValue("https://images.test/soup.jpg");
  vi.mocked(useRecipesActions).mockImplementation(() => ({
    reload: vi.fn().mockResolvedValue(undefined),
    setQuery: vi.fn(),
    select: vi.fn(),
    deleteRecipe: vi.fn(),
  }));
  vi.mocked(usePlanActions).mockImplementation(() => ({
    reload: vi.fn().mockResolvedValue(undefined),
    addToDay: vi.fn(),
    moveMeal: vi.fn(),
    dropRecipe: vi.fn(),
    removeFromDay: vi.fn(),
    clearDay: vi.fn(),
    copyPreviousDay: vi.fn(),
  }));
  vi.mocked(commands.getRecipe).mockResolvedValue({
    status: "ok",
    data: recipe(),
  });
  vi.mocked(commands.createRecipe).mockResolvedValue({
    status: "ok",
    data: recipe(),
  });
  vi.mocked(commands.updateRecipe).mockResolvedValue({
    status: "ok",
    data: recipe(),
  });
});
