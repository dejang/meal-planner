# Frontend source layout

- `App.tsx`: composition root, scoped providers, desktop menu, dialogs and planner split.
- `main.tsx`: React bootstrap and global styles.
- `features/<name>/`: gallery, planner, editor, shopping, import and settings UI.
  Each feature owns its styles inside its own directory.
- `components/`: shared, props-driven controls and presentation (no application stores).
- `mobile/`: mobile-specific composition when needed, with the same boundaries as features.
- `theme/`: bundled legacy fonts, CSS palette and typography.
- `stores/`: bonsai state, public selector/action hooks, persistence orchestration.
- `stores/core/`: private shared store machinery.
- `api/`: generated Rust contracts and typed desktop command adapters.
- `lib/`: shared non-UI behavior, including recipe drag data and image URL formatting.
- `test-support/`: shared test fixtures and harnesses.

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
props or injected configuration, not module-level literal constants in `components/`,
`stores/`, `features/`, or `mobile/`.
`AppConfig` is a name used by the rules, not an existing utility. Define it when
needed; do not assume it can be imported.
Keep hooks unconditional and before early returns.
Use the `@/` alias for all local imports, re-exports, test mocks and CSS assets,
including imports within the same directory. TypeScript and Vite/Vitest resolve
`@/` to `ui/src/`; dependency imports keep their package names.

Tests are colocated with the module they exercise and follow its layer rules;
there are no test-file exclusions. Feature and store tests configure typed command
mocks through `@/test-support/ipc` and mount real scopes with `AppScopes` from
`@/test-support/scopes`. UI tests do not import runtime API values directly.
The comment ban applies to TS/TSX source, not to these Markdown documents.

Run `pnpm run check:fast` from the repository root for Rust and UI checks without a
full desktop build. `./check.sh` also runs AST tests/scanning and full builds.
For a single file's formatted output, run
`cd ui && pnpm run --silent format:stdout src/path/file.tsx`.

The shell tests mock feature entry points so feature implementations can evolve
without changing shell tests or calling IPC in them.

## Enforcement status

AST rules cover components, features, mobile composition and stores. Path-style rules
reject relative module and CSS asset paths; layer rules check aliased imports.
Components cannot import stores or routing;
features and mobile composition may use them. Runtime API imports belong in stores;
other UI layers may import API types only. The shell performs desktop window actions.
