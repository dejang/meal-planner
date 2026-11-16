# API: typed desktop and backend calls

Put typed adapters for calls outside the frontend here. For this Tauri application,
that can include desktop command calls and their request/response contracts; add HTTP
clients only if the application actually needs them.

## Responsibilities

- Hide transport names, payload encoding, response decoding, and transport errors
  behind a small typed interface.
- Re-export generated Rust data contracts used at the desktop/backend seam.
- Keep transport operations separate from React rendering and application-state policy.

## Callers and dependencies

- Stores are the application callers of runtime API operations. UI changes go through
  store actions rather than invoking the desktop/backend directly.
- Components, features and mobile composition may use type-only API contracts.
- Do not import stores, UI components, features or routing back into this layer.
- Do not own React state, optimistic updates, or cache lifetime here; those belong
  to the store coordinating the operation.

`bindings.ts` is generated from the registered Tauri commands; do not edit it by hand.
Import bindings and shared `unwrap` through `index.ts`.
Versioned image URL formatting lives in `lib/imageUrl.ts`.
`unwrap` returns command result data on success or throws an Error with the error's
`detail`, or a readable storage-unavailable message for `lock_poisoned`. Regeneration and
freshness-check commands are documented in the repository README.

The `api-imports-*` rules cover components, features, mobile, theme and the TSX shell,
checking `@/api` imports. Separate path-style rules reject relative imports throughout
`ui/src/`. See the [source overview](../README.md).
