# Frontend source layout

These folders reserve the ownership areas described by the TS/TSX rules in
[`.ast-grep/rules`](../../.ast-grep/rules). They are documentation-only scaffolding;
no stores, transport, router, or shared configuration are implemented yet.

## Where code belongs

- [`kit/`](kit/README.md): reusable, props-driven UI with no application state access.
- [`organisms/`](organisms/README.md): meal-planning UI that connects store hooks to kit UI.
- [`pages/`](pages/README.md): screens that compose organisms and handle route-level concerns.
- [`stores/`](stores/README.md): application state, actions, persistence orchestration,
  scope providers, and public hooks.
- [`stores/core/`](stores/core/README.md): internal store machinery shared by stores.
- [`api/`](api/README.md): typed calls across the desktop/backend seam and their data contracts.
- [`lib/`](lib/README.md): focused, reusable non-UI modules and low-level live transport.
- [`theme/`](theme/README.md): visual tokens, shared styles, and theme definitions.

Keep `main.tsx` as the React bootstrap. Keep `App.tsx` as the application composition
root for providers, store scopes, and eventual routing. The existing `style.css`
remains the global stylesheet until theme styles are introduced.

## Intended dependency direction

Screens compose organisms and kit UI. Organisms read state and invoke actions through
public store hooks. Stores own state transitions and call the API and live transport.
Kit UI receives data and callbacks through props rather than importing application state.
Do not expose store instances or transport details to UI callers.

## Shared conventions

- Use TypeScript `interface` declarations for object shapes and regular string enums
  for closed string choices, following the existing rules.
- In `kit/`, `stores/`, `organisms/`, and `pages/`, supply behavioral values through
  props or injected configuration rather than module-level literal constants.
- `AppConfig` and `Keys<...>` are names referenced by the rules, not existing utilities.
  Define them when their first implementation is needed; do not assume they can be imported.
- Keep hooks unconditional and before early returns. Constructors must not subscribe
  to external events; store scopes manage connection and cleanup through effects.
- Colocate tests with the module they exercise. Tests inside these folders are also
  subject to the applicable rules; there are no general test-file exclusions.
- Keep source code self-explanatory: the current comment ban applies to TS/TSX source,
  not to these Markdown documents.

## Enforcement status

The folder responsibilities describe the intended design, not complete static enforcement.
Several import rules recognize only `@/...`, but that alias is not configured in
TypeScript or Vite yet. Relative imports still need to respect the same ownership rules.
Creating these folders does not fix the alias gap or broaden file-specific rule filters.

Run `ast-grep scan --filter='-tsx?$'` from the repository root to check frontend rules.
