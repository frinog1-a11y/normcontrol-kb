import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * Астральный фон: canvas создаётся скриптом и полностью пересоздаётся на каждом SPA-переходе
 * (событие "nav"). Палитра, glow, рябь от клика, шлейф курсора, реакция на скролл и выделение.
 * Здесь же — перезапуск inline-скриптов внутри article после SPA-перехода (нужно мини-игре
 * на /echelon: морф DOM вставляет script-узлы, которые сами по себе не исполняются).
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
    // PATCH (normcontrol-kb): на странице игры фон не реагирует на клики (рябь/вспышка не нужны)
    const gamePage = (window.location.pathname || "").indexOf("echelon") !== -1
    function isDark() {
      return document.documentElement.getAttribute("saved-theme") === "dark"
    }
    function currentColors() {
      return isDark() ? colorsDark : colorsLight
    }

    const PARTICLE_COUNT = 90
    const MOUSE_RADIUS = 180
    const MOUSE_REPEL = 0.8
    const RIPPLE_RADIUS = 250
    const RIPPLE_FORCE = 4
    const GLOW_SCALE = 3
    const GLOW_ALPHA = 0.25
    const TRAIL_MAX = 48
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
      const last = trail[trail.length - 1]
      if (!last) {
        trail.push({ x: mouse.x, y: mouse.y, life: 1 })
        return
      }
      // заполняем промежуток между событиями мыши: след не рвётся и не отстаёт
      const dx = mouse.x - last.x
      const dy = mouse.y - last.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1.5) return
      const steps = Math.min(40, Math.floor(dist / 4))
      for (let i = 1; i <= steps; i++) {
        trail.push({ x: last.x + (dx * i) / (steps + 1), y: last.y + (dy * i) / (steps + 1), life: 1 })
      }
      // последняя точка — всегда ровно под курсором
      trail.push({ x: mouse.x, y: mouse.y, life: 1 })
      while (trail.length > TRAIL_MAX) trail.shift()
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
      // на странице игры фон не шумит: клики по canvas обрабатывает сама игра
      if (gamePage) return
      const x = typeof e.clientX === "number" ? e.clientX : mouse.x
      const y = typeof e.clientY === "number" ? e.clientY : mouse.y

      // приоритет: клик по особой частице открывает спрятанную игру
      const sdx = x - specialParticle.x
      const sdy = y - specialParticle.y
      if (specialParticle.r + 11 > Math.sqrt(sdx * sdx + sdy * sdy)) {
        if (e.preventDefault) e.preventDefault()
        showSecretToast("🚀 Ты нашёл секретную частицу! Добро пожаловать, Адмирал.")
        openSecretPage(800)
        return
      }

      if (x < -500) return
      mouse.x = x
      mouse.y = y
      ripple.x = x
      ripple.y = y
      ripple.life = 1
      flashes.push({ x: x, y: y, life: 1 })
      pushTrail()
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

    // ===== Секрет: особая частица (отдельно от массива particles) =====
    const specialParticle = {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      baseR: 4,
      r: 4,
      color: "#ffd6a8",
      pulsePhase: Math.random() * Math.PI * 2,
    }

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

      // особая частица: медленный дрейф, пульсация, золотое свечение
      specialParticle.pulsePhase += 0.03
      specialParticle.r = specialParticle.baseR * (1 + Math.sin(specialParticle.pulsePhase) * 0.3)
      specialParticle.x += specialParticle.vx
      specialParticle.y += specialParticle.vy
      if (specialParticle.x < 0) specialParticle.x = w
      if (specialParticle.x > w) specialParticle.x = 0
      if (specialParticle.y < 0) specialParticle.y = h
      if (specialParticle.y > h) specialParticle.y = 0

      const spOpacity = 0.7 + Math.sin(specialParticle.pulsePhase) * 0.3
      ctx.save()
      ctx.shadowColor = "#c8a878"
      ctx.shadowBlur = 30
      ctx.globalAlpha = spOpacity * 0.3
      ctx.fillStyle = specialParticle.color
      ctx.beginPath()
      ctx.arc(specialParticle.x, specialParticle.y, specialParticle.r * 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = spOpacity
      ctx.beginPath()
      ctx.arc(specialParticle.x, specialParticle.y, specialParticle.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = 1
      ctx.fillStyle = "#fff5e0"
      ctx.beginPath()
      ctx.arc(specialParticle.x, specialParticle.y, specialParticle.r / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // шлейф — последним слоем: иначе glow частиц перекрывает точки у самого курсора
      for (const t of trail) {
        if (t.life <= 0) continue
        ctx.globalAlpha = t.life * 0.5
        ctx.fillStyle = isDark() ? "#d8c8f0" : "#6a5a8a"
        ctx.beginPath()
        ctx.arc(t.x, t.y, 0.9 + t.life * 2.4, 0, Math.PI * 2)
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

  /**
   * Морф DOM при SPA-переходе вставляет script-узлы, но браузер их не исполняет.
   * Перезапускаем такие скрипты вручную (createElement + textContent исполняется)
   * и помечаем узлы data-ran, чтобы не запускать дважды на первой загрузке.
   */
  function runArticleScripts() {
    const article = document.querySelector("article")
    if (!article) return
    const nodes = article.querySelectorAll("script")
    for (const old of nodes) {
      if (old.dataset && old.dataset.ran) continue
      const fresh = document.createElement("script")
      for (const attr of Array.from(old.attributes)) fresh.setAttribute(attr.name, attr.value)
      fresh.textContent = old.textContent
      fresh.dataset.ran = "1"
      old.parentNode.replaceChild(fresh, old)
    }
  }

  // ===== Секреты: путь к спрятанной игре и тост =====
  function gameUrl() {
    const base = document.body.dataset.basePath || ""
    return base + "/echelon"
  }

  let secretFound = false

  function openSecretPage(delay) {
    if (secretFound) return
    secretFound = true
    setTimeout(function() {
      window.location.href = gameUrl()
    }, delay || 800)
  }

  function showSecretToast(text) {
    const toast = document.createElement("div")
    toast.className = "secret-toast"
    toast.textContent = text
    document.body.appendChild(toast)
    setTimeout(function() {
      toast.classList.add("visible")
    }, 50)
    setTimeout(function() {
      toast.classList.remove("visible")
    }, 750)
    setTimeout(function() {
      toast.remove()
    }, 1100)
  }

  // ===== Секретный код E-C-H-E-L-O-N =====
  const SECRET = ["KeyE", "KeyC", "KeyH", "KeyE", "KeyL", "KeyO", "KeyN"]
  let secretIndex = 0

  function onSecretKey(e) {
    const t = e.target
    // не мешаем вводу в поиске и полях
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
    if (e.code === SECRET[secretIndex]) {
      secretIndex++
      if (secretIndex === SECRET.length) {
        secretIndex = 0
        showSecretToast("✨ Секретный код принят! Входим в Зыбь.")
        openSecretPage(800)
      }
    } else {
      secretIndex = 0
      // если это была первая буква — считаем началом последовательности
      if (e.code === SECRET[0]) secretIndex = 1
    }
  }

  document.addEventListener("keydown", onSecretKey)

  initParticles()

  document.addEventListener("nav", function() {
    destroyParticles()
    initParticles()
    restartFadeIn()
    runArticleScripts()
  })

  // первый показ: иначе контент останется невидимым до первого перехода
  requestAnimationFrame(function() {
    const article = document.querySelector("article")
    if (article) article.classList.add("is-visible")
    runArticleScripts()
  })
})()
`

export default (() => BackgroundParticles) satisfies QuartzComponentConstructor
