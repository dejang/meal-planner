import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Button } from "@/components/Button";
import "@/components/mobile/mobile.css";

export interface BottomDrawerProps {
  open: boolean;
  title: string;
  header?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  peekOffset?: string;
  dragSlop?: number;
  dismissDistance?: number;
  dismissRatio?: number;
  flickDistance?: number;
  flickVelocity?: number;
  expandDistance?: number;
}

export function BottomDrawer({
  open,
  title,
  header,
  children,
  onClose,
  peekOffset = "15dvh",
  dragSlop = 5,
  dismissDistance = 80,
  dismissRatio = 0.2,
  flickDistance = 20,
  flickVelocity = 0.65,
  expandDistance = 50,
}: BottomDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ y: number; time: number } | null>(null);
  const dragged = useRef(false);
  const [entered, setEntered] = useState(false);
  const [full, setFull] = useState(false);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) {
      if (element.open && sheet.current?.dataset.entered !== "true")
        element.close();
      setEntered(false);
      setOffset(0);
      gesture.current = null;
      return;
    }
    element.showModal();
    setFull(false);
    setOffset(0);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntered(true));
    });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const startDrag = useCallback((y: number, time: number) => {
    gesture.current = { y, time };
    dragged.current = false;
  }, []);

  const moveDrag = useCallback(
    (y: number) => {
      if (!gesture.current) return;
      const delta = y - gesture.current.y;
      if (Math.abs(delta) > dragSlop) dragged.current = true;
      setOffset(Math.max(0, delta));
    },
    [dragSlop],
  );

  const finishDrag = useCallback(
    (y?: number, time?: number) => {
      const drag = gesture.current;
      if (drag && y !== undefined && time !== undefined) {
        const delta = y - drag.y;
        const speed = delta / Math.max(1, time - drag.time);
        const threshold = Math.max(
          dismissDistance,
          (sheet.current?.clientHeight ?? 0) * dismissRatio,
        );
        if (
          delta > threshold ||
          (delta > flickDistance && speed > flickVelocity)
        ) {
          if (full) setFull(false);
          else onClose();
        } else if (
          delta < -expandDistance ||
          (delta < -flickDistance && speed < -flickVelocity)
        )
          setFull(true);
      }
      gesture.current = null;
      setOffset(0);
    },
    [
      dismissDistance,
      dismissRatio,
      flickDistance,
      flickVelocity,
      expandDistance,
      full,
      onClose,
    ],
  );

  const listenForDrag = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || !open) return;
      let pending: { x: number; y: number; time: number } | null = null;
      function start(event: TouchEvent) {
        pending = null;
        if (event.touches.length !== 1) return;
        let target = event.target instanceof Element ? event.target : null;
        while (target && element?.contains(target)) {
          if (target.scrollTop > 0) return;
          target = target.parentElement;
        }
        const touch = event.touches[0];
        pending = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
      }
      function move(event: TouchEvent) {
        if (event.touches.length !== 1) {
          cancel();
          return;
        }
        const touch = event.touches[0];
        if (pending) {
          const dx = touch.clientX - pending.x;
          const dy = touch.clientY - pending.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) <= dragSlop) return;
          if (dy <= Math.abs(dx)) {
            pending = null;
            return;
          }
          startDrag(pending.y, pending.time);
          pending = null;
        }
        if (!gesture.current) return;
        if (!event.cancelable) {
          cancel();
          return;
        }
        event.preventDefault();
        moveDrag(touch.clientY);
      }
      function end(event: TouchEvent) {
        pending = null;
        finishDrag(event.changedTouches[0]?.clientY, event.timeStamp);
      }
      function cancel() {
        pending = null;
        finishDrag();
      }
      element.addEventListener("touchstart", start, { passive: true });
      element.addEventListener("touchmove", move, { passive: false });
      element.addEventListener("touchend", end);
      element.addEventListener("touchcancel", cancel);
      return () => {
        element.removeEventListener("touchstart", start);
        element.removeEventListener("touchmove", move);
        element.removeEventListener("touchend", end);
        element.removeEventListener("touchcancel", cancel);
      };
    },
    [open, dragSlop, startDrag, moveDrag, finishDrag],
  );

  return (
    <dialog
      ref={dialog}
      className="bottom-drawer mobile-theme"
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (!event.repeat) onClose();
        }
      }}
      onCancel={(event) => event.preventDefault()}
      onClose={() => {
        if (open) {
          dialog.current?.showModal();
          onClose();
        }
      }}
    >
      <div
        className="drawer-scrim"
        data-entered={entered}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={sheet}
        className="drawer-sheet"
        data-entered={entered}
        data-dragging={offset !== 0}
        style={
          {
            "--drawer-rest": full ? "0px" : peekOffset,
            transform: entered
              ? `translate3d(0, calc(var(--drawer-rest) + ${offset}px), 0)`
              : "translate3d(0, 100%, 0)",
          } as CSSProperties
        }
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === "transform" &&
            !open
          )
            dialog.current?.close();
        }}
      >
        <button
          type="button"
          className="drawer-handle"
          aria-label={full ? "Reduce drawer" : "Expand drawer"}
          aria-expanded={full}
          onClick={(event) => {
            if (event.detail === 0 || !dragged.current) setFull(!full);
            dragged.current = false;
          }}
          onPointerDown={(event) => {
            if (!open || !event.isPrimary || event.button !== 0) return;
            startDrag(event.clientY, event.timeStamp);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => moveDrag(event.clientY)}
          onPointerUp={(event) => {
            finishDrag(event.clientY, event.timeStamp);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            finishDrag();
            dragged.current = false;
          }}
          onLostPointerCapture={() => finishDrag()}
        >
          <span />
        </button>
        <header className="drawer-header safe-area-sides">
          {header ?? (
            <>
              <h2 className="mobile-screen-title">{title}</h2>
              <Button onClick={onClose} aria-label="Close drawer">
                Close
              </Button>
            </>
          )}
        </header>
        <div
          ref={listenForDrag}
          className="drawer-body mobile-content safe-area-sides"
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
