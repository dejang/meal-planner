# Theme: visual foundations

Put shared visual definitions here: color palettes, typography, spacing tokens,
CSS custom properties, theme variants, and base styles. Keep visual choices separate
from meal-planning state and persistence behavior.

## Responsibilities

- Provide consistent visual tokens and styles to kit UI, organisms, and pages.
- Keep theme definitions independent of the current recipe, meal plan, or screen.
- Accept any application-controlled theme choice through props or configuration
  rather than importing a store to read it.

## Keep out

- Imports of stores, organisms, pages, routing, or live transport.
- Runtime API calls and domain-state ownership.
- Feature-specific UI markup that belongs in kit UI or organisms.

The existing `ui/src/style.css` remains in place. Move or split it into this folder
only when implementing shared theme styles, updating its imports at the same time.

Relevant rules: `store-imports-*`, `api-imports-*`, `live-imports-*`, and
`router-imports-*`. These enforce part of the intended separation; see the
[source overview](../README.md) for current coverage limitations.
