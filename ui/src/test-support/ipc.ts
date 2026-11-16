import { beforeEach, vi } from "vitest";
import { commands, imageUrl } from "../api";
import { analysis, recipe } from "../api/fixtures";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("../api", async (importOriginal) => {
  const api = await importOriginal<typeof import("../api")>();
  return {
    ...api,
    imageUrl: vi.fn(),
    commands: Object.fromEntries(
      Object.keys(api.commands).map((name) => [name, vi.fn()]),
    ),
  };
});
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

export function ok<T>(data: T): { status: "ok"; data: T } {
  return { status: "ok", data };
}

beforeEach(() => {
  vi.mocked(imageUrl)
    .mockReset()
    .mockReturnValue("https://images.test/soup.jpg");
  vi.mocked(open).mockReset().mockResolvedValue(null);
  vi.mocked(openUrl).mockReset().mockResolvedValue();
  for (const [name, command] of Object.entries(commands)) {
    vi.mocked(command)
      .mockReset()
      .mockImplementation(() => {
        throw new Error(`Unexpected IPC command: ${name}`);
      });
  }
  vi.mocked(commands.getRecipe).mockResolvedValue(ok(recipe()));
  vi.mocked(commands.createRecipe).mockResolvedValue(ok(recipe()));
  vi.mocked(commands.updateRecipe).mockResolvedValue(ok(recipe()));
  vi.mocked(commands.listRecipes).mockResolvedValue(ok([]));
  vi.mocked(commands.getPlan).mockResolvedValue(
    ok({ days: [[], [], [], [], [], []] }),
  );
  vi.mocked(commands.dayTotals).mockResolvedValue(ok(analysis()));
  vi.mocked(commands.shoppingList).mockResolvedValue(ok([]));
  vi.mocked(commands.analyzeIngredients).mockResolvedValue(ok(analysis()));
  vi.mocked(commands.supportedSites).mockResolvedValue([]);
  vi.mocked(commands.getCredentials).mockResolvedValue(
    ok({ app_id: "", api_key: "" }),
  );
  vi.mocked(commands.saveCredentials).mockResolvedValue(ok(null));
});
