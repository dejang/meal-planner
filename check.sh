#!/usr/bin/env bash
set -euxo pipefail
cd "$(dirname "$0")"

pnpm run check:fast
ast-grep test
ast-grep scan
cargo build --locked --workspace --all-targets --all-features
pnpm tauri build --no-bundle --debug
