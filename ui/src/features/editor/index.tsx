import { useEditorActions } from "../../stores/EditorStore";
import { Button } from "../../components/Button";

export default function Editor() {
  const editor = useEditorActions();
  return (
    <section>
      <p>Recipe editor</p>
      <Button onClick={editor.close}>Done</Button>
    </section>
  );
}
