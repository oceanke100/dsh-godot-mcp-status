# Publishing

DSH has no central store. Three layers make a plugin installable and findable,
and they do different jobs — all three together is the normal setup:

| Layer | What it is | What it does |
|---|---|---|
| **GitHub** | this repository, plus a tag per release | source, README, issues, and the `repository` link on the market card |
| **npm** | `dsh-godot-mcp-status@X.Y.Z` | the artifact people actually install (`source: { "type": "npm" }`) |
| **Index** | `docs/index.json` (and optionally a community index) | discovery: what makes the plugin appear in **Discover** |

One rule keeps them consistent: **one version, in every layer**.

```
package.json  version        0.1.0
git tag                      v0.1.0
npm                          dsh-godot-mcp-status@0.1.0
docs/index.json  version     0.1.0
docs/index.json  publishTimestamp   the npm publish time (Unix seconds)
engines.dsh                  identical in package.json and the index entry
```

## One-time setup

1. **Identity** — fill `author`, `repository`, `homepage`, `bugs` in
   `package.json`; if the name `dsh-godot-mcp-status` is taken on npm, rename it in
   `package.json`, `client.js` (`window.__ModuleLoader__.load({ id })`),
   `index.js` (`export const name`) and `cordis.patch.yml` (the row's `name`).
2. **Index** — fill the `<GITHUB_USER>`, `<AUTHOR>` and `publishTimestamp`
   placeholders in `docs/index.json` (see `docs/README.md`).
3. **GitHub** — create the repository, then:

   ```sh
   cd E:\dsh-plugins\dsh-godot-mcp-status
   git remote add origin https://github.com/<GITHUB_USER>/dsh-godot-mcp-status.git
   git push -u origin main
   ```

4. **npm** — no build step, the files in this directory are the shipped files:

   ```sh
   npm login                 # first time only
   npm pack --dry-run        # inspect the file list
   npm publish               # add --access public only for a scoped name
   ```

5. **Pages** — **Settings → Pages → Deploy from a branch → main / `/docs`**.
   The index URL becomes
   `https://<GITHUB_USER>.github.io/dsh-godot-mcp-status/index.json`.

6. **Community index** (optional) — the community catalog lists plugins it has
   accepted; submit the same entry from `docs/index.json` following that
   catalog's contribution instructions. DSH itself ships no index.

## Every release

1. Bump `version`, run `npm run check`.
2. `git commit`, `git tag vX.Y.Z`, `git push --follow-tags`.
3. `npm publish`.
4. Add a version object to `docs/index.json` with the real `publishTimestamp`,
   then push (Pages redeploys).
5. If the plugin is in a community index, let that catalog pick up the new
   version the way its instructions describe.

Publish in this order: npm first, index second. An index entry naming a version
that npm does not have fails at install time.

## Verify

```sh
npm run check                 # node --check on both halves
npm pack --dry-run            # files, locales, icon
npm view dsh-godot-mcp-status version
```

In DSH: **Settings → Plugins → Discover**, search the name, open the card, and
check the version and source before installing. A local install still works with
`install_bundle` pointed at this directory.

## Notes

- List **one** source per plugin in an index (`npm` here). Adding a second
  `git` entry for the same `name` splits the version history and confuses the
  upgrade state.
- A user who cannot reach npm can still install from a commit:
  `git+https://github.com/<GITHUB_USER>/dsh-godot-mcp-status.git#<40-char-sha>`.
- The index is third-party content: the installed package's own manifest decides
  what runs, so keep the two in sync rather than trusting the index.
