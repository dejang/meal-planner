# Frontend

The React UI of the Tauri app.

- `features/`: desktop screens and dialogs, each with its own styles.
- `mobile/`: the mobile presentation of the same workflows.
- `components/`: shared presentation driven by props.
- `stores/`: application state, actions and all backend calls.
- `api/`: generated backend contracts and typed command calls.
- `lib/`: small non-UI helpers.
- `theme/`: fonts, design tokens and shared styles.
- `test-support/`: the shared test harness.

Dependencies point one way. Features and mobile screens use stores and components.
Components get data through props and never import stores. Only stores call the API at
runtime. The API imports nothing from the UI. ast-grep enforces these boundaries.

Tests sit next to the code they test. Run `pnpm run check:fast` from the repository
root, or `./check.sh` for the full check.
