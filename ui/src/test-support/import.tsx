import type { ReactNode } from "react";
import { PlanScope } from "../stores/PlanStore";
import { RecipesScope } from "../stores/RecipesStore";
import { EditorScope } from "../stores/EditorStore";
import { ImportScope } from "../stores/ImportStore";

export function ImportScopes({ children }: { children: ReactNode }) {
  return (
    <PlanScope>
      <RecipesScope>
        <EditorScope>
          <ImportScope>{children}</ImportScope>
        </EditorScope>
      </RecipesScope>
    </PlanScope>
  );
}
