import { useState } from "react";

import { open } from "@tauri-apps/plugin-dialog";
import { createSelectorHook, Store } from "bonsai-react";
import { commands, unwrap, type ImportedRecipe, type RecipeInput } from "@/api";
import { createStoreContext } from "@/stores/core/context";
import { errorMessage } from "@/stores/core/error";
import { usePlanActions } from "@/stores/PlanStore";
import { useRecipesActions } from "@/stores/RecipesStore";

export interface RecipeDraft extends RecipeInput {
  id: string | null;
  imageVersion: string | null;
  imageSource: string | null;
}

export interface EditorState {
  draft: RecipeDraft | null;
  saving: boolean;
  analyzing: boolean;
  loadingImage: boolean;
  error: string | null;
}

interface TrackedRequest {
  sequence: number;
}

interface PendingRequest extends TrackedRequest {
  task: Promise<void> | null;
}

interface ImageRequest extends PendingRequest {
  source: string | null;
}

interface RequestOptions<T> {
  tracking: TrackedRequest;
  onBusy?: (busy: boolean) => void;
  accept?: () => boolean;
  request: () => Promise<Parameters<typeof unwrap<T>>[0]>;
  apply: (data: T) => void;
}

class EditorStore extends Store<EditorState> {
  constructor(
    readonly recipes: ReturnType<typeof useRecipesActions>,
    readonly plan: ReturnType<typeof usePlanActions>,
  ) {
    super({
      draft: null,
      saving: false,
      analyzing: false,
      loadingImage: false,
      error: null,
    });
  }

  private session = 0;
  private saveTask: Promise<boolean> | null = null;
  private openRequest: TrackedRequest = { sequence: 0 };
  private loadedImageSource: string | null = null;
  private imageRequest: ImageRequest = {
    sequence: 0,
    task: null,
    source: null,
  };
  private analysisRequest: PendingRequest = { sequence: 0, task: null };

  private setDraft(draft: RecipeDraft | null): void {
    this.session += 1;
    this.loadedImageSource = null;
    this.imageRequest.task = null;
    this.analysisRequest.task = null;
    this.update({ draft, error: null, analyzing: false, loadingImage: false });
  }

  private get editableState(): EditorState | null {
    const state = this.getSnapshot();
    return state.saving ? null : state;
  }

  private trackRequest<T>(options: RequestOptions<T>): Promise<void> {
    const { tracking, onBusy, accept, request, apply } = options;
    const session = this.session;
    const sequence = ++tracking.sequence;
    const isCurrent = () =>
      session === this.session && sequence === tracking.sequence;
    const isAccepted = () => isCurrent() && (!accept || accept());
    this.update({ error: null });
    onBusy?.(true);
    return (async () => {
      try {
        const data = unwrap(await request());
        if (isAccepted()) apply(data);
      } catch (error) {
        if (isAccepted()) this.update({ error: errorMessage(error) });
      } finally {
        if (isCurrent()) onBusy?.(false);
      }
    })();
  }

  private cancelImageLoad(): void {
    this.imageRequest.sequence += 1;
    this.imageRequest.task = null;
    this.update({ loadingImage: false });
  }

  private loadImage(
    source: string,
    request: () => ReturnType<typeof commands.loadImageFile>,
  ): Promise<void> {
    const state = this.editableState;
    if (!state?.draft) return Promise.resolve();
    this.actions.setImageSource(source);
    if (state.loadingImage && this.imageRequest.source === source)
      return this.imageRequest.task ?? Promise.resolve();
    if (this.loadedImageSource === source) {
      this.cancelImageLoad();
      return Promise.resolve();
    }
    this.imageRequest.source = source;
    this.imageRequest.task = this.trackRequest({
      tracking: this.imageRequest,
      onBusy: (loadingImage) => this.update({ loadingImage }),
      request,
      apply: (image) => {
        this.loadedImageSource = source;
        const draft = this.getSnapshot().draft;
        if (draft)
          this.update({
            draft: {
              ...draft,
              image: { kind: "set", image },
            },
          });
      },
    });
    return this.imageRequest.task;
  }

