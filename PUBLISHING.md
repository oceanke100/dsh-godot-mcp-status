# Publishing

DSH has no central store. Three layers make a plugin installable and findable, and
they do different jobs:

| Layer | What it is | What it does |
|---|---|---|
| **GitHub** | this repository, plus a tag per release | source, README, issues, and the install source for the current release |
| **npm** (optional) | `dsh-godot-mcp-status@X.Y.Z` | a faster install source once an npm account exists |
| **Index** | `docs/index.json` (and optionally a community index) | discovery: what makes the plugin appear in **Discover** |

The 0.1.0 release uses the **Git** source — the index pins a commit — so no
registry account is needed. One rule still keeps the layers consistent:

```
package.json  version        0.1.0
git tag                      v0.1.0
docs/index.json  version     0.1.0
docs/index.json  source      git + the commit below
docs/index.json  publishTimestamp   the release time (Unix seconds)
engines.dsh                  identical in package.json and the index entry
```

## One-time setup (already done for this repository)

1. **Identity** — `author`, `repository`, `homepage`, `bugs` are filled in
   `package.json`. If the package is ever renamed, change it in `package.json`,
   `client.js` (`window.__ModuleLoader__.load({ id })`), `index.js`
   (`export const name`) and `cordis.patch.yml` (the row's `name`).
2. **GitHub** — repository created, pushed, topics set.
3. **Index** — `docs/index.json` names this repository and pins the current
   commit (see `docs/README.md`).
4. **Pages** — **Settings → Pages → Deploy from a branch → main / `/docs`**; the
   index answers at
   `https://oceanke100.github.io/dsh-godot-mcp-status/index.json`.
5. **Community index** (optional) — submit the same entry following that
   catalog's contribution instructions. DSH itself ships no index.

An npm account is optional: publish the next version there and add it as a
separate `versions` entry with `"source": { "type": "npm" }`.

## Every release (Git source)

This release pins a commit instead of an npm version, so no registry account is
needed. Each release:

1. Bump `version` in `package.json`, run `npm run check`.
2. `git commit`, `git tag vX.Y.Z`, `git push --follow-tags`.
3. Put the new commit (`git rev-parse HEAD`) plus the version and a
   `publishTimestamp` into `docs/index.json`, then push — Pages redeploys itself.
4. If the plugin is in a community index, let that catalog pick up the new version
   the way its instructions describe.

If you later get an npm account, publish the *next* version there and add it as a
separate `versions` entry with `"source": { "type": "npm" }`. Keep the older Git
entries: the market installs the highest compatible version, so existing users
upgrade to the npm build while 0.1.0 stays reproducible.

## Verify

```sh
npm run check                 # node --check on both halves
npm pack --dry-run            # files, locales, icon
git rev-parse HEAD            # must equal versions[0].source.commit
```

In DSH: **Settings → Plugins → Discover**, search the name, open the card, and
check the version and source before installing. A local install still works with
`install_bundle` pointed at this directory.

## Notes

- List **one** source per version. A `git` version and an `npm` version under the
  same `name` are fine only when they are different versions and the newer one is
  complete; two entries for the same version split the upgrade state.
- Anyone can install the pinned commit directly:
  `git+https://github.com/oceanke100/dsh-godot-mcp-status.git#<40-char-sha>`.
- The index is third-party content: the installed package's own manifest decides
  what runs, so keep the two in sync rather than trusting the index.
