import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { expect, it, vi } from "vitest";
import { PaperDialog, PaperWindowHeader } from "@/components/PaperDialog";

it.each([
  { label: undefined, expected: "Close" },
  { label: "Close shopping list", expected: "Close shopping list" },
])("labels the close control as $expected", ({ label, expected }) => {
  const onClose = vi.fn();
  render(
    <PaperWindowHeader title="Sheet" closeLabel={label} onClose={onClose} />,
  );
  const close = screen.getByRole("button", { name: expected });
  expect(close.getAttribute("title")).toBe(expected);
  fireEvent.click(close);
  expect(onClose).toHaveBeenCalledOnce();
});

it("opens the dialog before mounting children so layout effects can measure it", () => {
  const measured = vi.fn();
  function Content() {
    const element = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      measured(element.current?.closest("dialog")?.open);
    }, []);
    return <div ref={element}>Sheet content</div>;
  }

  render(
    <PaperDialog title="Sheet" showHeader={false} onClose={vi.fn()}>
      <Content />
    </PaperDialog>,
  );

  expect(measured).toHaveBeenCalledOnce();
  expect(measured).toHaveBeenCalledWith(true);
});
