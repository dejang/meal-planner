import { useState } from "react";
import { Button } from "@/components/Button";
import { TextArea, TextInput } from "@/components/TextInput";
import { RecipePhoto } from "@/components/RecipePhoto";
import { NutritionLabel } from "@/components/NutritionLabel";
import { Stepper } from "@/components/mobile/Stepper";
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
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!draft ? (
        <p role="status">Loading recipe…</p>
      ) : (
        <fieldset className="recipe-drawer-form" disabled={saving || importing}>
          <details open={!draft.id}>
            <summary>Import from URL</summary>
            <form
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
                  value={url}
                  onChange={(event) => importer.setUrl(event.target.value)}
                  placeholder="https://…"
                />
              </label>
              <Button type="submit" disabled={importing || !url.trim()}>
                {importing ? "Importing…" : "Import"}
              </Button>
              {importError && <p role="alert">{importError}</p>}
            </form>
            <details>
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
          <Button
            className="recipe-drawer-photo-picker"
            aria-label="Choose recipe photo"
            onClick={editor.chooseImageFile}
            disabled={loadingImage}
          >
            <RecipePhoto
              className="recipe-drawer-photo"
              recipeId={draft.id}
              imageVersion={
                draft.image.kind === "keep" ? draft.imageVersion : null
              }
              image={draft.image.kind === "set" ? draft.image.image : null}
              alt={draft.title || "Recipe photo"}
            />
            Choose photo
          </Button>
          <label>
            Image URL
            <TextInput
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
          <label>
            Title
            <TextInput
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
          {draft.id && (
            <div>
              <Button onClick={() => setConfirmDelete(true)}>Delete</Button>
              {confirmDelete && (
                <div role="group" aria-label="Confirm deletion">
                  <p>Delete this recipe? This cannot be undone.</p>
                  <Button onClick={() => setConfirmDelete(false)}>
                    Keep recipe
                  </Button>
                  <Button
                    onClick={async () => {
                      if (await editor.deleteRecipe()) await drawer.close();
                    }}
                  >
                    Confirm delete
                  </Button>
                </div>
              )}
              {recipeError && <p role="alert">{recipeError}</p>}
            </div>
          )}
          <label>
            Ingredients
            <TextArea
              rows={7}
              value={draft.ingredients}
              onChange={(event) =>
                editor.patchDraft({ ingredients: event.target.value })
              }
              onBlur={editor.analyzeIngredients}
            />
          </label>
          <label>
            Cooking Instructions
            <TextArea
              rows={7}
              value={draft.instructions}
              onChange={(event) =>
                editor.patchDraft({ instructions: event.target.value })
              }
            />
          </label>
          {analyzing && <p role="status">Analyzing ingredients…</p>}
          <h3>Live nutrition preview</h3>
          {draft.analysis ? (
            <NutritionLabel
              analysis={draft.analysis}
              servings={draft.servings}
              servingsLabel="Calories per portion"
            />
          ) : (
            <p>No nutrition analysis yet.</p>
          )}
        </fieldset>
      )}
    </>
  );
}
