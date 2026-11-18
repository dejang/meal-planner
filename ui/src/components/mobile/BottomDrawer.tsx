import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
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
  dragSlop?: number;
  dismissDistance?: number;
  dismissRatio?: number;
  flickDistance?: number;
  flickVelocity?: number;
  overdragResistance?: number;
}

export function BottomDrawer({
  open,
  title,
  header,
  children,
  onClose,
  dragSlop = 5,
  dismissDistance = 80,
  dismissRatio = 0.25,
  flickDistance = 20,
  flickVelocity = 0.5,
  overdragResistance = 2,
}: BottomDrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const grip = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ y: number; time: number } | null>(null);
  const [entered, setEntered] = useState(false);

  const showDrag = useCallback((offset: number | null) => {
    const element = sheet.current;
    if (!element) return;
    const dragging = String(offset !== null);
    element.dataset.dragging = dragging;
    if (dialog.current) dialog.current.dataset.dragging = dragging;
    if (offset === null) {
      dialog.current?.style.removeProperty("--drawer-drag");
      dialog.current?.style.removeProperty("--drawer-fade");
      return;
    }
    const fade = Math.max(0, offset) / Math.max(1, element.clientHeight);
    dialog.current?.style.setProperty("--drawer-drag", `${offset}px`);
    dialog.current?.style.setProperty("--drawer-fade", String(fade));
  }, []);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) {
      setEntered(false);
      gesture.current = null;
      showDrag(null);
      if (!element.open) return;
      const animations = sheet.current?.getAnimations?.() ?? [];
      if (!animations.length) {
        element.close();
        return;
      }
      let closing = true;
      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => {
        if (closing) element.close();
      });
      return () => {
        closing = false;
      };
    }
    element.showModal();
    sheet.current?.focus({ preventScroll: true });
    showDrag(null);
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setEntered(true));
    });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
    };
  }, [open, showDrag]);

  const moveDrag = useCallback(
    (y: number) => {
      if (!gesture.current) return;
      const delta = y - gesture.current.y;
      showDrag(delta >= 0 ? delta : -overdragResistance * Math.sqrt(-delta));
    },
    [overdragResistance, showDrag],
  );

  const finishDrag = useCallback(
    (y?: number, time?: number) => {
      const drag = gesture.current;
      gesture.current = null;
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
        )
          onClose();
      }
      showDrag(null);
    },
    [
      dismissDistance,
      dismissRatio,
      flickDistance,
      flickVelocity,
      onClose,
      showDrag,
    ],
  );

  const listenForDrag = useCallback(
    (element: HTMLDivElement | null) => {
      sheet.current = element;
      if (!element || !open) return;
      let pending: { x: number; y: number; time: number } | null = null;
      function start(event: TouchEvent) {
        pending = null;
        if (event.touches.length !== 1) return;
        let target = event.target instanceof Element ? event.target : null;
        if (target && grip.current?.contains(target)) return;
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
          gesture.current = { y: pending.y, time: pending.time };
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
    [open, dragSlop, moveDrag, finishDrag],
  );

  const visible = open && entered;
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
      onClose={(event) => {
        if (open && !event.currentTarget.open) {
          event.currentTarget.showModal();
          onClose();
        }
      }}
    >
      <div
        className="drawer-scrim"
        data-entered={visible}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={listenForDrag}
        className="drawer-sheet"
        data-entered={visible}
        data-dragging="false"
        tabIndex={-1}
      >
        <div
          ref={grip}
          className="drawer-grip"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (!open || !event.isPrimary || event.button !== 0) return;
            gesture.current = { y: event.clientY, time: event.timeStamp };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => moveDrag(event.clientY)}
          onPointerUp={(event) => {
            finishDrag(event.clientY, event.timeStamp);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => finishDrag()}
          onLostPointerCapture={() => finishDrag()}
        >
          <span />
        </div>
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
        <div className="drawer-body mobile-content safe-area-sides">
          {children}
        </div>
      </div>
    </dialog>
  );
}
