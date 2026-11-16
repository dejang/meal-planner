{
  description = "Meal Planner Tauri devShell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    rust-overlay.url = "github:oxalica/rust-overlay";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, rust-overlay, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
      in with pkgs; {
        devShells.default = mkShell rec {
          nativeBuildInputs = [
            (rust-bin.fromRustupToolchainFile ./rust-toolchain)
            nodejs_22
            pnpm
            pkg-config
          ];

          buildInputs = [ openssl ] ++ lib.optionals stdenv.isLinux [
            gtk3
            webkitgtk_4_1
            libsoup_3
            librsvg
            libayatana-appindicator
            xdotool
          ];

          LD_LIBRARY_PATH = lib.makeLibraryPath buildInputs;
        };
      });
}
