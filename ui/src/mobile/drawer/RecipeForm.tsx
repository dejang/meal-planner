import { useRef, useState } from "react";
import { Button, ButtonVariant } from "@/components/Button";
import { TextArea, TextInput } from "@/components/TextInput";
import { RecipePhoto } from "@/components/RecipePhoto";
import { NutritionLabel } from "@/components/NutritionLabel";
import { Stepper } from "@/components/mobile/Stepper";
import { IngredientMatches } from "@/mobile/drawer/IngredientMatches";
import {
  useDraftRecipe,
  useEditorActions,
  useEditorSaving,
  useEditorAnalyzing,
  useEditorLoadingImage,
  useEditorError,
} from "@/stores/EditorStore";
import {
  useImportActions,
  useImportUrl,
  useImportImporting,
  useImportError,
  useImportSupportedSites,
  useImportLinkError,
} from "@/stores/ImportStore";
import { useDrawerActions } from "@/stores/DrawerStore";
import { useRecipesError } from "@/stores/RecipesStore";

export default function RecipeForm() {
  const draft = useDraftRecipe();
  const editor = useEditorActions();
  const saving = useEditorSaving();
  const analyzing = useEditorAnalyzing();
  const loadingImage = useEditorLoadingImage();
  const error = useEditorError();
  const importer = useImportActions();
  const url = useImportUrl();
  const importing = useImportImporting();
  const importError = useImportError();
  const sites = useImportSupportedSites();
  const linkError = useImportLinkError();
  const drawer = useDrawerActions();
  const recipeError = useRecipesError();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ingredientsBox = useRef<HTMLTextAreaElement>(null);
  const hasPhoto =
    draft?.image.kind === "set" ||
    (draft?.image.kind === "keep" && draft.imageVersion !== null);
  return (
    <>
      {error && (
        <p className="recipe-drawer-error" role="alert">
          {error}
        </p>
      )}
      {!draft ? (
        <p role="status">Loading recipe…</p>
      ) : (
        <fieldset className="recipe-drawer-form" disabled={saving || importing}>
          <details className="recipe-drawer-import" open={!draft.id}>
            <summary>Import from URL</summary>
            <form
              className="recipe-drawer-import-form"
              onSubmit={(event) => {
                event.preventDefault();
                void importer.importRecipe("draft");
              }}
              aria-busy={importing}
            >
              <label>
                Recipe URL
                <TextInput
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={url}
                  onChange={(event) => importer.setUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <Button
                type="submit"
                variant={ButtonVariant.Primary}
                disabled={importing || !url.trim()}
              >
                {importing ? "Importing…" : "Import"}
              </Button>
              {importError && <p role="alert">{importError}</p>}
            </form>
            <details className="recipe-drawer-sites">
              <summary>Supported sites</summary>
              <ul>
                {sites.map((site) => (
                  <li key={site.name}>
                    {site.name}
                    <ul>
                      {site.domains.map((domain) => (
                        <li key={domain}>
                          <a
                            href={`https://${domain}`}
                            onClick={(event) => {
                              event.preventDefault();
                              void importer.openSite(event.currentTarget.href);
                            }}
                          >
                            {domain}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </details>
            {linkError && <p role="alert">{linkError}</p>}
          </details>
          <div className="recipe-drawer-group">
            <Button
              className="recipe-drawer-photo-picker"
              aria-label="Choose recipe photo"
              onClick={editor.chooseImageFile}
              disabled={loadingImage}
            >
              <RecipePhoto
                className="recipe-drawer-photo-preview"
                recipeId={draft.id}
                imageVersion={
                  draft.image.kind === "keep" ? draft.imageVersion : null
                }
                image={draft.image.kind === "set" ? draft.image.image : null}
                alt={draft.title || "Recipe photo"}
              />
              <span className="recipe-drawer-photo-action" aria-hidden="true">
                {hasPhoto ? "Change photo" : "Choose photo"}
              </span>
            </Button>
            <label>
              Image URL
              <TextInput
                type="url"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                placeholder="Or paste an image link"
                value={draft.imageSource ?? ""}
                onChange={(event) => editor.setImageSource(event.target.value)}
                onBlur={() => void editor.loadImageUrl(draft.imageSource ?? "")}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData("text").trim();
                  if (pasted) {
                    event.preventDefault();
                    void editor.loadImageUrl(pasted);
                  }
                }}
              />
            </label>
            {loadingImage && <p role="status">Loading image…</p>}
          </div>
          <label>
            Title
            <TextInput
              className="recipe-drawer-title-input"
              placeholder="What are you cooking?"
              value={draft.title}
              onChange={(event) =>
                editor.patchDraft({ title: event.target.value })
              }
            />
          </label>
          <Stepper
            value={draft.servings}
            max={4294967295}
            onChange={(servings) => editor.patchDraft({ servings })}
          />
          <label>
            Ingredients
            <TextArea
              ref={ingredientsBox}
              rows={7}
              placeholder="One ingredient per line"
              value={draft.ingredients}
              onChange={(event) =>
                editor.patchDraft({ ingredients: event.target.value })
              }
              onBlur={editor.analyzeIngredients}
            />
          </label>
          {draft.analysis?.ingredients.length ? (
            <IngredientMatches
              title="What Edamam found"
              ingredients={draft.analysis.ingredients}
              onSelect={(text) => {
                const box = ingredientsBox.current;
                if (!box) return;
                let start = 0;
                for (const line of box.value.split("\n")) {
                  if (line.trim() === text.trim()) {
                    box.focus();
                    box.setSelectionRange(start, start + line.length);
                    return;
                  }
                  start += line.length + 1;
                }
              }}
            />
          ) : null}
          <label>
            Cooking Instructions
            <TextArea
              rows={7}
              placeholder="One step per line"
              value={draft.instructions}
              onChange={(event) =>
                editor.patchDraft({ instructions: event.target.value })
              }
            />
          </label>
          <section
            className="recipe-drawer-nutrition"
            aria-label="Live nutrition preview"
          >
            <h3>Live nutrition preview</h3>
            {analyzing && <p role="status">Analyzing ingredients…</p>}
            {draft.analysis ? (
              <NutritionLabel
                analysis={draft.analysis}
                servings={draft.servings}
                servingsLabel="Calories per portion"
              />
            ) : (
              !analyzing && <p>No nutrition analysis yet.</p>
            )}
          </section>
          {draft.id && (
            <div className="recipe-drawer-danger">
              {confirmDelete ? (
                <div role="group" aria-label="Confirm deletion">
                  <p>Delete this recipe? This cannot be undone.</p>
                  <Button onClick={() => setConfirmDelete(false)}>
                    Keep recipe
                  </Button>
                  <Button
                    className="recipe-drawer-delete"
                    onClick={async () => {
                      if (await editor.deleteRecipe()) await drawer.close();
                    }}
                  >
                    Confirm delete
                  </Button>
                </div>
              ) : (
                <Button
                  className="recipe-drawer-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              )}
              {recipeError && <p role="alert">{recipeError}</p>}
            </div>
          )}
        </fieldset>
      )}
    </>
  );
}
