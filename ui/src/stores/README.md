# Stores: application state and actions

Each feature owns its store file and `features/<name>/` folder. Keep feature CSS in
that folder and import it from the feature entry point. `style.css` owns only shell
layout; `theme/` and `components/` own shared presentation.

## Bonsai pattern

Private classes extend `bonsai-react`'s `Store<State>`. Each scope constructs one
instance with lazy `useState`. Named public hooks select state, and `use*Actions`
hooks expose stable, receiver-safe command objects. UI never receives raw stores.
Shared provider machinery lives in `core/context.tsx`; selectors live in store files.

Each named selector hook uses `context.useScopedHook` to memoize a bonsai hook factory
on the scoped store, then invokes the returned hook. For example:
`return context.useScopedHook((store) => createSelectorHook(store, (state) => state.draft))();`
Keep the selector inline as the second argument of `createSelectorHook`. Selectors must
return primitives or stable stored references, not freshly allocated arrays or objects.
For keyed entities, use `createKeyedSelectorHook` inside `useScopedHook` and invoke the
returned hook with the key (see `useRecipe`) so subscriptions follow key changes.
Do not export generic caller-supplied selectors.
Constructors initialize state only. Scopes own external subscriptions in effects,
with cleanup for StrictMode remounts; feature effects request initial reloads as needed.

## Public interface and implementation rules

- Export `*Scope` provider functions and named `use*` hook functions, plus the
  interfaces, types, and enums callers need.
- Use function declarations for exported scopes and hooks, not exported arrow values.
- Keep store classes, instances, React contexts, and raw getters private.
- Expose useful actions and selections rather than making callers manipulate state.
- Call `api/` and, when needed, `lib/live.ts` here. UI callers use store hooks instead
  of performing persistence or transport work themselves.
- Keep logic that reads or writes store state on the owning store, not in module-level
  helpers taking a store or its state as an argument.
- Receive configuration rather than declaring module-level literal constants.
- Do not import routing or screen UI into stores.

Shared implementation machinery belongs in [`core/`](core/README.md), not in a second
public route to the store's state. Add abstractions only when an implementation needs them.

Relevant rules: `store-exports-*`, `store-helper-*`, `selector-fresh-value-*`,
`listen-in-constructor-*`, `module-const-*`, `router-imports-*`, and the
[shared conventions](../README.md).

## Contract ownership

Read the TypeScript modules for current state types, action signatures, and named hooks:
[PlanStore](PlanStore.tsx), [RecipesStore](RecipesStore.tsx),
[EditorStore](EditorStore.tsx), [ImportStore](ImportStore.tsx), and
[SettingsStore](SettingsStore.tsx). Do not maintain a second signature inventory here.
Loading and operation errors belong to the store performing the operation; never put
IPC orchestration in UI. Backend search stays in Rust, not a duplicate JS filter.

Link/opener failures are independent of form or operation failures. Reuse
[`core/openSite.ts`](core/openSite.ts) and render the separate link error: retrying a
link must not clear an import, credential-load, or save error.

The editor is open exactly when its draft is non-null, without a second visibility flag.
Closing saves it, except for new drafts with a blank title, which are discarded.
Failed saves leave it open. The draft owns image field text; completed loads must not
replace text typed in the meantime. Choosing a file writes its path, removing a photo
clears the field, and loaded-source deduplication stays private to the editor.

Shopping and settings visibility belongs to the shell. Shopping reloads the plan when
opened; the plan refreshes shopping projections after mutations even while shopping
remains open. Editor and shopping own their window header/content and footer;
the import/settings shell frames supply their headers.

Settings reloads on open, discarding unsaved edits. Its editable credentials are separate
from the first successful startup snapshot used by Welcome. Welcome owns session-only
dismissal. Distinguish load failures from save failures so retry loading does not discard
edits after a failed save.

## Dependency and reload graph

Scopes nest Plan → Recipes → Editor → Import; Settings is independent. Provider
construction injects stable peer actions into private store constructors. Commands
are stable arrow functions on `actions`, so passing them as callbacks preserves receivers.

- Recipe deletion refreshes recipes and plan, and clears stale selection. Rust prunes
  deleted recipe references from the plan.
- Recipe save refreshes recipes and plan, then closes the draft.
- Plan persistence is serialized. Mutations store the returned plan and independently
  refresh day totals and shopping projections.
- Import checks for editor conflicts before requesting data and again before opening
  the imported draft. Opening it automatically starts ingredient analysis; saving waits
  for analysis. Import alone does not persist a recipe.
- Credential save refreshes persisted credentials, not recipes or plan.
- Analysis and image loading change only the draft; peers refresh after save.

Tests should mount real scopes with [`AppScopes`](../test-support/scopes.tsx) and mock
IPC/plugins through [`test-support/ipc.ts`](../test-support/ipc.ts), rather than
hand-writing peer action objects that break when stores grow.

## Drag and drop

The shell owns one dnd-kit context with PointerSensor (6px activation distance),
KeyboardSensor and `pointerWithin` collision detection, excluding pointer hits
outside any scroll ancestor's visible bounds. It falls back to `rectIntersection`
for keyboard drags without pointer coordinates. A card remains clickable until
movement crosses the threshold. Enter/Space on the drag activator starts a keyboard
drag. Cards that also open with Enter/Space must put drag listeners on a separate
handle using `setActivatorNodeRef`. Use `useDraggable`/`useDroppable` in features,
and `useDndMonitor` in the planner for drop handling without editing App.tsx.
`lib/recipeDrag.ts` defines draggable data: recipe ID plus position (null from the
gallery; day/row from the planner). PlanStore owns gallery additions, plan moves,
same-day row shifts and no-op drops. Days and rows are zero-based Rust positions.

Day totals are the API's `AnalysisResponse`, not a separate wire shape. Render them
with `NutritionLabel analysis={totals}` (one serving, Amount per day). For recipes pass
servings and servingsLabel explicitly.
