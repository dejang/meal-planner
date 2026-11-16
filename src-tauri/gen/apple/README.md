# iOS project initialization

The shared Rust entrypoint is `meal_planner_desktop_lib::run`. Desktop and iOS use
its plugins, commands, image protocol and application state. The bundle identifier
remains `com.meal-planner.desktop` (valid on Apple platforms) so desktop data paths
do not change. The minimum iOS version is 15.0.

Generate the Xcode project here using Tauri on macOS, not a hand-written project.
Install full Xcode (including the iOS platform and simulator runtime),
[Homebrew](https://brew.sh), the repository's pinned Rust toolchain, Node.js 22
and the pnpm version from the root `package.json`. Ensure `brew` is on your PATH
using Homebrew's installation instructions. Run these steps from the repository
root to install CocoaPods and generate and build the project:

```sh
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
brew install cocoapods
rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
pnpm install --frozen-lockfile
pnpm run tauri ios init
pnpm run tauri ios build --target aarch64-sim
```

Use `--target x86_64` instead for an Intel Mac simulator. Tauri generates the Xcode
project and associated files here and runs the configured frontend build hook.
For an interactive simulator run, use `pnpm run tauri ios dev` and select an
installed simulator.

For a device build, sign into Xcode with an Apple developer account and replace
the team placeholder below with its ten-character development team identifier:

```sh
export APPLE_DEVELOPMENT_TEAM="YOURTEAMID"
pnpm run tauri ios build --target aarch64 --open
```

Select the same team under Signing & Capabilities in the generated Xcode project,
use automatic signing, and select a provisioned device to run. Distribution also
requires the appropriate Apple certificates and provisioning profiles; no signing
credentials belong in this repository.

Linux verification covers the workspace tests, including `bindings_are_current`,
and the desktop build. An iOS compile, simulator launch and device signing must
still be verified on macOS with Xcode.
