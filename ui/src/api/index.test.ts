import { expect, it } from "vitest";
import { unwrap } from "@/api/index";

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
