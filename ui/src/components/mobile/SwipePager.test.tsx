import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SwipePager } from "@/components/mobile/SwipePager";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function Pager() {
  const [activeIndex, setActiveIndex] = useState(0);
  return (
    <SwipePager activeIndex={activeIndex} onActiveIndexChange={setActiveIndex}>
      <div>
        <p>First day</p>
        <input aria-label="Notes" />
      </div>
      <p>Second day</p>
      <p>Third day</p>
    </SwipePager>
  );
}

it("navigates with previous/next, dots, and arrow keys within bounds", () => {
  render(<Pager />);
  const viewport = screen.getByRole("group", { name: "Pages swipe area" });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), {
    key: "ArrowRight",
  });
  expect(
    screen
      .getByRole("button", { name: "Go to page 1" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    (screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(
    screen
      .getByRole("button", { name: "Go to page 2" })
      .getAttribute("aria-current"),
  ).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Go to page 3" }));
  expect(
    (screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  fireEvent.keyDown(viewport, { key: "ArrowLeft" });
  expect(
    screen
      .getByRole("button", { name: "Go to page 1" })
      .getAttribute("aria-current"),
  ).toBe("page");
  fireEvent.keyDown(viewport, { key: "ArrowRight" });
  expect(
    screen
      .getByRole("button", { name: "Go to page 2" })
      .getAttribute("aria-current"),
  ).toBe("page");
});

it.each([false, true])(
  "scrolls programmatically with reduced motion %s and reports settled swipes",
  (reduced) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced })),
    );
    const resized: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    render(<Pager />);
    const viewport = screen.getByLabelText("Pages swipe area");
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 320,
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      left: 320,
      behavior: reduced ? "instant" : "smooth",
    });
    viewport.scrollLeft = 640;
    fireEvent.scroll(viewport);
    expect(
      screen
        .getByRole("button", { name: "Go to page 2" })
        .getAttribute("aria-current"),
    ).toBe("page");
    act(() => vi.advanceTimersByTime(200));
    expect(
      screen
        .getByRole("button", { name: "Go to page 2" })
        .getAttribute("aria-current"),
    ).toBe("page");
    fireEvent(viewport, new Event("scrollend"));
    expect(
      screen
        .getByRole("button", { name: "Go to page 3" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(resized).toHaveLength(1);
    act(() => resized[0]());
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      left: 640,
      behavior: "instant",
    });
  },
);

it("lets the screen compose day navigation outside the default controls", () => {
  const onChange = vi.fn();
  render(
    <SwipePager
      activeIndex={1}
      onActiveIndexChange={onChange}
      label="Days"
      pageGroupLabel={(index) => `Day ${index + 1}`}
      renderControls={({ previous, next, activeIndex, select }) => (
        <header>
          <button onClick={previous}>Previous day</button>
          <h2>Day {activeIndex + 1}</h2>
          <button onClick={next}>Next day</button>
          <button onClick={() => select(0)}>First day</button>
        </header>
      )}
    >
      <p>Breakfast</p>
      <p>Lunch</p>
      <p>Dinner</p>
    </SwipePager>,
  );
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.getByRole("heading", { name: "Day 2" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Day 2" })).toBeTruthy();
  for (const name of ["Previous day", "Next day", "First day"])
    fireEvent.click(screen.getByRole("button", { name }));
  expect(onChange.mock.calls).toEqual([[0], [2], [0]]);
});

it.each([false, true])(
  "does not settle under a held touch, with native scrollend %s",
  (native) => {
    vi.useFakeTimers();
    let prototype: object | null = HTMLElement.prototype;
    while (prototype && !Object.hasOwn(prototype, "onscrollend"))
      prototype = Object.getPrototypeOf(prototype) as object | null;
    const descriptor = prototype
      ? Object.getOwnPropertyDescriptor(prototype, "onscrollend")
      : undefined;
    if (!native && prototype) Reflect.deleteProperty(prototype, "onscrollend");
    try {
      render(<Pager />);
      const viewport = screen.getByLabelText("Pages swipe area");
      if (native)
        Object.defineProperty(viewport, "onscrollend", {
          configurable: true,
          value: null,
        });
      Object.defineProperty(viewport, "clientWidth", { value: 320 });
      fireEvent.touchStart(viewport);
      viewport.scrollLeft = 320;
      fireEvent.scroll(viewport);
      act(() => vi.advanceTimersByTime(200));
      expect(
        screen
          .getByRole("button", { name: "Go to page 1" })
          .getAttribute("aria-current"),
      ).toBe("page");
      fireEvent.touchEnd(viewport);
      act(() => vi.advanceTimersByTime(200));
      if (native) {
        expect(
          screen
            .getByRole("button", { name: "Go to page 1" })
            .getAttribute("aria-current"),
        ).toBe("page");
        fireEvent(viewport, new Event("scrollend"));
      }
      expect(
        screen
          .getByRole("button", { name: "Go to page 2" })
          .getAttribute("aria-current"),
      ).toBe("page");
    } finally {
      if (prototype && descriptor)
        Object.defineProperty(prototype, "onscrollend", descriptor);
    }
  },
);
