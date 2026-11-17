import { BottomDrawer } from "@/components/mobile/BottomDrawer";
import {
  useDrawerActions,
  useDrawerOpen,
  useDrawerRecipeId,
} from "@/stores/DrawerStore";

export default function RecipeDrawer() {
  const open = useDrawerOpen();
  const recipeId = useDrawerRecipeId();
  const actions = useDrawerActions();
  return (
    <BottomDrawer open={open} title="Recipe" onClose={actions.close}>
      <p>{recipeId ?? "New recipe"}</p>
    </BottomDrawer>
  );
}
