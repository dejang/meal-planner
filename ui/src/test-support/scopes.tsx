import type { ReactNode } from "react";
import { PlanScope } from "@/stores/PlanStore";
import { RecipesScope } from "@/stores/RecipesStore";
import { EditorScope } from "@/stores/EditorStore";
import { ImportScope } from "@/stores/ImportStore";
import { SettingsScope } from "@/stores/SettingsStore";
import { DrawerScope } from "@/stores/DrawerStore";

export function AppScopes({ children }: { children: ReactNode }) {
  return (
    <PlanScope>
      <RecipesScope>
        <EditorScope>
          <ImportScope>
            <SettingsScope>
              <DrawerScope>{children}</DrawerScope>
            </SettingsScope>
          </ImportScope>
        </EditorScope>
      </RecipesScope>
    </PlanScope>
  );
}
