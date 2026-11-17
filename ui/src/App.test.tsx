import { commands, ok } from "@/test-support/ipc";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useDndMonitor, useDraggable, useDroppable } from "@dnd-kit/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { expect, it, vi } from "vitest";
import App from "@/App";
import type { RecipeInput } from "@/api";
import { useEditorActions, useDraftRecipe } from "@/stores/EditorStore";

vi.mock("@/features/gallery", () => ({
  default: function Gallery() {
    const editor = useEditorActions();
    const [clicks, setClicks] = useState(0);
    const [started, setStarted] = useState(false);
    const drag = useDraggable({ id: "recipe" });
    useDndMonitor({ onDragStart: () => setStarted(true) });
    return (
      <button
        ref={drag.setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        onDoubleClick={() => void editor.openRecipe("missing")}
        onClick={() => setClicks(clicks + 1)}
      >
        Card clicks {clicks}; drag {started ? "started" : "idle"}
      </button>
    );
  },
}));
vi.mock("@/features/planner", () => ({
  default: function Planner() {
    const drop = useDroppable({ id: "day" });
    const [dropped, setDropped] = useState<string | null>(null);
    useDndMonitor({
      onDragEnd: ({ over }) => setDropped(over ? String(over.id) : null),
    });
    return (
      <div data-testid="planner-scroll" style={{ overflowY: "auto" }}>
        <div ref={drop.setNodeRef}>Planner fixture; dropped {dropped}</div>
      </div>
    );
  },
}));
vi.mock("@/features/editor", () => ({
  default: function Editor() {
    const draft = useDraftRecipe();
    const editor = useEditorActions();
    return (
      <>
        <input
          aria-label="Draft title"
          value={draft?.title ?? ""}
          onChange={(event) => editor.patchDraft({ title: event.target.value })}
        />
        <button onClick={editor.close}>Done</button>
      </>
    );
  },
}));
vi.mock("@/features/shopping", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>Close shopping</button>
  ),
}));
vi.mock("@/features/import", () => ({
  default: () => <div>Import fixture</div>,
}));
vi.mock("@/features/settings", () => ({
  default: () => <div>Settings fixture</div>,
  Welcome: () => null,
}));
vi.mock("@/mobile/explorer", () => ({
  default: () => <h1>Mobile explorer fixture</h1>,
}));
vi.mock("@/mobile/planner", () => ({
  default: () => <h1>Mobile planner fixture</h1>,
}));
vi.mock("@/mobile/shopping", () => ({
  default: () => <h1>Mobile shopping fixture</h1>,
}));
vi.mock("@/mobile/settings", () => ({
  default: () => <h1>Mobile settings fixture</h1>,
}));
vi.mock("@/mobile/drawer", () => ({
  default: () => <div>Mobile drawer fixture</div>,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ close: vi.fn() })),
}));

it("shows recipe-open errors outside the closed editor", async () => {
  const user = userEvent.setup();
  vi.mocked(commands.getRecipe).mockResolvedValueOnce({
    status: "error",
    error: { kind: "not_found", detail: "Recipe no longer exists" },
  });
  render(<App />);
  await user.dblClick(screen.getByRole("button", { name: /Card clicks/ }));
  expect(screen.getByRole("alert").textContent).toContain(
    "Recipe no longer exists",
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("composes the workspace and synchronizes native dialog closure", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  expect(screen.getByRole("main")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Meal planner" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Shopping List" }));
  const shopping = screen.getByRole("dialog", { name: "Shopping list" });
  fireEvent(shopping, new Event("close"));
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Shopping List" }));
  expect(screen.getByRole("dialog", { name: "Shopping list" })).toBeTruthy();
});

