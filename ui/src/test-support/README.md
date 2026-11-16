# Scoped UI tests

Import `commands` and `ok` from `@/test-support/ipc` to configure typed command mocks.
This shared harness mocks `api.commands`, `lib/imageUrl`, the file-dialog plugin and
the opener plugin. Import it before stores or features so mocks are installed before
those modules load. The real API exports, including `unwrap`, remain intact.
Import `AppScopes` from `@/test-support/scopes` as the testing-library wrapper to
mount real Plan → Recipes → Editor → Import → Settings providers. The wrapper does
not initiate reloads: exercise store actions or mount the feature that owns the effect.
Do not mock `use*Actions()` with partial hand-written objects.

```tsx
import { commands, ok } from "@/test-support/ipc";
import { AppScopes } from "@/test-support/scopes";

vi.mocked(commands.listRecipes).mockResolvedValue(ok([recipe()]));
const { result } = renderHook(
  () => ({ actions: useRecipesActions(), ids: useRecipesVisibleIds() }),
  { wrapper: AppScopes },
);
await act(() => result.current.actions.reload());
expect(result.current.ids).toEqual(["recipe-1"]);
```

Use these imports alongside the test's normal Vitest, testing-library, fixture and
store-hook imports. Configure overrides inside tests or a local `beforeEach` after
importing the helper. Every test resets command/plugin mocks and reinstalls defaults:
empty recipe list, empty six-day plan/shopping, fixture recipe and analysis responses,
empty credentials/sites, successful credential save/opener and canceled file dialog.
Other commands throw an “Unexpected IPC command” error until explicitly configured;
new generated commands are mocked automatically but have no implicit success result.
There is no in-memory fake backend: configure each mutation's returned persisted data.

Generated typed commands resolve `ok(data)` or `{ status: "error", error: ... }`.
Use rejected promises for transport exceptions (`Error`), not typed backend errors.
`supportedSites` is the generated exception: it resolves a plain array, not `ok(array)`.
Use the existing `@/test-support/fixtures` factories and `deferred` for pending operations.
Override `open` / `openUrl` with `vi.mocked` for plugin failure or selection scenarios.
`editor.tsx` provides the common editor snapshot hook and installs this same IPC setup.

Keep mock configuration local to the test instead of calling `vi.resetAllMocks()`:
that removes the harness defaults too. Each render creates fresh scoped stores.
Assert rendered state, store selections and command arguments rather than store class
internals. Future actions on a real store then require no unrelated test mock updates.
