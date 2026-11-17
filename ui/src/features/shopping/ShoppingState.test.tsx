import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ShoppingState } from "@/features/shopping/ShoppingState";

it.each([
  {
    state: "loading",
    loading: true,
    error: null,
    itemCount: 0,
    message: "Loading shopping list…",
    role: "status",
  },
  {
    state: "empty",
    loading: false,
    error: null,
    itemCount: 0,
    message: "Your shopping list is empty.",
    role: null,
  },
  {
    state: "error",
    loading: false,
    error: "Cannot read shopping list",
    itemCount: 0,
    message: "Cannot read shopping list",
    role: "alert",
  },
  {
    state: "refreshing existing items",
    loading: true,
    error: null,
    itemCount: 2,
    message: null,
    role: null,
  },
  {
    state: "loaded items",
    loading: false,
    error: null,
    itemCount: 2,
    message: null,
    role: null,
  },
])(
  "shows only the $state feedback",
  ({ loading, error, itemCount, message, role }) => {
    const { container } = render(
      <ShoppingState
        loading={loading}
        error={error}
        itemCount={itemCount}
        emptyClassName="shopping-empty"
      />,
    );

    if (message) expect(screen.getByText(message)).toBeTruthy();
    else expect(container.textContent).toBe("");
    for (const feedbackRole of ["status", "alert"]) {
      expect(screen.queryByRole(feedbackRole)?.textContent ?? null).toBe(
        role === feedbackRole ? message : null,
      );
    }
    expect(
      screen.queryByText(
        "Add meals with analyzed ingredients to your weekly plan to get started.",
      ) !== null,
    ).toBe(!loading && !error && itemCount === 0);
  },
);
