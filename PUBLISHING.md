# Publishing

The package is ready apart from the identity fields below. DSH has no central
store: a "market" is a JSON index file that users add by URL, so publishing means
getting the package onto npm (or a Git repository) and then pointing an index at
it. A self-hosted index needs no review at all.

## 0. Fill in identity fields

`package.json`:

- `author` — your name or handle (optional, shown in npm).
- `repository` and `homepage` — your Git URL (optional but recommended; the
  market links to them).

If the name `dsh-godot-mcp-status` is taken on npm by the time you publish, either
rename the package or use a scope (`@your-name/dsh-godot-mcp-status`). A rename
must also change three other places:

- `client.js` → `window.__ModuleLoader__.load({ id: ... })` must equal the
  package name.
- `index.js` → `export const name = ...`.
- `cordis.patch.yml` → the inserted row's `name`.

## 1. Put it in a Git repository

```sh
cd E:\dsh-plugins\dsh-godot-mcp-status
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<GITHUB_USER>/dsh-godot-mcp-status.git
git push -u origin main
```

## 2. Publish to npm

```sh
npm login                       # first time only
npm pack --dry-run              # inspect the file list
npm publish --access public
```

There is no build step: the files in this directory are the shipped files.

## 3. List it in a market

A market index is format 1 JSON (UTF-8, at most 128 MiB, served with a 2xx and no
redirect). The index lists each plugin's versions and their install source:
`{ "type": "npm" }` installs `name@version`, a `{ "type": "git", ... }` entry
installs a commit-pinned URL.

### Option A — host your own index (no review)

1. Copy `market/index.template.json` to `site/index.json` and replace every
   `<...>` placeholder; set `publishTimestamp` to the version's real publish time
   in Unix seconds (`[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()` in PowerShell,
   or `Math.floor(Date.now() / 1000)` in Node).
2. Put `site/index.json` on any static host over https: GitHub Pages, GitLab
   Pages, object storage.
3. Share the URL. Friends open **Settings → Plugins → Discover → Add index
   source**, paste it, and install the plugin from the card.

### Option B — submit to the community index

The profile here already lists **Awesome DSH Plugin**
(`https://awesome-dsh-plugin.com/index.json`), which is community-curated; DSH
ships no index of its own. Follow that catalog's contribution instructions and
offer the same plugin entry as in `market/index.template.json` (its `name`,
`title`, `description`, `repository`, `versions[].version`, `publishTimestamp`).

## 4. Release a new version

1. Bump `version` in `package.json` (SemVer; the market treats every published
   version as installable).
2. `npm publish`.
3. Add the new version object to your index (and re-host it).

## Checks before each release

```sh
npm run check          # node --check on both halves
npm pack --dry-run     # files, locales, icon
```

`engines.dsh` in `package.json` and in the index entry states the DSH range the
plugin was tested with; DSH re-checks it at install time.
