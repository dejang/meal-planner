import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DayPills } from "@/components/mobile/DayPills";

it("reports zero-based days, highlights selection and shows confirmed additions", () => {
  const onSelect = vi.fn();
  const { rerender } = render(<DayPills selectedDay={1} onSelect={onSelect} />);
  expect(screen.getAllByRole("button")).toHaveLength(6);
  expect(
    screen.getByRole("button", { name: "D2" }).getAttribute("aria-pressed"),
  ).toBe("true");
  for (const day of [0, 2, 5])
    fireEvent.click(screen.getByRole("button", { name: `D${day + 1}` }));
  expect(onSelect.mock.calls).toEqual([[0], [2], [5]]);
  rerender(
    <DayPills selectedDay={5} confirmedDay={5} onSelect={onSelect} disabled />,
  );
  expect(
    screen
      .getByRole("button", { name: "D6" })
      .querySelector(".day-confirmation"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "D1" }));
  expect(onSelect).toHaveBeenCalledTimes(3);
  rerender(<DayPills count={3} onSelect={onSelect} />);
  expect(screen.getAllByRole("button")).toHaveLength(3);
});