it("loads credentials once on startup and reloads them each time Settings opens", async () => {
  const user = userEvent.setup();
  render(<App />);
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(commands.getCredentials).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(commands.getCredentials).toHaveBeenCalledTimes(2);
  await user.click(screen.getByRole("button", { name: "Close" }));
  await user.click(screen.getByRole("button", { name: "Settings" }));
  expect(commands.getCredentials).toHaveBeenCalledTimes(3);
});

it.each([
  { path: ["Shopping List"], title: "Shopping list", close: "Close shopping" },
  { path: ["Settings"], title: "Settings", close: "Close" },
  { path: ["New Recipe ▾", "Create"], title: "Recipe editor", close: "Done" },
  {
    path: ["New Recipe ▾", "Import from URL"],
    title: "Import recipe",
    close: "Close",
  },
])(
  "keeps $title open under StrictMode until its explicit control closes it",
  async ({ path, title, close }) => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    for (const name of path)
      await user.click(screen.getByRole("button", { name }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: close }));
    expect(screen.queryByRole("dialog")).toBeNull();
  },
);

it("preserves an unsaved draft under StrictMode through repeated Escape and backdrop interaction", async () => {
  vi.mocked(commands.createRecipe).mockImplementation(
    async (input: RecipeInput) =>
      ok({ ...input, id: "saved-recipe", image_version: null }),
  );
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await user.click(screen.getByRole("button", { name: "New Recipe ▾" }));
  await user.click(screen.getByRole("button", { name: "Create" }));
  const dialog = screen.getByRole("dialog", { name: "Recipe editor" });
  const title = screen.getByRole("textbox", { name: "Draft title" });
  await user.type(title, "Unsaved recipe");
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  for (const target of [title, document.body]) {
    expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(false);
    expect(fireEvent.keyDown(target, { key: "Escape" })).toBe(false);
  }
  expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(
    false,
  );
  fireEvent.click(dialog, { clientX: -1, clientY: -1 });
  expect(screen.getByRole("dialog", { name: "Recipe editor" })).toBe(dialog);
  expect((title as HTMLInputElement).value).toBe("Unsaved recipe");
  expect(fireEvent.keyDown(document.body, { key: "a" })).toBe(true);
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(fireEvent.keyDown(document.body, { key: "Escape" })).toBe(true);
});

it("keeps disclosures exclusive and dismisses on outside interaction, Escape, selection and focus leaving", async () => {
  const user = userEvent.setup();
  render(<App />);
  const file = screen.getByRole("button", { name: "File" });
  const recipe = screen.getByRole("button", { name: "New Recipe ▾" });
  await user.click(file);
  await user.click(recipe);
  expect(screen.queryByRole("button", { name: "Quit" })).toBeNull();
  expect(recipe.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{Escape}");
  expect(recipe.getAttribute("aria-expanded")).toBe("false");
  await user.click(file);
  fireEvent.pointerDown(screen.getByRole("main"));
  expect(file.getAttribute("aria-expanded")).toBe("false");
  await user.click(file);
  await user.click(screen.getByRole("button", { name: "Quit" }));
  expect(
    vi.mocked(getCurrentWindow).mock.results.at(-1)?.value.close,
  ).toHaveBeenCalledOnce();
  expect(file.getAttribute("aria-expanded")).toBe("false");
  for (const target of [
    screen.getByRole("separator"),
    screen.getByRole("button", { name: "Shopping List" }),
  ]) {
    await user.click(file);
    fireEvent.blur(file, { relatedTarget: target });
    expect(file.getAttribute("aria-expanded")).toBe("false");
  }
});

it("resizes the planner with pointer and keyboard within its bounds and stops on release", () => {
  render(<App />);
  const handle = screen.getByRole("separator");
  const workspace = handle.parentElement;
  if (!workspace) throw new Error("Missing workspace");
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue({
    bottom: 1000,
    height: 1000,
  } as DOMRect);
  expect(handle.getAttribute("aria-valuenow")).toBe("50");
  for (const [key, height] of [
    ["ArrowUp", "55"],
    ["Home", "15"],
    ["ArrowDown", "15"],
    ["End", "85"],
    ["ArrowUp", "85"],
  ]) {
    fireEvent.keyDown(handle, { key });
    expect(handle.getAttribute("aria-valuenow")).toBe(height);
  }
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0 });
  for (const [clientY, height] of [
    [2000, "15"],
    [-100, "85"],
    [600, "40"],
  ]) {
    fireEvent.pointerMove(handle, { pointerId: 1, clientY });
    expect(handle.getAttribute("aria-valuenow")).toBe(height);
  }
  fireEvent.pointerUp(handle, { pointerId: 1 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 0 });
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
});

