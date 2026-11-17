import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BottomDrawer } from "@/components/mobile/BottomDrawer";

it("opens with header and body and closes when its owner changes open", async () => {
  const onClose = vi.fn();
  const { rerender, unmount } = render(
    <BottomDrawer open={false} title="Recipe" onClose={onClose}>
      <p>Ingredients</p>
    </BottomDrawer>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(
    <BottomDrawer
      open
      title="Recipe"
      header={<h2>Recipe actions</h2>}
      onClose={onClose}
    >
      <p>Ingredients</p>
    </BottomDrawer>,
  );
  expect(screen.getByRole("dialog", { name: "Recipe" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Recipe actions" })).toBeTruthy();
  expect(screen.getByText("Ingredients")).toBeTruthy();
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.queryByRole("button", { name: "Close drawer" })).toBeNull();
  await act(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  rerender(
    <BottomDrawer open={false} title="Recipe" onClose={onClose}>
      <p>Ingredients</p>
    </BottomDrawer>,
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.transitionEnd(
    screen.getByRole("dialog").querySelector(".drawer-sheet")!,
    { propertyName: "transform" },
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.body.style.overflow).toBe("");
  expect(onClose).not.toHaveBeenCalled();
  rerender(
    <BottomDrawer open title="Recipe" onClose={onClose}>
      Reopened
    </BottomDrawer>,
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  unmount();
  expect(document.body.style.overflow).toBe("");
});

it.each(["handle", "body"])(
  "finishes closing when its owner closes during a %s drag",
  async (source) => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BottomDrawer open title="Recipe" onClose={onClose}>
        Ingredients
      </BottomDrawer>,
    );
    await act(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    const sheet = dialog.querySelector(".drawer-sheet")!;
    expect(sheet.getAttribute("data-entered")).toBe("true");
    if (source === "handle") {
      const handle = screen.getByRole("button", { name: "Expand drawer" });
      fireEvent.pointerDown(handle, { clientY: 100 });
      fireEvent.pointerMove(handle, { clientY: 140 });
    } else {
      const body = screen.getByText("Ingredients");
      fireEvent.touchStart(body, { touches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchMove(body, { touches: [{ clientX: 0, clientY: 140 }] });
    }
    expect(sheet.getAttribute("data-dragging")).toBe("true");
    rerender(
      <BottomDrawer open={false} title="Recipe" onClose={onClose}>
        Ingredients
      </BottomDrawer>,
    );
    expect(sheet.getAttribute("data-dragging")).toBe("false");
    expect(sheet.getAttribute("data-entered")).toBe("false");
    expect(dialog.open).toBe(true);
    const handle = screen.getByRole("button", { name: "Expand drawer" });
    fireEvent.pointerDown(handle, { clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 140 });
    expect(sheet.getAttribute("data-dragging")).toBe("false");
    fireEvent.pointerUp(handle, { clientY: 140 });
    fireEvent.transitionEnd(sheet, { propertyName: "transform" });
    await waitFor(() => expect(dialog.open).toBe(false));
    expect(document.body.style.overflow).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  },
);

it.each(["backdrop", "Escape", "close control"])(
  "requests dismissal through %s but not body clicks",
  (method) => {
    const onClose = vi.fn();
    render(
      <BottomDrawer open title="Recipe" onClose={onClose}>
        <p>Ingredients</p>
      </BottomDrawer>,
    );
    fireEvent.click(screen.getByText("Ingredients"));
    expect(onClose).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    if (method === "backdrop")
      fireEvent.click(dialog.querySelector(".drawer-scrim")!);
    else if (method === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onClose).toHaveBeenCalledOnce();
    if (method === "Escape") {
      fireEvent.keyDown(dialog, { key: "Escape", repeat: true });
      expect(onClose).toHaveBeenCalledOnce();
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(2);
      expect((dialog as HTMLDialogElement).open).toBe(true);
    }
  },
);

it.each([
  { distance: 30, elapsed: 10 },
  { distance: 150, elapsed: 500 },
])(
  "snaps between heights and dismisses a $distance px swipe in $elapsed ms",
  ({ distance, elapsed }) => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    render(
      <BottomDrawer open title="Recipe" onClose={onClose}>
        <button onClick={onAction}>Add meal</button>
      </BottomDrawer>,
    );
    const action = screen.getByRole("button", { name: "Add meal" });
    action.closest(".drawer-body")!.scrollTop = 40;
    const handle = screen.getByRole("button", { name: "Expand drawer" });
    for (const [start, end, expanded] of [
      [200, 100, "true"],
      [100, 250, "false"],
      [100, 100 + distance, "false"],
    ]) {
      const down = createEvent.pointerDown(handle, {
        clientY: start,
        pointerId: 1,
      });
      const up = createEvent.pointerUp(handle, { clientY: end, pointerId: 1 });
      Object.defineProperty(down, "timeStamp", { value: 0 });
      Object.defineProperty(up, "timeStamp", { value: elapsed });
      fireEvent(handle, down);
      fireEvent.pointerMove(handle, { clientY: end, pointerId: 1 });
      fireEvent(handle, up);
      expect(handle.getAttribute("aria-expanded")).toBe(expanded);
      fireEvent.touchStart(action, { touches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchEnd(action, {
        changedTouches: [{ clientX: 0, clientY: 100 }],
      });
      fireEvent.click(action);
    }
    expect(onAction).toHaveBeenCalledTimes(3);
    expect(onClose).toHaveBeenCalledOnce();
  },
);

it("leaves short or cancelled drags open and supports keyboard-accessible expansion", () => {
  const onClose = vi.fn();
  render(
    <BottomDrawer open title="Recipe" onClose={onClose}>
      Body
    </BottomDrawer>,
  );
  const handle = screen.getByRole("button", { name: "Expand drawer" });
  fireEvent.pointerDown(handle, { clientY: 100 });
  fireEvent.pointerMove(handle, { clientY: 110 });
  fireEvent.pointerUp(handle, { clientY: 110 });
  fireEvent.pointerDown(handle, { clientY: 100 });
  fireEvent.pointerMove(handle, { clientY: 300 });
  fireEvent.pointerCancel(handle);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(handle);
  expect(handle.getAttribute("aria-expanded")).toBe("true");
});

it.each([
  { scrollTop: 0, distance: 200, cancel: false, dismissals: 1 },
  { scrollTop: 40, distance: 200, cancel: false, dismissals: 0 },
  {
    scrollTop: 0,
    nestedScrollTop: 40,
    distance: 200,
    cancel: false,
    dismissals: 0,
  },
  {
    scrollTop: 0,
    horizontal: 300,
    distance: 200,
    cancel: false,
    dismissals: 0,
  },
  { scrollTop: 0, distance: -100, cancel: false, dismissals: 0 },
  { scrollTop: 0, distance: 200, cancel: true, dismissals: 0 },
])(
  "handles a body pull of $distance at scrollTop $scrollTop, cancelled $cancel",
  ({
    scrollTop,
    nestedScrollTop = 0,
    horizontal = 0,
    distance,
    cancel,
    dismissals,
  }) => {
    const onClose = vi.fn();
    render(
      <BottomDrawer open title="Recipe" onClose={onClose}>
        <textarea aria-label="Ingredients" defaultValue="Chickpeas" />
      </BottomDrawer>,
    );
    const input = screen.getByRole("textbox", { name: "Ingredients" });
    input.closest(".drawer-body")!.scrollTop = scrollTop;
    input.scrollTop = nestedScrollTop;
    fireEvent.touchStart(input, { touches: [{ clientX: 0, clientY: 100 }] });
    const move = createEvent.touchMove(input, {
      touches: [{ clientX: horizontal, clientY: 100 + distance }],
    });
    fireEvent(input, move);
    expect(move.defaultPrevented).toBe(
      scrollTop === 0 && nestedScrollTop === 0 && distance > horizontal,
    );
    if (cancel) fireEvent.touchCancel(input);
    else
      fireEvent.touchEnd(input, {
        changedTouches: [{ clientX: horizontal, clientY: 100 + distance }],
      });
    expect(onClose).toHaveBeenCalledTimes(dismissals);
  },
);

it.each([true, false])(
  "keeps a vetoed native close modal after cancelable=%s cancellation",
  async (cancelable) => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(
      <BottomDrawer open title="Recipe" onClose={onClose}>
        Body
      </BottomDrawer>,
    );
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    fireEvent(dialog, new Event("cancel", { cancelable }));
    dialog.close();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(dialog.open).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <BottomDrawer open={false} title="Recipe" onClose={onClose}>
        Body
      </BottomDrawer>,
    );
    await waitFor(() => expect(dialog.open).toBe(false));
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(document.body.style.overflow).toBe("");
  },
);
