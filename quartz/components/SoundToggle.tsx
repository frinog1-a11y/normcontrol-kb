import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * Кнопка звука 🔇/🔊. Состояние хранится в localStorage ("sound-enabled"),
 * звуки живут в quartz/components/scripts/sound.ts и включаются по событию "sound-enabled".
 */
const SoundToggle: QuartzComponent = () => (
  <button id="sound-toggle" type="button" aria-label="Включить/выключить звук">
    🔇
  </button>
)

SoundToggle.afterDOMLoaded = `
(function() {
  function bind() {
    const btn = document.getElementById("sound-toggle")
    if (!btn || btn.dataset.bound === "1") return
    btn.dataset.bound = "1"

    let enabled = localStorage.getItem("sound-enabled") === "true"
    updateIcon()

    function updateIcon() {
      btn.textContent = enabled ? "\\uD83D\\uDD0A" : "\\uD83D\\uDD07"
      btn.title = enabled ? "Звук: включён" : "Звук: выключен"
    }

    btn.addEventListener("click", function(e) {
      e.stopPropagation()
      enabled = !enabled
      try {
        localStorage.setItem("sound-enabled", enabled ? "true" : "false")
      } catch (err) {}
      updateIcon()
      window.dispatchEvent(new CustomEvent(enabled ? "sound-enabled" : "sound-disabled"))
    })
  }

  bind()
  document.addEventListener("nav", bind)
})()
`

export default (() => SoundToggle) satisfies QuartzComponentConstructor
