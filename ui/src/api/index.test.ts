import { convertFileSrc } from "@tauri-apps/api/core";
import { expect, it, vi } from "vitest";
import { imageUrl, unwrap } from "./index";

vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: vi.fn() }));

it.each<[Parameters<typeof unwrap<number>>[0], number | Error]>([
  [{ status: "ok", data: 42 }, 42],
  [
    {
      status: "error",
      error: { kind: "storage", detail: "Cannot read plan" },
    },
    new Error("Cannot read plan"),
  ],
  [
    { status: "error", error: { kind: "lock_poisoned" } },
    new Error(
      "Recipe storage is unavailable. Please restart the app and try again.",
    ),
  ],
])("decodes %j", (result, expected) => {
  if (expected instanceof Error) {
    expect(() => unwrap(result)).toThrow(expected);
  } else {
    expect(unwrap(result)).toBe(expected);
  }
});

it("adds an encoded cache token to the converted image URL", () => {
  vi.mocked(convertFileSrc).mockReturnValue("image://recipe-id");
  expect(imageUrl("recipe-id", "version /?&#")).toBe(
    "image://recipe-id?v=version%20%2F%3F%26%23",
  );
  expect(convertFileSrc).toHaveBeenLastCalledWith("recipe-id", "image");
});
