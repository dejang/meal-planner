# Theme

`index.css` owns the legacy paper/botanical palette, typography tokens and shared
component styles. `fonts.css` declares every font bundled under legacy's theme,
including Lucide. Font assets and editorial licenses are copied without changes.
`main.tsx` imports this theme before shell layout in `style.css`.

The desktop scale matches legacy: Geist body 17px, heading 22px semibold, small
14px, button 15px, smallish 16px, recipe title 24px and Caveat handwriting 32px.
Recipe Display/Text, Helvetica, Inter and all Geist weights are also available via
font-face declarations. Use the CSS variables and typography classes instead of
repeating visual values in features. Use `.surface-frame` for shared card/panel
surfaces and `--card-shadow` when only the shadow is needed. Use `.popup-frame`
for shared popup frames and left-aligned quiet button items with sage hover fills.
Use `.on-forest` on forest surfaces for contrasting buttons, focus outlines and popups.

## Mobile foundations

`index.css` also imports `mobile.css`. Its tokens and explicit utility classes are
available everywhere. Put `.mobile-theme` on the mobile shell (and on any separately
portaled mobile overlay) to opt into touch controls, selection policy and motion.
Desktop controls retain their existing sizing, typography and interaction styles.
This is a presentation scope, not a viewport detector; shell selection belongs to
application composition. No mobile layout or drawer state lives in the theme.

### Surfaces and geometry

- Keep `--paper` for the canvas and `--surface` for cream cards. Use
  `--surface-elevated` for raised overlays, `--scrim` for the dimmed backdrop,
  `--drawer-shadow` for drawers and `--card-press-shadow` for pressed cards.
- `--hairline` and `--hairline-color` provide quiet dividers (0.5px at 2dppx or
  higher, otherwise 1px). Add `.mobile-card` to `.surface-frame` for a hairline border;
  the shared frame owns the surface, radius and shadow.
- `--touch-min` is 44px. Mobile buttons (including `.button` disclosures), form
  controls and `.mobile-touch-target` get minimum height; buttons, `.button` and
  explicit touch targets also get minimum width. Summary button labels are vertically
  centered. Give non-button interactive elements proper keyboard behavior and semantics.
- `--radius-pill`, `--radius-card` (16px), and `--radius-drawer` (24px) are shared
  shapes. Mobile `.button` uses the pill radius; `.surface-frame` and `.paper-dialog`
  use the card radius.
- Spacing tokens `--space-mobile-xs/sm/md/gutter/lg/xl` are 4/8/12/16/24/32px.
  Use the gutter for screen edges and the larger values between content sections.

### Safe areas and scrolling

The viewport includes `viewport-fit=cover`; `--safe-top`, `--safe-bottom`,
`--safe-left`, and `--safe-right` expose iOS insets with 0px fallbacks.
`.safe-area-top` and `.safe-area-bottom` apply the corresponding inset as padding.
`.safe-area-sides` applies at least the 16px gutter, or the larger landscape inset.
These helpers set padding, rather than adding to existing padding. When a region
needs both a content gap and an inset, use e.g.
`padding-bottom: calc(var(--space-mobile-gutter) + var(--safe-bottom))` in its layout.
Apply each inset once at the owning shell edge or drawer, not on every nested card.

`.mobile-theme` suppresses tap highlights and automatic text-size inflation.
`:root:has(.mobile-theme)` disables vertical overscroll on the page scroller while
mobile UI is mounted, preventing page bounce when inner scrolling reaches its edge.
The shell still owns its height, overflow and scroll containers; do not disable
touch scrolling or use a global `touch-action: none`.
Buttons, summaries, `.mobile-chrome`, and `.mobile-card` disable text selection.
Content stays selectable by default; use `.mobile-content` to explicitly restore
selection inside chrome/cards. Inputs, textareas and editable content remain selectable.

### Typography

| Class                  | Token                      | Size / leading | Use                                    |
| ---------------------- | -------------------------- | -------------- | -------------------------------------- |
| `.mobile-screen-title` | `--text-screen`            | 28px / 1.2     | Display-font screen heading            |
| `.mobile-card-title`   | `--text-mobile-card`       | 18px / 1.2     | Semibold recipe heading                |
| `.mobile-meta`         | `--text-mobile-meta`       | 14px / 1.5     | Muted kcal · portions, tabular numbers |
| `.mobile-ingredient`   | `--text-mobile-ingredient` | 16px / 1.5     | Ingredient rows                        |
| `.mobile-step`         | `--text-mobile-step`       | 17px / 1.5     | Editorial-font instructions            |

Screen headings share `--text-screen` and display typography with `.paper-header h2`.
Metadata, ingredient, step and input tokens alias the shared `--text-small`,
`--text-smallish` and `--text-body` scale. The leading tokens are
`--leading-mobile-title` and `--leading-mobile-body`.
Mobile inputs, selects and textareas use `--text-mobile-input` (16px); keep this
at least 16px so Safari/WKWebView does not zoom on focus. The viewport also requests
`maximum-scale=1.0, user-scalable=no` as specified for the app WebView.

### Motion and feedback

Use `--duration-fast` (160ms) for feedback, `--duration-normal` (280ms) for content
transitions, and `--duration-drawer` (340ms) for drawer entry/exit. Pair them with
`--ease-out-expo` for settling motion or `--ease-spring` for tactile feedback.
Animate transform/opacity for movement, not layout properties like height or top.
Mobile buttons and opt-in `.mobile-pressable` elements press to `--press-scale`
(0.98). A `.mobile-card.mobile-pressable` also uses the pressed shadow. Disabled
and aria-disabled controls do not press. Do not apply press transforms to elements
whose transform is already owned by drag positioning or drawer motion.
The existing shared `:focus-visible` outline and `.on-forest` contrast remain intact.

With `prefers-reduced-motion: reduce`, durations become near-instant, easing becomes
linear and press scale becomes 1. Consumers should use the tokens instead of
hardcoded durations so overlays and future drawers inherit this policy. Components
with non-token motion or smooth scrolling own their reduced-motion fallbacks;
non-spatial effects such as opacity loading pulses can retain their own timing.

### Verification

Run UI typecheck, lint, tests, format check and production build. CSS layout and iOS
safe-area behavior need browser/device verification: compare a 390px portrait view,
landscape notches, and desktop; focus each form field, select ingredient/step text,
press enabled/disabled controls, and enable reduced motion. Confirm scroll regions
remain usable and bottom navigation/drawers do not cover content or the home indicator.
JSDOM component tests do not evaluate CSS layout or media-query rendering.

## Responsibilities

- Provide consistent visual tokens and styles to components, features, mobile UI
  and the application shell.
- Keep theme definitions independent of the current recipe, meal plan, or screen.
- Accept any application-controlled theme choice through props or configuration
  rather than importing a store to read it.

Feature CSS belongs alongside its feature entry point; shell layout belongs in `style.css`.

## Keep out

- Imports of stores, features, mobile UI or routing.
- Runtime API calls and domain-state ownership.
- UI markup that belongs in components, features or mobile UI.

Relevant rules: `store-imports-*`, `api-imports-*`, and `router-imports-*`.
These enforce import boundaries; see the [source overview](../README.md)
for the dependency direction.
