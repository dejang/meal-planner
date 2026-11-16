import "@/test-support/ipc";
import {
  useDraftRecipe,
  useEditorActions,
  useEditorAnalyzing,
  useEditorError,
  useEditorLoadingImage,
  useEditorSaving,
} from "@/stores/EditorStore";

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
