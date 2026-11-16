# Mobile implementation specification

This is the on-disk implementation brief for the F-355 mobile epic, F-356–F-366,
including Sketch Board 12, “iOS & Mobile UI — Meal Planner” (revision 19).
Agents must be able to implement the mobile waves without parent-ticket or board access.
The binding codebase overrides below take precedence over conflicting ticket examples.
This document specifies the target; these folders and stores are not all implemented yet.

## Architecture and target layout

Mobile is another presentation of the existing recipe, editor, import, plan, shopping,
and credential workflows, not another persistence layer. Preserve desktop behavior.
Reuse the existing API, scoped bonsai stores, shared controls, `RecipePhoto`, and
`NutritionLabel`. Do not duplicate backend operations or nutrition calculations in UI.

```text
ui/src/
  components/mobile/       shared props-driven mobile controls and drawer primitives
  stores/DrawerStore.tsx    mobile drawer visibility/mode/selection orchestration
  mobile/
    MobileShell.tsx         mobile navigation, screen composition, drawer and shell alerts
    explorer/              searchable two-column recipe gallery
    drawer/                one recipe drawer, view/edit/create and URL import
    planner/               six-day swipeable planner and daily nutrition
    shopping/              mobile shopping presentation using PlanStore projections
    settings/              mobile credentials presentation using SettingsStore
```

Shared components receive props and callbacks; they do not import application stores.
Mobile feature composition consumes named store hooks. `DrawerStore` owns mobile drawer
state; recipe drafts and persistence remain in `EditorStore`, imports in `ImportStore`,
and plan mutations/totals/shopping in `PlanStore`. Extend those owners rather than
adding parallel state or transport calls. Follow `../stores/README.md` for encapsulation,
selectors and reload responsibilities. Nest Plan → Recipes → Editor → Import, with
Settings independent; mount the drawer where its consumed peer scopes are available.

The shell switches between Explorer, Weekly Plan, and Shop; Settings must also be
reachable. Explorer and planned-meal taps open the exact same drawer in view mode.
Edit and Create use that drawer in place, not separate pages or a second modal editor.
Mobile adaptation must accommodate safe areas, narrow widths, touch interaction,
scrolling content and the on-screen keyboard. Keep the desktop shell intact when
selecting the mobile presentation; test viewport selection using mocked `matchMedia`.

## Visual baseline from Sketch Board 12

Reference frames are 390 × 800, not fixed runtime dimensions. Use responsive width and
scrolling rather than clipping content to the sketch. The gallery and planner use a
paper background with forest-green headers/outlines, cream cards, muted green photo
placeholders, and lime highlights for active actions. Reuse existing theme tokens and
legacy typography instead of a new palette. The sketch includes a 28px system-status
area: respect the platform safe area, do not render fake “9:41 / 5G / 100%” text.

At the reference width, outer content gutters are 16px and most controls are 44px or
more tall. Drawer content is full width with inset sections and a sticky header.
Keep controls keyboard accessible, labeled, and usable without swipe-only navigation.
Loading, empty, operation-error and retry states must remain visible for real store flows.
The sketch's food names and nutrient numbers are examples, not data to hardcode.

## Frame 1A — Meal Explorer (F-360)

- Header: “Meal Explorer” and a “+ New” action entering the drawer's Create mode.
- Full-width “Search recipes…” input below the header, with a clear action.
  Use RecipesStore's query/search flow; do not reimplement backend search.
- A vertically scrolling **two-column** photo gallery. At 390px, cards are about
  172px wide with a 14px column gap; the first row is about 224px high.
- Each card shows a large dish photo, then **only title, per-portion calories and
  portion count**. No ingredient list, long instructions or full nutrition card here.
- Board examples: Lemon Herb Salmon (480 kcal, 2 portions), Chickpea Curry
  (410 kcal, 4 portions), Oatmeal & Berries (320 kcal, 1 portion), Basil Pesto Pasta
  (540 kcal, 4 portions); Roast Chicken and Greek Salad continue below the fold.
- Tapping a card opens frame 1B in View mode over the dimmed explorer. Use the shared
  recipe image behavior and represent unavailable images/analysis without inventing data.

