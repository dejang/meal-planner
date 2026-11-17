import {
  DndContext,
  KeyboardSensor,
  getScrollableAncestors,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type Ref } from "react";
import { Button, ButtonVariant } from "@/components/Button";
import { Icon, IconName } from "@/components/Icon";
import { DialogSize, PaperDialog } from "@/components/PaperDialog";
import Gallery from "@/features/gallery";
import Planner from "@/features/planner";
import Editor from "@/features/editor";
import { ClosedEditorError } from "@/features/editor/ClosedEditorError";
import Shopping from "@/features/shopping";
import Import from "@/features/import";
import Settings, { Welcome } from "@/features/settings";
import { PlanScope } from "@/stores/PlanStore";
import { RecipesScope } from "@/stores/RecipesStore";
import {
  EditorScope,
  useEditorOpen,
  useEditorActions,
} from "@/stores/EditorStore";
import {
  ImportScope,
  useImportOpen,
  useImportActions,
} from "@/stores/ImportStore";
import { SettingsScope } from "@/stores/SettingsStore";
import { DrawerScope } from "@/stores/DrawerStore";
import MobileShell from "@/mobile/MobileShell";
import { useIsMobileViewport } from "@/mobile/useIsMobileViewport";

export interface AppProps {
  plannerMin?: number;
  plannerMax?: number;
  plannerDefault?: number;
  dragDistance?: number;
  mobileViewportQuery?: string;
}

enum Dropdown {
  File = "file",
  Recipe = "recipe",
}

interface MenuDropdownProps {
  label: string;
  id: string;
  open: boolean;
  rootRef?: Ref<HTMLDivElement>;
  onToggle: () => void;
  onClose: () => void;
  items: { label: string; onClick: () => void }[];
}

