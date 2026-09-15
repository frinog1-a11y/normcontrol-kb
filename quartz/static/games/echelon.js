  ;(function () {
    var canvas = document.getElementById("echelon-canvas")
    if (!canvas) return
    // повторный запуск после SPA-перехода: гасим предыдущий экземпляр
    if (window.__echelon) {
      try {
        window.__echelon.destroy()
      } catch (e) {}
    }

    var ctx = canvas.getContext("2d")
    var W = canvas.width
    var H = canvas.height
    var hudLayer = document.getElementById("hud-layer")
    var hudHealth = document.getElementById("hud-health")
    var hudFuel = document.getElementById("hud-fuel")
    var hudFaith = document.getElementById("hud-faith")
    var hudCorruption = document.getElementById("hud-corruption")
    var btnStart = document.getElementById("btn-start")
    var btnRestart = document.getElementById("btn-restart")
    var resultEl = document.getElementById("echelon-result")
    var recordEl = document.getElementById("echelon-record")
    var RECORD_KEY = "echelon-record"

    var LAYERS = [
      { name: "Зыбь-1", color: "#5a9a8a", bg: "#0a1a1a" },
      { name: "Зыбь-2", color: "#6a4a7a", bg: "#0a0a1a" },
      { name: "Зыбь-3", color: "#8a2a2a", bg: "#1a0a0a" },
      { name: "Тлен-1", color: "#8a2a2a", bg: "#050505" },
      { name: "Бездна", color: "#c8a878", bg: "#000000" },
    ]

    var state = {
      running: false,
      layer: 0,
      health: 100,
      fuel: 100,
      faith: 0,
      corruption: 0,
      progress: 0,
      ship: { x: 80, y: H / 2, vx: 0, vy: 0, w: 28, h: 20 },
      obstacles: [],
      stars: [],
      keys: {},
      touch: null,
      lastTime: 0,
      spawnTimer: 0,
    }

    // 60 мерцающих звёзд
    for (var i = 0; i < 60; i++) {
      state.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.4 + Math.random() * 1.3,
        a: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      })
    }

    function currentLayer() {
      return LAYERS[Math.min(state.layer, LAYERS.length - 1)]
    }

    function showRecord() {
      if (!recordEl) return
      var best = null
      try {
        best = JSON.parse(localStorage.getItem(RECORD_KEY) || "null")
      } catch (e) {
        best = null
      }
      if (best && typeof best.score === "number") {
        recordEl.textContent = "Лучший результат: слой " + best.layer + " / 5, вера " + best.faith
      } else {
        recordEl.textContent = "Пока нет рекордов. Начни плавание!"
      }
    }

    function updateHUD() {
      if (hudLayer) hudLayer.textContent = String(Math.min(state.layer + 1, 5))
      if (hudHealth) hudHealth.textContent = String(Math.max(0, Math.round(state.health)))
      if (hudFuel) hudFuel.textContent = String(Math.max(0, Math.round(state.fuel)))
      if (hudFaith) hudFaith.textContent = String(state.faith)
      if (hudCorruption) hudCorruption.textContent = String(state.corruption)
    }

    function drawShip() {
      var s = state.ship
      ctx.save()
      // шлейф позади корпуса
      var tail = ctx.createLinearGradient(s.x - 78, s.y, s.x - 6, s.y)
      tail.addColorStop(0, "rgba(200, 168, 120, 0)")
      tail.addColorStop(1, "rgba(200, 168, 120, 0.5)")
      ctx.fillStyle = tail
      ctx.beginPath()
      ctx.moveTo(s.x - 78, s.y - 4)
      ctx.lineTo(s.x - 6, s.y - 9)
      ctx.lineTo(s.x - 6, s.y + 9)
      ctx.lineTo(s.x - 78, s.y + 4)
      ctx.closePath()
      ctx.fill()
      // корпус — треугольник носом вправо, с золотым свечением
      ctx.shadowColor = "#c8a878"
      ctx.shadowBlur = 18
      ctx.fillStyle = "#f2eef8"
      ctx.beginPath()
      ctx.moveTo(s.x + 14, s.y)
      ctx.lineTo(s.x - 14, s.y - 10)
      ctx.lineTo(s.x - 6, s.y)
      ctx.lineTo(s.x - 14, s.y + 10)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = "#c8a878"
      ctx.beginPath()
      ctx.arc(s.x - 2, s.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function drawObstacles() {
      for (var i = 0; i < state.obstacles.length; i++) {
        var o = state.obstacles[i]
        ctx.save()
        if (o.type === "crystal") {
          ctx.shadowColor = "#c8a878"
          ctx.shadowBlur = 16
          ctx.fillStyle = "#c8a878"
          ctx.beginPath()
          ctx.arc(o.x, o.y, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "#f2eef8"
          ctx.beginPath()
          ctx.arc(o.x, o.y, 2.4, 0, Math.PI * 2)
          ctx.fill()
        } else if (o.type === "rift") {
          ctx.shadowColor = "#8a2a2a"
          ctx.shadowBlur = 14
          ctx.fillStyle = "#8a2a2a"
          ctx.beginPath()
          ctx.moveTo(o.x, o.y - 20)
          ctx.lineTo(o.x + 15, o.y)
          ctx.lineTo(o.x, o.y + 20)
          ctx.lineTo(o.x - 15, o.y)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = "rgba(242, 238, 248, 0.5)"
          ctx.lineWidth = 1
          ctx.stroke()
        } else if (o.type === "tlen") {
          var g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r)
          g.addColorStop(0, "rgba(0, 0, 0, 0.95)")
          g.addColorStop(0.7, "rgba(20, 10, 25, 0.75)")
          g.addColorStop(1, "rgba(0, 0, 0, 0)")
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
          ctx.fill()
        } else if (o.type === "heart") {
          ctx.shadowColor = "#c8a878"
          ctx.shadowBlur = 40
          ctx.fillStyle = "rgba(242, 238, 248, 0.85)"
          ctx.beginPath()
          ctx.arc(o.x, o.y, 60, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }
    }

    function drawBackground() {
      var layer = currentLayer()
      var grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, layer.bg)
      grad.addColorStop(1, "#000000")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      var t = performance.now() / 1000
      ctx.save()
      for (var i = 0; i < state.stars.length; i++) {
        var st = state.stars[i]
        ctx.globalAlpha = st.a * (0.55 + 0.45 * Math.sin(t * 1.6 + st.phase))
        ctx.fillStyle = "#f2eef8"
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // полоса прогресса слоя сверху
      ctx.save()
      ctx.fillStyle = "rgba(242, 238, 248, 0.12)"
      ctx.fillRect(0, 0, W, 6)
      ctx.fillStyle = layer.color
      ctx.fillRect(0, 0, (W * Math.min(100, state.progress)) / 100, 6)
      ctx.globalAlpha = 0.7
      ctx.fillStyle = "#f2eef8"
      ctx.font = "13px 'JetBrains Mono', monospace"
      ctx.fillText(layer.name + " · слой " + Math.min(state.layer + 1, 5) + "/5", 12, 26)
      ctx.restore()
    }

    function spawn() {
      var deep = state.layer >= 3
      var roll = Math.random()
      var type
      if (deep) {
        type = roll < 0.25 ? "crystal" : roll < 0.6 ? "rift" : "tlen"
      } else {
        type = roll < 0.5 ? "crystal" : roll < 0.85 ? "rift" : "tlen"
      }
      var o = { type: type, x: W + 30, y: 100 + Math.random() * (H - 200) }
      if (type === "crystal") o.speed = 110 + state.layer * 20 + Math.random() * 30
      else if (type === "rift") o.speed = 130 + state.layer * 25 + Math.random() * 30
      else {
        o.r = Math.random() < 0.5 ? 25 : 35
        o.speed = 70 + state.layer * 15 + Math.random() * 20
        o.hit = false
      }
      state.obstacles.push(o)
    }

    function update(dt) {
      var s = state.ship
      var k = state.keys
      var ax = 0
      var ay = 0
      // WASD (латиница и русская раскладка) + стрелки
      if (k["ArrowLeft"] || k["a"] || k["A"] || k["ф"] || k["Ф"]) ax -= 1
      if (k["ArrowRight"] || k["d"] || k["D"] || k["в"] || k["В"]) ax += 1
      if (k["ArrowUp"] || k["w"] || k["W"] || k["ц"] || k["Ц"]) ay -= 1
      if (k["ArrowDown"] || k["s"] || k["S"] || k["ы"] || k["Ы"]) ay += 1

      if (state.touch) {
        var tdx = state.touch.x - s.x
        var tdy = state.touch.y - s.y
        var tlen = Math.sqrt(tdx * tdx + tdy * tdy)
        if (tlen > 10) {
          ax += tdx / tlen
          ay += tdy / tlen
        }
      }

      var alen = Math.sqrt(ax * ax + ay * ay)
      if (alen > 1) {
        ax /= alen
        ay /= alen
      }

      s.vx += ax * 0.5
      s.vy += ay * 0.5
      s.vx *= 0.92
      s.vy *= 0.92
      s.x += s.vx
      s.y += s.vy
      if (s.x < 40) {
        s.x = 40
        s.vx = 0
      }
      if (s.x > W - 40) {
        s.x = W - 40
        s.vx = 0
      }
      if (s.y < 80) {
        s.y = 80
        s.vy = 0
      }
      if (s.y > H - 40) {
        s.y = H - 40
        s.vy = 0
      }

      // топливо неумолимо тратится
      state.fuel -= dt * 0.5
      if (state.fuel <= 0) {
        state.fuel = 0
        updateHUD()
        endGame(false, "Топливо иссякло во тьме…")
        return
      }

      // прогресс слоя
      state.progress += dt * 3
      if (state.progress >= 100) {
        state.layer += 1
        state.progress = 0
        state.obstacles = []
        state.fuel = Math.min(100, state.fuel + 20)
        if (state.layer >= 5) {
          updateHUD()
          endGame(true, "Флагман прошёл Бездну — все пять слоёв позади!")
          return
        }
      }

      // появление объектов: чем глубже слой, тем чаще
      state.spawnTimer += dt
      var interval = Math.max(0.35, 1 - state.layer * 0.15)
      if (state.spawnTimer >= interval) {
        state.spawnTimer = 0
        spawn()
      }

      // движение объектов и столкновения
      for (var i = state.obstacles.length - 1; i >= 0; i--) {
        var o = state.obstacles[i]
        o.x -= o.speed * dt
        var dx = o.x - s.x
        var dy = o.y - s.y
        var dist = Math.sqrt(dx * dx + dy * dy)

        if (o.type === "crystal" && dist < 20) {
          state.fuel = Math.min(100, state.fuel + 15)
          state.faith += 5
          state.obstacles.splice(i, 1)
          continue
        }
        if (o.type === "rift" && dist < 20) {
          state.health -= 15
          state.corruption += 5
          state.obstacles.splice(i, 1)
          if (state.health <= 0) {
            state.health = 0
            updateHUD()
            endGame(false, "Разлом разорвал корпус флагмана…")
            return
          }
          continue
        }
        if (o.type === "tlen" && !o.hit && dist < o.r) {
          o.hit = true
          state.health -= 10
          state.corruption += 3
          if (state.health <= 0) {
            state.health = 0
            updateHUD()
            endGame(false, "Тлен поглотил флагман…")
            return
          }
        }
        if (o.type === "heart" && dist < 60) {
          state.health = Math.min(100, state.health + 40)
          state.faith += 10
          state.obstacles.splice(i, 1)
          continue
        }
        if (o.x < -50) state.obstacles.splice(i, 1)
      }

      updateHUD()
    }

    function draw() {
      drawBackground()
      drawObstacles()
      drawShip()
    }

    function loop(time) {
      if (!state.running) return
      if (!state.lastTime) state.lastTime = time
      var dt = Math.min(0.05, (time - state.lastTime) / 1000)
      state.lastTime = time
      update(dt)
      draw()
      if (state.running) window.requestAnimationFrame(loop)
    }

    function startGame() {
      state.running = true
      state.layer = 0
      state.health = 100
      state.fuel = 100
      state.faith = 0
      state.corruption = 0
      state.progress = 0
      state.obstacles = []
      state.keys = {}
      state.touch = null
      state.spawnTimer = 0
      state.lastTime = 0
      state.ship.x = 80
      state.ship.y = H / 2
      state.ship.vx = 0
      state.ship.vy = 0
      if (resultEl) {
        resultEl.className = ""
        resultEl.textContent = ""
      }
      if (btnStart) btnStart.style.display = "none"
      if (btnRestart) btnRestart.style.display = ""
      updateHUD()
      draw()
      window.requestAnimationFrame(loop)
    }

    function endGame(win, message) {
      state.running = false
      var shownLayer = Math.min(state.layer + 1, 5)
      if (resultEl) {
        resultEl.className = win ? "result-win" : "result-lose"
        resultEl.innerHTML =
          (message || (win ? "Победа!" : "Поражение")) +
          '<div class="result-info">Слой ' +
          shownLayer +
          " / 5 · вера " +
          state.faith +
          " · порча " +
          state.corruption +
          "</div>"
      }
      var score = state.layer * 1000 + state.faith
      try {
        var best = JSON.parse(localStorage.getItem(RECORD_KEY) || "null")
        if (!best || score > best.score) {
          localStorage.setItem(
            RECORD_KEY,
            JSON.stringify({
              score: score,
              layer: shownLayer,
              faith: state.faith,
              date: new Date().toISOString(),
            }),
          )
        }
      } catch (e) {}
      showRecord()
      if (btnStart) btnStart.style.display = ""
      if (btnRestart) btnRestart.style.display = "none"
    }

    function toCanvasXY(clientX, clientY) {
      var rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H,
      }
    }

    function onKeyDown(e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault()
      }
      state.keys[e.key] = true
    }
    function onKeyUp(e) {
      state.keys[e.key] = false
    }
    function onPointerDown(e) {
      if (e.preventDefault) e.preventDefault()
      state.touch = toCanvasXY(e.clientX, e.clientY)
      if (canvas.setPointerCapture && e.pointerId !== undefined) {
        try {
          canvas.setPointerCapture(e.pointerId)
        } catch (err) {}
      }
    }
    function onPointerMove(e) {
      if (!state.touch) return
      state.touch = toCanvasXY(e.clientX, e.clientY)
    }
    function onPointerUp() {
      state.touch = null
    }
    function onPointerLeave() {
      state.touch = null
    }
    function onResize() {
      draw()
    }
    function onStartClick() {
      startGame()
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("keyup", onKeyUp)
    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", onPointerUp)
    canvas.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("resize", onResize)
    if (btnStart) btnStart.addEventListener("click", onStartClick)
    if (btnRestart) btnRestart.addEventListener("click", onStartClick)

    function destroy() {
      state.running = false
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("keyup", onKeyUp)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("resize", onResize)
      if (btnStart) btnStart.removeEventListener("click", onStartClick)
      if (btnRestart) btnRestart.removeEventListener("click", onStartClick)
      if (window.__echelon && window.__echelon.destroy === destroy) window.__echelon = null
    }

    window.__echelon = { state: state, start: startGame, destroy: destroy }

    showRecord()
    updateHUD()
    draw()
  })()