## Frames 1B / 1C — Recipe Bottom Drawer (F-361)

These are two scroll positions of **one drawer**, not two routes. Frame 1B begins
roughly 105px below the app header and occupies the remaining screen. Frame 1C shows
its scrolled content with the title/Close header still accessible.

1. Header with recipe title (“Chickpea Spinach Curry” in the board), Edit action,
   and a reachable Close action; keep title/close available while scrolling.
2. Wide dish picture (about 358 × 140 at the reference width).
3. Highlighted metadata: “410 kcal per portion · 4 portions” in the example.
4. **Add to Plan:** six pills labeled `[D1] [D2] [D3] [D4] [D5] [D6]`.
   Tapping a pill adds the viewed recipe to that day through PlanStore; the board
   highlights `D2 +`. User labels are one-based; backend day/row positions are zero-based.
   Use the current day's meal count for an append position rather than overwriting a meal.
5. Ingredients section with a count and individual rows. Example five rows:
   chickpeas 400g, baby spinach 200g, coconut milk 200ml, garam masala 1 tbsp,
   minced garlic 2 cloves. Render actual recipe data rather than parsing new wire types
   just to reproduce the example's alignment.
6. Cooking Instructions section with visibly numbered steps. Example sequence:
   warm oil and cook garlic/spices; stir in chickpeas and coconut milk and simmer;
   fold in spinach and season. Preserve recipe instruction content, including source URLs.
7. Reused USDA-style **`NutritionLabel`**, scaled per portion using the recipe's servings.
   Include calories, macro/sub-nutrient rows and expandable Vitamins & Minerals.
   The board's example has 410 kcal, fat 14g, carbs 48g, protein 18g, saturated fat 9g,
   fiber 11g and sodium 340mg. These are illustrative; the existing label owns nutrient
   selection, rounding and daily-value rendering, not a new hand-written mobile summary.

Planned-meal taps from frame 2 open this exact drawer too. View mode must not create
an editable draft just to display a recipe; draft transitions belong to the editor flow.

## Frame 2 — Weekly Planner (F-362)

- One day fills the view; swipe horizontally through **six** days, not seven.
- Header has previous/next navigation, “Day 2” in the example, Copy Prev and Clear.
  Show a six-position day indicator with the active day identified. Navigation buttons
  provide a non-gesture alternative; do not navigate beyond the first/last day.
- Each planned meal is a compact row: photo, title, per-portion kcal, and a distinct
  remove action (`×`). Removing must not also open the recipe. Tapping the rest of
  the row opens the same View drawer as Explorer.
- Example Day 2 rows are Oatmeal & Berries (320 kcal), Chickpea Curry (410 kcal),
  and Lemon Herb Salmon (480 kcal).
- Under the meal rows, show the reused USDA `NutritionLabel` for the **day total**,
  not divided by any recipe's servings. Use PlanStore's `AnalysisResponse` projection
  with the label's one-serving daily presentation (“Amount per day”).
- Example total: 1,210 kcal; fat 42g, saturated fat 12g, trans fat 0g,
  carbohydrates 118g, fiber 19g, sugars 14g, protein 74g, sodium 890mg, plus the
  same expandable Vitamins & Minerals section. Do not hardcode the board's DV text.
- Bottom navigation: Explorer / Weekly Plan (active here) / Shop. It must not cover
  the nutrition card or scrollable content.
- Copy Previous, Clear and Remove call existing PlanStore actions. Keep serialized
  persistence and refresh of both nutrition and shopping projections in that store.

## Frame 3 — In-place Edit / Create and URL Import (F-361)

The same bottom drawer changes mode. Keep the background dimmed and the body scrollable.
The board's order, top to bottom:

1. Sticky header: Cancel / Edit or New Recipe / Save.
2. Inline “Import URL” input and Import button; no separate full-screen importer.
3. Dish-picture editor: choose a local photo or enter an image URL.
4. Title input.
5. Portions decrement / current value / increment; Delete for an existing recipe.
6. Ingredients textarea, triggering ingredient analysis on blur.
7. Cooking Instructions textarea.
8. Live USDA `NutritionLabel` preview using the current draft analysis and servings.

