# Meal Planner

A pet project that I am using on a weekly basis. It has helped me save money, lose body fat and avoid taking food supplements.

<img width="1728" height="967" alt="Screenshot 2026-09-05 at 12 50 42 AM" src="https://github.com/user-attachments/assets/2ca20095-5a58-475c-abb8-c0c30a76e5db" />


## Development

Install the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), the
pinned Rust toolchain, Node.js 22 and pnpm (version in `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm tauri dev              # desktop app with the Vite frontend
pnpm tauri build            # release build and installers under target/release
pnpm run check:fast         # Rust and frontend lint and tests
./check.sh                  # everything, needs @ast-grep/cli@0.51.0 on PATH
```

## iOS development

On macOS, install Xcode, CocoaPods, XcodeGen and the Rust targets
`aarch64-apple-ios` and `aarch64-apple-ios-sim`. The Xcode project is committed
under `src-tauri/gen/apple`.

```sh
pnpm tauri ios dev                         # run in a simulator
pnpm tauri ios build --target aarch64      # build for a device
xcrun devicectl device install app --device <id> \
  "src-tauri/gen/apple/build/arm64/Meal Planner.ipa"
```

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

