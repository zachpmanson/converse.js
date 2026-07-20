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

Nix build (see `~/nix` repo, commits `4cf35aa64` devshell + `2ffc984` build):

- `flake.nix` / `.envrc` here: nix-direnv devShell pinning `nodejs_24`
  (matches `.nvmrc`).
- `~/nix/flake.nix`: `converse-src` flake input pointing at this fork
  (`flake = false` — we only want the source tree for `buildNpmPackage`,
  not this repo's own flake outputs).
- `~/nix/hosts/naboo/services/converse/default.nix`: `buildNpmPackage`
  derivation building `dist/` from source.
- `~/nix/hosts/naboo/services/caddy.nix`: wired to serve that built output.
- Also exposed as `packages.aarch64-darwin.converse` in `~/nix/flake.nix` so
  `nix build .#converse` sanity-checks the derivation locally on a Mac
  without needing naboo or a Linux builder (`buildNpmPackage` isn't
  platform-specific).

## Not done / blocked

**1. One more lockfile regen is needed.** Upstream's `package-lock.json` was
missing `resolved` URLs for ~90% of packages (a known npm bug,
https://github.com/npm/cli/issues/6301), which breaks Nix's `fetchNpmDeps`
sandboxed fetch. A full reinstall (commit `85a304ad1`) fixed almost all of
it, but left one duplicate: `undici-types` appears twice in the tree at
different major versions (8.3.0 at root, 7.24.6 nested under `src/log`'s own
`@types/node` devDependency), and the nested one still hits the bug.
`package.json` now has an `overrides` entry forcing one version everywhere
(commit `37c9e2e05`), but the **lockfile itself hasn't been regenerated to
match yet** — that requires a destructive command (`rm -rf node_modules
package-lock.json`) that a sandboxed/headless session can't get
auto-approved for. Run this from an actual terminal:

```
cd ~/projects/converse   # wherever it's cloned
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json with undici-types deduped"
git push origin master
```

Then verify: `cd ~/nix && nix flake update converse-src && nix build .#converse -L`
— should go green with no `ENOTCACHED`/`notarget` errors. If it still fails,
check `nix log` output for which package is missing a `resolved` URL this
time (`python3 -c "import json; d=json.load(open('package-lock.json'));
[print(k) for k,v in d['packages'].items() if k and 'resolved' not in v and
'link' not in v]"` in the fork checkout to list them — anything other than
`src/headless`/`src/log`/`@converse/headless`/`@converse/log` themselves is
a real gap).

**2. Flip the live site over.** Once the nix build is green,
`hosts/naboo/services/converse/index.html` still needs:
- `theme: "classic"` / `dark_theme: "classic"` → `theme: "mono"` /
  `dark_theme: "mono"` (currently still `classic` because the CDN's stock
  v14.0.0 build has no `mono` theme — only this fork does, so flipping the
  theme name before the site actually serves the fork's build would break
  it).
- Drop the CDN `<script src="https://cdn.conversejs.org/...">` / `<link>`
  tags in favor of the nix-built, same-origin-served JS/CSS.
- Delete `hosts/naboo/services/converse/theme.css` and its `<link>` — every
  rule in it has been migrated into the fork (see the "Done" list above).

This is genuinely the last step; don't reorder it before #1, since the site
would otherwise ask for a theme that doesn't exist in whatever it's
currently serving.
