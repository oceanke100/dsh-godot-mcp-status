/**
 * Host half of the Godot MCP status badge.
 *
 * Reports two separate facts, because the badge answers two questions:
 *
 *  - `running`: is the MCP endpoint up? The Streamable HTTP probe answers this, so
 *    the badge appears as soon as the Godot editor starts listening and disappears
 *    as soon as it stops — independent of whether DSH is connected.
 *  - `connected`: does DSH hold that server's tools? The MCP bridge publishes
 *    `mcp__<server>__<tool>` only after a successful connection and discovery, and
 *    removes them when the connection is disposed or its reconnect budget runs out.
 *
 * Server rows come from the active loader entries whose resolved configuration
 * carries an MCP client shape (server name, transport, endpoint); the live tool
 * registry supplies the per-server tool counts.
 */

import { execFile } from 'node:child_process'
import net from 'node:net'

export const name = 'dsh-godot-mcp-status'
export const inject = ['tools', 'webServer']

const PREFIX = '/godot-mcp-badge'
const PROBE_TIMEOUT_MS = 1200
const PROBE_TTL_MS = 2000
const STATE_TTL_MS = 600
const EDITOR_SCAN_TTL_MS = 3500

/** Read the configured MCP servers from the active loader rows. */
function readConfiguredServers(ctx) {
  const editor = ctx.get('configEditor')
  if (editor === undefined || editor === null || typeof editor.configuration !== 'function') return []

  let rows
  try {
    rows = editor.configuration()
  } catch {
    return []
  }
  if (!Array.isArray(rows)) return []

  const servers = []
  const seen = new Set()
  for (const row of rows) {
    const entry = row !== null && typeof row === 'object' ? row.entry : undefined
    if (entry === null || entry === undefined) continue

    // A loader row's Fiber exposes the module options (and usually the package
    // name) under `options`; the resolved config is split between the bundle
    // layer (`inherited`), the user's patch (`override`), and the entry itself.
    const options = entry.options !== null && typeof entry.options === 'object' ? entry.options : {}
    const config = Object.assign(
      {},
      row.inherited,
      row.override,
      options.config !== null && typeof options.config === 'object' ? options.config : {},
      entry.config !== null && typeof entry.config === 'object' ? entry.config : {},
    )

    const serverName = typeof config.serverName === 'string' ? config.serverName : ''
    if (serverName === '' || seen.has(serverName)) continue

    // `serverName` plus one of the two transports is the MCP client row's own
    // configuration shape; it identifies the row even when the installed loader
    // does not expose the package name on the Fiber.
    let transport = ''
    if (config.transport === 'stdio') transport = 'stdio'
    else if (config.transport === 'streamable-http') transport = 'streamable-http'
    if (transport === '') continue

    seen.add(serverName)
    servers.push({
      name: serverName,
      transport,
      url: typeof config.url === 'string' ? config.url : '',
    })
  }
  return servers
}

/** Count the tools each MCP server currently contributes to the global registry. */
function countMcpTools(ctx) {
  const counts = new Map()
  let definitions
  try {
    definitions = ctx.tools.definitions()
  } catch {
    return counts
  }
  if (!Array.isArray(definitions)) return counts

  for (const definition of definitions) {
    const toolName = definition !== null && typeof definition === 'object' && typeof definition.name === 'string'
      ? definition.name
      : ''
    const match = /^mcp__([A-Za-z0-9_-]{1,32})__/.exec(toolName)
    if (match === null) continue
    counts.set(match[1], (counts.get(match[1]) || 0) + 1)
  }
  return counts
}

const probeCache = new Map()

