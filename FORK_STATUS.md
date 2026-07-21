# zachpmanson/converse.js — fork status

This is a personal fork of [conversejs/converse.js](https://github.com/conversejs/converse.js),
branched from the `v14.0.0` tag, for `chat.zachmanson.com`. The goal: migrate
that site's `theme.css` (a pile of `!important` overrides fighting the
cascade from outside the app) into proper source-level changes here instead,
and build/serve it from source via nix rather than vendoring prebuilt CDN
assets.

Both `master` and `mods` on `origin` (this fork) point at the same commits —
treat `master` as the working branch going forward; `mods` is a leftover
name from before we consolidated onto `master`.

## Local dev

```
cd ~/projects/converse   # or wherever you've cloned it
direnv allow             # flake.nix + .envrc pin nodejs_24 via nix-direnv
npm install
npm run build            # produces dist/converse.js, converse.min.js, converse.min.css, etc.
```

## Done

Source-level fixes (see commit `204bad401` "Add mono theme; fix several
structural/theme overrides at the source" for the full list):

- New `mono` theme (`src/shared/styles/themes/mono.scss`), same pattern as
  the built-in classic/dracula/nordic/cyberpunk themes, real variable values
  instead of overriding classic's with `!important`.
- Chat/MUC/headlines header border widths: `0.25em`/`0.15em` → `0.1rem`
  directly at the source.
- Toolbar renders after the textarea via actual template order (lit-html),
  not a CSS flex `order` hack.
- `converse-contact-approval-alert` margin only applies via `:has(*)`.
- `.chat-content__notifications` collapses via `:empty` at the source.
- `roster-group-contacts` collapse gets its own animated class instead of
  fighting the shared `.collapsed`.
- Fixed a real Converse bug: `.roster-contacts`'s `display: contents` was
  silently breaking Converse's own existing slideIn/slideOut animation.
- Added the `.is-fresh` message slide-up animation + last-child bottom
  spacing to `messages.scss` (the page's own MutationObserver still tags
  `.is-fresh` — only the embedding page knows live-arrival vs.
  bulk-history-load).

Nix build:

- `flake.nix` / `.envrc` here: nix-direnv devShell pinning `nodejs_24`
  (matches `.nvmrc`).
- `flake.nix` here also exposes `packages.converse` (and `.default`): a
  `buildNpmPackage` that runs `npm run build` and installs `dist/`. Validated
  with `nix build .#converse` on aarch64-darwin (`buildNpmPackage` isn't
  platform-specific, so it sanity-checks without naboo or a Linux builder).
  `npmDepsHash` is pinned in `flake.nix` — regenerate it after any
  `package-lock.json` change with
  `nix run nixpkgs#prefetch-npm-deps -- package-lock.json`.
- `~/nix/flake.nix`: `converse` flake input pointing at this fork
  (`github:zachpmanson/converse.js`, `inputs.nixpkgs.follows = "nixpkgs"`),
  matching the pattern used by the other zachpmanson web apps — each repo
  exposes its own build as a flake output; nothing `buildNpmPackage`-shaped
  lives in `~/nix`. (An earlier approach, actually shipped in `~/nix` commit
  `2ffc984`, took the other route — a `flake = false` `converse-src` input +
  a `buildNpmPackage` `default.nix` inside `~/nix`, using
  `npmDepsFetcherVersion = 2` to tolerate the lockfile gaps. We consolidated
  onto the fork-owns-its-build approach and removed that in the merge
  `25ba082`.)
- `~/nix/hosts/naboo/services/caddy.nix`: builds `converseRoot` from
  `inputs.converse.packages.<system>.converse`, serving the whole `dist/`
  under `/dist/` plus a mono-theme `index.html`. The `/dist/` prefix keeps
  Converse's default `assets_path` (`/dist`) and webpack `publicPath: 'auto'`
  resolving chunks/webfonts/sounds/emoji.

## Done — live

Deployed to naboo (`~/nix` merge `25ba082`, `make naboo-deploy`) and verified
on `chat.zachmanson.com`:

- `index.html` serves `theme: "mono"` / `dark_theme: "mono"` and local
  `/dist/` assets; no `cdn.conversejs.org` requests.
- `/dist/converse.min.{css,js}` and the rest of the dist tree (emoji.json,
  wasm, sounds…) return 200 same-origin; the mono theme is present in the
  served CSS.
- `/theme.css` is gone (404, and nothing references it — every rule migrated
  into the fork source).

### Also done

- **Lockfile regen** — `undici-types` deduped to a single 8.3.0; only the
  local `src/headless` / `src/log` workspaces lack `resolved` URLs now, which
  is expected.
- **naboo ssh alias / deploy tooling** — `~/nix` gained a dedicated `naboo`
  ssh alias (`home/mac-common.nix`) so deploys stop piggybacking on the `nc`
  (nextcloud) alias that only coincidentally shares the box; `make`'s `HOST`
  defaults to `naboo`. `naboo.zachmanson.com` is a parked address — the real
  box is `nextcloud.zachmanson.com`, which the alias points at.

## Follow-ups (optional)

- The `naboo` ssh alias only reaches `~/.ssh/config` after this Mac's next
  `darwin-rebuild switch`; until then use `make naboo-deploy HOST=nc`.
