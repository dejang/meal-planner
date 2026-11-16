#!/usr/bin/env bash
set -euxo pipefail
cd "$(dirname "$0")"

cargo fmt --all -- --check
pnpm run lint
cargo build --locked --workspace --all-targets --all-features
cargo test --locked --workspace --all-targets --all-features
cargo test --locked --workspace --doc
pnpm --dir ui run typecheck
pnpm --dir ui test
pnpm tauri build --no-bundle --debug
