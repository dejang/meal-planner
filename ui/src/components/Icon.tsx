import type { HTMLAttributes } from "react";

export enum IconName {
  Leaf = "\ue2dd",
  ChefHat = "\ue2ab",
  X = "\ue1b1",
  Settings = "\ue157",
  Trash2 = "\ue18d",
  ClipboardPaste = "\ue3eb",
  Pencil = "\ue1f8",
  Check = "\ue070",
  Search = "\ue154",
}

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: IconName;
}

export function Icon({ name, className = "", ...props }: IconProps) {
  return (
    <span aria-hidden="true" {...props} className={`icon ${className}`}>
      {name}
    </span>
  );
}
