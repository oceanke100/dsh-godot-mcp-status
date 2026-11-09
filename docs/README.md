# Market index

This folder is the plugin's own market index. DSH reads the one JSON file,
`index.json`, from any static host, and a URL is all a user needs: they add it
under **Settings → Plugins → Discover → Add index source** and install the
plugin from the card. GitHub Pages can serve this folder as-is.

## Values

`index.json` already names this repository and its author:

| Field | Value |
|---|---|
| `plugins[0].author` | `oceanke100` |
| `plugins[0].homepage`, `plugins[0].repository.url` | `https://github.com/oceanke100/dsh-godot-mcp-status` |
| `plugins[0].versions[0].source` | `git`, with the commit the release was built from (`git rev-parse HEAD`) |
| `plugins[0].versions[0].publishTimestamp` | the release time (Unix seconds); update it for every release |

`versions[0].version` must equal `package.json`'s `version`, and `engines.dsh`
must match the package. Add a new object to `versions` for every release.

## Serve it with GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment → Deploy from a branch**:
   branch `main`, folder `/docs`, then **Save**.
3. After the first build the index answers at
   `https://oceanke100.github.io/dsh-godot-mcp-status/index.json`.

## Check

```sh
node -e "JSON.parse(require('fs').readFileSync('docs/index.json','utf8')); console.log('ok')"
```

The file must be UTF-8 JSON, served with a 2xx status, without a redirect.
The icon is inlined as a `data:` URL, so this folder needs no other file.
