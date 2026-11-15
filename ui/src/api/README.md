# API: typed desktop and backend calls

Put typed adapters for calls outside the frontend here. For this Tauri application,
that can include desktop command calls and their request/response contracts; add HTTP
clients only if the application actually needs them.

## Responsibilities

- Hide transport names, payload encoding, response decoding, and transport errors
  behind a small typed interface.
- Define the data contracts used at the desktop/backend seam.
- Keep transport operations separate from React rendering and application-state policy.

## Callers and dependencies

- Stores are the application callers of runtime API operations. UI changes go through
  store actions rather than invoking the desktop/backend directly.
- Other layers may use type-only contracts where their rules permit them; `kit/`
  must stay independent of this folder, including API types.
- Do not import stores, organisms, pages, or routing back into this layer.
- Do not own React state, optimistic updates, or cache lifetime here; those belong
  to the store coordinating the operation.

This folder does not add an SDK, command implementation, or network connection.
The current `api-imports-*` rules cover selected caller paths and aliases, not every
possible import. See the [source overview](../README.md) for that limitation.
