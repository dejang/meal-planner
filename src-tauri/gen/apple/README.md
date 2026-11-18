# iOS project

The Xcode project for the iOS app. Tauri generated it, and it is committed so that
iOS-only settings (app metadata and permissions, entitlements, icons, launch screen
and signing team) live in version control. The shared Rust entrypoint is
`meal_planner_desktop_lib::run`. Desktop and iOS use its plugins, commands, image
protocol and application state. The bundle identifier remains
`com.meal-planner.desktop` (valid on Apple platforms) so desktop data paths do not
change. The minimum iOS version is 15.0.

Edit this project in place. Do not run `tauri ios init` again unless you mean to
regenerate it, because that overwrites changes made here. Build output, Xcode user
state and fetched externals stay local and are ignored.

## Setup

Install full Xcode (including the iOS platform and simulator runtime),
[Homebrew](https://brew.sh), the repository's pinned Rust toolchain, Node.js 22 and
the pnpm version from the root `package.json`. Ensure `brew` is on your PATH using
Homebrew's installation instructions. From the repository root:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
brew install cocoapods xcodegen
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
pnpm install --frozen-lockfile
pnpm run tauri ios build --target aarch64-sim
```

Use `--target x86_64` instead for an Intel Mac simulator. For an interactive
simulator run, use `pnpm run tauri ios dev` and select an installed simulator.

## Devices

Sign into Xcode with an Apple developer account on the team configured in this
project, then build and install on a paired device:

```sh
pnpm run tauri ios build --target aarch64
xcrun devicectl list devices
xcrun devicectl device install app --device <device id> \
  "src-tauri/gen/apple/build/arm64/Meal Planner.ipa"
```

To sign with a different team, change it under Signing & Capabilities in Xcode
(`pnpm run tauri ios build --target aarch64 --open`) and commit the result.
Distribution also requires the appropriate Apple certificates and provisioning
profiles; no signing credentials belong in this repository.
