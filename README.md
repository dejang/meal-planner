# Meal Planner

A pet project that I am using on a weekly basis. It has helped me save money, lose body fat and avoid taking food supplements.

<img width="1728" height="967" alt="Screenshot 2026-09-05 at 12 50 42 AM" src="https://github.com/user-attachments/assets/2ca20095-5a58-475c-abb8-c0c30a76e5db" />


## Development

Use the pinned Rust toolchain, Node.js 22 and **pnpm** (version in the root `package.json`).
On Linux, install Tauri v2 prerequisites: `libwebkit2gtk-4.1-dev`, `build-essential`,
`curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `librsvg2-dev`,
and `libayatana-appindicator3-dev` (Debian/Ubuntu package names).
On macOS and Windows, install the platform's
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) first.

From the repository root, start the Tauri app and its Vite/React frontend:

```sh
pnpm install --frozen-lockfile
pnpm tauri dev
```

The frontend dev server uses `http://127.0.0.1:1420`. To build the desktop app,
run `pnpm tauri build`. The executable is written to `target/release/` and
platform installers to `target/release/bundle/`. The root pnpm workspace installs
both the desktop CLI and the frontend dependencies; Tauri starts Vite automatically.

Run `pnpm run check:fast` for workspace fmt, clippy and tests (including bindings
freshness), plus frontend typecheck, ESLint, Prettier and Vitest. `./check.sh` also
runs ast-grep tests/scanning, a workspace build and a Tauri build.
Install the prerequisites and frontend dependencies first. The full check requires
`ast-grep` on PATH from `@ast-grep/cli@0.41.0`, matching CI; for example, install it
with `pnpm add --global --allow-build=@ast-grep/cli @ast-grep/cli@0.41.0`.

## Desktop data and manual checks

For a fresh Tauri database on Linux without deleting existing data, first run
`export XDG_DATA_HOME="$(mktemp -d)"` in its terminal. Keep that terminal and the
same environment for restart checks. The desktop app stores `meal_planner.sqlite`
and `settings.json` under the `com.meal-planner.desktop` application data directory.
The root `state.json` is parked historical data; the desktop app does not read or
modify it. Do not commit credentials or database files.

Manual acceptance checklist (requires a graphical desktop, network access and
valid Edamam Nutrition Analysis credentials):

1. On fresh startup, check the welcome screen. Open Settings, save credentials,
   close and reopen Settings, and check that they remain saved.
2. Create a recipe with title, ingredients, instructions and two servings. Close
   the editor to save; search for it, open its details, edit and save again.
3. Choose a local image, then replace it using an image URL. Reopen the recipe
   after each save and check the photo in both editor and gallery.
4. Analyze ingredients. Check the per-serving nutrition in the editor and details.
   With missing credentials or a bad image URL, verify an error appears and retry.
5. Import a recipe from a listed supported site. Check the editable draft and its
   image/source. Nutrition analysis should start automatically, without focusing
   the ingredients field; closing to save waits for it. Try an unsupported URL
   and check the error.
6. Drag at least two different recipes to a day; reorder them, move one to another
   day, copy the previous day, remove a meal and clear a day. Verify day totals
   and the shopping list after each change and after editing a planned recipe.
7. Delete a planned recipe; check that its gallery card, planned meals, totals and
   shopping ingredients disappear without requiring a restart.
8. Quit and restart using the same data directory. Verify recipes, photos, meal
   ordering, totals, shopping list and credentials. Welcome should not reappear
   when credentials are present.
9. Inspect the Rust logs and webview developer console for warnings/errors.

## Desktop command bindings

Register commands in `src-tauri/src/commands/mod.rs`. The same tauri-specta builder
provides IPC dispatch and generates `ui/src/api/bindings.ts`; do not edit that file
by hand. Frontend callers import the API through `ui/src/api/index.ts`.

After changing a command or a boundary type, regenerate and check the bindings:

```sh
pnpm --dir ui run bindings:generate
pnpm --dir ui run bindings:check
```

The Rust test suite also checks the generated file against the registered commands.

## Features

- copy/paste a list of ingredients in the ingredients box and get immediate nutrients analysis (macros & micros) per serving
- easily save recipes found on the internet in your "recipe book" and attach a descriptive picture
- plan your meals for 6 days using a calendar like view with breakdown of your macros & micros for each day 
- get a shopping list with all the things you need to buy based on your current week plan

## Motivation
Rust is cool! Meal planning is cool! Meal planning is healthy! But meal planning takes a lot of time if you are trying to have your diet support your athletic performance while also hitting your target macros and micros on a daily basis. 
Most, if not all, applications currently available are for tablets and phones. And they have a similar layout which often times does not help getting a birds-eye view of your diet. 
Besides that, introducing a recipe from a book, or website, into these apps using the phone keyboard is extremely time consuming. Ideally, a meal planning application should allow me to copy/paste the list of ingredients, the instructions,
save them and then begin planning. I should also be able to get a shopping list so I don't lose too much time shopping for groceries.

So this is what this app tries to address: it provides a calendar-like view for the upcoming 6 days on the bottom half of the screen. Use the top half as a browser to quickly find what recipes will fit your restrictions. Using a drag-n-drop
experience you can drag a recipe into the column (day) you want. At the bottom of each day you will see a food-label like view with important things you want to keep an eye out for, such as calories, protein, fats, cholesterol, sodium etc. 


## Always free! Because we should all be healthy!
This app will never cost money. Use it for yourself, explore delicious recipes and maintain your fitness goals. As someone who has already tried this for more than 6 months I can tell you this: if it worked for me, it will work for you too!

## Contributions
Help me make it better! I am looking forward to see PRs from like-minded people who have the skills to make changes to this app so it can look/feel better.