function MenuDropdown({
  label,
  id,
  open,
  rootRef,
  onToggle,
  onClose,
  items,
}: MenuDropdownProps) {
  return (
    <div className="menu-disclosure" ref={rootRef}>
      <Button
        variant={ButtonVariant.Quiet}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        {label}
      </Button>
      {open && (
        <div id={id} className="menu-popup popup-frame" onClick={onClose}>
          {items.map((item) => (
            <Button
              key={item.label}
              variant={ButtonVariant.Quiet}
              onClick={item.onClick}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell({
  plannerMin = 15,
  plannerMax = 85,
  plannerDefault = 50,
  dragDistance = 6,
}: AppProps) {
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menu, setMenu] = useState<Dropdown | null>(null);
  const [plannerHeight, setPlannerHeight] = useState(plannerDefault);
  const menuRoot = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const editorOpen = useEditorOpen();
  const editor = useEditorActions();
  const importOpen = useImportOpen();
  const importer = useImportActions();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: dragDistance },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRoot.current?.contains(event.target)
      )
        setMenu(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function resize(height: number) {
    setPlannerHeight(Math.min(plannerMax, Math.max(plannerMin, height)));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const pointer = args.pointerCoordinates;
        if (!pointer) return rectIntersection(args);
        return pointerWithin(args).filter(({ data }) => {
          const node = data?.droppableContainer.node.current;
          return (
            node &&
            getScrollableAncestors(node).every((ancestor) => {
              const rect = ancestor.getBoundingClientRect();
              return (
                pointer.x >= rect.left &&
                pointer.x <= rect.right &&
                pointer.y >= rect.top &&
                pointer.y <= rect.bottom
              );
            })
          );
        });
      }}
    >
      <div className="app-shell">
        <nav
          aria-label="Main"
          className="menu-bar on-forest"
          onBlur={(event) => {
            if (!menuRoot.current?.contains(event.relatedTarget)) setMenu(null);
          }}
        >
          <Icon name={IconName.Leaf} className="brand-icon" />
          <span className="brand">Meal planner</span>
          <MenuDropdown
            label="File"
            id="file-dropdown"
            open={menu === Dropdown.File}
            rootRef={menu === Dropdown.File ? menuRoot : undefined}
            onToggle={() =>
              setMenu(menu === Dropdown.File ? null : Dropdown.File)
            }
            onClose={() => setMenu(null)}
            items={[
              {
                label: "Quit",
                onClick: () => {
                  void getCurrentWindow().close();
                },
              },
            ]}
          />
          <MenuDropdown
            label="New Recipe ▾"
            id="recipe-dropdown"
            open={menu === Dropdown.Recipe}
            rootRef={menu === Dropdown.Recipe ? menuRoot : undefined}
            onToggle={() =>
              setMenu(menu === Dropdown.Recipe ? null : Dropdown.Recipe)
            }
            onClose={() => setMenu(null)}
            items={[
              { label: "Create", onClick: editor.openNew },
              { label: "Import from URL", onClick: importer.open },
            ]}
          />
          <Button
            variant={ButtonVariant.Quiet}
            onClick={() => setShoppingOpen(true)}
          >
            Shopping List
          </Button>
          <Button
            variant={ButtonVariant.Quiet}
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        </nav>
        <div ref={workspace} className="workspace">
          <main className="gallery-area">
            <Gallery />
          </main>
          <div
            className="planner-resizer"
            role="separator"
            tabIndex={0}
            aria-label="Planner height"
            aria-orientation="horizontal"
            aria-valuemin={plannerMin}
            aria-valuemax={plannerMax}
            aria-valuenow={plannerHeight}
            onKeyDown={(event) => {
              const height =
                event.key === "ArrowUp"
                  ? plannerHeight + 5
                  : event.key === "ArrowDown"
                    ? plannerHeight - 5
                    : event.key === "Home"
                      ? plannerMin
                      : event.key === "End"
                        ? plannerMax
                        : null;
              if (height !== null) {
                event.preventDefault();
                resize(height);
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              dragging.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const bounds = workspace.current?.getBoundingClientRect();
              if (
                dragging.current === event.pointerId &&
                bounds &&
                bounds.height > 0
              )
                resize(((bounds.bottom - event.clientY) / bounds.height) * 100);
            }}
            onPointerUp={(event) => {
              if (dragging.current === event.pointerId) {
                dragging.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              dragging.current = null;
            }}
            onLostPointerCapture={() => {
              dragging.current = null;
            }}
          />
          <section
            aria-label="Meal planner"
            className="planner-panel"
            style={{ height: `${plannerHeight}%` }}
          >
            <div className="planner-surface surface-frame">
              <Planner />
            </div>
          </section>
        </div>
        <ClosedEditorError />
        <Welcome />
        {shoppingOpen && (
          <PaperDialog
            title="Shopping list"
            size={DialogSize.Shopping}
            showHeader={false}
            onClose={() => setShoppingOpen(false)}
          >
            <Shopping onClose={() => setShoppingOpen(false)} />
          </PaperDialog>
        )}
        {settingsOpen && (
          <PaperDialog title="Settings" onClose={() => setSettingsOpen(false)}>
            <Settings />
          </PaperDialog>
        )}
        {editorOpen && (
          <PaperDialog
            title="Recipe editor"
            size={DialogSize.Editor}
            showHeader={false}
            onClose={editor.close}
          >
            <Editor />
          </PaperDialog>
        )}
        {importOpen && (
          <PaperDialog title="Import recipe" onClose={importer.close}>
            <Import />
          </PaperDialog>
        )}
      </div>
    </DndContext>
  );
}

export default function App(props: AppProps) {
  const isMobile = useIsMobileViewport(props.mobileViewportQuery);
  return (
    <PlanScope>
      <RecipesScope>
        <EditorScope>
          <ImportScope>
            <SettingsScope>
              <DrawerScope>
                {isMobile ? <MobileShell /> : <Shell {...props} />}
              </DrawerScope>
            </SettingsScope>
          </ImportScope>
        </EditorScope>
      </RecipesScope>
    </PlanScope>
  );
}
