import { useState } from "react";
import {
  useEditorActions,
  useDraftRecipe,
  useEditorSaving,
  useEditorAnalyzing,
  useEditorLoadingImage,
  useEditorError,
} from "../../stores/EditorStore";
import { Button, ButtonVariant } from "../../components/Button";
import { Icon, IconName } from "../../components/Icon";
import { RecipePhoto } from "../../components/RecipePhoto";
import { NutritionLabel } from "../../components/NutritionLabel";
import { TextArea, TextInput } from "../../components/TextInput";
import "./editor.css";

export default function Editor() {
  const editor = useEditorActions();
  const draft = useDraftRecipe();
  const saving = useEditorSaving();
  const analyzing = useEditorAnalyzing();
  const loadingImage = useEditorLoadingImage();
  const error = useEditorError();
  const [servingsInput, setServingsInput] = useState<string | null>(null);
  if (!draft) return null;
  return (
    <section className="recipe-editor" aria-busy={saving}>
      <header className="editor-header">
        <span className="editor-caption">RECIPE BOOK / EDIT RECIPE</span>
        <Button
          variant={ButtonVariant.Quiet}
          aria-label="Close editor"
          title="Close editor"
          disabled={saving}
          onClick={editor.close}
        >
          <Icon name={IconName.X} />
        </Button>
      </header>
      {error && (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
      <fieldset className="editor-content" disabled={saving}>
        <div className="editor-cover">
          <RecipePhoto
            className="editor-photo"
            recipeId={draft.id}
            imageVersion={
              draft.image.kind === "keep" ? draft.imageVersion : null
            }
            image={draft.image.kind === "set" ? draft.image.image : null}
            alt={draft.title || "Recipe photo"}
          />
          <label className="editor-title-plate">
            <span className="editor-caption">RECIPE TITLE</span>
            <TextArea
              aria-label="Recipe title"
              rows={1}
              placeholder="Name your recipe"
              value={draft.title}
              onChange={(event) =>
                editor.patchDraft({ title: event.target.value })
              }
            />
          </label>
        </div>
        <div className="editor-image-field" aria-busy={loadingImage}>
          <label className="editor-caption" htmlFor="editor-image-url">
            IMAGE
          </label>
          <TextInput
            id="editor-image-url"
            type="text"
            placeholder="Paste an image URL"
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
          <Button onClick={editor.chooseImageFile}>Choose file</Button>
          <Button
            onClick={() => {
              editor.patchDraft({ image: { kind: "remove" } });
            }}
          >
            Remove photo
          </Button>
        </div>
        {loadingImage && <p role="status">Loading image…</p>}
        <div className="editor-page">
          <div className="editor-servings">
            <label className="editor-caption" htmlFor="editor-servings">
              SERVINGS
            </label>
            <TextInput
              id="editor-servings"
              type="number"
              min={1}
              max={4294967295}
              step={1}
              value={servingsInput ?? draft.servings}
              onChange={(event) => {
                setServingsInput(event.target.value);
                if (event.target.validity.valid && event.target.value !== "")
                  editor.patchDraft({ servings: event.target.valueAsNumber });
              }}
              onBlur={() => setServingsInput(null)}
            />
            <span className="editor-caption">
              {Math.floor(
                (draft.analysis?.calories ?? 0) / Math.max(1, draft.servings),
              )}{" "}
              KCAL / SERVING
            </span>
          </div>
          <div className="editor-columns">
            <label>
              <span className="editor-heading">INGREDIENTS</span>
              <span className="editor-caption">
                One ingredient per line, with amount &amp; unit.
              </span>
              <TextArea
                aria-label="Ingredients"
                rows={7}
                placeholder={
                  "1 tablespoon olive oil\n1 onion, diced\n2 cloves garlic"
                }
                value={draft.ingredients}
                onChange={(event) =>
                  editor.patchDraft({ ingredients: event.target.value })
                }
                onBlur={editor.analyzeIngredients}
              />
            </label>
            <label>
              <span className="editor-heading">DIRECTIONS</span>
              <span className="editor-caption">
                Write or paste the instructions, one step per line.
              </span>
              <TextArea
                aria-label="Directions"
                rows={7}
                placeholder="Add your cooking instructions here…"
                value={draft.instructions}
                onChange={(event) =>
                  editor.patchDraft({ instructions: event.target.value })
                }
              />
            </label>
          </div>
          <details className="editor-nutrition">
            <summary>NUTRITION</summary>
            {draft.analysis ? (
              <NutritionLabel
                analysis={draft.analysis}
                servings={draft.servings}
                servingsLabel="Amount per serving"
              />
            ) : (
              <p>No nutrition analysis yet.</p>
            )}
            <p className="editor-caption">
              Refreshes when you leave the Ingredients field.
            </p>
          </details>
          {analyzing && <p role="status">Analyzing ingredients…</p>}
        </div>
      </fieldset>
      <footer className="editor-footer">
        <span className="editor-caption">Changes apply when you close.</span>
        <Button
          variant={ButtonVariant.Primary}
          title="Close the editor with your changes applied"
          disabled={saving}
          onClick={editor.close}
        >
          <Icon name={IconName.Check} /> {saving ? "Saving…" : "Done"}
        </Button>
      </footer>
    </section>
  );
}
