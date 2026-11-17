import { useId } from "react";
import { Button } from "@/components/Button";
import "@/components/mobile/mobile.css";

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  disabled,
  label = "Portions",
}: StepperProps) {
  const id = useId();
  return (
    <div className="mobile-stepper" role="group" aria-labelledby={id}>
      <span id={id}>{label}</span>
      <Button
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </Button>
      <output aria-live="polite">{value}</output>
      <Button
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        +
      </Button>
    </div>
  );
}
