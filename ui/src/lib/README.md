# Library: focused non-UI modules

Put reusable non-UI behavior here only when it has a clear responsibility and does not
belong to a feature store or the API adapter. Examples include pure formatting or parsing
modules used by multiple callers. Avoid a catch-all collection of store-state helpers.

## Responsibilities

- Give each module a focused interface with explicit inputs and outputs.
- Keep pure utilities independent of React, stores, pages, and organisms.
- Keep feature state transitions in stores and desktop/backend calls in `api/`.

## Reserved live transport

The rules explicitly reference `ui/src/lib/live.ts`. If live updates are introduced,
put the low-level socket or desktop-event connection there, with explicit connection,
subscription, and cleanup operations. It is a file, not a `lib/live/` directory.

Only store implementations should consume live transport. The transport must not
import stores, routing, or runtime API values; stores coordinate those dependencies.
Do not create a connection at import time or add a placeholder transport before it is needed.

The current rules single out `live.ts`; other files here are not automatically covered
by the same import and style filters. Follow the intended ownership rules regardless.
See the [source overview](../README.md).
