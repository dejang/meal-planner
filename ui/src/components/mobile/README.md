# Mobile primitives

These controls are props-driven; application stores remain in feature composition.
Import each component directly. No additional runtime dependencies are required.

- `BottomDrawer`: controlled `open`, accessible `title`, optional `header` slot,
  body children, and `onClose` dismissal request. The owner changes `open` after any
  unsaved-draft checks. The default header includes Close; a supplied header owns all
  its actions. Native modal dialog behavior supplies focus containment/restoration
  and makes the background inert. Entry/exit use transform motion; exit retains the
  dialog until the transition ends. Escape and scrim taps request dismissal. A native
  close also requests dismissal and restores the modal if the owner keeps it open.
  The handle supports pointer dragging and keyboard activation: swipe up to full
  height, down to default height, then down to dismiss. A body touch pull-down can
  drag only after a downward, predominantly vertical gesture starts with the body
  and nested scrollers at scrollTop zero. Other gestures scroll normally.
  `peekOffset`, `dragSlop`, `dismissDistance`, `dismissRatio`, `flickDistance`,
  `flickVelocity` (pixels/ms), and `expandDistance` configure snaps and gestures.
- `SwipePager`: controlled zero-based `activeIndex` and `onActiveIndexChange`.
  Children are full-width pages. Prev/next, arrow keys and `PageDots` provide
  non-swipe navigation. The default arrow row and separate dot row fit narrow screens.
  `renderControls` receives `activeIndex`, `count`, `select`, `previous`, and `next`
  so a screen can compose its own header navigation or omit the controls.
  `previousLabel`, `nextLabel`, `pageGroupLabel`, `dotLabel`, and `dotsLabel` configure
  accessible names, for example day navigation instead of page navigation.
  Settled native scrolling reports the nearest page; only browsers without
  `scrollend` use the configurable `settleDelay` debounce. Neither path reports
  while a pointer/touch is held. Resize keeps the page aligned; programmatic smooth
  scrolling respects reduced motion. Inactive pages are inert.
- `PageDots`: standalone `count`, zero-based `activeIndex`, and `onSelect`;
  optional `label` and `dotLabel` configure accessible names.
- `DayPills`: `count` one-based labels (default six) reporting zero-based days
  through `onSelect`. `selectedDay` marks selection; set `confirmedDay` after a
  successful addition to reveal a decorative checkmark, then clear it when the
  confirmation is complete (including under reduced motion). `disabled` blocks
  interaction during work; `label` names the group.
- `MobileHeader`: safe-area-aware title and optional `action` slot.
- `Stepper`: controlled numeric `value` and `onChange`, optional positive `step`,
  inclusive `min`/`max` bounds, `disabled`, and accessible `label`. Defaults to whole
  portions with minimum one. The owner supplies a value within the configured bounds.

Motion, safe areas, touch sizes and colors use the shared theme tokens. Apply the
mobile theme at the screen level; the native drawer supplies it for its own overlay.
Browser/device checks are still needed for actual scroll snapping, focus trapping,
keyboard resizing, safe-area rendering and animation feel at 320–430px widths.
