import { Button, ButtonVariant } from "@/components/Button";
import { BottomDrawer } from "@/components/mobile/BottomDrawer";
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
  useEditorSaving,
} from "@/stores/EditorStore";
import { useRecipe } from "@/stores/RecipesStore";
import { useImportImporting } from "@/stores/ImportStore";
import RecipeView from "@/mobile/drawer/RecipeView";
import RecipeForm from "@/mobile/drawer/RecipeForm";
import "@/mobile/drawer/drawer.css";

export default function RecipeDrawer() {
  const open = useDrawerOpen();
  const mode = useDrawerMode();
  const recipeId = useDrawerRecipeId();
  const drawer = useDrawerActions();
  const editor = useEditorActions();
  const saving = useEditorSaving();
  const draft = useDraftRecipe();
  const importing = useImportImporting();
  const recipe = useRecipe(recipeId ?? "");
  const viewing = mode === DrawerMode.View;
  const title = viewing
    ? (recipe?.title ?? "Recipe")
    : mode === DrawerMode.Create
      ? "New Recipe"
      : "Edit Recipe";
  return (
    <BottomDrawer
      open={open}
      title={title}
      onClose={viewing ? drawer.close : drawer.cancel}
      header={
        viewing ? (
          <>
            <h2 className="mobile-screen-title">{title}</h2>
            {recipe && (
              <Button onClick={() => drawer.openEdit(recipe.id)}>Edit</Button>
            )}
            <Button onClick={drawer.close}>Close</Button>
          </>
        ) : (
          <>
            <Button disabled={saving} onClick={drawer.cancel}>
              Cancel
            </Button>
            <h2 className="mobile-screen-title">{title}</h2>
            <Button
              variant={ButtonVariant.Primary}
              disabled={saving || importing || !draft}
              onClick={async () => {
                if (!(await editor.save())) return;
                if (recipeId) await drawer.switchToView(recipeId);
                else await drawer.close();
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )
      }
    >
      {open && (
        <div className="recipe-drawer-content" key={`${mode}-${recipeId}`}>
          {viewing ? (
            <RecipeView recipeId={recipeId ?? ""} />
          ) : (
            <RecipeForm />
          )}
        </div>
      )}
    </BottomDrawer>
  );
}
