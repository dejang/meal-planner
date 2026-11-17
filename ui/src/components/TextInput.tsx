import type { ComponentProps, TextareaHTMLAttributes } from "react";

export function TextInput({
  className = "",
  ...props
}: ComponentProps<"input">) {
  return <input {...props} className={`text-input ${className}`} />;
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`text-input ${className}`} />;
}