Reuse EditorStore's patch/save/image/analysis workflows and RecipesStore's deletion
flow. Keep saving/analyzing/loading-image guards and errors visible. Do not bypass
conflict checks to replace an unsaved draft during URL import. Cancel/close semantics
must respect the editor's existing save-on-close and failed-save retention contract;
a button label alone is not permission to silently discard a draft.

URL import goes through ImportStore and `EditorStore.openImported`. The imported draft
includes source provenance and **automatically starts `analyzeIngredients()`**. Saving
waits for that work. Do not replace this with a mobile-only draft construction path or
an extra analysis call. Preserve supported-site links and their independent `linkError`
handling via `stores/core/openSite.ts`; link retry must not clear form/import errors.

## Shopping and settings

Shop presents the existing shopping projection, reloading when opened and remaining
current after plan changes. Settings reuses the credential load/edit/save flow, separates
link errors, and preserves Welcome's first-successful-load snapshot/session dismissal.
Neither has a detailed frame on Board 12: reuse the desktop behavior in mobile layout,
not invented backend contracts. Both belong to the target layout above.

## Binding overrides for F-356–F-366

1. **F-359 DrawerStore:** use a regular string enum, exactly:

   ```tsx
   enum DrawerMode {
     View = "view",
     Edit = "edit",
     Create = "create",
   }
   ```

   Export it when consumed by UI. Never use `"view" | "edit" | "create"` as a
   string-literal union: that violates `string-union-type-tsx`.

2. **F-360 Explorer, F-361 Drawer, F-362 Planner:** calculate per-portion calories
   with `caloriesPerServing(calories, servings)` from `ui/src/lib/nutrition.ts`.
   Never use `Math.round(calories / servings)`. The helper owns nonnegative calories,
   floor rounding and the safe integer servings divisor. Reuse `NutritionLabel` for
   detailed recipe/daily nutrition; do not duplicate its calculations.

3. **F-359 MobileShell:** select `useEditorError()` and `useEditorOpen()` and render
   closed-drawer errors with `role="alert"` and a Dismiss action calling
   `dismissError()`, just like desktop `App.tsx`. A failed recipe load without an open
   draft must not disappear because the drawer is closed. **F-361 URL import** must
   preserve `openImported`'s automatic ingredient analysis and separate `linkError`
   handling described above.

4. **F-356 and F-366 headless verification:** Linux unit agents verify
   `cargo test --workspace`, `bindings_are_current`, TypeScript (`tsc`), ESLint,
   Vitest, the UI production build, and viewport-mocked `matchMedia` / component
   tests. Do not block completion on macOS Xcode, `cargo tauri ios build`, an iOS
   simulator, or interactive GUI display checks unavailable on headless Linux.
   Report platform checks not run honestly; do not claim an iOS build was verified.

## Wave delivery and verification

Wave 0 establishes platform/responsive and shared mobile foundations; subsequent
waves compose the shell/drawer/store and screens, then integrate and verify them.
These are dependencies, not permission to implement adjacent tickets early. F-359
owns shell/drawer state; F-360 Explorer, F-361 recipe drawer and F-362 planner share
the existing store contracts and the primitives in `components/mobile/`.
Do not append exact method/state inventories to the central stores README as waves land.

Import `commands` and `ok` from `@/test-support/ipc` and `AppScopes` from
`@/test-support/scopes` for feature/store tests, not runtime values from `@/api`.
Override typed command results (`ok(data)` or a typed error result) and plugin boundaries, not
hand-written `use*Actions()` object literals. Test rendered states, navigation,
drawer transitions, plan updates and errors through real scopes. Parameterize input
variations rather than repeating tests for the same path.

From the repository root the intended checks are:

```sh
cargo test --workspace
ast-grep scan
cd ui
pnpm run bindings:check
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run format:check
pnpm run build
```

`pnpm --dir ui build` is equivalent to the last command.
Add viewport-mocked component tests for mobile selection and interaction without
requiring a real display. Keep existing desktop tests passing as mobile waves land.
