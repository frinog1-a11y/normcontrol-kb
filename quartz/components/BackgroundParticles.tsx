import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * Астральный фон: canvas создаётся скриптом и полностью пересоздаётся на каждом SPA-переходе
 * (событие "nav"). Палитра, glow, рябь от клика, шлейф курсора, реакция на скролл и выделение.
 */
const BackgroundParticles: QuartzComponent = () => {
  return null
}

BackgroundParticles.afterDOMLoaded = `
(function() {
  let cleanup = null

  function destroyParticles() {
    if (cleanup) { cleanup(); cleanup = null }
    const canvas = document.getElementById("bg-particles")
    if (canvas) canvas.remove()
  }

  function initParticles() {
    if (document.getElementById("bg-particles")) return

    const canvas = document.createElement("canvas")
    canvas.id = "bg-particles"
    canvas.setAttribute("aria-hidden", "true")
    canvas.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; opacity: 1;"
    document.body.prepend(canvas)

    const ctx = canvas.getContext("2d")
    let w = window.innerWidth
    let h = window.innerHeight
    let mouse = { x: -1000, y: -1000 }
    let rafId = null
    let scrollY = window.scrollY || 0
    let lastScrollY = scrollY
    let selectionCenter = { x: -1000, y: -1000 }

    const colorsLight = ["#6a5a8a", "#a85a7a", "#7a6a9a", "#8a7a5a"]
    const colorsDark = ["#b8a8d8", "#d89ab8", "#c8b8e8", "#d8c898"]
    function isDark() {
      return document.documentElement.getAttribute("saved-theme") === "dark"
    }
    function currentColors() {
      return isDark() ? colorsDark : colorsLight
    }
    function linePrefix() {
      return isDark() ? "rgba(184, 168, 216, " : "rgba(106, 90, 138, "
    }

    const PARTICLE_COUNT = 90
    const CONNECTION_DISTANCE = 120
    const MOUSE_RADIUS = 180
    const MOUSE_REPEL = 0.8
    const RIPPLE_RADIUS = 250
    const RIPPLE_FORCE = 4
    const GLOW_SCALE = 3
    const GLOW_ALPHA = 0.25
    const TRAIL_MAX = 30
    const SELECTION_RADIUS = 200

    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    resize()

    const trail = []
    const flashes = []
    const ripple = { x: -1000, y: -1000, life: 0 }

    function pushTrail() {
      if (mouse.x < -500) return
      trail.push({ x: mouse.x, y: mouse.y, life: 1 })
      if (trail.length > TRAIL_MAX) trail.shift()
    }

    function onMouseMove(e) {
      mouse.x = e.clientX
      mouse.y = e.clientY
      pushTrail()
    }
    function onMouseLeave() {
      mouse.x = -1000
      mouse.y = -1000
    }
    function onPointerDown(e) {
      const x = typeof e.clientX === "number" ? e.clientX : mouse.x
      const y = typeof e.clientY === "number" ? e.clientY : mouse.y
      if (x < -500) return
      mouse.x = x
      mouse.y = y
      ripple.x = x
      ripple.y = y
      ripple.life = 1
      flashes.push({ x: x, y: y, life: 1 })
      pushTrail()
      // звук (модуль sound.ts) — кристаллический звон, если звук включён
      window.dispatchEvent(new CustomEvent("particle-click"))
    }
    function onTouchStart(e) {
      if (e.touches && e.touches.length > 0) {
        mouse.x = e.touches[0].clientX
        mouse.y = e.touches[0].clientY
        onPointerDown({ clientX: mouse.x, clientY: mouse.y })
      }
    }
    function onTouchMove(e) {
      if (e.touches && e.touches.length > 0) {
        mouse.x = e.touches[0].clientX
        mouse.y = e.touches[0].clientY
        pushTrail()
      }
    }
    function onTouchEnd() {}
    function onScroll() {
      scrollY = window.scrollY || 0
    }
    function onSelectionChange() {
      const sel = window.getSelection ? window.getSelection() : null
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        selectionCenter.x = -1000
        selectionCenter.y = -1000
        return
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      selectionCenter.x = rect.left + rect.width / 2
      selectionCenter.y = rect.top + rect.height / 2
    }

    window.addEventListener("resize", resize)
    window.addEventListener("mousemove", onMouseMove, { passive: true })
    window.addEventListener("mouseleave", onMouseLeave, { passive: true })
    window.addEventListener("mousedown", onPointerDown, { passive: true })
    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("selectionchange", onSelectionChange, { passive: true })

    const particles = []
    const colors = currentColors()
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const speedFactor = 0.4 + Math.random() * 1.2
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3 * speedFactor,
        vy: (Math.random() - 0.5) * 0.3 * speedFactor,
        baseR: 1.5 + Math.random() * 2.5,
        r: 1.5,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.005 + Math.random() * 0.01,
        speedFactor: speedFactor,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.35 + 0.35,
      })
    }
    for (const p of particles) p.r = p.baseR

    const themeObserver = new MutationObserver(function() {
      const next = currentColors()
      particles.forEach(function(p) {
        p.color = next[Math.floor(Math.random() * next.length)]
      })
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["saved-theme"],
    })

    function draw() {
      ctx.clearRect(0, 0, w, h)

      const scrollDelta = scrollY - lastScrollY
      lastScrollY = scrollY

      for (const f of flashes) f.life -= 0.03
      for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].life <= 0) flashes.splice(i, 1)
      if (ripple.life > 0) ripple.life = Math.max(0, ripple.life - 0.04)
      for (const t of trail) t.life -= 0.03
      for (let i = trail.length - 1; i >= 0; i--) if (trail[i].life <= 0) trail.splice(i, 1)

      for (const p of particles) {
        p.pulsePhase += p.pulseSpeed
        p.r = p.baseR * (1 + Math.sin(p.pulsePhase) * 0.25)

        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = ((MOUSE_RADIUS - dist) / MOUSE_RADIUS) * MOUSE_REPEL
          p.vx += (dx / dist) * force * 0.1
          p.vy += (dy / dist) * force * 0.1
        }

        if (ripple.life > 0) {
          const rdx = p.x - ripple.x
          const rdy = p.y - ripple.y
          const rd = Math.sqrt(rdx * rdx + rdy * rdy)
          if (rd < RIPPLE_RADIUS && rd > 0) {
            const rf = (1 - rd / RIPPLE_RADIUS) * ripple.life * RIPPLE_FORCE
            p.vx += (rdx / rd) * rf * 0.1
            p.vy += (rdy / rd) * rf * 0.1
          }
        }

        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.98
        p.vy *= 0.98
        if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.1
        if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.1
        p.y -= scrollDelta * 0.15
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0
      }

      ctx.strokeStyle = "rgba(138, 122, 184, 0.08)"
      ctx.lineWidth = 0.4
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          if (Math.abs(dx) > CONNECTION_DISTANCE || Math.abs(dy) > CONNECTION_DISTANCE) continue
          if (Math.sqrt(dx * dx + dy * dy) < CONNECTION_DISTANCE) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          if (Math.abs(dx) > CONNECTION_DISTANCE || Math.abs(dy) > CONNECTION_DISTANCE) continue
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d >= CONNECTION_DISTANCE) continue
          const aNear = Math.hypot(a.x - mouse.x, a.y - mouse.y) < MOUSE_RADIUS
          const bNear = Math.hypot(b.x - mouse.x, b.y - mouse.y) < MOUSE_RADIUS
          if (!aNear && !bNear) continue
          ctx.strokeStyle = linePrefix() + (1 - d / CONNECTION_DISTANCE) * 0.25 + ")"
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      for (const t of trail) {
        if (t.life <= 0) continue
        ctx.globalAlpha = t.life * 0.45
        ctx.fillStyle = isDark() ? "#c8b8e8" : "#7a6a9a"
        ctx.beginPath()
        ctx.arc(t.x, t.y, 0.8 + t.life * 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const f of flashes) {
        if (f.life <= 0) continue
        ctx.globalAlpha = f.life * 0.6
        ctx.strokeStyle = "#b86a8a"
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(f.x, f.y, (1 - f.life) * 150, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (ripple.life > 0) {
        ctx.globalAlpha = ripple.life * 0.25
        ctx.strokeStyle = "#8a7ab8"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(ripple.x, ripple.y, (1 - ripple.life) * RIPPLE_RADIUS, 0, Math.PI * 2)
        ctx.stroke()
      }

      for (const p of particles) {
        const distM = Math.hypot(p.x - mouse.x, p.y - mouse.y)
        const glowAmount = Math.max(0, 1 - distM / MOUSE_RADIUS)
        const distSel = Math.hypot(p.x - selectionCenter.x, p.y - selectionCenter.y)
        const selBoost = distSel < SELECTION_RADIUS ? (1 - distSel / SELECTION_RADIUS) * 0.4 : 0

        if (glowAmount > 0) {
          ctx.globalAlpha = glowAmount * GLOW_ALPHA
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * GLOW_SCALE, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.globalAlpha = Math.min(1, p.alpha + glowAmount * 0.5 + selBoost)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      rafId = requestAnimationFrame(draw)
    }
    draw()

    cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseleave", onMouseLeave)
      window.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("selectionchange", onSelectionChange)
      themeObserver.disconnect()
    }
  }

  // fade-in контента при SPA-переходах: перезапускаем переход через класс
  function restartFadeIn() {
    const article = document.querySelector("article")
    if (!article) return
    article.classList.remove("is-visible")
    void article.offsetHeight
    requestAnimationFrame(() => {
      article.classList.add("is-visible")
    })
  }

  initParticles()

  document.addEventListener("nav", function() {
    destroyParticles()
    initParticles()
    restartFadeIn()
  })

  // первый показ: иначе контент останется невидимым до первого перехода
  requestAnimationFrame(function() {
    const article = document.querySelector("article")
    if (article) article.classList.add("is-visible")
  })
})()
`

export default (() => BackgroundParticles) satisfies QuartzComponentConstructor
