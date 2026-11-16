# Store core: shared implementation machinery

Put implementation modules shared by multiple stores here when a concrete need arises.
Examples include subscription bookkeeping, stable selector-hook machinery, or a shared
draft-state contract. Feature-specific state and actions remain in their owning store.

## Visibility

- Core modules may export the classes and helpers that store implementations need.
  This directory is exempt from `store-exports-*`, not from all store rules.
- UI modules must consume public store hooks rather than importing core implementations.
- Expose types and enums needed by UI through the owning public store module.

## Keep out

- Screen rendering, routing, and feature-specific business decisions.
- A public registry or getter that lets UI bypass store hooks.
- Speculative base classes or selector frameworks without real callers.

The parent's state-ownership, selector-stability, configuration, and subscription
lifecycle rules still apply. See the [store README](../README.md).
