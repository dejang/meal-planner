import { useEffect, useRef, type ReactNode } from "react";
import { Button, ButtonVariant } from "./Button";
import { Icon, IconName } from "./Icon";

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
}: Pick<PaperDialogProps, "title" | "onClose">) {
  return (
    <header className="paper-header">
      <h2>{title}</h2>
      <Button
        variant={ButtonVariant.Quiet}
        aria-label="Close"
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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    function preventEscape(event: KeyboardEvent) {
      if (event.key === "Escape") event.preventDefault();
    }
    document.addEventListener("keydown", preventEscape, true);
    return () => document.removeEventListener("keydown", preventEscape, true);
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={title}
      className={`paper-dialog paper-dialog-${size}`}
      onCancel={(event) => {
        event.preventDefault();
      }}
      onClose={onClose}
    >
      {showHeader && <PaperWindowHeader title={title} onClose={onClose} />}
      {children}
    </dialog>
  );
}
