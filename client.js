/**
 * Client half of the Godot MCP status badge.
 *
 * A frame-wide, click-through seat (`shell.overlay`) that polls the Host half's
 * state route. Renders nothing until DSH reports a live Godot MCP connection, then
 * shows the Godot robot tile with an "MCP" corner tag; hovering (or focusing) it
 * raises the connection bubble.
 */

window.__ModuleLoader__.load({
  id: 'dsh-godot-mcp-status',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'godot-mcp-status'
    const STATE_URL = '/godot-mcp-badge/state.json'
    const POLL_MS = 2500

    /** Bound once in `apply`; the seat's `t` prop takes priority when present. */
    let boundT = null

    const zh = {
      connectedGodot: '已连接上Godot MCP',
      connectedMcp: '已连接上 MCP',
    }
    const en = {
      connectedGodot: 'Connected to Godot MCP',
      connectedMcp: 'Connected to MCP',
    }

    const CSS = [
      '.gmcp-seat{position:fixed;right:12px;bottom:30px;z-index:64;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      '.gmcp-badge{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 3px 12px rgba(0,0,0,.2);cursor:default;pointer-events:auto;outline:none;transition:transform .15s ease,box-shadow .15s ease}',
      '.gmcp-badge:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.28)}',
      '.gmcp-badge:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}',
      '.gmcp-mark{display:block;width:23px;height:23px}',
      '.gmcp-tag{position:absolute;right:-7px;bottom:-6px;box-sizing:border-box;height:12px;padding:0 3px;border-radius:5px;background:linear-gradient(135deg,#478CBF,#6A46B8);color:#fff;font:700 7px/12px ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;box-shadow:0 0 0 1px var(--dsw-alias-bg-overlay);pointer-events:none}',
      '.gmcp-tip{position:absolute;right:-4px;bottom:calc(100% + 9px);z-index:2;white-space:nowrap;padding:5px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:500 12px/17px ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.24);pointer-events:none;animation:gmcp-tip-in .14s ease-out both}',
      '.gmcp-tip::after{content:"";position:absolute;right:14px;top:100%;width:7px;height:7px;margin-top:-4px;transform:rotate(45deg);border-right:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay)}',
      '@keyframes gmcp-tip-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.gmcp-badge{transition:none}.gmcp-tip{animation:none}}',
    ].join('')

    /** The Godot-style robot tile: original artwork in the engine's blue. */
    function RobotMark() {
      return h(
        'svg',
        {
          className: 'gmcp-mark',
          viewBox: '0 0 32 32',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h(
          'defs',
          null,
          h(
            'linearGradient',
            { id: 'gmcp-head', x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
            h('stop', { offset: '0%', stopColor: '#5AA7DE' }),
            h('stop', { offset: '100%', stopColor: '#2F6C9E' }),
          ),
        ),
        h('path', {
          d: 'M11 8.4 8.6 4.9M21 8.4 23.4 4.9',
          stroke: '#9EC6E8',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          fill: 'none',
        }),
        h('circle', { cx: 8.3, cy: 4, r: 1.9, fill: '#C9E0F2' }),
        h('circle', { cx: 23.7, cy: 4, r: 1.9, fill: '#C9E0F2' }),
        h('rect', { x: 3, y: 7, width: 26, height: 23, rx: 8, fill: 'url(#gmcp-head)' }),
        h('ellipse', { cx: 11.4, cy: 16.4, rx: 3.6, ry: 4.1, fill: '#FFFFFF' }),
        h('ellipse', { cx: 20.6, cy: 16.4, rx: 3.6, ry: 4.1, fill: '#FFFFFF' }),
        h('circle', { cx: 12, cy: 17, r: 1.7, fill: '#17374F' }),
        h('circle', { cx: 20, cy: 17, r: 1.7, fill: '#17374F' }),
        h('path', {
          d: 'M13.4 23.4q2.6 1.9 5.2 0',
          stroke: '#17374F',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          fill: 'none',
          opacity: 0.75,
        }),
      )
    }

    function normalize(body) {
      if (body === null || typeof body !== 'object') return { connected: false, servers: [] }
      const servers = Array.isArray(body.servers)
        ? body.servers.filter(
            (server) =>
              server !== null &&
              typeof server === 'object' &&
              typeof server.name === 'string' &&
              server.connected === true,
          )
        : []
      return { connected: body.connected === true, servers }
    }

    /** Poll the Host state route for this component's lifetime. */
    function useStatus() {
      const [status, setStatus] = React.useState(null)

      React.useEffect(() => {
        let alive = true
        let timer = null
        const controller = typeof AbortController === 'function' ? new AbortController() : null

        async function tick() {
          let next
          try {
            const response = await fetch(STATE_URL, {
              method: 'GET',
              cache: 'no-store',
              headers: { accept: 'application/json' },
              signal: controller === null ? undefined : controller.signal,
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            next = normalize(await response.json())
          } catch {
            // A missing route or a stopped Host half is simply "not connected".
            next = { connected: false, servers: [] }
          }
          if (!alive) return
          setStatus((previous) => {
            if (previous === null) return next
            const same =
              previous.connected === next.connected &&
              previous.servers.length === next.servers.length &&
              previous.servers.every((server, index) => server.name === next.servers[index].name)
            return same ? previous : next
          })
          timer = window.setTimeout(tick, POLL_MS)
        }

        tick()
        return () => {
          alive = false
          if (timer !== null) window.clearTimeout(timer)
          if (controller !== null) controller.abort()
        }
      }, [])

      return status
    }

    function GodotMcpBadge(props) {
      const t = props !== null && typeof props.t === 'function' ? props.t : boundT !== null ? boundT : (key) => key
      const status = useStatus()
      const [hovered, setHovered] = React.useState(false)

      if (status === null || status.connected !== true) return null

      const names = status.servers.map((server) => server.name)
      const single = names.length === 1 ? names[0] : ''
      const label = single !== '' && single.toLowerCase() === 'godot' ? t('connectedGodot') : t('connectedMcp')

      return h(
        React.Fragment,
        null,
        h('style', { 'data-godot-mcp-status': 'styles' }, CSS),
        h(
          'div',
          { className: 'gmcp-seat' },
          h(
            'div',
            {
              className: 'gmcp-badge',
              role: 'status',
              'aria-label': label,
              tabIndex: 0,
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
              onFocus: () => setHovered(true),
              onBlur: () => setHovered(false),
            },
            h(RobotMark),
            h('span', { className: 'gmcp-tag', 'aria-hidden': 'true' }, 'MCP'),
            hovered ? h('div', { className: 'gmcp-tip', role: 'tooltip' }, label) : null,
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        boundT = ctx.locale.bind(NS)
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'godot-mcp-status: dictionaries')
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'godot-mcp-status',
              order: 64,
              locale: NS,
              inject: () => ({}),
            },
            GodotMcpBadge,
          ),
        )
      },
    }
  },
})
