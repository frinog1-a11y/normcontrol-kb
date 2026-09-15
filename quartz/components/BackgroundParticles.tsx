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

    // ===== Мини-игра «Астроном»: прогрессия по кликам по фону =====
    const PROGRESS_KEY = "astronom-progress"
    const CONSTELLATIONS_KEY = "my-constellations"
    let bgClickCount = 0
    try {
      const savedProgress = parseInt(localStorage.getItem(PROGRESS_KEY) || "0", 10)
      if (!isNaN(savedProgress)) bgClickCount = savedProgress
    } catch (e) {}
    // режим песочницы: проверяем и data-slug, и URL (SPA-переход мог ещё не обновить body)
    function urlSlug() {
      const parts = window.location.pathname.split("/").filter(function(s) {
        return s.length > 0
      })
      return parts.length ? parts[parts.length - 1] : "index"
    }
    const isPlayground = document.body.dataset.slug === "playground" || urlSlug() === "playground"
    if (isPlayground) canvas.style.zIndex = "0"
    // класс на body: страховка для CSS, если data-slug не успел обновиться при SPA-переходе
    document.body.classList.toggle("is-playground", isPlayground)

    function showToast(text, emoji) {
      const toast = document.createElement("div")
      toast.className = "astronom-toast"
      toast.textContent = emoji + " " + text
      document.body.appendChild(toast)
      setTimeout(function() {
        toast.classList.add("visible")
      }, 50)
      setTimeout(function() {
        toast.classList.remove("visible")
        setTimeout(function() {
          toast.remove()
        }, 400)
      }, 4000)
    }

    function showPlaygroundButton() {
      if (document.getElementById("playground-btn")) return
      const base = document.body.dataset.basePath || ""
      const btn = document.createElement("a")
      btn.id = "playground-btn"
      btn.href = base + "/playground"
      btn.textContent = "✨"
      btn.title = "Песочница"
      document.body.appendChild(btn)
    }

    function showCollection() {
      const badges = []
      if (bgClickCount >= 15) badges.push("🦉")
      if (bgClickCount >= 30) badges.push("🦊")
      if (bgClickCount >= 45) badges.push("🐻")
      if (!badges.length) return
      let collection = document.getElementById("astronom-collection")
      if (!collection) {
        collection = document.createElement("div")
        collection.id = "astronom-collection"
        collection.title = "Моя коллекция созвездий"
        document.body.appendChild(collection)
      }
      // обновляем бейджи при каждом открытии нового созвездия
      collection.textContent = badges.join(" ")
    }

    function makeStar(x, y) {
      const palette = currentColors()
      const speedFactor = 0.4 + Math.random() * 1.2
      return {
        x: x === undefined ? Math.random() * w : x,
        y: y === undefined ? Math.random() * h : y,
        vx: (Math.random() - 0.5) * 0.3 * speedFactor,
        vy: (Math.random() - 0.5) * 0.3 * speedFactor,
        baseR: 1.5 + Math.random() * 2.5,
        r: 1.5,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.005 + Math.random() * 0.01,
        speedFactor: speedFactor,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: Math.random() * 0.35 + 0.35,
      }
    }

    function addStars(count, x, y) {
      for (let i = 0; i < count; i++) particles.push(makeStar(x, y))
    }

    function applyProgress(announce) {
      if (bgClickCount >= 5) document.body.classList.add("astronom-lines")
      if (bgClickCount >= 15) document.body.classList.add("astronom-owl")
      if (bgClickCount >= 30) document.body.classList.add("astronom-fox")
      if (bgClickCount >= 45) document.body.classList.add("astronom-bear")
      if (bgClickCount >= 60) showPlaygroundButton()
      if (bgClickCount >= 100) document.body.classList.add("astronom-flight")
      showCollection()
      showResetButton()

      if (!announce) return
      if (bgClickCount === 5) showToast("Линии между звёздами открыты", "✨")
      if (bgClickCount === 15) showToast("Созвездие «Сова» открыто", "🦉")
      if (bgClickCount === 30) showToast("Созвездие «Лиса» открыто", "🦊")
      if (bgClickCount === 45) showToast("Созвездие «Медведь» открыто", "🐻")
      if (bgClickCount === 60) showToast("Песочница открыта!", "🎨")
      if (bgClickCount === 100) {
        showToast("Свободный полёт разблокирован", "🌌")
        addStars(110)
      }
    }

    function saveProgress() {
      try {
        localStorage.setItem(PROGRESS_KEY, String(bgClickCount))
      } catch (e) {}
    }

    /** Кнопка ↻ сброса прогресса: появляется, если что-то уже открыто или сохранено. */
    function showResetButton() {
      if (document.getElementById("astronom-reset")) return
      let hasSaved = false
      try {
        hasSaved = !!localStorage.getItem(CONSTELLATIONS_KEY)
      } catch (e) {}
      if (bgClickCount <= 0 && !hasSaved) return
      const btn = document.createElement("button")
      btn.id = "astronom-reset"
      btn.type = "button"
      btn.textContent = "↻"
      btn.title = "Сбросить прогресс Астронома"
      btn.addEventListener("click", function(e) {
        e.stopPropagation()
        const sure = window.confirm(
          "Сбросить весь прогресс Астронома? Будут удалены: открытые созвездия, сохранённые созвездия и счётчик кликов.",
        )
        if (!sure) return
        if (!window.confirm("Точно? Это нельзя отменить.")) return
        try {
          localStorage.removeItem(PROGRESS_KEY)
          localStorage.removeItem(CONSTELLATIONS_KEY)
        } catch (err) {}
        document.body.classList.remove(
          "astronom-lines",
          "astronom-owl",
          "astronom-fox",
          "astronom-bear",
          "astronom-flight",
        )
        const pgBtn = document.getElementById("playground-btn")
        if (pgBtn) pgBtn.remove()
        const collection = document.getElementById("astronom-collection")
        if (collection) collection.remove()
        document.querySelectorAll(".astronom-toast").forEach(function(t) {
          t.remove()
        })
        bgClickCount = 0
        clearUserScene()
        if (particles.length > 90) particles.length = 90
        renderConstellationList()
        btn.remove()
        showToast("Прогресс сброшен", "↻")
      })
      document.body.appendChild(btn)
    }

    function isBackgroundClick(e) {
      const t = e.target
      if (!t || !t.tagName) return false
      if (t === document.body) return true
      if (t.id === "bg-particles" || t.id === "quartz-root") return true
      if (t.classList && t.classList.contains("page")) return true
      return false
    }

    // созвездия: золотые фигуры, включаются прогрессом
    function drawConstellation(ctx2, points, close) {
      const t = performance.now() / 1000
      ctx2.save()
      ctx2.globalAlpha = 0.55 + Math.sin(t) * 0.15
      ctx2.strokeStyle = "#c8a878"
      ctx2.fillStyle = "#c8a878"
      ctx2.lineWidth = 1
      ctx2.beginPath()
      ctx2.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i++) ctx2.lineTo(points[i][0], points[i][1])
      if (close) ctx2.closePath()
      ctx2.stroke()
      for (const pt of points) {
        ctx2.beginPath()
        ctx2.arc(pt[0], pt[1], 2, 0, Math.PI * 2)
        ctx2.fill()
      }
      ctx2.restore()
    }

    function drawConstellationOwl(ctx2, width2, height2) {
      const cx = width2 * 0.15
      const cy = height2 * 0.2
      const s = 60
      drawConstellation(
        ctx2,
        [
          [cx - s, cy],
          [cx - s / 2, cy - s / 2],
          [cx, cy],
          [cx + s / 2, cy - s / 2],
          [cx + s, cy],
          [cx + s / 2, cy + s / 2],
          [cx, cy],
          [cx - s / 2, cy + s / 2],
        ],
        true,
      )
    }

    function drawConstellationFox(ctx2, width2, height2) {
      const cx = width2 * 0.85
      const cy = height2 * 0.22
      const s = 55
      drawConstellation(
        ctx2,
        [
          [cx - s, cy - s / 2],
          [cx - s / 2, cy - s],
          [cx, cy - s / 3],
          [cx + s / 2, cy - s],
          [cx + s, cy - s / 2],
          [cx + s / 2, cy + s / 2],
          [cx, cy + s],
          [cx - s / 2, cy + s / 2],
        ],
        true,
      )
    }

    function drawConstellationBear(ctx2, width2, height2) {
      const cx = width2 * 0.5
      const cy = height2 * 0.85
      const s = 70
      drawConstellation(
        ctx2,
        [
          [cx - s, cy],
          [cx - s / 2, cy - s / 2],
          [cx, cy - s / 3],
          [cx + s / 2, cy - s / 2],
          [cx + s, cy],
          [cx + s / 3, cy + s / 3],
          [cx - s / 3, cy + s / 3],
        ],
        true,
      )
    }

    // ===== Песочница (/playground): режимы, звёзды пользователя и связи =====
    let playgroundMode = "free"
    let userStars = []
    let userLinks = []
    let draggingFromStar = null
    let previewLine = null
    const pgCleanups = []

    function loadConstellations() {
      try {
        const raw = localStorage.getItem(CONSTELLATIONS_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        return []
      }
    }

    function findStarAt(x, y, radius) {
      const limit = radius || 20
      for (let i = userStars.length - 1; i >= 0; i--) {
        const star = userStars[i]
        const dx = star.x - x
        const dy = star.y - y
        if (Math.sqrt(dx * dx + dy * dy) < limit) return star
      }
      return null
    }

    function setPlaygroundMode(mode) {
      playgroundMode = mode === "draw" ? "draw" : "free"
      const freeBtn = document.getElementById("mode-free")
      const drawBtn = document.getElementById("mode-draw")
      if (freeBtn) freeBtn.classList.toggle("active", playgroundMode === "free")
      if (drawBtn) drawBtn.classList.toggle("active", playgroundMode === "draw")
      draggingFromStar = null
      previewLine = null
    }

    function clearUserScene() {
      userStars = []
      userLinks = []
      draggingFromStar = null
      previewLine = null
    }

    function onPgDown(e) {
      if (!isPlayground || playgroundMode !== "draw" || e.button !== 0) return
      // клики по тексту и кнопкам не считаем
      if (!isBackgroundClick(e)) return
      const star = findStarAt(e.clientX, e.clientY)
      if (star) {
        // взялись за звезду — тянем связь
        draggingFromStar = star
        previewLine = { from: star, to: { x: e.clientX, y: e.clientY } }
        return
      }
      // клик по пустому месту — новая звезда (с анимацией появления)
      userStars.push({
        x: e.clientX,
        y: e.clientY,
        id: Date.now() + Math.random(),
        createdAt: performance.now(),
      })
    }

    function onPgMove(e) {
      if (!isPlayground || playgroundMode !== "draw" || !draggingFromStar) return
      previewLine = { from: draggingFromStar, to: { x: e.clientX, y: e.clientY } }
    }

    function onPgUp(e) {
      if (!isPlayground || playgroundMode !== "draw" || !draggingFromStar) return
      const target = findStarAt(e.clientX, e.clientY)
      if (target && target.id !== draggingFromStar.id) {
        const from = draggingFromStar.id
        const to = target.id
        const exists = userLinks.some(function(l) {
          return (l.from === from && l.to === to) || (l.from === to && l.to === from)
        })
        if (!exists) userLinks.push({ from: from, to: to })
      }
      draggingFromStar = null
      previewLine = null
    }

    /** Отрисовка звёзд пользователя, их связей и пунктирного предпросмотра. */
    function drawPlaygroundScene(ctx2) {
      const now = performance.now()

      // связи между звёздами
      for (const link of userLinks) {
        const a = userStars.find(function(s) {
          return s.id === link.from
        })
        const b = userStars.find(function(s) {
          return s.id === link.to
        })
        if (!a || !b) continue
        ctx2.save()
        ctx2.shadowColor = "#c8a878"
        ctx2.shadowBlur = 10
        ctx2.strokeStyle = "rgba(200, 168, 120, 0.7)"
        ctx2.lineWidth = 1.5
        ctx2.beginPath()
        ctx2.moveTo(a.x, a.y)
        ctx2.lineTo(b.x, b.y)
        ctx2.stroke()
        ctx2.restore()
      }

      // предпросмотр новой связи — пунктир
      if (previewLine) {
        ctx2.save()
        ctx2.shadowColor = "#8a7ab8"
        ctx2.shadowBlur = 12
        ctx2.strokeStyle = "rgba(138, 122, 184, 0.6)"
        ctx2.lineWidth = 1
        ctx2.setLineDash([4, 4])
        ctx2.beginPath()
        ctx2.moveTo(previewLine.from.x, previewLine.from.y)
        ctx2.lineTo(previewLine.to.x, previewLine.to.y)
        ctx2.stroke()
        ctx2.restore()
      }

      // звёзды пользователя с анимацией появления и вспышкой
      for (const star of userStars) {
        const age = (now - star.createdAt) / 1000
        const appearScale = age < 0.3 ? age / 0.3 : 1
        const flashOpacity = age < 0.15 ? 1 - age / 0.15 : 0
        ctx2.save()
        if (flashOpacity > 0) {
          ctx2.globalAlpha = flashOpacity * 0.5
          ctx2.fillStyle = "#c8a878"
          ctx2.shadowColor = "#c8a878"
          ctx2.shadowBlur = 40
          ctx2.beginPath()
          ctx2.arc(star.x, star.y, 25 * flashOpacity, 0, Math.PI * 2)
          ctx2.fill()
        }
        ctx2.globalAlpha = 1
        ctx2.shadowColor = "#c8a878"
        ctx2.shadowBlur = 20
        ctx2.fillStyle = "#f2eef8"
        ctx2.beginPath()
        ctx2.arc(star.x, star.y, 5 * appearScale, 0, Math.PI * 2)
        ctx2.fill()
        ctx2.fillStyle = "#c8a878"
        ctx2.beginPath()
        ctx2.arc(star.x, star.y, 2.5 * appearScale, 0, Math.PI * 2)
        ctx2.fill()
        ctx2.restore()
      }
    }

    function renderConstellationList() {
      const container = document.getElementById("my-constellations")
      if (!container) return
      container.textContent = ""
      const saved = loadConstellations()
      // пусто — подсказку рисует CSS через :empty::after
      if (!saved.length) return
      for (const c of saved) {
        const count = c.stars ? c.stars.length : c.lines ? c.lines.length : 0
        const div = document.createElement("div")
        div.textContent = "✨ " + c.name + (count ? " — звёзд: " + count : "")
        container.appendChild(div)
      }
    }

    function saveUserConstellation() {
      if (userStars.length < 2) {
        showToast("Нужно минимум 2 звезды", "✨")
        return
      }
      const name = window.prompt("Как назовёшь своё созвездие?")
      if (!name) return
      const saved = loadConstellations()
      saved.push({
        name: name,
        stars: JSON.parse(JSON.stringify(userStars)),
        links: JSON.parse(JSON.stringify(userLinks)),
        createdAt: Date.now(),
      })
      try {
        localStorage.setItem(CONSTELLATIONS_KEY, JSON.stringify(saved))
      } catch (e) {}
      showToast("Созвездие «" + name + "» сохранено", "✨")
      renderConstellationList()
      showResetButton()
    }

    /** Навешивает обработчик на кнопку песочницы и запоминает снятие для cleanup(). */
    function onPgControl(el, handler) {
      if (!el) return
      el.addEventListener("click", handler)
      pgCleanups.push(function() {
        el.removeEventListener("click", handler)
      })
    }

    /** Кнопки режимов и список созвездий: вызывается при каждом запуске (в т.ч. после SPA-перехода). */
    function setupPlaygroundControls() {
      if (!isPlayground) return
      const article = document.querySelector("article")
      if (!article) return
      let controls = document.getElementById("playground-controls")
      // если разметка не дала контролы — создаём сами
      if (!controls) {
        controls = document.createElement("div")
        controls.id = "playground-controls"
        const mk = function(id, label) {
          const b = document.createElement("button")
          b.id = id
          b.type = "button"
          b.textContent = label
          controls.appendChild(b)
          return b
        }
        mk("mode-free", "🌌 Свободный")
        mk("mode-draw", "✨ Рисование")
        mk("btn-clear", "🗑 Очистить")
        mk("btn-save", "💾 Сохранить")
        article.insertBefore(controls, article.firstChild)
      }
      if (!document.getElementById("my-constellations")) {
        const list = document.createElement("div")
        list.id = "my-constellations"
        article.appendChild(list)
      }

      setPlaygroundMode(playgroundMode)
      onPgControl(document.getElementById("mode-free"), function() {
        setPlaygroundMode("free")
      })
      onPgControl(document.getElementById("mode-draw"), function() {
        setPlaygroundMode("draw")
      })
      onPgControl(document.getElementById("btn-clear"), function() {
        if (!userStars.length && !userLinks.length) return
        if (!window.confirm("Очистить всё?")) return
        clearUserScene()
      })
      onPgControl(document.getElementById("btn-save"), saveUserConstellation)
      renderConstellationList()
    }

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

      // прогресс «Астронома»: считаем только клики по фону
      if (isBackgroundClick(e)) {
        bgClickCount++
        saveProgress()
        applyProgress(true)
      }

      // в режиме «Рисование» клик создаёт звезду (это делает onPgDown), а не взрыв
      if (isPlayground && playgroundMode === "draw") return

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
        onPointerDown({ clientX: mouse.x, clientY: mouse.y, target: e.target })
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
    // песочница: рисование созвездий (работает только на /playground)
    window.addEventListener("mousemove", onPgMove, { passive: true })
    window.addEventListener("mousedown", onPgDown, { passive: true })
    window.addEventListener("mouseup", onPgUp, { passive: true })

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
    // «свободный полёт» (прогресс ≥ 100) и песочница: 200 звёзд с самого старта
    if (isPlayground) addStars(200 - particles.length)
    else if (bgClickCount >= 100) addStars(110)

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

      // в режиме «Рисование» частицы не реагируют на курсор — звёзды можно соединять
      const drawingMode = isPlayground && playgroundMode === "draw"

      for (const p of particles) {
        p.pulsePhase += p.pulseSpeed
        p.r = p.baseR * (1 + Math.sin(p.pulsePhase) * 0.25)

        if (!drawingMode) {
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
        }

        if (drawingMode) {
          // плавное затухание: звёзды почти стоят на месте
          p.vx *= 0.97
          p.vy *= 0.97
          if (Math.abs(p.vx) < 0.02) p.vx = 0
          if (Math.abs(p.vy) < 0.02) p.vy = 0
          p.x += p.vx
          p.y += p.vy
        } else {
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.98
          p.vy *= 0.98
          if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.1
          if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.1
        }
        p.y -= scrollDelta * 0.15
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0
      }

      // Светящиеся линии: слой 1 — лавандовое свечение, слой 2 — золотое ядро
      // (shadowBlur дорогой, поэтому при 200 частицах в «свободном полёте» рисуем без него)
      const useLineGlow = particles.length <= 120
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          if (Math.abs(dx) > CONNECTION_DISTANCE || Math.abs(dy) > CONNECTION_DISTANCE) continue
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d >= CONNECTION_DISTANCE) continue
          // чем ближе звёзды — тем ярче линия
          const fade = Math.pow(1 - d / CONNECTION_DISTANCE, 1.5)

          ctx.save()
          ctx.lineCap = "round"
          if (useLineGlow) {
            ctx.shadowColor = "#8a7ab8"
            ctx.shadowBlur = 8
          }
          ctx.strokeStyle = "rgba(138, 122, 184, " + 0.15 * fade + ")"
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.restore()

          ctx.save()
          if (useLineGlow) {
            ctx.shadowColor = "#c8a878"
            ctx.shadowBlur = 4
          }
          ctx.strokeStyle = "rgba(200, 168, 120, " + 0.35 * fade + ")"
          ctx.lineWidth = 0.6
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          ctx.restore()
        }
      }

      // Линии у курсора — розовое свечение (в режиме рисования не подсвечиваем)
      if (!drawingMode) {
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
            const fade = 1 - d / CONNECTION_DISTANCE
            ctx.save()
            ctx.lineCap = "round"
            ctx.shadowColor = "#b86a8a"
            ctx.shadowBlur = 15
            ctx.strokeStyle = "rgba(184, 106, 138, " + 0.5 * fade + ")"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
            ctx.restore()
          }
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

      // созвездия «Астронома» и сцена песочницы
      if (bgClickCount >= 15) drawConstellationOwl(ctx, w, h)
      if (bgClickCount >= 30) drawConstellationFox(ctx, w, h)
      if (bgClickCount >= 45) drawConstellationBear(ctx, w, h)
      if (isPlayground) drawPlaygroundScene(ctx)

      for (const p of particles) {
        const distM = Math.hypot(p.x - mouse.x, p.y - mouse.y)
        const glowAmount = Math.max(0, 1 - distM / MOUSE_RADIUS)
        const distSel = Math.hypot(p.x - selectionCenter.x, p.y - selectionCenter.y)
        const selBoost = distSel < SELECTION_RADIUS ? (1 - distSel / SELECTION_RADIUS) * 0.4 : 0

        if (!drawingMode && glowAmount > 0) {
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
      window.removeEventListener("mousemove", onPgMove)
      window.removeEventListener("mousedown", onPgDown)
      window.removeEventListener("mouseup", onPgUp)
      for (const fn of pgCleanups) fn()
      pgCleanups.length = 0
    }

    // прогресс и контролы песочницы: применяем при каждом запуске (в том числе после SPA-перехода)
    applyProgress(false)
    setupPlaygroundControls()
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
