# dsh-godot-mcp-status

A DSH Web UI plugin: while the Godot editor is running, the Godot logo with an
**MCP** corner tag stays in the bottom-right of the app. The tag carries a status
dot — **blue** while DSH is connected to the Godot MCP server, **gray** while the
editor is up but DSH is not connected. Hovering or focusing the tile raises the
bubble **已连接上Godot MCP** / **未连接上Godot MCP** (English: Connected to /
Not connected to Godot MCP). When the editor closes, the badge disappears.
Hold and drag the tile to move it anywhere in the window.

It answers one question at a glance: is the editor's MCP server live right now,
so the agent can actually use `mcp__godot__*` tools?

## Install

- From a market: add the index that lists this package in **Settings → Plugins →
  Discover**, then install it.
- From a folder: install the package directory with the Plugin Manager
  (`install_bundle`), e.g. this repository root.
- Then reload the page once: the badge is a Client module, so an already open
  page loads it on the next refresh.

No configuration. It follows whatever MCP servers the profile has configured.

## How the state is decided

The Host half computes both facts on demand and serves them as JSON at
`/godot-mcp-badge/state.json`. The badge answers two questions separately:

- **Is the editor running?** A TCP probe of the configured endpoint answers it.
  The badge appears as soon as the editor listens and disappears as soon as it
  stops, whether or not DSH ever connected.
- **Is DSH connected to it?** The `mcp__<server>__<tool>` definitions in the live
  tool registry answer it. The MCP bridge publishes them only after a successful
  connection and tool discovery, and removes them when the connection is disposed
  or its reconnect budget is exhausted. That is the dot: blue when the running
  server contributes tools, gray when it does not.

A server row comes from the active loader entries whose resolved configuration has
a `serverName` plus a `stdio` or `streamable-http` transport. Nothing is
installed, no editor state is written, and the probe opens no MCP session — it only
connects a socket and closes it.

The Client half registers a seat in `shell.overlay` (frame-wide, click-through)
and polls that route every 2 s while the page is open. Only the 32 px tile opts
into pointer events.

## Files

| File | Role |
|---|---|
| `index.js` | Host row: state route and detection |
| `client.js` | Client module: overlay seat, Godot logo, bubble |
| `cordis.patch.yml` | Inserts the Host row |
| `locale/*.json` | Plugin Manager title/description and badge text |
| `icon.svg` | Package icon |
| `market/index.template.json` | Self-hostable market index to fill in before publishing |
| `PUBLISHING.md` | How to publish and list the plugin |

## Requirements

- DSH `>= 0.2.2-rc.1`, Web platform (Desktop or browser).
- A profile that already has an MCP client row for Godot (for example
  `@deepseek-ai/dsh-mcp-client` with `serverName: godot` and
  `transport: streamable-http`).

## Notes

- The badge follows every MCP server in the profile; it names Godot specially
  when the connected server is `godot`.
- Drag the tile to move it; the drop position is clamped to the window and saved
  in `localStorage` under `dsh-godot-mcp-status:position`, so it survives a page
  reload of the same origin. Dragging 4 px or less is treated as a click, so the
  hover bubble still works.
- Default placement is 12 px from the right and 30 px from the bottom, clear of
  the bottom-right corner controls used by other overlay plugins. The bubble flips
  below the tile near the top edge and anchors from the left near the left edge.
- The in-app mark is the official Godot logo, inlined as SVG paths. The Godot
  logo is by Andrea Calabró and the Godot Engine contributors, licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the logo is a
  trademark of the Godot Foundation and is used here only to identify a Godot
  MCP connection. See <https://godotengine.org/press>.
- This plugin's own code and artwork composition are MIT licensed (see
  `LICENSE`).

## 中文

插件名：**Godot MCP 连接状态**。

Godot 编辑器一启动，主界面右下角就出现一个 32px 的 Godot 图标（官方 logo，白色描边
+ 引擎蓝），右下角带「MCP」角标；编辑器关掉，图标随之消失。

- 角标文字前的圆点：MCP 连接上时是**蓝色**，编辑器在跑但 DSH 还没连上时是**灰色**。
- 鼠标悬停：蓝点时提示「已连接上Godot MCP」，灰点时提示「未连接上Godot MCP」。
- 按住图标可以拖到窗口任意位置，松手后位置记在 localStorage 里。

Godot logo 由 Andrea Calabró 与 Godot Engine 贡献者创作，采用 CC BY 4.0 许可，
是 Godot Foundation 的商标，此处仅用于标识 Godot MCP 连接；插件自身代码为 MIT。

判断依据分两件事：一是对配置里的 HTTP 端点做 TCP 探测——端口在监听就显示图标，不
在就隐藏，与 DSH 是否连上无关；二是数工具注册表里 `mcp__godot__*` 的数量——有工具
说明 DSH 真的连上了，圆点变蓝，没有就是灰点。

安装后需要刷新一次页面才会加载这个 UI。

MIT 许可证。
