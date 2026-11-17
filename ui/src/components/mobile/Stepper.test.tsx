import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { Stepper } from "@/components/mobile/Stepper";

it.each([1, 2])(
  "increments and decrements by %s without crossing bounds",
  (step) => {
    function Portions() {
      const [value, setValue] = useState(2);
      return (
        <Stepper
          value={value}
          onChange={setValue}
          min={1}
          max={3}
          step={step}
        />
      );
    }
    render(<Portions />);
    const increase = screen.getByRole("button", { name: "Increase Portions" });
    const decrease = screen.getByRole("button", { name: "Decrease Portions" });
    fireEvent.click(increase);
    expect(screen.getByRole("status").textContent).toBe("3");
    expect((increase as HTMLButtonElement).disabled).toBe(true);
    for (let index = 0; index < 2; index++) fireEvent.click(decrease);
    expect(screen.getByRole("status").textContent).toBe("1");
    expect((decrease as HTMLButtonElement).disabled).toBe(true);
  },
);

it("disables both stepper controls during work", () => {
  const onChange = vi.fn();
  render(<Stepper value={4} disabled onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Increase Portions" }));
  fireEvent.click(screen.getByRole("button", { name: "Decrease Portions" }));
  expect(onChange).not.toHaveBeenCalled();
});
