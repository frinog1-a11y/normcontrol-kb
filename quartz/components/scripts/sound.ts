// PATCH (normcontrol-kb): космические звуки на Web Audio API.
// Звук выключен по умолчанию: включается кнопкой #sound-toggle (localStorage: sound-enabled).
// AudioContext создаётся только после действия пользователя — иначе браузер блокирует звук.

type AudioCtor = typeof AudioContext

let audioCtx: AudioContext | null = null
let enabled = false
let droneOsc: OscillatorNode | null = null
let droneGain: GainNode | null = null
const STORAGE_KEY = "sound-enabled"

function getCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function initSoundState() {
  try {
    enabled = localStorage.getItem(STORAGE_KEY) === "true"
  } catch (e) {
    enabled = false
  }
}

export function isSoundEnabled() {
  return enabled
}

function ensureAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const Ctor = getCtor()
    if (!Ctor) return null
    try {
      audioCtx = new Ctor()
    } catch (e) {
      return null
    }
  }
  if (audioCtx.state === "suspended") void audioCtx.resume()
  return audioCtx
}

/** Одноразовый обработчик: создаёт AudioContext после первого клика/тапа (требование браузеров). */
export function prepareAudio() {
  const handler = () => {
    ensureAudioContext()
    if (enabled) startDrone()
    window.removeEventListener("click", handler)
    window.removeEventListener("touchstart", handler)
  }
  window.addEventListener("click", handler, { once: true })
  window.addEventListener("touchstart", handler, { once: true })
}

/** 1. DEEP SPACE DRONE — 55 Гц, громкость 0.02, плавное появление за 2 с. */
export function startDrone() {
  if (droneOsc) return
  const ctx = ensureAudioContext()
  if (!ctx) return
  droneOsc = ctx.createOscillator()
  droneGain = ctx.createGain()
  droneOsc.type = "sine"
  droneOsc.frequency.value = 55
  droneGain.gain.setValueAtTime(0, ctx.currentTime)
  droneGain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 2)
  droneOsc.connect(droneGain)
  droneGain.connect(ctx.destination)
  droneOsc.start()
}

export function stopDrone() {
  if (!droneOsc || !droneGain || !audioCtx) return
  droneGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5)
  const osc = droneOsc
  const gain = droneGain
  droneOsc = null
  droneGain = null
  setTimeout(() => {
    try {
      osc.stop()
    } catch (e) {}
    try {
      osc.disconnect()
      gain.disconnect()
    } catch (e) {}
  }, 600)
}

function tone(
  freq: number,
  volume: number,
  duration: number,
  type: OscillatorType = "sine",
  attack = 0.01,
) {
  const ctx = ensureAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration + 0.02)
}

/** 2. CRYSTAL CHIME — клик по фону: два тона (880 + 1320), 0.8 с. */
export function playCrystalChime() {
  if (!enabled) return
  tone(880, 0.06, 0.8)
  tone(1320, 0.03, 0.8)
}

/** 3. PULSAR — наведение на узел графа: 440 Гц, 0.08 с. */
export function playPulsar() {
  if (!enabled) return
  tone(440, 0.03, 0.08, "sine", 0.005)
}

/** 4. SHIMMER — перетаскивание узла: 660 Гц с LFO 15 Гц, 0.25 с. */
export function playShimmer() {
  if (!enabled) return
  const ctx = ensureAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  const gain = ctx.createGain()
  osc.type = "triangle"
  osc.frequency.value = 660
  lfo.frequency.value = 15
  lfoGain.gain.value = 40
  lfo.connect(lfoGain)
  lfoGain.connect(osc.frequency)
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  lfo.start()
  osc.stop(ctx.currentTime + 0.27)
  lfo.stop(ctx.currentTime + 0.27)
}

/** 5. WARP — переход между страницами: 220 → 880 Гц за 0.3 с. */
export function playWarp() {
  if (!enabled) return
  const ctx = ensureAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(220, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3)
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.4)
}

/** 6. SUPERNOVA — клик по узлу: 880 → 110 Гц + шум, 0.5 с. */
export function playSupernova() {
  if (!enabled) return
  const ctx = ensureAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const noise = ctx.createBufferSource()
  const noiseGain = ctx.createGain()
  const gain = ctx.createGain()
  const bufferSize = Math.floor(ctx.sampleRate * 0.5)
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  noise.buffer = buffer
  osc.type = "sine"
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5)
  gain.gain.setValueAtTime(0.06, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  noiseGain.gain.setValueAtTime(0.015, ctx.currentTime)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc.connect(gain)
  noise.connect(noiseGain)
  noiseGain.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  noise.start()
  osc.stop(ctx.currentTime + 0.52)
  noise.stop(ctx.currentTime + 0.52)
}

// --- связка с интерфейсом: кнопка, клики по фону, переходы между страницами ---
let navCount = 0

function bindSoundEvents() {
  window.addEventListener("sound-enabled", () => {
    enabled = true
    ensureAudioContext()
    startDrone()
    playCrystalChime()
  })
  window.addEventListener("sound-disabled", () => {
    enabled = false
    stopDrone()
  })
  // клик по фону (скрипт частиц рассылает это событие) — кристаллический звон
  window.addEventListener("particle-click", () => {
    playCrystalChime()
  })
  // переход между страницами — warp, но не на первой загрузке
  document.addEventListener("nav", () => {
    initSoundState()
    navCount++
    if (navCount > 1) playWarp()
  })

  initSoundState()
  prepareAudio()
}

bindSoundEvents()
