import "@/components/mobile/mobile.css";

export interface PageDotsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  label?: string;
  dotLabel?: (index: number) => string;
}

export function PageDots({
  count,
  activeIndex,
  onSelect,
  label = "Choose page",
  dotLabel = (index) => `Go to page ${index + 1}`,
}: PageDotsProps) {
  return (
    <nav className="page-dots" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <button
          type="button"
          className="page-dot mobile-pressable"
          key={index}
          aria-label={dotLabel(index)}
          aria-current={index === activeIndex ? "page" : undefined}
          onClick={() => onSelect(index)}
        >
          <span />
        </button>
      ))}
    </nav>
  );
}
