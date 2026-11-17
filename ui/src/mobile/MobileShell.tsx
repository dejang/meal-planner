import { useState, type CSSProperties } from "react";
import { Icon, IconName } from "@/components/Icon";
import { ClosedEditorError } from "@/features/editor/ClosedEditorError";
import { Welcome } from "@/features/settings";
import Explorer from "@/mobile/explorer";
import Planner from "@/mobile/planner";
import Shopping from "@/mobile/shopping";
import Settings from "@/mobile/settings";
import RecipeDrawer from "@/mobile/drawer";
import "@/mobile/MobileShell.css";

export default function MobileShell() {
  const [active, setActive] = useState(0);
  const tabs = [
    { label: "Explorer", icon: IconName.Leaf, screen: Explorer },
    { label: "Weekly Plan", icon: IconName.ChefHat, screen: Planner },
    { label: "Shop", icon: IconName.ShoppingCart, screen: Shopping },
    { label: "Settings", icon: IconName.Settings, screen: Settings },
  ];

  return (
    <div className="mobile-shell mobile-theme">
      <main className="mobile-viewport">
        {tabs.map((tab, index) => (
          <section
            key={tab.label}
            id={`mobile-screen-${index}`}
            aria-label={tab.label}
            aria-hidden={active !== index}
            inert={active !== index}
            className="mobile-screen"
            data-active={active === index}
          >
            <tab.screen active={active === index} />
          </section>
        ))}
      </main>
      <ClosedEditorError />
      <Welcome />
      <nav className="mobile-tabs safe-area-sides" aria-label="Main">
        <div
          className="mobile-tab-track"
          style={{ "--active-tab": active } as CSSProperties}
        >
          <span className="mobile-tab-indicator" aria-hidden="true" />
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              type="button"
              className="mobile-tab mobile-pressable"
              aria-current={active === index ? "page" : undefined}
              aria-controls={`mobile-screen-${index}`}
              onClick={() => setActive(index)}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
      <RecipeDrawer />
    </div>
  );
}
