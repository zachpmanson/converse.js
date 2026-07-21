{
  description = "zachpmanson/converse.js fork — dev shell + built dist/ package";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_24
          ];
        };

        # The built static site (dist/), served same-origin by caddy on naboo.
        # buildNpmPackage isn't platform-specific, so `nix build .#converse`
        # sanity-checks this on a Mac without needing a Linux builder.
        packages.default = self.packages.${system}.converse;
        packages.converse = pkgs.buildNpmPackage {
          pname = "converse";
          version = "14.0.0";
          src = ./.;

          npmDepsHash = "sha256-zvRga7xxGuncHrwTxjRvUrjTtIA771H6R2Wdu9wIp/4=";

          nodejs = pkgs.nodejs_24;

          # `npm run build` = build:website-min-css && build:headless && build:main.
          npmBuildScript = "build";

          # This repo ships two local workspaces (src/headless, src/log) linked
          # via file: deps; npm ci wires them up during the deps phase.
          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -r dist $out/dist
            runHook postInstall
          '';
        };
      });
}
