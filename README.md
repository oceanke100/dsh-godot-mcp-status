# dsh-godot-mcp-status

A DSH Web UI plugin: while DeepSeek Harness is connected to a Godot MCP server,
the Godot logo with an **MCP** corner tag stays in the bottom-right of the app.
Nothing is shown while the connection is absent. Hovering or focusing the tile
raises the bubble **Connected to Godot MCP** (中文界面：**已连接上Godot MCP**).

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

The Host half computes the state on demand and serves it as JSON at
`/godot-mcp-badge/state.json`:

1. It walks the active loader rows and keeps those whose resolved configuration
   has a `serverName` plus a `stdio` or `streamable-http` transport — the MCP
   client row's own shape — to learn each server's name, transport, and endpoint.
2. It counts the `mcp__<server>__<tool>` definitions in the live tool registry.
   The MCP bridge publishes those only after a successful connection and tool
   discovery, and removes them when the connection is disposed or its reconnect
   budget is exhausted.
3. For Streamable HTTP servers it probes the endpoint's TCP port, so the badge
   disappears on the next poll after the editor stops listening instead of
   waiting for the reconnect budget to run out.

A server counts as connected when it contributes at least one tool and (for HTTP)
its port still answers. Nothing is installed, no editor state is written, and the
probe opens no MCP session — it only connects a socket and closes it.

The Client half registers a seat in `shell.overlay` (frame-wide, click-through)
and polls that route every 2.5 s while the page is open. Only the 32 px tile opts
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
- Placement is `right: 12px; bottom: 30px`, clear of the bottom-right corner
  controls used by other overlay plugins.
- The in-app mark is the official Godot logo, inlined as SVG paths. The Godot
  logo is by Andrea Calabró and the Godot Engine contributors, licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the logo is a
  trademark of the Godot Foundation and is used here only to identify a Godot
  MCP connection. See <https://godotengine.org/press>.
- This plugin's own code and artwork composition are MIT licensed (see
  `LICENSE`).

## 中文

插件名：**Godot MCP 连接状态**。

连上 Godot MCP 后，主界面右下角出现一个 32px 的 Godot 图标（官方 logo，白色描边
+ 引擎蓝），右下角带「MCP」角标，鼠标悬停弹出气泡「已连接上Godot MCP」；没连上时
完全不显示。

Godot logo 由 Andrea Calabró 与 Godot Engine 贡献者创作，采用 CC BY 4.0 许可，
是 Godot Foundation 的商标，此处仅用于标识 Godot MCP 连接；插件自身代码为 MIT。

判断依据：读取 profile 里 MCP 客户端行的配置（服务器名、传输方式、端点）、数工具
注册表里 `mcp__godot__*` 的数量，并对 HTTP 端点做一次 TCP 端口探测。三者同时成立
才算连接——所以关掉 Godot 后几秒内角标就会消失，不必等 MCP 客户端把重连预算耗尽。

安装后需要刷新一次页面才会加载这个 UI。

MIT 许可证。
