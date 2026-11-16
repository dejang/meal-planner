import { useEditor } from "@/test-support/editor";
import { act, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { open } from "@tauri-apps/plugin-dialog";
import Editor from "@/features/editor/index";
import { deferred } from "@/test-support/fixtures";
import { AppScopes } from "@/test-support/scopes";
import { commands, ok } from "@/test-support/ipc";

function renderEditor() {
  return renderHook(useEditor, {
    wrapper: ({ children }) => (
      <AppScopes>
        {children}
        <Editor />
      </AppScopes>
    ),
  });
}

it("edits servings through empty intermediate values and saves", async () => {
  const user = userEvent.setup();
  const { result } = renderEditor();
  act(() => {
    result.current.actions.openNew();
    result.current.actions.patchDraft({ title: "Soup", servings: 4 });
  });
  expect(
    screen.getByRole("button", { name: "Close editor" }).getAttribute("title"),
  ).toBe("Close editor");
  expect(
    screen.getByRole("button", { name: "Done" }).getAttribute("title"),
  ).toBe("Close the editor with your changes applied");
  const input = screen.getByRole<HTMLInputElement>("spinbutton", {
    name: "SERVINGS",
  });
  await user.clear(input);
  expect(input.value).toBe("");
  expect(result.current.draft?.servings).toBe(4);
  await user.type(input, "6");
  expect(input.value).toBe("6");
  expect(result.current.draft?.servings).toBe(6);
  await user.clear(input);
  await user.type(input, "0");
  await user.tab();
  expect(input.value).toBe("6");
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(commands.createRecipe).toHaveBeenCalledWith(
    expect.objectContaining({ servings: 6 }),
  );
});

it("saves photo removal without a pending load overwriting it", async () => {
  const user = userEvent.setup();
  const { result } = renderEditor();
  const response =
    deferred<Awaited<ReturnType<typeof commands.loadImageUrl>>>();
  vi.mocked(commands.loadImageUrl).mockReturnValueOnce(response.promise);
  await act(() => result.current.actions.openRecipe("recipe-1"));
  act(() => {
    void result.current.actions.loadImageUrl("old-url");
  });
  await user.click(screen.getByRole("button", { name: "Remove photo" }));
  await act(async () => {
    response.resolve(ok({ bytes: "old", width: 2, height: 2 }));
  });
  expect(result.current.draft?.image).toEqual({ kind: "remove" });
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "IMAGE" }).value,
  ).toBe("");
  expect(result.current.loadingImage).toBe(false);
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(commands.updateRecipe).toHaveBeenCalledWith(
    "recipe-1",
    expect.objectContaining({ image: { kind: "remove" } }),
  );
});

it.each([false, true])(
  "loads a pasted URL only once when tabbing away (pending: %s)",
  async (pending) => {
    const user = userEvent.setup();
    const { result } = renderEditor();
    const response =
      deferred<Awaited<ReturnType<typeof commands.loadImageUrl>>>();
    const image = { bytes: "url", width: 2, height: 2 };
    vi.mocked(commands.loadImageUrl).mockReturnValue(response.promise);
    act(() => result.current.actions.openNew());
    const input = screen.getByRole("textbox", { name: "IMAGE" });
    await user.click(input);
    await user.paste("https://images.test/new.jpg");
    if (!pending) await act(async () => response.resolve(ok(image)));
    await user.tab();
    expect(commands.loadImageUrl).toHaveBeenCalledTimes(1);
    if (pending) await act(async () => response.resolve(ok(image)));
    expect(result.current.draft?.image).toEqual({ kind: "set", image });
    await user.click(input);
    await user.tab();
    expect(commands.loadImageUrl).toHaveBeenCalledTimes(1);
  },
);

it("retries a failed URL on blur and shows the selected file source", async () => {
  const user = userEvent.setup();
  const { result } = renderEditor();
  const url = "https://images.test/new.jpg";
  const image = { bytes: "url", width: 2, height: 2 };
  vi.mocked(commands.loadImageUrl)
    .mockResolvedValueOnce({
      status: "error",
      error: { kind: "image", detail: "Offline" },
    })
    .mockResolvedValue(ok(image));
  vi.mocked(open).mockResolvedValueOnce("/soup.png");
  vi.mocked(commands.loadImageFile).mockResolvedValueOnce(
    ok({ ...image, bytes: "file" }),
  );
  act(() => result.current.actions.openNew());
  const input = screen.getByRole<HTMLInputElement>("textbox", {
    name: "IMAGE",
  });
  await user.click(input);
  await user.paste(url);
  expect(screen.getByRole("alert").textContent).toBe("Offline");
  await user.tab();
  expect(commands.loadImageUrl).toHaveBeenCalledTimes(2);
  expect(result.current.draft?.image).toEqual({ kind: "set", image });
  await user.click(screen.getByRole("button", { name: "Choose file" }));
  expect(input.value).toBe("/soup.png");
  expect(commands.loadImageFile).toHaveBeenCalledWith("/soup.png");
  expect(result.current.draft?.image).toEqual({
    kind: "set",
    image: { ...image, bytes: "file" },
  });
  await user.click(input);
  await user.tab();
  expect(commands.loadImageUrl).toHaveBeenCalledTimes(2);
  await user.clear(input);
  await user.type(input, url);
  await user.tab();
  expect(commands.loadImageUrl).toHaveBeenCalledTimes(3);
  expect(commands.loadImageUrl).toHaveBeenLastCalledWith(url);
  expect(result.current.draft?.image).toEqual({ kind: "set", image });
  expect(input.value).toBe(url);
});

it.each(["url", "file"])(
  "keeps image field edits when a pending %s load finishes",
  async (source) => {
    const user = userEvent.setup();
    const { result } = renderEditor();
    const response =
      deferred<Awaited<ReturnType<typeof commands.loadImageUrl>>>();
    const command =
      source === "url" ? commands.loadImageUrl : commands.loadImageFile;
    vi.mocked(command).mockReturnValueOnce(response.promise);
    act(() => result.current.actions.openNew());
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "IMAGE",
    });
    if (source === "url") {
      await user.click(input);
      await user.paste("https://images.test/first.jpg");
    } else {
      vi.mocked(open).mockResolvedValueOnce("/first.png");
      await user.click(screen.getByRole("button", { name: "Choose file" }));
      expect(input.value).toBe("/first.png");
    }
    await user.clear(input);
    await user.type(input, "https://images.test/next.jpg");
    const image = { bytes: "first", width: 2, height: 2 };
    await act(async () => response.resolve(ok(image)));
    expect(input.value).toBe("https://images.test/next.jpg");
    expect(result.current.draft?.imageSource).toBe(input.value);
    expect(result.current.draft?.image).toEqual({ kind: "set", image });
    expect(command).toHaveBeenCalledOnce();
  },
);
