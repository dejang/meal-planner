import {
  Children,
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import { PageDots } from "@/components/mobile/PageDots";
import { Button } from "@/components/Button";
import "@/components/mobile/mobile.css";

export interface SwipePagerProps {
  children: ReactNode;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  pageGroupLabel?: (index: number, count: number) => string;
  dotLabel?: (index: number) => string;
  dotsLabel?: string;
  settleDelay?: number;
  renderControls?: (navigation: {
    activeIndex: number;
    count: number;
    select: (index: number) => void;
    previous: () => void;
    next: () => void;
  }) => ReactNode;
}

export function SwipePager({
  children,
  activeIndex,
  onActiveIndexChange,
  label = "Pages",
  previousLabel = "Previous page",
  nextLabel = "Next page",
  pageGroupLabel = (index, count) => `Page ${index + 1} of ${count}`,
  dotLabel,
  dotsLabel,
  settleDelay = 150,
  renderControls,
}: SwipePagerProps) {
  const pages = Children.toArray(children);
  const viewport = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  function clampIndex(index: number) {
    return Math.max(0, Math.min(index, pages.length - 1));
  }

  const active = clampIndex(activeIndex);
  const activePage = useRef(active);
  const interacting = useRef(false);

  useEffect(() => {
    const unchanged = activePage.current === active;
    activePage.current = active;
    const element = viewport.current;
    if (
      !element ||
      (unchanged && element.scrollLeft === active * element.clientWidth)
    )
      return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    element.scrollTo({
      left: active * element.clientWidth,
      behavior: reduced ? "instant" : "smooth",
    });
  }, [active]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            element.scrollTo({
              left: activePage.current * element.clientWidth,
              behavior: "instant",
            });
          })
        : undefined;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      clearTimeout(settleTimer.current);
    };
  }, []);

  function reportSettledPage() {
    clearTimeout(settleTimer.current);
    const element = viewport.current;
    if (!element?.clientWidth || interacting.current) return;
    const index = clampIndex(
      Math.round(element.scrollLeft / element.clientWidth),
    );
    activePage.current = index;
    if (index !== active) onActiveIndexChange(index);
  }

  function scheduleSettle() {
    clearTimeout(settleTimer.current);
    if (
      !interacting.current &&
      viewport.current &&
      !("onscrollend" in viewport.current)
    )
      settleTimer.current = setTimeout(reportSettledPage, settleDelay);
  }

  function hold(event: PointerEvent | TouchEvent) {
    if ("pointerType" in event && event.pointerType === "touch") return;
    interacting.current = true;
    clearTimeout(settleTimer.current);
  }

  function release(event: PointerEvent | TouchEvent) {
    if ("pointerType" in event && event.pointerType === "touch") return;
    interacting.current = false;
    scheduleSettle();
  }

  function select(index: number) {
    onActiveIndexChange(clampIndex(index));
  }

  const atStart = active === 0;
  const atEnd = active >= pages.length - 1;

  function previous() {
    select(active - 1);
  }

  function next() {
    select(active + 1);
  }

  return (
    <section className="swipe-pager" aria-label={label}>
      {renderControls ? (
        renderControls({
          activeIndex: active,
          count: pages.length,
          select,
          previous,
          next,
        })
      ) : (
        <div className="pager-controls">
          <div className="pager-navigation">
            <Button
              aria-label={previousLabel}
              disabled={atStart}
              onClick={previous}
            >
              ‹
            </Button>
            <Button aria-label={nextLabel} disabled={atEnd} onClick={next}>
              ›
            </Button>
          </div>
          <PageDots
            count={pages.length}
            activeIndex={active}
            onSelect={select}
            label={dotsLabel}
            dotLabel={dotLabel}
          />
        </div>
      )}
      <div
        ref={viewport}
        className="pager-viewport"
        onScroll={scheduleSettle}
        onTouchStart={hold}
        onTouchEnd={release}
        onTouchCancel={release}
        onPointerDown={hold}
        onPointerLeave={release}
        onPointerUp={release}
        onScrollEnd={reportSettledPage}
        tabIndex={0}
        role="group"
        aria-label={`${label} swipe area`}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "ArrowLeft" && !atStart) {
            event.preventDefault();
            previous();
          }
          if (event.key === "ArrowRight" && !atEnd) {
            event.preventDefault();
            next();
          }
        }}
      >
        {pages.map((page, index) => (
          <div
            className="pager-page"
            role="group"
            aria-label={pageGroupLabel(index, pages.length)}
            inert={index !== active}
            key={index}
          >
            {page}
          </div>
        ))}
      </div>
    </section>
  );
}
