import { Button } from "../../components/Button";

export default function Shopping({ onClose }: { onClose: () => void }) {
  return (
    <section>
      <p>Shopping list</p>
      <Button onClick={onClose}>Close</Button>
    </section>
  );
}
