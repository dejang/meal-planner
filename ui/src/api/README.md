# API

Typed calls across the desktop/backend boundary and the generated contracts they use.
`bindings.ts` is generated from the Rust commands; do not edit it by hand. After changing
a command or a boundary type, run `pnpm run bindings:generate` in `ui`; the Rust tests fail
while it is stale.

Only stores call the API at runtime; other UI code imports its types only. The API does
not import UI code or stores and holds no application state.
