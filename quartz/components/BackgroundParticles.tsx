import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * Астральный фон. Canvas создаётся скриптом и полностью пересоздаётся на каждом SPA-переходе
 * (событие "nav"), поэтому частицы не исчезают после навигации. Разметку не рендерим (null),
 * чтобы не оставалось «мёртвого» canvas после подмены контента.
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

    const colorsLight = ["#6a5a8a", "#a85a7a", "#7a6a9a", "#8a7a5a"]
    const colorsDark = ["#b8a8d8", "#d89ab8", "#c8b8e8", "#d8c898"]

    function currentColors() {
      return document.documentElement.getAttribute("saved-theme") === "dark"
        ? colorsDark : colorsLight
    }

    const PARTICLE_COUNT = 90
    const CONNECTION_DISTANCE = 120
    const MOUSE_RADIUS = 180
    const MOUSE_REPEL = 0.8

    function resize() {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w
      canvas.height = h
    }
    resize()

    window.addEventListener("resize", resize)

    function onMouseMove(e) { mouse.x = e.clientX; mouse.y = e.clientY }
    function onMouseLeave() { mouse.x = -1000; mouse.y = -1000 }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseleave", onMouseLeave)

    const particles = []
    const colors = currentColors()
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.35 + 0.35,
      })
    }

    const themeObserver = new MutationObserver(() => {
      const newColors = currentColors()
      particles.forEach(p => {
        p.color = newColors[Math.floor(Math.random() * newColors.length)]
      })
    })
    themeObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ["saved-theme"]
    })

    function draw() {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * MOUSE_REPEL
          p.vx += (dx / dist) * force * 0.1
          p.vy += (dy / dist) * force * 0.1
        }
        p.x += p.vx; p.y += p.vy
        p.vx *= 0.98; p.vy *= 0.98
        if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.1
        if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.1
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < CONNECTION_DISTANCE) {
            const aNear = Math.hypot(a.x - mouse.x, a.y - mouse.y) < MOUSE_RADIUS
            const bNear = Math.hypot(b.x - mouse.x, b.y - mouse.y) < MOUSE_RADIUS
            if (aNear || bNear) {
              const op = (1 - d / CONNECTION_DISTANCE) * 0.25
              ctx.strokeStyle = \`rgba(138, 122, 184, \${op})\`
              ctx.lineWidth = 0.6
              ctx.beginPath()
              ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
            }
          }
        }
      }
      for (const p of particles) {
        const distM = Math.hypot(p.x - mouse.x, p.y - mouse.y)
        const hl = distM < MOUSE_RADIUS ? 0.5 : 0
        ctx.globalAlpha = Math.min(1, p.alpha + hl)
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
      themeObserver.disconnect()
    }
  }

  // fade-in контента не перезапускается сам при SPA-переходах: сбрасываем анимацию вручную
  function restartFadeIn() {
    const article = document.querySelector("article")
    if (!article) return
    article.style.animation = "none"
    void article.offsetHeight
    article.style.animation = "fadeIn 0.3s ease-out"
  }

  initParticles()

  document.addEventListener("nav", function() {
    destroyParticles()
    initParticles()
    restartFadeIn()
  })
})()
`

export default (() => BackgroundParticles) satisfies QuartzComponentConstructor
