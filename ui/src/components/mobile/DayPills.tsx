import { Button } from "@/components/Button";
import "@/components/mobile/mobile.css";

export interface DayPillsProps {
  count?: number;
  selectedDay?: number;
  confirmedDay?: number;
  onSelect: (day: number) => void;
  disabled?: boolean;
  label?: string;
}

export function DayPills({
  count = 6,
  selectedDay,
  confirmedDay,
  onSelect,
  disabled,
  label = "Choose day",
}: DayPillsProps) {
  return (
    <div className="day-pills" role="group" aria-label={label}>
      {Array.from({ length: count }, (_, day) => (
        <Button
          className="day-pill"
          key={day}
          disabled={disabled}
          aria-pressed={day === selectedDay}
          onClick={() => onSelect(day)}
        >
          D{day + 1}
          {day === confirmedDay && (
            <span className="day-confirmation" aria-hidden="true">
              ✓
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
