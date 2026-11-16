import { convertFileSrc } from "@tauri-apps/api/core";
import type { Error as ApiError } from "./bindings";

export * from "./bindings";

export function unwrap<T>(
  result: { status: "ok"; data: T } | { status: "error"; error: ApiError },
): T {
  if (result.status === "error") {
    throw new Error(
      result.error.kind === "lock_poisoned"
        ? "Recipe storage is unavailable. Please restart the app and try again."
        : result.error.detail,
    );
  }
  return result.data;
}

export function imageUrl(recipeId: string, version: string): string {
  return `${convertFileSrc(recipeId, "image")}?v=${encodeURIComponent(version)}`;
}
