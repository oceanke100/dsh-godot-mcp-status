# dsh-godot-mcp-status · Godot MCP 连接状态


## 是什么 / What it is

Godot 编辑器一启动，主界面右下角就会出现一个带「MCP」角标的 Godot 图标；编辑器关掉，
图标随之消失。角标文字前有一个状态圆点：**蓝色**表示 DSH 已经连上 Godot MCP，
**灰色**表示编辑器在跑但这会儿没连上。鼠标悬停会弹出对应的气泡（已连接 / 未连接），
按住图标可以拖到窗口任意位置。

While the Godot editor is running, the Godot logo with an **MCP** corner tag stays in
the bottom-right of the app; it disappears when the editor closes. A status dot sits
before the tag text: **blue** while DSH is connected to the Godot MCP server,
**gray** while the editor is up but DSH is not connected. Hovering shows the matching
bubble, and the tile can be dragged anywhere in the window.

它回答一个一眼可见的问题：编辑器里的 MCP 现在是活的吗，智能体能不能真的用
`mcp__godot__*` 工具？ It answers one question at a glance: is the editor's MCP server
live right now, so the agent can actually use `mcp__godot__*` tools?

## 安装 / Install

- 市场：在 **设置 → 插件 → 发现** 里添加列出本插件的索引源，然后从卡片安装。发布后本仓库
  自带索引位于 `https://<GITHUB_USER>.github.io/dsh-godot-mcp-status/index.json`。
- npm：发布后直接用包名 `dsh-godot-mcp-status` 安装。
- 本地目录：用插件管理器（`install_bundle`）指向本仓库根目录。
- 装完刷新一次页面：角标是客户端模块，已打开的页面要重新加载才会出现。

- Market: add the index that lists this package under **Settings → Plugins →
  Discover**, then install it. Once published, this repository's own index lives at
  `https://<GITHUB_USER>.github.io/dsh-godot-mcp-status/index.json`.
- npm: install the package name `dsh-godot-mcp-status` once published.
- Folder: point the Plugin Manager (`install_bundle`) at this repository root.
- Reload the page once: the badge is a Client module, so an open page needs a
  refresh.

不需要任何配置，它跟随 profile 里已有的 MCP 服务器。
No configuration; it follows whatever MCP servers the profile has configured.

## 判断依据 / How the state is decided

Host 半边现算现报，`/godot-mcp-badge/state.json` 返回 JSON，把两件事分开：

- **编辑器在不在**：MCP 端口开着就直接看端口；端口关了（比如在编辑器里把 MCP 插件关掉）
  就退回进程扫描——Windows 用 `tasklist`、其他平台用 `ps`，找 Godot 编辑器进程，缓存 3.5 秒。
  所以开着编辑器图标就在，关掉编辑器才消失。
- **DSH 连没连上**：数工具注册表里 `mcp__<server>__<tool>` 的定义。MCP 桥只有在连接成功并
  完成工具发现后才注册它们，连接释放或重连预算耗尽就移除。这就是那个圆点：端点应答且贡献
  工具时变蓝，否则灰色。

The Host half computes both facts on demand and serves them as JSON at
`/godot-mcp-badge/state.json`, keeping them separate:

- **Is the editor running?** Usually a TCP probe of the configured endpoint answers it,
  and the badge follows that port. When the port is closed — the MCP server was turned
  off inside the editor — the Host half scans the process list for a Godot editor
  (`tasklist` on Windows, `ps` elsewhere, cached for 3.5 s). The badge stays while the
  editor is open and disappears when the editor process is gone.
- **Is DSH connected to it?** The `mcp__<server>__<tool>` definitions in the live tool
  registry answer it. The MCP bridge publishes them only after a successful connection
  and tool discovery, and removes them when the connection is disposed or its reconnect
  budget is exhausted. That is the dot: blue when the endpoint answers and contributes
  tools, gray otherwise.

服务器行来自 loader 里那些配置带 `serverName` 加 `stdio` 或 `streamable-http` 传输方式的
条目。不安装任何东西、不写编辑器状态；端口探测只建立一个 socket 然后关掉，不打开 MCP 会话。
客户端半边在 `shell.overlay` 注册一个全窗口单点击穿席位，页面打开期间每 2 秒轮询一次，只有
那 32px 的图标接收鼠标事件。