it.each([
  { location: "gallery", x: 150, y: 50, dropped: "" },
  { location: "outside the column", x: 350, y: 180, dropped: "" },
  { location: "visible column", x: 150, y: 180, dropped: "day" },
])(
  "only accepts visible pointer drops: $location",
  async ({ x, y, dropped }) => {
    render(<App />);
    const card = screen.getByRole("button", { name: /Card clicks/ });
    const day = screen.getByText(/Planner fixture/);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(
      new DOMRect(10, 10, 20, 20),
    );
    vi.spyOn(day, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 500, 500),
    );
    vi.spyOn(
      screen.getByTestId("planner-scroll"),
      "getBoundingClientRect",
    ).mockReturnValue(new DOMRect(100, 160, 200, 80));
    fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: x, clientY: y });
    fireEvent.pointerUp(document);
    expect(day.textContent).toBe(`Planner fixture; dropped ${dropped}`);
    await act(() => new Promise((resolve) => setTimeout(resolve, 60)));
  },
);

it("preserves card clicks below the pointer threshold and drops keyboard drags on the planner", async () => {
  const user = userEvent.setup();
  render(<App />);
  const card = screen.getByRole("button", { name: /Card clicks/ });
  fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 13, clientY: 10 });
  expect(card.textContent).toContain("drag idle");
  fireEvent.pointerUp(document);
  fireEvent.click(card);
  expect(card.textContent).toContain("clicks 1");
  fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(document, { clientX: 20, clientY: 10 });
  expect(card.textContent).toContain("drag started");
  fireEvent.pointerUp(document);

  const day = screen.getByText(/Planner fixture/);
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue(
    new DOMRect(10, 10, 20, 20),
  );
  vi.spyOn(day, "getBoundingClientRect").mockReturnValue(
    new DOMRect(60, 10, 20, 20),
  );
  card.focus();
  await user.keyboard("[Space]");
  expect(day.textContent).toBe("Planner fixture; dropped ");
  await user.keyboard("[ArrowRight][ArrowRight][Space]");
  expect(day.textContent).toBe("Planner fixture; dropped day");
});

it("selects the responsive shell on media changes and accepts a custom viewport query", () => {
  const original = window.matchMedia;
  const events = new EventTarget();
  const media = {
    matches: false,
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  };
  const matchMedia = vi.fn(() => media);
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });
  try {
    const { rerender, unmount } = render(<App />);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 768px)");
    expect(screen.getByRole("button", { name: "File" })).toBeTruthy();
    act(() => {
      media.matches = true;
      events.dispatchEvent(new Event("change"));
    });
    expect(
      screen.getByRole("heading", { name: "Mobile explorer fixture" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "File" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quit" })).toBeNull();
    rerender(<App mobileViewportQuery="(max-width: 600px)" />);
    expect(matchMedia).toHaveBeenCalledWith("(max-width: 600px)");
    act(() => {
      media.matches = false;
      events.dispatchEvent(new Event("change"));
    });
    expect(screen.getByRole("button", { name: "File" })).toBeTruthy();
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledTimes(
      media.addEventListener.mock.calls.length,
    );
  } finally {
    if (original) window.matchMedia = original;
    else Reflect.deleteProperty(window, "matchMedia");
  }
});
