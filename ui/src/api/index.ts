import { convertFileSrc } from "@tauri-apps/api/core";

export * from "./bindings";

export function imageUrl(recipeId: string, version: string): string {
  return `${convertFileSrc(recipeId, "image")}?v=${encodeURIComponent(version)}`;
}