**没配 MCP 也能装**：插件会正常激活，但什么都不显示——没有 MCP 服务器行就没有可显示的
状态。进程扫描也只在配置了名字或地址含 `godot` 的服务器时才启用，不会因为你机器上开着别的
Godot 就冒出一个灰点。

A server row comes from the active loader entries whose resolved configuration has a
`serverName` plus a `stdio` or `streamable-http` transport. Nothing is installed, no
editor state is written, and the probe opens no MCP session — it only connects a
socket and closes it. The Client half registers a seat in `shell.overlay`
(frame-wide, click-through) and polls that route every 2 s while the page is open;
only the 32 px tile opts into pointer events.

**It installs fine without an MCP server**: the plugin activates and shows nothing,
because there is no MCP server row to report on. The process scan also runs only
when a configured server's name or URL mentions `godot`, so an unrelated Godot
editor on the machine never produces a badge.

## 文件 / Files

| 文件 File | 作用 | Role |
|---|---|---|
| `index.js` | Host 半边：状态路由与检测 | Host row: state route and detection |
| `client.js` | 客户端模块：浮层席位、Godot logo、气泡 | Client module: overlay seat, Godot logo, bubble |
| `cordis.patch.yml` | 插入 Host 行 | Inserts the Host row |
| `locale/*.json` | 插件管理器的标题/描述与角标文案 | Plugin Manager title/description and badge text |
| `icon.svg` | 插件图标 | Package icon |
| `docs/index.json` | GitHub Pages 上的市场索引，发布前填占位符 | Market index served by GitHub Pages |
| `docs/README.md` | 索引的填写与部署说明 | How to fill and deploy that index |
| `PUBLISHING.md` | 三层发布流程（GitHub / npm / 索引） | The three publishing layers, in order |

## 环境要求 / Requirements

- DSH `>= 0.2.2-rc.1`，Web 平台（桌面版或浏览器）。
- profile 里已经有 Godot 的 MCP 客户端行，例如 `@deepseek-ai/dsh-mcp-client`，`serverName`
  为 `godot`，`transport` 为 `streamable-http`。

- DSH `>= 0.2.2-rc.1`, Web platform (Desktop or browser).
- A profile that already has an MCP client row for Godot, for example
  `@deepseek-ai/dsh-mcp-client` with `serverName: godot` and
  `transport: streamable-http`.

## 说明与许可 / Notes & license

拖动：松手位置会被限制在窗口内，并存在 `localStorage` 的
`dsh-godot-mcp-status:position` 里，同一来源刷新后回到原位；移动不足 4px 算点击，所以悬停
气泡不受影响。默认位置离右边 12px、离底部 30px，避开其它浮层插件占用的右下角；气泡在靠近
顶边时翻到下方，靠近左边时改为左对齐。

Drag: the drop position is clamped to the window and saved in `localStorage` under
`dsh-godot-mcp-status:position`, so it returns after a reload of the same origin;
moving 4 px or less counts as a click, which keeps the hover bubble working. Default
placement is 12 px from the right and 30 px from the bottom, clear of the bottom-right
corner controls used by other overlay plugins; the bubble flips below the tile near
the top edge and anchors from the left near the left edge.

图标是官方 Godot logo（内联为 SVG 路径）。Godot logo 由 Andrea Calabró 与 Godot Engine
贡献者创作，采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可，是 Godot
Foundation 的商标，此处仅用于标识 Godot MCP 连接（见 <https://godotengine.org/press>）。
本插件自身代码与图标组合为 MIT 许可（见 `LICENSE`）。

The in-app mark is the official Godot logo, inlined as SVG paths. The Godot logo is by
Andrea Calabró and the Godot Engine contributors, licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); it is a trademark of the
Godot Foundation and is used here only to identify a Godot MCP connection (see
<https://godotengine.org/press>). This plugin's own code and artwork composition are
MIT licensed (see `LICENSE`).

## 发布 / Publishing

三层分工、版本线、每次发版的固定顺序都在 `PUBLISHING.md`；自带索引的填写与 GitHub Pages
部署在 `docs/README.md`。

The three layers, the version line and the per-release order are in `PUBLISHING.md`;
filling in and deploying this repository's own index is in `docs/README.md`.
