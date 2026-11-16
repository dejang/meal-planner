import { useDraggable } from "@dnd-kit/core";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MealPosition } from "../../api";
import { Button, ButtonVariant } from "../../components/Button";
import { Icon, IconName } from "../../components/Icon";
import type { RecipeDragPayload } from "../../lib/recipeDrag";
import { useEditorActions } from "../../stores/EditorStore";
import { usePlanActions } from "../../stores/PlanStore";
import { useRecipe } from "../../stores/RecipesStore";
import DropTarget from "./DropTarget";

interface MealCardProps {
  recipeId: string;
  position: MealPosition;
}

export function MealTitle({ recipeId, id }: { recipeId: string; id?: string }) {
  const recipe = useRecipe(recipeId);
  return <h3 id={id}>{recipe?.title ?? "Recipe unavailable"}</h3>;
}

export default function MealCard({ recipeId, position }: MealCardProps) {
  const titleId = useId();
  const editor = useEditorActions();
  const plan = usePlanActions();
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menu = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const payload: RecipeDragPayload = { recipeId, position };
  const drag = useDraggable({
    id: `planned-meal-${position.day}-${position.row}`,
    data: payload,
  });

  useLayoutEffect(() => {
    if (!menuPosition || !menu.current) return;
    const bounds = menu.current.getBoundingClientRect();
    menu.current.style.left = `${Math.max(0, Math.min(menuPosition.x, window.innerWidth - bounds.width))}px`;
    menu.current.style.top = `${Math.max(0, Math.min(menuPosition.y, window.innerHeight - bounds.height))}px`;
    menu.current.querySelector("button")?.focus();
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target)
      ) {
        setMenuPosition(null);
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuPosition]);

  return (
    <>
      <article
        ref={(node) => {
          card.current = node;
          drag.setNodeRef(node);
          drag.setActivatorNodeRef(node);
        }}
        {...drag.attributes}
        {...drag.listeners}
        aria-labelledby={titleId}
        className={`planner-meal ${drag.isDragging ? "planner-meal-dragging" : ""}`}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuPosition({ x: event.clientX, y: event.clientY });
        }}
        onKeyDown={(event) => {
          drag.listeners?.onKeyDown?.(event);
          if (
            event.key === "ContextMenu" ||
            (event.shiftKey && event.key === "F10")
          ) {
            event.preventDefault();
            const bounds = event.currentTarget.getBoundingClientRect();
            setMenuPosition({ x: bounds.left, y: bounds.bottom });
          }
        }}
      >
        <DropTarget position={position} className="planner-insert-before" />
        <MealTitle recipeId={recipeId} id={titleId} />
        <DropTarget
          position={{ ...position, row: position.row + 1 }}
          className="planner-insert-after"
        />
      </article>
      {menuPosition &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label="Meal actions"
            className="planner-meal-menu popup-frame"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setMenuPosition(null);
                card.current?.focus();
              } else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const items = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    '[role="menuitem"]',
                  ),
                );
                const index = items.findIndex(
                  (item) => item === document.activeElement,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length;
                items[next]?.focus();
              }
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                setMenuPosition(null);
            }}
          >
            <Button
              role="menuitem"
              variant={ButtonVariant.Quiet}
              onClick={() => {
                setMenuPosition(null);
                void editor.openRecipe(recipeId);
              }}
            >
              <Icon name={IconName.Pencil} /> Edit
            </Button>
            <Button
              role="menuitem"
              variant={ButtonVariant.Quiet}
              onClick={() => {
                setMenuPosition(null);
                void plan.removeFromDay(position);
              }}
            >
              <Icon name={IconName.Trash2} /> Remove
            </Button>
          </div>,
          document.body,
        )}
    </>
  );
}
