# Kit: reusable UI

Put generic, props-driven UI here: buttons, fields, dialogs, layout primitives,
and presentational lists. A kit module should be usable without knowing about
recipes, meal plans, store instances, or backend connections.

## Responsibilities

- Render values supplied through props and report interactions through callbacks.
- Keep only local presentation state, such as focus or whether a menu is open.
- Reuse other kit modules, theme styles, and pure library utilities.

## Keep out

- Imports from `stores/`, `organisms/`, `pages/`, `api/`, or `lib/live.ts`, including
  type-only imports from those application layers.
- Routing, persistence calls, subscriptions, and application-state ownership.
- Module-level literal configuration; receive configurable values through props.

For example, a generic selectable list belongs here. A recipe picker that reads the
recipe store belongs in [`organisms/`](../organisms/README.md).

Relevant rules: `kit-imports-*`, `module-const-*`, `object-type-alias-*`, and
`string-union-type-*`. See the [source overview](../README.md) for enforcement gaps.
