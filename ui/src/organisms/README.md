# Organisms: state-connected feature UI

Put meal-planning UI here that connects public store hooks to reusable kit UI.
Examples include a recipe picker, a meal-plan day, or an editable shopping list.

## Responsibilities

- Select the state needed for rendering through public `use*` store hooks.
- Invoke store actions through hooks instead of calling the API directly.
- Compose kit UI and smaller organisms.
- Use routing when a feature needs navigation or route identifiers.

## Props and imports

- The current props rule expects `Keys<...>`: identifiers, names, and `() => void`
  callbacks rather than entity objects or store instances. The `Keys` type still
  needs an implementation before it can be used.
- Do not import API runtime values, `lib/live.ts`, or store implementation classes.
- Prefer public store types. The rules reserve a type-only import/export exception
  for `stores/core/draft` if a shared draft contract is introduced later.
- Keep state transitions and persistence logic in stores, not in rendering code.

Relevant rules: `organism-props-*`, `live-imports-organisms-*`, and `api-imports-*`,
plus the shared style rules in the [source overview](../README.md).
