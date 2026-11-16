import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import type { MealPosition } from "../../api";

interface DropTargetProps {
  position: MealPosition;
  className: string;
  children?: ReactNode;
}

export default function DropTarget({
  position,
  className,
  children,
}: DropTargetProps) {
  const drop = useDroppable({
    id: `plan-drop-${position.day}-${position.row}-${className}`,
    data: { position },
  });
  return (
    <div
      ref={drop.setNodeRef}
      className={`${className} ${drop.isOver ? "planner-drop-active" : ""}`}
    >
      {children}
    </div>
  );
}