/** TCP-level liveness of one endpoint: an open port answers, a dead one refuses. */
function probeSocket(url) {
  return new Promise((resolve) => {
    let target
    try {
      target = new URL(url)
    } catch {
      resolve(null)
      return
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      resolve(null)
      return
    }
    const port = Number(target.port || (target.protocol === 'https:' ? 443 : 80))

    let socket
    try {
      socket = net.connect({ host: target.hostname, port })
    } catch {
      resolve(null)
      return
    }

    let settled = false
    const finish = (alive) => {
      if (settled) return
      settled = true
      try {
        socket.destroy()
      } catch {
        /* the socket may already be gone */
      }
      resolve(alive)
    }
    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

function probe(url) {
  const cached = probeCache.get(url)
  if (cached !== undefined && Date.now() - cached.at < PROBE_TTL_MS) return Promise.resolve(cached.alive)
  return probeSocket(url).then((alive) => {
    probeCache.set(url, { at: Date.now(), alive })
    return alive
  })
}

let editorScan = { at: 0, running: null }

/**
 * Whether a Godot editor process is running on this machine.
 *
 * The badge follows the editor, not the MCP server: turning the server off inside
 * a running editor must keep the badge on screen with a gray dot. A closed editor
 * leaves nothing to attach to, so the badge disappears.
 *
 * Returns null when the platform cannot be scanned; callers then fall back to the
 * endpoint probe alone.
 */
function godotEditorRunning() {
  if (Date.now() - editorScan.at < EDITOR_SCAN_TTL_MS) return Promise.resolve(editorScan.running)

  const windows = process.platform === 'win32'
  const file = windows ? 'tasklist' : 'ps'
  const args = windows ? ['/FO', 'CSV', '/NH'] : ['-A', '-o', 'comm=']
  const pattern = windows ? /^"(godot[^"]*)"/i : /(^|\/)(godot[^/\s]*)$/i

  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { windowsHide: true, timeout: 4000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout) => {
        let running = null
        if (error === null || error === undefined) {
          const text = typeof stdout === 'string' ? stdout : String(stdout === undefined || stdout === null ? '' : stdout)
          running = false
          for (const line of text.split(/\r?\n/)) {
            if (pattern.test(line.trim())) {
              running = true
              break
            }
          }
        }
        editorScan = { at: Date.now(), running }
        resolve(running)
      },
    )
  })
}

async function computeState(ctx) {
  const servers = readConfiguredServers(ctx)
  const counts = countMcpTools(ctx)

  // A server whose tools exist but whose row is not visible to `configEditor`
  // still counts: the registry is the authoritative signal.
  const known = new Set(servers.map((server) => server.name))
  for (const serverName of counts.keys()) {
    if (known.has(serverName)) continue
    known.add(serverName)
    servers.push({ name: serverName, transport: 'unknown', url: '' })
  }

  const reported = []
  for (const server of servers) {
    const tools = counts.get(server.name) || 0
    const probeable = server.transport === 'streamable-http' && server.url !== ''
    const reachable = probeable ? await probe(server.url) : null

    // A stdio server and an unconfigured row have no port to probe, so their
    // registered tools are the only evidence available.
    const listening = probeable ? reachable === true : tools > 0

    reported.push({
      name: server.name,
      transport: server.transport,
      url: server.url,
      tools,
      reachable,
      listening,
      // Blue dot: the endpoint answers AND DSH holds that server's tools.
      connected: tools > 0 && (probeable ? reachable === true : true),
    })
  }

  const listening = reported.some((server) => server.listening === true)

  // The process fallback only makes sense for a Godot MCP server. A profile with
  // no MCP row at all (or one that has nothing to do with Godot) stays inert
  // instead of showing a badge for whatever Godot editor happens to be open.
  const godotServer = servers.some(
    (server) => /godot/i.test(server.name) === true || /godot/i.test(server.url) === true,
  )
  const editorRunning = godotServer === true ? (listening ? true : await godotEditorRunning()) : null

  // The badge follows the editor, not the MCP server: it stays visible (with a
  // gray dot) while Godot runs with its MCP server turned off.
  const visible = reported.length > 0 && (listening || editorRunning === true)

  return {
    visible,
    connected: reported.some((server) => server.connected === true),
    editorRunning,
    listening,
    servers: reported,
    checkedAt: Date.now(),
  }
}

export function apply(ctx) {
  let cached = null
  let cachedAt = 0
  let inflight = null

  function state() {
    if (cached !== null && Date.now() - cachedAt < STATE_TTL_MS) return Promise.resolve(cached)
    if (inflight !== null) return inflight
    inflight = computeState(ctx)
      .then((next) => {
        cached = next
        cachedAt = Date.now()
        return next
      })
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'exact',
      path: `${PREFIX}/state.json`,
      handler: async (req, res) => {
        if (req.method !== undefined && req.method !== 'GET') {
          res.writeHead(405, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify({ connected: false, servers: [], error: `method ${req.method} is not allowed` }))
          return
        }

        let payload
        try {
          payload = await state()
        } catch (error) {
          payload = {
            connected: false,
            servers: [],
            error: error instanceof Error ? error.message : String(error),
          }
        }

        const body = JSON.stringify(payload)
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'content-length': String(Buffer.byteLength(body)),
        })
        res.end(body)
      },
    })

    return () => {
      cached = null
      cachedAt = 0
      probeCache.clear()
      editorScan = { at: 0, running: null }
      try {
        dispose()
      } catch {
        /* the route may already be gone with the fiber teardown */
      }
    }
  }, 'godot-mcp-status: state route')
}
