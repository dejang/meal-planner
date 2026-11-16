import type { ReactNode } from "react";
import { PlanScope } from "@/stores/PlanStore";
import { RecipesScope } from "@/stores/RecipesStore";
import { EditorScope } from "@/stores/EditorStore";
import { ImportScope } from "@/stores/ImportStore";
import { SettingsScope } from "@/stores/SettingsStore";

export function AppScopes({ children }: { children: ReactNode }) {
  return (
    <PlanScope>
      <RecipesScope>
        <EditorScope>
          <ImportScope>
            <SettingsScope>{children}</SettingsScope>
          </ImportScope>
        </EditorScope>
      </RecipesScope>
    </PlanScope>
  );
}
