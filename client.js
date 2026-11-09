/**
 * Client half of the Godot MCP status badge.
 *
 * A frame-wide, click-through seat (`shell.overlay`) that polls the Host half's
 * state route. Renders nothing unless the Godot editor is running; while it runs,
 * shows the Godot logo with an MCP tag whose dot is blue when DSH is connected and
 * gray when it is not, and hovering raises the matching bubble.
 */

window.__ModuleLoader__.load({
  id: 'dsh-godot-mcp-status',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'godot-mcp-status'
    const STATE_URL = '/godot-mcp-badge/state.json'
    const POLL_MS = 2000

    /** Bound once in `apply`; the seat's `t` prop takes priority when present. */
    let boundT = null

    const zh = {
      connectedGodot: '已连接上Godot MCP',
      connectedMcp: '已连接上 MCP',
      disconnectedGodot: '未连接上Godot MCP',
      disconnectedMcp: '未连接上 MCP',
      detectedGodot: '检测到 Godot MCP，尚未配置',
      panelTitle: '接入 Godot MCP',
      panelHint: '把下面这段加到 profile 的 cordis.patch.yml，然后重载配置。',
      copy: '复制',
      copied: '已复制',
      close: '关闭',
    }
    const en = {
      connectedGodot: 'Connected to Godot MCP',
      connectedMcp: 'Connected to MCP',
      disconnectedGodot: 'Not connected to Godot MCP',
      disconnectedMcp: 'Not connected to MCP',
      detectedGodot: 'Godot MCP detected — not configured yet',
      panelTitle: 'Connect Godot MCP',
      panelHint: 'Add this to the profile’s cordis.patch.yml, then reload the configuration.',
      copy: 'Copy',
      copied: 'Copied',
      close: 'Close',
    }

    const CSS = [
      '.gmcp-seat{position:fixed;left:0;top:0;z-index:64;display:flex;align-items:center;justify-content:center;pointer-events:none}',
      '.gmcp-badge{position:relative;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);box-shadow:0 3px 12px rgba(0,0,0,.2);cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;outline:none;transition:transform .15s ease,box-shadow .15s ease}',
      '.gmcp-badge:not(.is-dragging):hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.28)}',
      '.gmcp-badge.is-dragging{cursor:grabbing;transform:none;box-shadow:0 8px 22px rgba(0,0,0,.32);transition:none}',
      '.gmcp-badge:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary)}',
      '.gmcp-mark{display:block;width:25px;height:16px}',
      '.gmcp-tag{position:absolute;right:-7px;bottom:-6px;box-sizing:border-box;display:inline-flex;align-items:center;gap:3px;height:12px;padding:0 4px 0 3px;border-radius:5px;background:linear-gradient(135deg,#478CBF,#6A46B8);color:#fff;font:700 7px/12px ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.06em;box-shadow:0 0 0 1px var(--dsw-alias-bg-overlay);pointer-events:none}',
      '.gmcp-dot{display:block;flex:none;width:5px;height:5px;border-radius:50%;background:#98a1ac;box-shadow:0 0 0 1px rgba(12,18,26,.4);transition:background .15s ease,box-shadow .15s ease}',
      '.gmcp-dot.is-on{background:#5cc8ff;box-shadow:0 0 0 1px rgba(12,18,26,.4),0 0 5px rgba(92,200,255,.9)}',
      '.gmcp-tip{position:absolute;right:-4px;bottom:calc(100% + 9px);z-index:2;white-space:nowrap;padding:5px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:500 12px/17px ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.24);pointer-events:none;animation:gmcp-tip-in .14s ease-out both}',
      '.gmcp-tip::after{content:"";position:absolute;right:14px;top:100%;width:7px;height:7px;margin-top:-4px;transform:rotate(45deg);border-right:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay)}',
      '.gmcp-tip[data-place="below"]{bottom:auto;top:calc(100% + 9px)}',
      '.gmcp-tip[data-place="below"]::after{top:auto;bottom:100%;margin-top:0;margin-bottom:-4px;transform:rotate(225deg)}',
      '.gmcp-tip[data-align="start"]{right:auto;left:-4px}',
      '.gmcp-tip[data-align="start"]::after{right:auto;left:14px}',
      '.gmcp-badge.is-actionable{cursor:pointer}',
      '.gmcp-panel{position:absolute;right:-4px;bottom:calc(100% + 10px);z-index:4;box-sizing:border-box;width:300px;max-width:calc(100vw - 24px);padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);box-shadow:0 10px 28px rgba(0,0,0,.3);pointer-events:auto;cursor:auto;font:500 12px/17px ui-sans-serif,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;animation:gmcp-tip-in .14s ease-out both}',
      '.gmcp-panel[data-place="below"]{bottom:auto;top:calc(100% + 10px)}',
      '.gmcp-panel[data-align="start"]{right:auto;left:-4px}',
      '.gmcp-panel-head{display:flex;align-items:center;gap:8px;margin:0 0 6px}',
      '.gmcp-panel-title{flex:1;font-size:12px;font-weight:600}',
      '.gmcp-panel-close{flex:none;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:600 14px/1 ui-sans-serif,system-ui,sans-serif;cursor:pointer}',
      '.gmcp-panel-close:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}',
      '.gmcp-snippet{margin:0 0 8px;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:11px/15px ui-monospace,Consolas,"Cascadia Mono",monospace;white-space:pre;overflow:auto;max-height:180px;cursor:text;user-select:text;-webkit-user-select:text}',
      '.gmcp-panel-hint{margin:0 0 8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:15px}',
      '.gmcp-panel-foot{display:flex;justify-content:flex-end;gap:6px}',
      '.gmcp-copy{height:26px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:600 12px/24px ui-sans-serif,system-ui,sans-serif;cursor:pointer}',
      '.gmcp-copy:hover{background:var(--dsw-alias-bg-layer-2)}',
      '@keyframes gmcp-tip-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.gmcp-badge{transition:none}.gmcp-tip{animation:none}}',
    ].join('')

    /**
     * The Godot logo, inlined so the badge needs no asset URL or network fetch.
     * Path data comes from the official logo artwork; see README for attribution.
     */
    const GODOT_LOGO_PATHS = [
      { d: 'm90.133 65.7s-.133-.818-.211-.81l-14.843 1.43a2.412 2.412 0 0 0 -2.181 2.24l-.408 5.844-11.483.82-.78-5.297a2.433 2.433 0 0 0 -2.394-2.067h-15.666c-1.19 0-2.22.889-2.393 2.067l-.781 5.296-11.483-.819-.408-5.844a2.413 2.413 0 0 0 -2.181-2.24l-14.851-1.43c-.077-.007-.133.812-.21.812l-.02 3.212 12.577 2.028.411 5.896a2.431 2.431 0 0 0 2.241 2.245l15.815 1.128a2.431 2.431 0 0 0 2.568-2.06l.803-5.45h11.488l.804 5.45a2.432 2.432 0 0 0 2.565 2.06l15.817-1.128a2.432 2.432 0 0 0 2.24-2.245l.412-5.896 12.572-2.037z', fill: '#fff', strokeWidth: 0.32 },
      { d: 'm40.764 4.2a2.574 2.574 0 0 0 -.666.064c-4.332.963-8.688 2.318-12.83 4.402a2.773 2.773 0 0 0 -1.525 2.55c.074 2.886.326 5.694.644 8.529-1.077.645-2.154 1.232-3.342 2.185-.845.65-1.788 1.473-2.71 2.236-2.15-1.349-4.32-2.692-6.62-3.85a2.773 2.773 0 0 0 -3.279.59c-3.126 3.366-6.098 7.048-8.553 11.224a2.773 2.773 0 0 0 .034 2.863c1.623 2.625 3.351 5.08 5.171 7.459v29.805c0 8.223 5.472 14.496 13.3 18.238 7.826 3.742 18.184 5.452 29.575 5.492h.075c11.39-.04 21.749-1.75 29.574-5.492s13.295-10.016 13.295-18.238l.004-29.031c1.848-2.712 3.382-5.334 5.173-8.23.54-.875.553-1.976.034-2.862-2.454-4.177-5.429-7.86-8.555-11.225a2.773 2.773 0 0 0 -3.277-.59c-2.299 1.157-4.47 2.502-6.62 3.852-.922-.764-1.862-1.588-2.71-2.239-.004 0-.007 0-.01-.01-1.186-.95-2.259-1.537-3.332-2.18.317-2.833.57-5.642.644-8.529a2.773 2.773 0 0 0 -1.525-2.548c-4.143-2.085-8.498-3.44-12.833-4.403a2.773 2.773 0 0 0 -2.985 1.29c-1.4 2.353-2.601 4.855-3.763 7.325-1.035-.094-2.086-.238-3.088-.25h-.127c-1.004.012-2.056.156-3.092.25-1.115-2.372-2.277-4.764-3.615-7.035a2.773 2.773 0 0 0 -2.467-1.646z', fill: '#fff' },
      { d: 'm40.699 6.9c-4.178.929-8.31 2.222-12.185 4.172.089 3.421.31 6.7.758 10.029-1.505.964-3.086 1.791-4.491 2.92-1.428 1.098-2.887 2.15-4.18 3.434a80.027 80.027 0 0 0 -8.134-4.731c-3.036 3.267-5.874 6.794-8.193 10.74 1.744 2.822 3.566 5.468 5.532 7.978h.055v24.22c.045 0 .089 0 .133.01l14.848 1.432a1.599 1.599 0 0 1 1.441 1.48l.458 6.555 12.952.924.893-6.05a1.599 1.599 0 0 1 1.581-1.365h15.665c.793 0 1.466.581 1.582 1.365l.892 6.05 12.953-.924.458-6.555a1.6 1.6 0 0 1 1.441-1.48l14.842-1.432c.044 0 .088-.01.132-.01v-1.932h.006v-22.285h.055c1.967-2.511 3.787-5.157 5.533-7.979-2.318-3.946-5.159-7.473-8.195-10.74a80.158 80.158 0 0 0 -8.134 4.732c-1.292-1.285-2.748-2.336-4.178-3.435-1.405-1.128-2.989-1.956-4.49-2.92.447-3.33.668-6.607.757-10.029-3.875-1.95-8.007-3.243-12.187-4.171-1.669 2.804-3.195 5.841-4.524 8.81-1.576-.263-3.16-.36-4.745-.38h-.061c-1.588.02-3.17.117-4.747.38-1.328-2.969-2.853-6.006-4.525-8.81zm-30.862 61.966c.006 1.435.024 3.007.024 3.32 0 14.101 17.888 20.878 40.112 20.956h.055c22.224-.078 40.106-6.855 40.106-20.956 0-.319.02-1.884.026-3.32l-13.346 1.287-.46 6.59a1.6 1.6 0 0 1 -1.482 1.483l-15.816 1.128h-.115a1.599 1.599 0 0 1 -1.58-1.366l-.907-6.15h-12.905l-.907 6.15a1.598 1.598 0 0 1 -1.696 1.362l-15.816-1.128a1.599 1.599 0 0 1 -1.48-1.483l-.46-6.59z', fill: '#478cbf' },
      { d: 'm37.9 51.3a8.948 8.948 0 0 1 -17.895 0c0-4.94 4.007-8.944 8.947-8.944 4.942 0 8.948 4.003 8.948 8.944m12.1 9.8c-1.59 0-2.88-1.172-2.88-2.618v-8.237c0-1.444 1.29-2.618 2.88-2.618s2.883 1.174 2.883 2.618v8.237c0 1.446-1.292 2.618-2.883 2.618m12.101-9.8a8.947 8.947 0 0 0 8.949 8.949 8.947 8.947 0 0 0 8.946-8.949c0-4.94-4.007-8.944-8.946-8.944-4.943 0-8.949 4.003-8.949 8.944', fill: '#fff', strokeWidth: 0.32 },
      { d: 'm29.807 45.9a5.938 5.938 0 1 0 0 11.877 5.94 5.94 0 0 0 0-11.877zm40.383 0a5.938 5.938 0 0 0 -5.936 5.94 5.936 5.936 0 0 0 5.936 5.937 5.939 5.939 0 0 0 0-11.877z', fill: '#414042' },
    ]

    function GodotMark() {
      return h(
        'svg',
        {
          className: 'gmcp-mark',
          viewBox: '-26.95222077 2.76256937 153.96327688 93.22443063',
          preserveAspectRatio: 'xMidYMid meet',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        GODOT_LOGO_PATHS.map((path, index) =>
          h('path', { key: index, d: path.d, fill: path.fill, strokeWidth: path.strokeWidth }),
        ),
      )
    }

    function normalize(body) {
      if (body === null || typeof body !== 'object') {
        return { visible: false, connected: false, detectedUrl: null, servers: [] }
      }
      const servers = Array.isArray(body.servers)
        ? body.servers
            .filter((server) => server !== null && typeof server === 'object' && typeof server.name === 'string')
            .map((server) => ({
              name: server.name,
              listening: server.listening === true,
              connected: server.connected === true,
            }))
        : []
      return {
        visible: body.visible === true,
        connected: body.connected === true,
        detectedUrl: typeof body.detectedUrl === 'string' && body.detectedUrl !== '' ? body.detectedUrl : null,
        servers,
      }
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
            // A missing route or a stopped Host half means the editor is not running.
            next = { visible: false, connected: false, detectedUrl: null, servers: [] }
          }
          if (!alive) return
          setStatus((previous) => {
            if (previous === null) return next
            // Only the visible facts matter; avoids a re-render per poll.
            return JSON.stringify(previous) === JSON.stringify(next) ? previous : next
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

    const BADGE_SIZE = 32
    const POSITION_KEY = 'dsh-godot-mcp-status:position'
    const DRAG_THRESHOLD = 4

    function clampPosition(x, y) {
      const width = typeof window === 'undefined' ? 1024 : window.innerWidth
      const height = typeof window === 'undefined' ? 768 : window.innerHeight
      const maxX = Math.max(0, width - BADGE_SIZE)
      const maxY = Math.max(0, height - BADGE_SIZE)
      return {
        x: Math.min(Math.max(0, Math.round(x)), maxX),
        y: Math.min(Math.max(0, Math.round(y)), maxY),
      }
    }

    /** The original resting place: 12 px from the right and 30 px from the bottom. */
    function defaultPosition() {
      const width = typeof window === 'undefined' ? 1024 : window.innerWidth
      const height = typeof window === 'undefined' ? 768 : window.innerHeight
      return clampPosition(width - BADGE_SIZE - 12, height - BADGE_SIZE - 30)
    }

    function loadPosition() {
      try {
        const raw = window.localStorage.getItem(POSITION_KEY)
        if (raw === null) return null
        const saved = JSON.parse(raw)
        if (saved === null || typeof saved !== 'object') return null
        if (typeof saved.x !== 'number' || typeof saved.y !== 'number') return null
        if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return null
        return clampPosition(saved.x, saved.y)
      } catch {
        return null
      }
    }

    function savePosition(position) {
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(position))
      } catch {
        /* storage can be full or blocked; the badge still drags for this session */
      }
    }

    /** The row a user pastes into the profile when the endpoint is detected but unconfigured. */
    const SNIPPET_LINES = [
      '- insert:',
      '    - id: mcp-godot',
      "      name: '@deepseek-ai/dsh-mcp-client'",
      '      config:',
      '        serverName: godot',
      '        transport: streamable-http',
      '        url: __URL__',
      '        failOnStartupError: false',
    ]

    function snippetFor(url) {
      return SNIPPET_LINES.map((line) => line.replace('__URL__', url)).join('\n')
    }

    function GodotMcpBadge(props) {
      const t = props !== null && typeof props.t === 'function' ? props.t : boundT !== null ? boundT : (key) => key
      const status = useStatus()
      const [hovered, setHovered] = React.useState(false)
      const [position, setPosition] = React.useState(() => loadPosition() || defaultPosition())
      const [dragging, setDragging] = React.useState(false)
      const [panelOpen, setPanelOpen] = React.useState(false)
      const [copied, setCopied] = React.useState(false)
      const dragRef = React.useRef(null)
      const rootRef = React.useRef(null)
      const copyTimerRef = React.useRef(null)

      React.useEffect(() => {
        function onResize() {
          setPosition((current) => clampPosition(current.x, current.y))
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [])

      React.useEffect(
        () => () => {
          if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
        },
        [],
      )

      // The panel closes on an outside press or Escape, like a host popover.
      React.useEffect(() => {
        if (!panelOpen) return undefined
        function onDownOutside(event) {
          const root = rootRef.current
          if (root !== null && event.target instanceof Node && root.contains(event.target)) return
          setPanelOpen(false)
        }
        function onKey(event) {
          if (event.key === 'Escape') setPanelOpen(false)
        }
        document.addEventListener('pointerdown', onDownOutside, true)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('pointerdown', onDownOutside, true)
          document.removeEventListener('keydown', onKey)
        }
      }, [panelOpen])

      function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return
        // Presses inside the panel belong to its own buttons, not to the drag.
        const target = event.target
        if (target instanceof Element && target.closest('.gmcp-panel') !== null) return
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: position.x,
          originY: position.y,
          x: position.x,
          y: position.y,
          moved: false,
        }
        const element = event.currentTarget
        if (typeof element.setPointerCapture === 'function') {
          try {
            element.setPointerCapture(event.pointerId)
          } catch {
            /* pointer capture is best-effort */
          }
        }
      }

      function onPointerMove(event) {
        const drag = dragRef.current
        if (drag === null || drag.pointerId !== event.pointerId) return
        // A released button without a pointerup (capture lost) ends the drag here.
        if (typeof event.buttons === 'number' && event.buttons === 0) {
          dragRef.current = null
          setDragging(false)
          return
        }
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        if (drag.moved !== true && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
        if (drag.moved !== true) {
          drag.moved = true
          setDragging(true)
          setHovered(false)
        }
        const next = clampPosition(drag.originX + dx, drag.originY + dy)
        drag.x = next.x
        drag.y = next.y
        setPosition(next)
      }

      function onPointerEnd(event) {
        const drag = dragRef.current
        if (drag === null || drag.pointerId !== event.pointerId) return
        dragRef.current = null
        const element = event.currentTarget
        if (typeof element.releasePointerCapture === 'function') {
          try {
            element.releasePointerCapture(event.pointerId)
          } catch {
            /* the capture may already be gone */
          }
        }
        setDragging(false)
        if (drag.moved === true) {
          savePosition({ x: drag.x, y: drag.y })
        } else if (status !== null && typeof status.detectedUrl === 'string') {
          // A plain click on an unconfigured endpoint opens the setup snippet.
          setPanelOpen((open) => !open)
        }
      }

      function copySnippet(url) {
        const text = snippetFor(url)
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        if (clipboard === undefined || typeof clipboard.writeText !== 'function') return
        clipboard.writeText(text).then(
          () => {
            setCopied(true)
            if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
            copyTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
          },
          () => {
            /* the snippet stays selectable for a manual copy */
          },
        )
      }

      if (status === null || status.visible !== true) return null

      const detectedUrl = typeof status.detectedUrl === 'string' ? status.detectedUrl : null
      const actionable = detectedUrl !== null
      // Naming follows the configured server, whether or not it is connected.
      const names = status.servers.map((server) => server.name)
      const single = names.length === 1 ? names[0] : ''
      const isGodot = single !== '' && single.toLowerCase() === 'godot'
      const connected = status.connected === true
      const textKey = actionable
        ? 'detectedGodot'
        : connected
          ? isGodot
            ? 'connectedGodot'
            : 'connectedMcp'
          : isGodot
            ? 'disconnectedGodot'
            : 'disconnectedMcp'
      const label = t(textKey)
      const tipBelow = position.y < 76
      const tipFlip = position.x < 150
      const panelBelow = position.y < 240
      const panelStart = position.x < 320

      return h(
        React.Fragment,
        null,
        h('style', { 'data-godot-mcp-status': 'styles' }, CSS),
        h(
          'div',
          {
            className: 'gmcp-seat',
            ref: rootRef,
            style: { left: position.x + 'px', top: position.y + 'px' },
          },
          h(
            'div',
            {
              className:
                'gmcp-badge' + (dragging ? ' is-dragging' : '') + (actionable ? ' is-actionable' : ''),
              role: actionable ? 'button' : 'status',
              'aria-label': label,
              'aria-expanded': actionable ? panelOpen : undefined,
              tabIndex: 0,
              onPointerDown,
              onPointerMove,
              onPointerUp: onPointerEnd,
              onPointerCancel: onPointerEnd,
              onLostPointerCapture: onPointerEnd,
              onKeyDown: (event) => {
                if (!actionable || event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setPanelOpen((open) => !open)
                }
              },
              onMouseEnter: () => setHovered(true),
              onMouseLeave: () => setHovered(false),
              onFocus: () => setHovered(true),
              onBlur: () => setHovered(false),
            },
            h(GodotMark),
            h(
              'span',
              { className: 'gmcp-tag', 'aria-hidden': 'true' },
              h('span', { className: connected ? 'gmcp-dot is-on' : 'gmcp-dot' }),
              'MCP',
            ),
            hovered && !dragging && !panelOpen
              ? h(
                  'div',
                  {
                    className: 'gmcp-tip',
                    role: 'tooltip',
                    'data-place': tipBelow ? 'below' : undefined,
                    'data-align': tipFlip ? 'start' : undefined,
                  },
                  label,
                )
              : null,
            panelOpen && actionable
              ? h(
                  'div',
                  {
                    className: 'gmcp-panel',
                    role: 'dialog',
                    'aria-label': t('panelTitle'),
                    'data-place': panelBelow ? 'below' : undefined,
                    'data-align': panelStart ? 'start' : undefined,
                  },
                  h(
                    'div',
                    { className: 'gmcp-panel-head' },
                    h('span', { className: 'gmcp-panel-title' }, t('panelTitle')),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'gmcp-panel-close',
                        'aria-label': t('close'),
                        onClick: () => setPanelOpen(false),
                      },
                      '×',
                    ),
                  ),
                  h('pre', { className: 'gmcp-snippet' }, snippetFor(detectedUrl)),
                  h('p', { className: 'gmcp-panel-hint' }, t('panelHint')),
                  h(
                    'div',
                    { className: 'gmcp-panel-foot' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'gmcp-copy',
                        onClick: () => copySnippet(detectedUrl),
                      },
                      copied ? t('copied') : t('copy'),
                    ),
                  ),
                )
              : null,
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
