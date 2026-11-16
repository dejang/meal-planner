# Frontend source layout

- `App.tsx`: composition root, scoped providers, desktop menu, dialogs and planner split.
- `main.tsx`: React bootstrap and global styles.
- `features/<name>/`: gallery, planner, editor, shopping, import and settings UI.
  Each feature owns its styles inside its own directory.
- `components/`: shared, props-driven controls and presentation (no application stores).
- `theme/`: bundled legacy fonts, CSS palette and typography.
- `stores/`: bonsai state, public selector/action hooks, persistence orchestration.
- `stores/core/`: private shared store machinery.
- `api/`: generated Rust contracts and typed desktop command adapters.
- `lib/`: shared non-UI contracts, including recipe drag data.

The `kit/`, `organisms/` and `pages/` folders remain reserved for the corresponding
architecture layers. Shared presentation lives in `components/` and feature
composition lives in `features/`.

## Dependency direction

Features compose shared components and use public store hooks. Stores own state
transitions and runtime API calls. Shared presentation receives data and callbacks
through props; it does not import application stores. The shell performs the desktop
window close action. API modules must not import UI or stores.

Use interfaces for object shapes and regular string enums for closed choices.
Keep store instances private; selectors must return stable stored values. Constructors
must not subscribe. Scope effects own external connection and cleanup. See
[stores/README.md](stores/README.md) for the final state/action and reload contracts.

## Shared conventions

Keep source free of comments and lint suppressions. Behavioral values belong in
props or injected configuration, not module-level literal constants in `kit/`,
`stores/`, `organisms/`, or `pages/`.

`AppConfig` and `Keys<...>` are names referenced by the rules, not existing utilities.
Define them when their first implementation is needed; do not assume they can be imported.
Keep hooks unconditional and before early returns.

Tests are colocated with the module they exercise. Tests inside these folders are also
subject to the applicable rules; there are no general test-file exclusions.
The comment ban applies to TS/TSX source, not to these Markdown documents.

Run `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`
and `pnpm run format:check` from `ui/`, and run
`ast-grep scan` from the repository root.

The shell tests mock feature entry points so feature implementations can evolve
without changing shell tests or calling IPC in them.

## Enforcement status

The folder responsibilities describe the intended design, not complete static enforcement.
Several import rules recognize only `@/...`, but that alias is not configured in
TypeScript or Vite yet. Relative imports still need to respect the same ownership rules.
Creating these folders does not fix the alias gap or broaden file-specific rule filters.
