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

## Responsibilities

- Provide consistent visual tokens and styles to shared components, kit UI, features,
  organisms, and pages.
- Keep theme definitions independent of the current recipe, meal plan, or screen.
- Accept any application-controlled theme choice through props or configuration
  rather than importing a store to read it.

Feature CSS belongs alongside its feature entry point; shell layout belongs in `style.css`.

## Keep out

- Imports of stores, organisms, pages, routing, or live transport.
- Runtime API calls and domain-state ownership.
- Feature-specific UI markup that belongs in features, kit UI, or organisms.

Relevant rules: `store-imports-*`, `api-imports-*`, `live-imports-*`, and
`router-imports-*`. These enforce part of the intended separation; see the
[source overview](../README.md) for current coverage limitations.
