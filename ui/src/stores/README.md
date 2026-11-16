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
The shell uses `useEditorOpen()` and `useImportOpen()`; features use named field hooks
such as `useRecipesVisibleIds()`, `useRecipe(id)` and `usePlanShoppingItems()`.
Constructors initialize state only. Feature scopes should perform initial reloads
and manage external subscriptions in effects, with cleanup for StrictMode remounts.

## Public interface and implementation rules

- Export `*Scope` provider functions and `use*` hook functions, plus the interfaces,
  types, and enums callers need.
- Use function declarations for exported scopes and hooks: the export rule rejects
  `export const useSomething = ...` even when the value is a function.
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

## Final contracts and remaining TODOs

PlanStore implements serialized persistence and independent projection refreshes through IPC.
RecipesStore persistence actions are implemented over IPC using `listRecipes`,
`searchRecipes`, and `deleteRecipe`.
SettingsStore.reload reads credentials and save persists them, then refreshes the
stored values. Editor persistence, image loading and ingredient analysis are implemented.
Remaining persistence actions are placeholders for their owning feature tickets; preserve
their names and state shapes. Loading and error fields belong to the store performing the
operation; never put IPC orchestration in UI.

| Store         | State                                                                            | Actions and backend responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RecipesStore  | recipes by ID, visibleIds, query, selectedId, loading, error                     | `reload()` lists recipes and reapplies the current query; `setQuery(query)` asynchronously calls `searchRecipes` and stores the ordered result IDs; `select(id)` changes selection; `deleteRecipe(id)` deletes and refreshes caches; `retry()` re-runs the last failed operation (reload/search, or the failed delete). Do not reimplement backend search in JS.                                                                                                                                                                                                                              |
| PlanStore     | plan (six days), dayTotals (six analyses or null), shoppingItems, loading, error | `reload()` loads `getPlan`, `dayTotals` for every day and `shoppingList`. `addToDay(position, recipeId)`, `moveMeal(from, to)`, `removeFromDay(position)`, `clearDay(day)`, `copyPreviousDay(day)` persist mutations and refresh totals/shopping after storing the returned plan. `dropRecipe(payload, target)` handles gallery additions and plan moves, including same-day row shifts and no-op drops.                                                                                                                                                                                      |
| EditorStore   | draft or null, saving, analyzing, loadingImage, error                            | `reload()` refreshes the persisted open draft (no-op for a new draft); `openNew()`, `openRecipe(id)` (getRecipe), `assertCanImport()`, `openImported(recipe, sourceUrl)`, `close()`, `patchDraft(patch)`, `save()` (create/update), `analyzeIngredients()`, `chooseImageFile()` (opens the dialog plugin with image filters, then runs `loadImageFile`), `loadImageFile(path)`, `loadImageUrl(url)`, `setImageSource(text)` (edits the image field without loading). Draft includes nullable ID, imageVersion and imageSource plus RecipeInput. Use patchDraft for image removal/replacement. |
| ImportStore   | open, url, supportedSites, importing, error                                      | `reload()` loads supportedSites; `open()`, `close()`, `setUrl(url)`, `importRecipe()` imports into the editor; `openSite(url)` opens a supported-site link in the browser through the opener plugin.                                                                                                                                                                                                                                                                                                                                                                                          |
| SettingsStore | credentials, startupCredentials, loadFailed, loading, saving, error, linkError   | `reload()` reads credentials; `setCredentials(credentials)` edits locally; `save()` persists credentials; `openSite(url)` opens the Edamam link through the opener plugin.                                                                                                                                                                                                                                                                                                                                                                                                                    |

`useDraftRecipe()` selects the React-only editor draft. Closing saves it, except for
new drafts with a blank title, which are discarded. Failed saves leave the draft open.
`draft.imageSource` owns the image field text. Starting a load sets the source;
finishing a load never changes text typed in the meantime. Choosing a file writes
its path, and removing a photo clears the field. Loaded-source deduplication is private.
`EditorStore` is open exactly when `draft !== null`; it has no second visibility flag.
Shopping and settings visibility belongs to the shell. Shopping receives `onClose`;
its feature calls PlanStore.reload when opened and selects shoppingItems. PlanStore
refreshes that projection after plan changes even if shopping remains open. Editor and shopping own their window header/content and footer.
The import/settings shell frames supply their headers.

Settings reloads on open, discarding unsaved edits. `credentials` is the editable
draft; `startupCredentials` captures only the first successful load and remains null
until then. Welcome uses that startup snapshot, not edits or subsequent reloads, and
owns its session-only dismissal. `loadFailed` distinguishes load errors from save
errors so retry loading never discards edits after a failed save.

## Dependency and reload graph

Scopes nest Plan → Recipes → Editor → Import; Settings is independent. Provider
construction injects stable peer actions into private store constructors now, so
feature tickets do not need to change the shell or core context to wire peers.

| Successful change                | Owning store's responsibility                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delete recipe                    | RecipesStore reloads itself and its injected PlanStore (deleted references are pruned by Rust). Clear stale selectedId.                                                                                     |
| Save recipe                      | EditorStore reloads injected RecipesStore and PlanStore, then closes its draft.                                                                                                                             |
| Plan mutation                    | PlanStore updates/reloads the plan and recalculates day totals and shoppingItems.                                                                                                                           |
| Import recipe                    | ImportStore checks EditorStore.assertCanImport(), then calls openImported(result, sourceUrl) and closes. The editor rechecks for conflicts before creating a draft; import alone does not persist a recipe. |
| Save credentials                 | SettingsStore refreshes persisted credentials. No recipe/plan reload.                                                                                                                                       |
| Analyze ingredients / load image | EditorStore changes only its draft; other stores reload after save.                                                                                                                                         |

The peer actions are available as `this.plan`, `this.recipes`, and `this.editor` in
the respective private classes. Commands are stable arrow functions on `actions`,
so passing `onClick={actions.close}` preserves the receiver. Keep new commands in
that same form. Async TODO parameters use `_` prefixes until implemented.

## Drag and drop

The shell owns one dnd-kit context with PointerSensor (6px activation distance),
KeyboardSensor and `pointerWithin` collision detection, excluding pointer hits
outside any scroll ancestor's visible bounds. It falls back to `rectIntersection`
for keyboard drags without pointer coordinates. A card remains
clickable until movement crosses the threshold. Enter/Space on the drag activator
starts a keyboard drag. Cards that also open with Enter/Space must put drag listeners
on a separate handle using `setActivatorNodeRef`. Use `useDraggable`/`useDroppable` in
features, and `useDndMonitor` in the planner for drop handling without editing App.tsx.
`lib/recipeDrag.ts` defines `RecipeDragPayload` for draggable data: recipeId plus
position (`null` from the gallery; day/row from the planner). PlanStore's `dropRecipe(payload, target)` handles gallery additions, plan moves,
same-day row shifts and no-op drops. Days and rows are zero-based Rust positions.

Day totals are the API's `AnalysisResponse`, not a separate wire shape. Render them
with `NutritionLabel analysis={totals}` (one serving, Amount per day). For recipes pass
servings and servingsLabel explicitly.
