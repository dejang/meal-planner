# Stores: application state and actions

Put stateful meal-planning modules here, such as recipe-book, meal-plan, or shopping-list
stores. A store owns its state transitions, derived selections, asynchronous actions,
and coordination with persistence or live events.

## Public interface

- Export `*Scope` provider functions and `use*` hook functions, plus the interfaces,
  types, and enums callers need.
- Use function declarations for exported scopes and hooks: the export rule rejects
  `export const useSomething = ...` even when the value is a function.
- Keep store classes, instances, React contexts, and raw getters private.
- Expose useful actions and selections rather than making callers manipulate state.

## Implementation rules

- Call `api/` and, when needed, `lib/live.ts` here. UI callers use store hooks instead
  of performing persistence or transport work themselves.
- Keep logic that reads or writes store state on the owning store, not in module-level
  helpers taking a store or its state as an argument.
- Constructors initialize state without subscribing. Connect in the scope's effect
  and disconnect in its cleanup so React StrictMode can safely remount the scope.
- Selectors return primitives or stable stored references, not freshly allocated
  objects, arrays, or `map`/`filter`/`slice` results on every call.
- Receive configuration rather than declaring module-level literal constants.
- Do not import routing or screen UI into stores.

Shared implementation machinery belongs in [`core/`](core/README.md), not in a second
public route to the store's state. Add abstractions only when an implementation needs them.

Relevant rules: `store-exports-*`, `store-helper-*`, `selector-fresh-value-*`,
`listen-in-constructor-*`, `router-imports-*`, and the [shared conventions](../README.md).
