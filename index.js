/**
 * Host half of the Godot MCP status badge.
 *
 * Reports whether DSH currently has a live MCP connection, using two facts it can
 * read from the running harness:
 *
 *  1. Which MCP servers are configured — the active loader rows whose resolved
 *     configuration carries an MCP client shape (server name, transport, endpoint).
 *  2. Whether that server's tools are registered — the MCP bridge publishes
 *     `mcp__<server>__<tool>` only after a successful connection and discovery, and
 *     removes them when the connection is disposed or its reconnect budget runs out.
 *
 * For Streamable HTTP servers it also probes the endpoint's TCP port, so the badge
 * disappears within one poll after the editor stops listening instead of waiting for
 * the reconnect budget to expire.
 */

import net from 'node:net'

export const name = 'dsh-godot-mcp-status'
export const inject = ['tools', 'webServer']

const PREFIX = '/godot-mcp-badge'
const PROBE_TIMEOUT_MS = 1200
const PROBE_TTL_MS = 3000
const STATE_TTL_MS = 700

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
    let reachable = null
    if (server.transport === 'streamable-http' && server.url !== '') {
      reachable = await probe(server.url)
    }
    reported.push({
      name: server.name,
      transport: server.transport,
      url: server.url,
      tools,
      reachable,
      // Tools without a probe result are the only evidence available for stdio
      // servers; HTTP servers must also answer on their port.
      connected: tools > 0 && reachable !== false,
    })
  }

  return {
    connected: reported.some((server) => server.connected === true),
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
      try {
        dispose()
      } catch {
        /* the route may already be gone with the fiber teardown */
      }
    }
  }, 'godot-mcp-status: state route')
}
