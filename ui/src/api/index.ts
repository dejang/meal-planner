import { convertFileSrc } from "@tauri-apps/api/core";
import type { Error as ApiError } from "./bindings";

export * from "./bindings";

export function unwrap<T>(
  result: { status: "ok"; data: T } | { status: "error"; error: ApiError },
): T {
  if (result.status === "error") {
    throw new Error(
      "detail" in result.error ? result.error.detail : result.error.kind,
    );
  }
  return result.data;
}

export function imageUrl(recipeId: string, version: string): string {
  return `${convertFileSrc(recipeId, "image")}?v=${encodeURIComponent(version)}`;
}
