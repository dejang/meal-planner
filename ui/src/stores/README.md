# Stores

Application state and the actions that change it, one store per domain. Stores are the
only UI code that calls the backend, and they own the loading and error state of their
operations.

Each store is a private bonsai `Store` created by its `*Scope` provider. Callers use the
exported selector and action hooks; store classes, instances and contexts stay private.
Selectors return stored values, not new objects.

Stores pull their initial data in the constructor. A screen that needs fresh data each
time it opens is wrapped in a provider that mounts with it.

`core/` holds implementation shared by several stores.