  readonly actions = {
    dismissError: (): void => {
      this.update({ error: null });
    },
    reload: async (): Promise<void> => {
      const draft = this.getSnapshot().draft;
      if (draft?.id) await this.actions.openRecipe(draft.id);
    },
    openNew: (): void => {
      if (!this.editableState) return;
      this.setDraft({
        id: null,
        title: "",
        ingredients: "",
        instructions: "",
        servings: 1,
        analysis: null,
        image: { kind: "keep" },
        imageVersion: null,
        imageSource: null,
      });
    },
    openRecipe: async (id: string): Promise<void> => {
      if (!this.editableState) return;
      await this.trackRequest({
        tracking: this.openRequest,
        accept: () => this.editableState !== null,
        request: () => commands.getRecipe(id),
        apply: ({ image_version, ...recipe }) => {
          this.setDraft({
            ...recipe,
            imageVersion: image_version,
            imageSource: null,
            image: { kind: "keep" },
          });
        },
      });
    },
    assertCanImport: (): void => {
      if (this.getSnapshot().draft !== null) {
        throw new Error(
          "Close the current new recipe before importing another one",
        );
      }
    },
    prepareImport: (
      target: "new" | "draft",
    ): ((recipe: ImportedRecipe, url: string) => void) => {
      if (target === "new") this.actions.assertCanImport();
      if (
        !this.editableState ||
        (target === "draft" && !this.getSnapshot().draft)
      )
        throw new Error("No editable recipe is open");
      const session = this.session;
      return (recipe, url) => {
        if (
          target === "draft" &&
          (session !== this.session || !this.editableState)
        )
          throw new Error("The recipe changed while importing");
        this.actions.openImported(recipe, url, target);
      };
    },
    openImported: (
      recipe: ImportedRecipe,
      sourceUrl: string,
      target: "new" | "draft" = "new",
    ): void => {
      if (target === "new") this.actions.assertCanImport();
      const current = this.editableState?.draft;
      if (target === "draft" && !current) return;
      this.setDraft({
        id: target === "draft" ? (current?.id ?? null) : null,
        title: recipe.title,
        ingredients: recipe.ingredients.join("\n"),
        instructions: `${recipe.instructions.join("\n")}\n\n${sourceUrl}`,
        servings: recipe.servings,
        analysis: null,
        image: recipe.image
          ? { kind: "set", image: recipe.image }
          : { kind: "keep" },
        imageVersion:
          target === "draft" ? (current?.imageVersion ?? null) : null,
        imageSource: null,
      });
      void this.actions.analyzeIngredients();
    },
    close: async (): Promise<boolean> => {
      this.openRequest.sequence += 1;
      await this.actions.save();
      return this.getSnapshot().draft === null;
    },
    deleteRecipe: async (): Promise<boolean> => {
      const draft = this.editableState?.draft;
      if (!draft?.id) return false;
      this.update({ saving: true });
      try {
        if (!(await this.recipes.deleteRecipe(draft.id))) return false;
        this.setDraft(null);
        return true;
      } finally {
        this.update({ saving: false });
      }
    },
    discard: (): boolean => {
      if (!this.editableState) return false;
      this.openRequest.sequence += 1;
      this.setDraft(null);
      return true;
    },
    patchDraft: (patch: Partial<RecipeInput>): void => {
      const draft = this.editableState?.draft;
      if (draft) {
        if (patch.image) {
          this.loadedImageSource = null;
          this.cancelImageLoad();
        }
        this.update({
          draft: {
            ...draft,
            ...patch,
            imageSource: patch.image ? null : draft.imageSource,
          },
        });
      }
    },
    setImageSource: (imageSource: string): void => {
      const draft = this.editableState?.draft;
      if (draft) this.update({ draft: { ...draft, imageSource } });
    },
    save: (): Promise<boolean> => {
      if (this.saveTask) return this.saveTask;
      const editableDraft = this.editableState?.draft;
      if (!editableDraft) return Promise.resolve(true);
      if (!editableDraft.id && !editableDraft.title.trim()) {
        this.setDraft(null);
        return Promise.resolve(true);
      }
      this.update({ saving: true, error: null });
      this.saveTask = (async () => {
        try {
          await Promise.all([
            this.imageRequest.task,
            this.analysisRequest.task,
          ]);
          const draft = this.getSnapshot().draft;
          if (!draft) return true;
          const id = draft.id;
          const input: RecipeInput = {
            title: draft.title,
            ingredients: draft.ingredients,
            instructions: draft.instructions,
            servings: draft.servings,
            analysis: draft.analysis,
            image: draft.image,
          };
          const saved = unwrap(
            id
              ? await commands.updateRecipe(id, input)
              : await commands.createRecipe(input),
          );
          this.update({
            draft: {
              ...draft,
              id: saved.id,
              imageVersion: saved.image_version,
              image: { kind: "keep" },
            },
          });
          await Promise.all([this.recipes.reload(), this.plan.reload()]);
          this.setDraft(null);
          return true;
        } catch (error) {
          this.update({ error: errorMessage(error) });
          return false;
        } finally {
          this.update({ saving: false });
        }
      })().finally(() => {
        this.saveTask = null;
      });
      return this.saveTask;
    },
    analyzeIngredients: (): Promise<void> => {
      const draft = this.editableState?.draft;
      if (!draft) return Promise.resolve();
      this.analysisRequest.task = this.trackRequest({
        tracking: this.analysisRequest,
        onBusy: (analyzing) => this.update({ analyzing }),
        accept: () =>
          this.getSnapshot().draft?.ingredients === draft.ingredients,
        request: () =>
          commands.analyzeIngredients(
            draft.ingredients
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          ),
        apply: (analysis) => {
          const current = this.getSnapshot().draft;
          if (current) this.update({ draft: { ...current, analysis } });
        },
      });
      return this.analysisRequest.task;
    },
    chooseImageFile: async (): Promise<void> => {
      if (!this.editableState?.draft) return;
      const session = this.session;
      try {
        const path = await open({
          multiple: false,
          filters: [
            {
              name: "Images",
              extensions: ["png", "jpg", "jpeg", "gif", "webp"],
            },
          ],
        });
        if (typeof path === "string" && session === this.session)
          await this.actions.loadImageFile(path);
      } catch (error) {
        if (session === this.session)
          this.update({ error: errorMessage(error) });
      }
    },
    loadImageFile: (path: string): Promise<void> => {
      return this.loadImage(path, () => commands.loadImageFile(path));
    },
    loadImageUrl: (url: string): Promise<void> => {
      if (!url.trim()) return Promise.resolve();
      return this.loadImage(url, () => commands.loadImageUrl(url));
    },
  };
}

const context = createStoreContext(() => {
  const recipes = useRecipesActions();
  const plan = usePlanActions();
  return useState(() => new EditorStore(recipes, plan))[0];
});

export function EditorScope({ children }: { children: React.ReactNode }) {
  return <context.Scope>{children}</context.Scope>;
}

export function useDraftRecipe() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.draft),
  )();
}

export function useEditorOpen() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.draft !== null),
  )();
}

export function useEditorSaving() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.saving),
  )();
}

export function useEditorAnalyzing() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.analyzing),
  )();
}

export function useEditorLoadingImage() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.loadingImage),
  )();
}

export function useEditorError() {
  return context.useScopedHook((store) =>
    createSelectorHook(store, (state) => state.error),
  )();
}

export function useEditorActions() {
  return context.useActions();
}
