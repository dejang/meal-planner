import { Button, ButtonVariant } from "@/components/Button";
import {
  useEditorActions,
  useEditorError,
  useEditorOpen,
} from "@/stores/EditorStore";

export function ClosedEditorError() {
  const error = useEditorError();
  const open = useEditorOpen();
  const editor = useEditorActions();
  if (open || !error) return null;
  return (
    <div role="alert" className="shell-error">
      <span>{error}</span>
      <Button variant={ButtonVariant.Quiet} onClick={editor.dismissError}>
        Dismiss
      </Button>
    </div>
  );
}
