import { useCallback, useState, type ReactNode } from "react";
import { Button, ButtonVariant } from "@/components/Button";
import { Icon, IconName } from "@/components/Icon";

export enum DialogSize {
  Default = "default",
  Editor = "editor",
  Shopping = "shopping",
}

export interface PaperDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: DialogSize;
  showHeader?: boolean;
}

export function PaperWindowHeader({
  title,
  onClose,
  closeLabel = "Close",
}: Pick<PaperDialogProps, "title" | "onClose"> & { closeLabel?: string }) {
  return (
    <header className="paper-header">
      <h2>{title}</h2>
      <Button
        variant={ButtonVariant.Quiet}
        aria-label={closeLabel}
        title={closeLabel}
        onClick={onClose}
      >
        <Icon name={IconName.X} />
      </Button>
    </header>
  );
}

export function PaperDialog({
  title,
  onClose,
  children,
  size = DialogSize.Default,
  showHeader = true,
}: PaperDialogProps) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback((node: HTMLDialogElement) => {
    node.showModal();
    setOpen(true);
    function preventEscape(event: KeyboardEvent) {
      if (event.key === "Escape") event.preventDefault();
    }
    document.addEventListener("keydown", preventEscape, true);
    return () => document.removeEventListener("keydown", preventEscape, true);
  }, []);

  return (
    <dialog
      ref={openModal}
      aria-label={title}
      className={`paper-dialog paper-dialog-${size}`}
      onCancel={(event) => {
        event.preventDefault();
      }}
      onClose={onClose}
    >
      {showHeader && <PaperWindowHeader title={title} onClose={onClose} />}
      {open && children}
    </dialog>
  );
}
