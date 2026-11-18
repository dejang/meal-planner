# iOS project

The Tauri-generated Xcode project for the iOS app. It owns the iOS-only settings:
app metadata and permissions, entitlements, icons, launch screen and signing team.
App code stays in the shared Rust and frontend sources.

Edit it in place; `tauri ios init` regenerates it and overwrites local changes.
Signing credentials never belong here.
