import type { ReactNode } from "react";
import "@/components/mobile/mobile.css";

export interface MobileHeaderProps {
  title: string;
  action?: ReactNode;
}

export function MobileHeader({ title, action }: MobileHeaderProps) {
  return (
    <header className="mobile-header safe-area-sides">
      <h1 className="mobile-screen-title">{title}</h1>
      {action && <div className="mobile-header-action">{action}</div>}
    </header>
  );
}
