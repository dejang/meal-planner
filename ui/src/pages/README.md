# Pages: screen composition

Put whole screens here, such as a recipe-book screen, weekly planner, or shopping-list
screen. A page arranges organisms and kit UI rather than implementing storage or transport.

## Responsibilities

- Compose the feature UI for one screen.
- Handle route parameters, navigation, and screen-level layout when routing is added.
- Pass identifiers and callbacks to organisms.
- Consume public store hooks and place store scopes where their lifetime belongs to
  the screen; application-wide scopes belong in `App.tsx`.

## Keep out

- Direct API runtime calls, live subscriptions, or imports of `stores/core/`.
- Store classes, contexts, and state mutation logic.
- Duplicated generic UI that belongs in `kit/`.
- Module-level literal configuration; receive it through props or configuration.

React Router is not currently installed. This folder reserves screen ownership
without requiring a router or placeholder screens now.

Relevant rules: `api-imports-*`, `live-imports-*`, and the shared style rules in the
[source overview](../README.md).
