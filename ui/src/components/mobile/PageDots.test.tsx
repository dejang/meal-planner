import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PageDots } from "@/components/mobile/PageDots";

it("names day targets and reports a direct page selection", () => {
  const onSelect = vi.fn();
  const { rerender } = render(
    <PageDots
      count={6}
      activeIndex={1}
      onSelect={onSelect}
      label="Choose day"
      dotLabel={(index) => `Go to day ${index + 1}`}
    />,
  );
  expect(screen.getByRole("navigation", { name: "Choose day" })).toBeTruthy();
  expect(screen.getAllByRole("button")).toHaveLength(6);
  expect(
    screen
      .getByRole("button", { name: "Go to day 2" })
      .getAttribute("aria-current"),
  ).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Go to day 6" }));
  expect(onSelect).toHaveBeenCalledWith(5);
  rerender(<PageDots count={6} activeIndex={5} onSelect={onSelect} />);
  expect(
    screen
      .getByRole("button", { name: "Go to page 6" })
      .getAttribute("aria-current"),
  ).toBe("page");
});
