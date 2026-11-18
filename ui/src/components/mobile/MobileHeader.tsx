import type { ReactNode } from "react";
import "@/components/mobile/mobile.css";

export interface MobileHeaderProps {
  title: string;
  action?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function MobileHeader({
  title,
  action,
  leading,
  trailing,
}: MobileHeaderProps) {
  return (
    <header className="mobile-header safe-area-sides">
      <div className="mobile-header-title">
        {leading}
        <h1 className="mobile-screen-title">{title}</h1>
        {trailing}
      </div>
      {action && <div className="mobile-header-action">{action}</div>}
    </header>
  );
}
