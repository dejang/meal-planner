# Library: focused non-UI modules

Put reusable non-UI behavior here only when it has a clear responsibility and does not
belong to a feature store or the API adapter. Examples include pure formatting or parsing
modules used by multiple callers. Avoid a catch-all collection of store-state helpers.

## Responsibilities

- Give each module a focused interface with explicit inputs and outputs.
- Keep utilities independent of React, stores, components and features.
- `imageUrl.ts` formats versioned image URLs using Tauri's file-source conversion.
- Keep feature state transitions in stores and desktop/backend calls in `api/`.

Do not create connections at import time or add placeholder transport before it is needed.
Stores coordinate subscriptions and their cleanup. See the [source overview](../README.md).
