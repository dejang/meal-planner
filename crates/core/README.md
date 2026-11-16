# Meal planner core

Domain types and the application API shared by the desktop commands and adapters.
`App` owns recipe and six-day plan snapshots behind an internal mutex. Service
calls are asynchronous and never hold that mutex across an await. Adapters handle
filesystem access, downloads, credentials, persistence, and IPC outside this crate.

Recipes load in persisted display order; inserts append and updates retain their
position. `delete_recipe` is the application deletion entry point and removes every
plan occurrence and the image. Storage deletes the recipe and saves the cleaned
plan atomically. Image changes on create/update are explicit keep/remove/set values.
Image versions are UUID cache tokens; absence means no image. Image bytes cross
IPC as base64 JPEG strings, suitable for a `data:image/jpeg;base64,` URL.

Recipe writes reach Storage before the cached snapshot changes. Setting an image
on update puts its bytes first, then saves fields and a fresh version together.
Removing an image saves the empty version before cleaning up the bytes. Creation
inserts the recipe before putting an image, so image rows may reference it; if the
image step fails, creation attempts rollback through the deletion path and returns
the original error. Storage and ImageStore are separate contracts, not one
transaction: a failed update write can leave replaced image bytes, failed cleanup
can leave unreferenced bytes, and failed rollback can leave the inserted recipe.

Plan day and row indices are zero-based. Adding at the day length appends; moving
uses a destination row after source removal. Plan mutations return the updated
plan. Storage saves the plan by atomically replacing all rows, including their
within-day ordering. Daily totals have the same wire shape as recipe analysis and
are rendered with servings set to one. Shopping weights are grams, as in the
Edamam analysis.

Enable the `fakes` feature to use the in-memory adapters from other crates. The
analysis fixture is nutrition-only data extracted from the legacy state export,
with the legacy `_yield` key normalized to Edamam's `yield`.
