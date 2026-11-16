import type { ButtonHTMLAttributes } from "react";

export enum ButtonVariant {
  Default = "default",
  Primary = "primary",
  Quiet = "quiet",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = ButtonVariant.Default,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`button button-${variant} ${className}`}
    />
  );
}
