import { convertFileSrc } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { imageUrl } from "./index";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: vi.fn() }));

it("adds an encoded cache token to the converted image URL", () => {
  vi.mocked(convertFileSrc).mockReturnValue("image://recipe-id");
  expect(imageUrl("recipe-id", "version /?&#")).toBe(
    "image://recipe-id?v=version%20%2F%3F%26%23",
  );
  expect(convertFileSrc).toHaveBeenLastCalledWith("recipe-id", "image");
});
