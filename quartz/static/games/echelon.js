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

  // ===== ЗВУК: свой AudioContext, уважаем общий переключатель 🔊 (localStorage sound-enabled) =====
  var soundOn = false
  var actx = null
  var ambient = null

  function readSoundFlag() {
    try {
      soundOn = localStorage.getItem("sound-enabled") === "true"
    } catch (e) {
      soundOn = false
    }
  }

  function ac() {
    if (!soundOn) return null
    if (!actx) {
      var Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      try {
        actx = new Ctor()
      } catch (e) {
        return null
      }
    }
    if (actx.state === "suspended") {
      try {
        actx.resume()
      } catch (e) {}
    }
    return actx
  }

  function noiseSrc(ctx, seconds) {
    var len = Math.floor(ctx.sampleRate * seconds)
    var buf = ctx.createBuffer(1, len, ctx.sampleRate)
    var data = buf.getChannelData(0)
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    var src = ctx.createBufferSource()
    src.buffer = buf
    return src
  }

  /** Короткий тон: freq → rampTo за dur, с огибающей. */
  function tone(freq, vol, dur, type, rampTo) {
    var ctx = ac()
    if (!ctx) return
    var osc = ctx.createOscillator()
    var g = ctx.createGain()
    var t = ctx.currentTime
    osc.type = type || "sine"
    osc.frequency.setValueAtTime(freq, t)
    if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start()
    osc.stop(t + dur + 0.06)
  }

  /** Шумовой всплеск с необязательным lowpass. */
  function noiseHit(vol, dur, cutoff) {
    var ctx = ac()
    if (!ctx) return
    var src = noiseSrc(ctx, dur + 0.05)
    var g = ctx.createGain()
    var t = ctx.currentTime
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    if (cutoff) {
      var f = ctx.createBiquadFilter()
      f.type = "lowpass"
      f.frequency.value = cutoff
      src.connect(f)
      f.connect(g)
    } else {
      src.connect(g)
    }
    g.connect(ctx.destination)
    src.start()
    src.stop(t + dur + 0.05)
  }

  function chord(freqs, vol, dur, type) {
    for (var i = 0; i < freqs.length; i++) tone(freqs[i], vol, dur, type)
  }

  function playStart() {
    tone(220, 0.05, 0.3, "sine", 880)
  }
  function playCrystal() {
    tone(880, 0.04, 0.4)
    tone(1320, 0.02, 0.4)
  }
  function playRift() {
    tone(200, 0.045, 0.3)
    tone(80, 0.045, 0.3, "square")
    noiseHit(0.07, 0.25, 0)
  }
  function playTlen() {
    tone(120, 0.04, 0.5, "sine", 60)
    noiseHit(0.04, 0.4, 200)
  }
  function playLayer() {
    chord([261, 329, 392], 0.03, 0.6)
  }
  function playVictory() {
    var seq = [261, 329, 392, 523]
    for (var i = 0; i < seq.length; i++) {
      setTimeout(
        (function (f) {
          return function () {
            tone(f, 0.035, 0.35)
          }
        })(seq[i]),
        i * 180,
      )
    }
    setTimeout(function () {
      chord([261, 329, 392, 523], 0.035, 1.5)
    }, 760)
  }
  function playDefeat() {
    var ctx = ac()
    if (!ctx) return
    var osc = ctx.createOscillator()
    var g = ctx.createGain()
    var lfo = ctx.createOscillator()
    var lfoGain = ctx.createGain()
    var t = ctx.currentTime
    osc.type = "sine"
    osc.frequency.setValueAtTime(440, t)
    osc.frequency.linearRampToValueAtTime(349, t + 0.35)
    osc.frequency.linearRampToValueAtTime(294, t + 0.8)
    lfo.frequency.value = 8
    lfoGain.gain.value = 12
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.035, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.85)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start()
    lfo.start()
    osc.stop(t + 0.9)
    lfo.stop(t + 0.9)
  }
  function playShot() {
    tone(1200, 0.02, 0.05, "sine", 600)
  }
  function playHitRift() {
    tone(400, 0.025, 0.1)
    noiseHit(0.025, 0.1, 0)
  }
  function playNote() {
    tone(660, 0.04, 0.3)
  }

  // ===== AMBIENT «Дышащая Мерея»: drone + ветер + кристаллы + пульсары =====
  var AMB_LAYERS = [
    { drone: [55, 82.5], wind: 400, crystals: [0.002, 0.0015, 0], pulse: [10, 15] },
    { drone: [55, 78], wind: 500, crystals: [0.0016, 0.0012, 0], pulse: [8, 12] },
    { drone: [55, 73], wind: 600, crystals: [0.001, 0.0008, 0], pulse: [6, 10] },
    { drone: [41, 61], wind: 300, crystals: [0.0004, 0, 0], pulse: [5, 8] },
    { drone: [41, 55], wind: 200, crystals: [0, 0, 0], pulse: [3, 6] },
  ]
  var AMB_BOSS = { drone: [50, 77], wind: 250, crystals: [0, 0, 0], pulse: [3, 5] }

  function startAmbient() {
    var ctx = ac()
    if (!ctx || ambient) return
    var master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2)
    // тёплый общий lowpass: срезает «пищащие» верха всего ambient
    var masterLp = ctx.createBiquadFilter()
    masterLp.type = "lowpass"
    masterLp.frequency.value = 800
    master.connect(masterLp)
    masterLp.connect(ctx.destination)
    ambient = {
      master: master,
      nodes: [],
      oscs: {},
      windFilter: null,
      crystalGains: [],
      pulseTimer: null,
      cfg: AMB_LAYERS[0],
    }

    var d0 = ctx.createOscillator()
    var d1 = ctx.createOscillator()
    var dg0 = ctx.createGain()
    var dg1 = ctx.createGain()
    d0.type = "sine"
    d1.type = "sine"
    d0.frequency.value = 55
    d1.frequency.value = 82.5
    dg0.gain.value = 0.005
    dg1.gain.value = 0.003
    d0.connect(dg0)
    d1.connect(dg1)
    dg0.connect(master)
    dg1.connect(master)
    d0.start()
    d1.start()
    ambient.oscs.drone = [d0, d1]
    ambient.nodes.push(d0, d1, dg0, dg1)

    var wsrc = noiseSrc(ctx, 4)
    wsrc.loop = true
    var wf = ctx.createBiquadFilter()
    var wg = ctx.createGain()
    var wlfo = ctx.createOscillator()
    var wlfoGain = ctx.createGain()
    wf.type = "lowpass"
    wf.frequency.value = 400
    wg.gain.value = 0.006
    wlfo.frequency.value = 0.08
    wlfoGain.gain.value = 150
    wlfo.connect(wlfoGain)
    wlfoGain.connect(wf.frequency)
    wsrc.connect(wf)
    wf.connect(wg)
    wg.connect(master)
    wsrc.start()
    wlfo.start()
    ambient.windFilter = wf
    ambient.nodes.push(wsrc, wf, wg, wlfo, wlfoGain)

    // кристаллы: только 880 и 1320 Гц (1760 «пищал» — убран)
    var cf = [880, 1320]
    var clfo = [0.15, 0.11]
    for (var i = 0; i < 2; i++) {
      var co = ctx.createOscillator()
      var cg = ctx.createGain()
      var cl = ctx.createOscillator()
      var clg = ctx.createGain()
      co.type = "sine"
      co.frequency.value = cf[i]
      cg.gain.value = 0.002
      cl.frequency.value = clfo[i]
      clg.gain.value = 0.0015
      cl.connect(clg)
      clg.connect(cg.gain)
      co.connect(cg)
      cg.connect(master)
      co.start()
      cl.start()
      ambient.crystalGains.push(cg)
      ambient.nodes.push(co, cg, cl, clg)
    }

    schedulePulse()
  }

  function stopAmbient(fadeSeconds) {
    if (!ambient) return
    var ctx = actx
    var amb = ambient
    ambient = null
    if (amb.pulseTimer) clearTimeout(amb.pulseTimer)
    if (!ctx) return
    var fade = fadeSeconds === undefined ? 1 : fadeSeconds
    try {
      amb.master.gain.cancelScheduledValues(ctx.currentTime)
      amb.master.gain.setValueAtTime(amb.master.gain.value, ctx.currentTime)
      amb.master.gain.linearRampToValueAtTime(0, ctx.currentTime + fade)
    } catch (e) {}
    setTimeout(
      function () {
        for (var i = 0; i < amb.nodes.length; i++) {
          var n = amb.nodes[i]
          try {
            if (n.stop) n.stop()
            if (n.disconnect) n.disconnect()
          } catch (e) {}
        }
      },
      fade * 1000 + 300,
    )
  }

  /** Смена параметров ambient под слой (или под бой с боссом). */
  function changeAmbientForLayer(layer, bossFight) {
    if (!ambient || !actx) return
    var cfg = bossFight
      ? AMB_BOSS
      : AMB_LAYERS[Math.max(0, Math.min(AMB_LAYERS.length - 1, layer || 0))]
    ambient.cfg = cfg
    var t = actx.currentTime
    try {
      if (ambient.oscs.drone) {
        ambient.oscs.drone[0].frequency.linearRampToValueAtTime(cfg.drone[0], t + 1.5)
        ambient.oscs.drone[1].frequency.linearRampToValueAtTime(cfg.drone[1], t + 1.5)
      }
      if (ambient.windFilter)
        ambient.windFilter.frequency.linearRampToValueAtTime(cfg.wind, t + 1.5)
      for (var i = 0; i < ambient.crystalGains.length; i++) {
        ambient.crystalGains[i].gain.linearRampToValueAtTime(cfg.crystals[i] || 0, t + 1.5)
      }
    } catch (e) {}
  }

  function schedulePulse() {
    if (!ambient) return
    var cfg = ambient.cfg || AMB_LAYERS[0]
    var wait = (cfg.pulse[0] + Math.random() * (cfg.pulse[1] - cfg.pulse[0])) * 1000
    ambient.pulseTimer = setTimeout(function () {
      if (!ambient) return
      var ctx = ac()
      if (ctx) {
        var osc = ctx.createOscillator()
        var g = ctx.createGain()
        var dl = ctx.createDelay()
        var fb = ctx.createGain()
        var t = ctx.currentTime
        osc.type = "sine"
        osc.frequency.setValueAtTime(180, t)
        osc.frequency.linearRampToValueAtTime(240, t + 0.3)
        g.gain.setValueAtTime(0.008, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
        dl.delayTime.value = 0.3
        fb.gain.value = 0.3
        // мягкий lowpass: пульс больше не «долбит» в уши
        var plp = ctx.createBiquadFilter()
        plp.type = "lowpass"
        plp.frequency.value = 600
        osc.connect(plp)
        plp.connect(g)
        g.connect(ambient.master)
        g.connect(dl)
        dl.connect(fb)
        fb.connect(dl)
        fb.connect(ambient.master)
        osc.start()
        osc.stop(t + 0.7)
        ambient.nodes.push(osc, g, dl, fb, plp)
      }
      schedulePulse()
    }, wait)
  }

  // ===== БОССЫ: по одному после каждого слоя =====
  var BOSSES = [
    {
      name: "Хранительница Зыби",
      hp: 30,
      speed: 1.5,
      fire: 1.5,
      color: "#5a9a8a",
      shape: "circle",
    },
    {
      name: "Астральный Дракон",
      hp: 40,
      speed: 2.0,
      fire: 1.2,
      color: "#6a4a7a",
      shape: "diamond",
    },
    { name: "Сплетающий Узлы", hp: 50, speed: 2.5, fire: 1.0, color: "#8a2a2a", shape: "poly" },
    {
      name: "Матриарх Тлена",
      hp: 60,
      speed: 3.0,
      fire: 0.8,
      color: "#0a0a0a",
      color2: "#8a2a2a",
      shape: "silhouette",
    },
    { name: "Сердце Бездны", hp: 80, speed: 0, fire: 0.6, color: "#c8a878", shape: "sphere" },
  ]

  // ===== ЛОРНЫЕ ЗАПИСКИ =====
  var LORE = [
    {
      title: "Запись первая — О Пустоте",
      body: "Прежде чем появился свет, была только Пустота. Она не была злом. Она просто была. И в неё пришёл Он — Тот, кто не имел имени. Он создал мир-кольцо. И назвал его Израмон.",
      sign: "— фрагмент свитка Странников",
    },
    {
      title: "Запись вторая — О Войне",
      body: "Народы Израмона забыли, что они — одно. Они воевали за Свет, за Тьму, за право быть правыми. Война длилась двести лет. И когда она кончилась, мир был уже мёртв.",
      sign: "— из дневника беженца",
    },
    {
      title: "Запись третья — О Санре",
      body: "Санра была хранительницей равновесия. Она стояла в центре мира. И тогда люди выстрелили из арк-пушки. Её свет погас. И мир закричал.",
      sign: "— из хроник Первого Адмирала",
    },
    {
      title: "Запись четвёртая — О Тлене",
      body: "Импульс смерти Санры сломал времявязальную машину. И из боли родился Тлен — застывшая агония, умноженная на разорванное время. Он не убивает. Он переписывает.",
      sign: "— из трактата Инженера Игниса",
    },
    {
      title: "Запись пятая — О Надежде",
      body: "Мы ушли за грань. Мы потеряли всё. Но мы всё ещё плывём. Потому что где-то там — Тихая Гавань. Место, где исцеляется время. И мы верим: мы дойдём.",
      sign: "— из последней записи Двенадцатого Адмирала",
    },
  ]

  // ===== ВИДИМОСТЬ: на тёмных слоях всё ярче и с обводкой =====
  function brightness() {
    var l = state.layer
    if (l <= 2) return 1
    if (l === 3) return 1.3
    return 1.6
  }
  function glowFor() {
    var l = state.layer
    if (l <= 2) return 18
    if (l === 3) return 25
    return 35
  }
  function starAlpha() {
    var l = state.layer
    if (l <= 2) return 0.5
    if (l === 3) return 0.65
    return 0.8
  }
  function deepDark() {
    return state.layer >= 3
  }

  // ===== СТРЕЛЬБА =====
  var SHOT_COOLDOWN = 300
  var btnFire = document.getElementById("btn-fire")

  function shoot() {
    if (!state.running || state.paused || state.note) return
    var now = Date.now()
    if (now - state.lastShotTime < SHOT_COOLDOWN) return
    state.lastShotTime = now
    state.bullets.push({ x: state.ship.x + state.ship.w, y: state.ship.y, vx: 8 })
    playShot()
  }

  function updateBullets(dt) {
    for (var i = state.bullets.length - 1; i >= 0; i--) {
      var b = state.bullets[i]
      b.x += b.vx * dt * 60
      if (b.x > W + 20) {
        state.bullets.splice(i, 1)
        continue
      }
      // попадание в босса
      if (state.boss) {
        var bs = state.boss
        var bdx = b.x - bs.x
        var bdy = b.y - bs.y
        var br = bs.shape === "sphere" ? 70 : 45
        if (Math.sqrt(bdx * bdx + bdy * bdy) < br) {
          state.bullets.splice(i, 1)
          damageBoss(5)
          continue
        }
      }
      // попадания по объектам
      for (var j = state.obstacles.length - 1; j >= 0; j--) {
        var o = state.obstacles[j]
        var dx = b.x - o.x
        var dy = b.y - o.y
        var d = Math.sqrt(dx * dx + dy * dy)
        if (o.type === "rift" && d < 20) {
          state.obstacles.splice(j, 1)
          state.bullets.splice(i, 1)
          state.faith += 3
          playHitRift()
          break
        }
        if (o.type === "tlen" && d < o.r) {
          o.r = Math.max(6, o.r / 2)
          state.corruption += 1
          state.bullets.splice(i, 1)
          playHitRift()
          break
        }
      }
    }
    // снаряды босса
    if (state.boss) {
      for (var k = state.boss.bullets.length - 1; k >= 0; k--) {
        var bb = state.boss.bullets[k]
        bb.x += bb.vx * dt * 60
        if (bb.x < -30) {
          state.boss.bullets.splice(k, 1)
          continue
        }
        var s = state.ship
        var sdx = bb.x - s.x
        var sdy = bb.y - s.y
        if (Math.sqrt(sdx * sdx + sdy * sdy) < 22) {
          state.boss.bullets.splice(k, 1)
          state.health -= 10
          state.corruption += 2
          playRift()
          if (state.health <= 0) {
            state.health = 0
            updateHUD()
            endGame(false, "Ядро флагмана не выдержало…")
            return
          }
        }
      }
    }
  }

  function drawBullets() {
    for (var i = 0; i < state.bullets.length; i++) {
      var b = state.bullets[i]
      ctx.save()
      ctx.globalAlpha = 0.35
      ctx.fillStyle = "#c8a878"
      ctx.beginPath()
      ctx.arc(b.x - 6, b.y, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(b.x - 12, b.y, 1.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.shadowColor = "#c8a878"
      ctx.shadowBlur = 12
      ctx.fillStyle = "#ffd6a8"
      ctx.beginPath()
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    if (state.boss) {
      for (var j = 0; j < state.boss.bullets.length; j++) {
        var bb = state.boss.bullets[j]
        ctx.save()
        ctx.shadowColor = state.boss.color
        ctx.shadowBlur = 14
        ctx.fillStyle = state.boss.color2 || state.boss.color
        ctx.beginPath()
        ctx.arc(bb.x, bb.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }
  }

  // ===== БОССЫ =====
  function startBossFight(idx) {
    var def = BOSSES[Math.max(0, Math.min(BOSSES.length - 1, idx))]
    state.boss = {
      hp: def.hp,
      maxHp: def.hp,
      x: W - 40,
      y: H / 2,
      vy: def.speed,
      speed: def.speed,
      fireTimer: 0,
      fireInterval: def.fire,
      color: def.color,
      color2: def.color2,
      shape: def.shape,
      name: def.name,
      bullets: [],
    }
    state.obstacles = []
    state.bullets = []
    changeAmbientForLayer(state.layer, true)
    playLayer()
  }

  function damageBoss(amount) {
    if (!state.boss) return
    state.boss.hp -= amount
    state.faith += 2
    playHitRift()
    if (state.boss.hp <= 0) {
      state.boss.hp = 0
      defeatBoss()
    }
  }

  /** Босс побеждён: вера, звук, лорная записка, затем следующий слой. */
  function defeatBoss() {
    var idx = state.layer
    var wasFinal = idx >= BOSSES.length - 1
    state.boss = null
    state.bullets = []
    state.faith += 100
    updateHUD()
    playVictory()
    showLoreNote(idx, function () {
      if (wasFinal) {
        state.layer = 5
        updateHUD()
        playFinalCinematic()
      } else {
        state.layer += 1
        state.progress = 0
        state.fuel = Math.min(100, state.fuel + 25)
        updateHUD()
        playLayer()
        changeAmbientForLayer(state.layer, false)
      }
    })
  }

  function bossFire() {
    if (!state.boss) return
    state.boss.bullets.push({ x: state.boss.x - 40, y: state.boss.y, vx: -3 })
    playRift()
  }

  function updateBoss(dt) {
    var bs = state.boss
    if (!bs) return
    // управление флагманом работает и в бою
    if (!updateShip(dt)) return
    // выход на арену из-за правого края
    if (bs.x > W - 150) {
      bs.x -= 170 * dt
      if (bs.x < W - 150) bs.x = W - 150
    }
    // финальный босс медленно всплывает к центру и стоит
    if (bs.speed > 0) {
      bs.y += bs.vy * dt * 60 * 0.2
      if (bs.y < 120) {
        bs.y = 120
        bs.vy = Math.abs(bs.vy)
      }
      if (bs.y > H - 120) {
        bs.y = H - 120
        bs.vy = -Math.abs(bs.vy)
      }
    }
    bs.fireTimer += dt
    if (bs.fireTimer >= bs.fireInterval) {
      bs.fireTimer = 0
      bossFire()
    }
    // таран корпусом
    var s = state.ship
    var dx = bs.x - s.x
    var dy = bs.y - s.y
    if (Math.sqrt(dx * dx + dy * dy) < 60) {
      state.health -= dt * 25
      state.corruption += dt * 2
      if (state.health <= 0) {
        state.health = 0
        updateHUD()
        endGame(false, "Босс смял флагман…")
        return
      }
    }
    updateBullets(dt)
    updateHUD()
  }

  function drawBoss() {
    var bs = state.boss
    if (!bs) return
    ctx.save()
    ctx.shadowColor = bs.color
    ctx.shadowBlur = glowFor() + 10
    ctx.fillStyle = bs.color
    if (bs.shape === "circle") {
      ctx.beginPath()
      ctx.arc(bs.x, bs.y, 40, 0, Math.PI * 2)
      ctx.fill()
    } else if (bs.shape === "diamond") {
      ctx.beginPath()
      ctx.moveTo(bs.x + 45, bs.y)
      ctx.lineTo(bs.x, bs.y - 38)
      ctx.lineTo(bs.x - 45, bs.y)
      ctx.lineTo(bs.x, bs.y + 38)
      ctx.closePath()
      ctx.fill()
    } else if (bs.shape === "poly") {
      ctx.beginPath()
      for (var i = 0; i < 7; i++) {
        var a = (Math.PI * 2 * i) / 7 + performance.now() / 2200
        var px = bs.x + Math.cos(a) * 44
        var py = bs.y + Math.sin(a) * 44
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    } else if (bs.shape === "silhouette") {
      ctx.beginPath()
      ctx.arc(bs.x, bs.y, 46, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = bs.color2 || "#8a2a2a"
      for (var k = 0; k < 6; k++) {
        var ka = (Math.PI * 2 * k) / 6 + performance.now() / 1600
        ctx.beginPath()
        ctx.arc(bs.x + Math.cos(ka) * 40, bs.y + Math.sin(ka) * 40, 9, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      var grd = ctx.createRadialGradient(bs.x, bs.y, 8, bs.x, bs.y, 60)
      grd.addColorStop(0, "#fff5e0")
      grd.addColorStop(0.5, bs.color)
      grd.addColorStop(1, "rgba(200, 168, 120, 0)")
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(bs.x, bs.y, 60, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // HP-бар сверху
    var w = W - 120
    var hpFrac = Math.max(0, bs.hp / bs.maxHp)
    ctx.save()
    ctx.fillStyle = "rgba(10, 10, 20, 0.8)"
    ctx.fillRect(60, 40, w, 12)
    ctx.fillStyle = bs.color2 || bs.color
    ctx.fillRect(60, 40, w * hpFrac, 12)
    ctx.strokeStyle = "rgba(200, 168, 120, 0.6)"
    ctx.lineWidth = 1
    ctx.strokeRect(60, 40, w, 12)
    ctx.fillStyle = "#f2eef8"
    ctx.font = "14px 'JetBrains Mono', monospace"
    ctx.fillText(bs.name + " — " + bs.hp + " / " + bs.maxHp, 60, 32)
    ctx.restore()
  }

  // ===== ЛОРНЫЕ ЗАПИСКИ (поверх игры, игра на паузе) =====
  function showLoreNote(index, onClose) {
    var note = LORE[Math.max(0, Math.min(LORE.length - 1, index))]
    state.paused = true
    var overlay = document.createElement("div")
    overlay.className = "lore-note-overlay"
    var box = document.createElement("div")
    box.className = "lore-note"
    var h = document.createElement("h2")
    h.textContent = "«" + note.title + "»"
    var p = document.createElement("p")
    p.textContent = "«" + note.body + "»"
    var sign = document.createElement("div")
    sign.className = "signature"
    sign.textContent = note.sign
    var btn = document.createElement("button")
    btn.type = "button"
    btn.textContent = "Продолжить"
    box.appendChild(h)
    box.appendChild(p)
    box.appendChild(sign)
    box.appendChild(btn)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    playNote()

    function close() {
      if (!state.note) return
      state.note = null
      overlay.classList.remove("visible")
      setTimeout(function () {
        overlay.remove()
      }, 320)
      state.paused = false
      state.lastTime = 0
      if (onClose) onClose()
    }

    overlay._close = close
    state.note = overlay
    btn.addEventListener("click", close)
    window.requestAnimationFrame(function () {
      overlay.classList.add("visible")
    })
  }

  // ===== ФИНАЛЬНЫЙ «МУЛЬТИК»: 15 секунд canvas-анимации =====
  // ===== ФИНАЛЬНЫЙ «МУЛЬТИК»: Сердце Бездны → портал → салют =====
  function playFinalCinematic() {
    state.paused = true
    endGame(true, "Флагман дошёл до Тихой Гавани!", true)
    var cv = document.createElement("canvas")
    cv.className = "cinematic-canvas"
    cv.width = window.innerWidth
    cv.height = window.innerHeight
    document.body.appendChild(cv)
    var c = cv.getContext("2d")
    var cx = cv.width / 2
    var cy = cv.height / 2
    var start = performance.now()
    var exploded = false
    var flash = 0
    var chordDone = false
    var swishDone = false
    var finalAccordDone = false
    var fadeDone = false
    var fireDone = false
    var stars = []
    var sparks = []
    var shipX = -70
    var portalOpen = 1
    playVictory()

    // взрыв Сердца Бездны: низкий удар + шум, 140 звёзд-осколков
    function boom() {
      playRift()
      noiseHit(0.08, 0.6, 400)
      for (var i = 0; i < 140; i++) {
        var a = Math.random() * Math.PI * 2
        var sp = 60 + Math.random() * 260
        stars.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          r: 1 + Math.random() * 2.2,
        })
      }
    }

    // салют: ракета снизу, взрывается на искры
    function launchFirework() {
      var colors = ["#c8a878", "#8a7ab8", "#b86a8a", "#f2eef8"]
      sparks.push({
        x: cx + (Math.random() - 0.5) * cv.width * 0.7,
        y: cv.height + 20,
        vx: (Math.random() - 0.5) * 60,
        vy: -420 - Math.random() * 160,
        fuse: 0.5 + Math.random() * 0.45,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }

    function burst(x, y, color) {
      for (var i = 0; i < 40; i++) {
        var a = (Math.PI * 2 * i) / 40 + Math.random() * 0.2
        var sp = 70 + Math.random() * 150
        sparks.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          color: color,
          life: 1,
          spark: true,
        })
      }
    }
    function frame() {
      var t = (performance.now() - start) / 1000
      c.fillStyle = "#000"
      c.fillRect(0, 0, cv.width, cv.height)

      // ФАЗА 1 (0–3 с): Сердце Бездны пульсирует всё чаще
      if (t < 3) {
        var accel = 1 + t * t * 0.8
        var beat = 1 + 0.12 * Math.sin(t * 6 * accel)
        c.save()
        var hg = c.createRadialGradient(cx, cy, 4, cx, cy, 70 * beat)
        hg.addColorStop(0, "#000000")
        hg.addColorStop(0.7, "#12000a")
        hg.addColorStop(1, "rgba(138, 42, 42, 0.25)")
        c.fillStyle = hg
        c.beginPath()
        c.arc(cx, cy, 70 * beat, 0, Math.PI * 2)
        c.fill()
        c.strokeStyle = "rgba(138, 42, 42, 0.85)"
        c.lineWidth = 1.4
        for (var ti = 0; ti < 9; ti++) {
          var ta = (Math.PI * 2 * ti) / 9 + t * (1 + t)
          c.beginPath()
          c.moveTo(cx + Math.cos(ta) * 12, cy + Math.sin(ta) * 12)
          c.lineTo(cx + Math.cos(ta) * 68, cy + Math.sin(ta) * 68)
          c.stroke()
        }
        c.restore()
      }

      // взрыв на 2.5 с
      if (t >= 2.5 && !exploded) {
        exploded = true
        flash = 1
        boom()
      }

      // ФАЗА 2 (3–6 с): осколки разлетаются и застывают золотыми точками
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i]
        st.x += st.vx * 0.016
        st.y += st.vy * 0.016
        st.vx *= 0.975
        st.vy *= 0.975
        c.save()
        c.shadowColor = "#c8a878"
        c.shadowBlur = 14
        c.fillStyle = "#ffd6a8"
        c.beginPath()
        c.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }

      // ФАЗА 3 (6–9 с): золотые линии собирают частицы в арку-портал
      var portalR = t > 6 ? Math.min(210, 210 * ((t - 6) / 3)) : 0
      if (t > 6) {
        if (!chordDone && t > 6.2) {
          chordDone = true
          chord([261, 329, 392, 523], 0.022, 1.4)
        }
        c.save()
        c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 3)
        c.strokeStyle = "#c8a878"
        c.lineWidth = 1
        for (var j = 0; j < stars.length; j += 3) {
          c.beginPath()
          c.moveTo(cx, cy)
          c.lineTo(stars[j].x, stars[j].y)
          c.stroke()
        }
        c.globalAlpha = 0.6
        c.lineWidth = 2
        c.beginPath()
        c.arc(cx, cy, portalR, 0, Math.PI * 2)
        c.stroke()
        c.restore()
      }
      // ФАЗА 4 (9–12 с): портал открывается, флагман входит
      if (t > 9) {
        portalOpen = Math.max(0, 1 - (t - 11.4) / 0.5)
        var pg = c.createRadialGradient(cx, cy, 10, cx, cy, portalR * 0.95)
        pg.addColorStop(0, "rgba(255, 240, 210, " + (0.85 * portalOpen).toFixed(2) + ")")
        pg.addColorStop(0.6, "rgba(200, 168, 120, " + (0.5 * portalOpen).toFixed(2) + ")")
        pg.addColorStop(1, "rgba(200, 168, 120, 0)")
        c.save()
        c.fillStyle = pg
        c.beginPath()
        c.arc(cx, cy, portalR * 0.95 * portalOpen, 0, Math.PI * 2)
        c.fill()
        c.globalAlpha = 0.5
        c.strokeStyle = "#fff5e0"
        c.lineWidth = 2
        for (var k2 = 0; k2 < 12; k2++) {
          var ka = (Math.PI * 2 * k2) / 12 + t * 0.8
          c.beginPath()
          c.moveTo(cx + Math.cos(ka) * portalR * 0.3, cy + Math.sin(ka) * portalR * 0.3)
          c.lineTo(cx + Math.cos(ka) * portalR, cy + Math.sin(ka) * portalR)
          c.stroke()
        }
        c.restore()

        // флагман слева → в портал
        if (t < 11.5) shipX += 44
        c.save()
        c.shadowColor = "#c8a878"
        c.shadowBlur = 24
        c.fillStyle = "#f2eef8"
        c.beginPath()
        c.moveTo(shipX + 16, cy)
        c.lineTo(shipX - 16, cy - 11)
        c.lineTo(shipX - 6, cy)
        c.lineTo(shipX - 16, cy + 11)
        c.closePath()
        c.fill()
        c.globalAlpha = 0.4
        c.fillStyle = "rgba(200, 168, 120, 0.5)"
        c.fillRect(shipX - 90, cy - 4, 80, 8)
        c.restore()

        if (!swishDone && t > 11.4) {
          swishDone = true
          noiseHit(0.05, 0.5, 900)
          tone(523, 0.03, 0.8)
          flash = 0.8
        }
        if (!finalAccordDone && t > 11.6) {
          finalAccordDone = true
          chord([261, 329, 392, 523], 0.03, 1.6)
        }
      }

      // вспышка (взрыв и закрытие портала)
      if (flash > 0) {
        c.save()
        c.globalAlpha = flash * 0.8
        c.fillStyle = "#fff5e0"
        c.fillRect(0, 0, cv.width, cv.height)
        c.restore()
        flash = Math.max(0, flash - 0.05)
      }
      // ФАЗА 5 (12–15 с): золотой текст, салют, «Конец.»
      if (t > 12) {
        var ak = Math.min(1, (t - 12) / 1)
        c.save()
        c.globalAlpha = ak * 0.35
        c.fillStyle = "#000"
        c.fillRect(0, 0, cv.width, cv.height)
        c.globalAlpha = ak
        c.textAlign = "center"
        c.fillStyle = "#c8a878"
        c.font = "46px 'Playfair Display', serif"
        c.fillText("Тихая Гавань.", cx, cy - 30)
        c.font = "26px 'Playfair Display', serif"
        c.fillText("Ты дошёл.", cx, cy + 16)
        c.font = "17px 'Inter', sans-serif"
        c.fillStyle = "rgba(242, 238, 248, 0.75)"
        c.fillText("— Двенадцатый Адмирал", cx, cy + 56)
        c.restore()

        if (!fireDone && t > 12.9) {
          fireDone = true
          chord([261, 329, 392], 0.02, 1.2)
        }
        if (t > 12.9 && Math.random() < 0.06) launchFirework()
        if (!fadeDone && t > 13) {
          fadeDone = true
          stopAmbient(2)
        }
      }

      // салют: ракеты и искры
      for (var si = sparks.length - 1; si >= 0; si--) {
        var sk = sparks[si]
        if (!sk.spark) {
          sk.x += sk.vx * 0.016
          sk.y += sk.vy * 0.016
          sk.vy += 400 * 0.016
          sk.fuse -= 0.016
          c.save()
          c.fillStyle = sk.color
          c.beginPath()
          c.arc(sk.x, sk.y, 2, 0, Math.PI * 2)
          c.fill()
          c.restore()
          if (sk.fuse <= 0) {
            burst(sk.x, sk.y, sk.color)
            sparks.splice(si, 1)
          }
        } else {
          sk.x += sk.vx * 0.016
          sk.y += sk.vy * 0.016
          sk.vy += 120 * 0.016
          sk.life -= 0.012
          c.save()
          c.globalAlpha = Math.max(0, sk.life)
          c.fillStyle = sk.color
          c.beginPath()
          c.arc(sk.x, sk.y, 1.8, 0, Math.PI * 2)
          c.fill()
          c.restore()
          if (sk.life <= 0) sparks.splice(si, 1)
        }
      }

      if (t > 14) {
        c.save()
        c.globalAlpha = Math.min(1, (t - 14) / 0.8)
        c.fillStyle = "#f2eef8"
        c.font = "22px 'Inter', sans-serif"
        c.textAlign = "center"
        c.fillText("Конец.", cx, cy + 120)
        c.restore()
      }

      if (t < 15) {
        window.requestAnimationFrame(frame)
      } else {
        showCinematicButtons(cv)
      }
    }

    window.requestAnimationFrame(frame)
  }

  function showCinematicButtons(cv) {
    var wrap = document.createElement("div")
    wrap.className = "cinematic-buttons"
    var again = document.createElement("button")
    again.type = "button"
    again.textContent = "↻ Играть заново"
    var back = document.createElement("button")
    back.type = "button"
    back.textContent = "Вернуться к базе"
    wrap.appendChild(again)
    wrap.appendChild(back)
    document.body.appendChild(wrap)

    function cleanup() {
      wrap.remove()
      cv.remove()
      state.paused = false
      state.lastTime = 0
    }

    again.addEventListener("click", function () {
      cleanup()
      startGame()
    })
    back.addEventListener("click", function () {
      var base = document.body.dataset.basePath || ""
      window.location.href = base + "/"
    })
  }

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
    bullets: [],
    lastShotTime: 0,
    boss: null,
    paused: false,
    note: null,
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
    // на самых тёмных слоях флагман подсвечивается сильнее
    if (state.layer >= 4) {
      ctx.globalAlpha = 0.3
      ctx.fillStyle = "#c8a878"
      ctx.beginPath()
      ctx.arc(s.x, s.y, 30, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // корпус — треугольник носом вправо, с золотым свечением
    ctx.shadowColor = "#c8a878"
    ctx.shadowBlur = state.layer >= 4 ? 30 : glowFor()
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
        ctx.shadowBlur = glowFor()
        ctx.fillStyle = "#c8a878"
        ctx.beginPath()
        ctx.arc(o.x, o.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "#f2eef8"
        ctx.beginPath()
        ctx.arc(o.x, o.y, 2.4, 0, Math.PI * 2)
        ctx.fill()
      } else if (o.type === "rift") {
        // подсветка фона под разломом: видно на тёмных слоях
        ctx.globalAlpha = 0.3
        ctx.fillStyle = "rgba(200, 60, 60, " + 0.3 * brightness() + ")"
        ctx.beginPath()
        ctx.arc(o.x, o.y, 40, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.shadowColor = "#8a2a2a"
        ctx.shadowBlur = glowFor()
        ctx.fillStyle = "#8a2a2a"
        ctx.beginPath()
        ctx.moveTo(o.x, o.y - 20)
        ctx.lineTo(o.x + 15, o.y)
        ctx.lineTo(o.x, o.y + 20)
        ctx.lineTo(o.x - 15, o.y)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = deepDark() ? "#ff6b6b" : "rgba(242, 238, 248, 0.5)"
        ctx.lineWidth = deepDark() ? 2 : 1
        ctx.stroke()
      } else if (o.type === "tlen") {
        // подсветка фона под Тленом
        ctx.globalAlpha = 1
        ctx.fillStyle = "rgba(200, 168, 120, " + 0.15 * brightness() + ")"
        ctx.beginPath()
        ctx.arc(o.x, o.y, 60, 0, Math.PI * 2)
        ctx.fill()
        var g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, o.r)
        g.addColorStop(0, "rgba(0, 0, 0, 0.95)")
        g.addColorStop(0.7, "rgba(20, 10, 25, 0.75)")
        g.addColorStop(1, "rgba(0, 0, 0, 0)")
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = "#c8a878"
        ctx.lineWidth = 1.5
        ctx.stroke()
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
      ctx.globalAlpha = st.a * starAlpha() * (0.55 + 0.45 * Math.sin(t * 1.6 + st.phase))
      ctx.fillStyle = "#f2eef8"
      ctx.beginPath()
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // меридианы: тонкие вертикальные линии слоя (только на тёмных слоях)
    if (deepDark()) {
      ctx.save()
      ctx.globalAlpha = 0.1
      ctx.strokeStyle = currentLayer().color
      ctx.lineWidth = 1
      for (var mx = 0; mx < W; mx += 200) {
        ctx.beginPath()
        ctx.moveTo(mx, 0)
        ctx.lineTo(mx, H)
        ctx.stroke()
      }
      ctx.restore()
    }

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

  /** Управление флагманом — общее для обычных слоёв и для боёв с боссами. */
  function updateShip(dt) {
    var s = state.ship
    var k = state.keys
    var ax = 0
    var ay = 0
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

    state.fuel -= dt * 0.5
    if (state.fuel <= 0) {
      state.fuel = 0
      updateHUD()
      endGame(false, "Топливо иссякло во тьме…")
      return false
    }
    return true
  }

  function update(dt) {
    if (state.paused) return
    // бой с боссом: своя логика, обычный спавн отключён
    if (state.boss) {
      updateBoss(dt)
      return
    }
    if (!updateShip(dt)) return
    var s = state.ship

    // прогресс слоя: на 100% начинается бой с боссом (за ним — лорная записка)
    state.progress += dt * 3
    if (state.progress >= 100) {
      state.progress = 100
      updateHUD()
      startBossFight(state.layer)
      return
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

    updateBullets(dt)
    updateHUD()
  }

  function draw() {
    drawBackground()
    drawObstacles()
    drawBullets()
    drawShip()
    drawBoss()
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
    state.bullets = []
    state.lastShotTime = 0
    state.boss = null
    state.paused = false
    state.note = null
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
    readSoundFlag()
    playStart()
    changeAmbientForLayer(0, false)
    startAmbient()
    draw()
    window.requestAnimationFrame(loop)
  }

  function endGame(win, message, keepAmbient) {
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
    state.boss = null
    state.bullets = []
    if (win) playVictory()
    else playDefeat()
    if (!keepAmbient) stopAmbient(1)
  }

  function toCanvasXY(clientX, clientY) {
    var rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    }
  }

  function onKeyDown(e) {
    // записка открыта: Space/Enter только закрывают её, стрельбы нет
    if (state.note) {
      if (e.key === " " || e.key === "Enter" || e.code === "Space") {
        e.preventDefault()
        if (state.note._close) state.note._close()
      }
      return
    }
    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault()
    }
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault()
      if (!state.keys[" "]) shoot()
    }
    state.keys[e.key] = true
  }
  function onKeyUp(e) {
    state.keys[e.key] = false
  }
  function onPointerDown(e) {
    if (e.preventDefault) e.preventDefault()
    state.touch = toCanvasXY(e.clientX, e.clientY)
    shoot()
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
  function onFireClick() {
    shoot()
  }
  function onSoundEnabled() {
    soundOn = true
    if (state.running && !ambient) startAmbient()
  }
  function onSoundDisabled() {
    soundOn = false
    stopAmbient(0.5)
  }

  document.addEventListener("keydown", onKeyDown)
  document.addEventListener("keyup", onKeyUp)
  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointermove", onPointerMove)
  canvas.addEventListener("pointerup", onPointerUp)
  canvas.addEventListener("pointerleave", onPointerLeave)
  window.addEventListener("resize", onResize)
  window.addEventListener("sound-enabled", onSoundEnabled)
  window.addEventListener("sound-disabled", onSoundDisabled)
  if (btnStart) btnStart.addEventListener("click", onStartClick)
  if (btnRestart) btnRestart.addEventListener("click", onStartClick)
  if (btnFire) btnFire.addEventListener("click", onFireClick)
  readSoundFlag()

  function destroy() {
    state.running = false
    document.removeEventListener("keydown", onKeyDown)
    document.removeEventListener("keyup", onKeyUp)
    canvas.removeEventListener("pointerdown", onPointerDown)
    canvas.removeEventListener("pointermove", onPointerMove)
    canvas.removeEventListener("pointerup", onPointerUp)
    canvas.removeEventListener("pointerleave", onPointerLeave)
    window.removeEventListener("resize", onResize)
    window.removeEventListener("sound-enabled", onSoundEnabled)
    window.removeEventListener("sound-disabled", onSoundDisabled)
    if (btnStart) btnStart.removeEventListener("click", onStartClick)
    if (btnRestart) btnRestart.removeEventListener("click", onStartClick)
    if (btnFire) btnFire.removeEventListener("click", onFireClick)
    stopAmbient(0.3)
    var ov = document.querySelectorAll(".lore-note-overlay, .cinematic-canvas, .cinematic-buttons")
    for (var i = 0; i < ov.length; i++) ov[i].remove()
    state.paused = false
    state.note = null
    if (window.__echelon && window.__echelon.destroy === destroy) window.__echelon = null
  }

  window.__echelon = { state: state, start: startGame, destroy: destroy }

  showRecord()
  updateHUD()
  draw()
})()
