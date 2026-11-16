import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RecipePhoto } from "./RecipePhoto";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (id: string) => `image://${id}`,
}));

it("shows saved and draft photos, falling back on missing or failed images and retrying changed sources", () => {
  const view = render(
    <RecipePhoto recipeId="soup" imageVersion={null} alt="Soup" />,
  );
  expect(screen.getByText("A little kitchen inspiration")).toBeTruthy();
  view.rerender(<RecipePhoto recipeId="soup" imageVersion="v1" alt="Soup" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe("image://soup?v=v1");
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText("A little kitchen inspiration")).toBeTruthy();
  view.rerender(<RecipePhoto recipeId="soup" imageVersion="v2" alt="Soup" />);
  expect(screen.getByRole("img").getAttribute("src")).toBe("image://soup?v=v2");
  for (const recipeId of [null, "soup"]) {
    view.rerender(
      <RecipePhoto
        recipeId={recipeId}
        imageVersion="v2"
        image={{ bytes: "/9j/2Q==", width: 1, height: 1 }}
        alt="Soup"
      />,
    );
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "data:image/jpeg;base64,/9j/2Q==",
    );
  }
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText("A little kitchen inspiration")).toBeTruthy();
  view.rerender(
    <RecipePhoto
      image={{ bytes: "/9j/AA==", width: 1, height: 1 }}
      alt="Soup"
    />,
  );
  expect(screen.getByRole("img").getAttribute("src")).toBe(
    "data:image/jpeg;base64,/9j/AA==",
  );
  view.rerender(<RecipePhoto alt="Soup" />);
  expect(screen.getByText("A little kitchen inspiration")).toBeTruthy();
});
