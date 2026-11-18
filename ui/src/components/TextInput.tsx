import type { ComponentProps } from "react";

export function TextInput({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return <input {...props} className={`text-input ${className}`} />;
}

export function TextArea({
  className = "",
  ...props
}: ComponentProps<"textarea">) {
  return <textarea {...props} className={`text-input ${className}`} />;
}
