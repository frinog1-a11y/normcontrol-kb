import { QuartzComponent, QuartzComponentConstructor } from "./types"

/**
 * Кнопка «наверх». Появляется при прокрутке страницы.
 * Стили — только в quartz/styles/custom.scss (селектор #back-to-top).
 */
const BackToTop: QuartzComponent = () => {
  return (
    <button id="back-to-top" type="button" aria-label="Наверх" title="Наверх">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  )
}

BackToTop.afterDOMLoaded = `
  const setupBackToTop = () => {
    const btn = document.getElementById("back-to-top")
    if (!btn) return

    const toggle = () => {
      if (window.scrollY > 400) {
        btn.classList.add("visible")
      } else {
        btn.classList.remove("visible")
      }
    }

    const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" })

    window.addEventListener("scroll", toggle, { passive: true })
    btn.addEventListener("click", toTop)
    toggle()

    // window.addCleanup появляется только после инициализации роутера Quartz,
    // поэтому проверяем наличие функции, чтобы не сорвать выполнение остальных скриптов
    if (typeof window.addCleanup === "function") {
      window.addCleanup(() => {
        window.removeEventListener("scroll", toggle)
        btn.removeEventListener("click", toTop)
      })
    }
  }

  // настройка запускается по событию nav — так работают штатные скрипты Quartz
  document.addEventListener("nav", setupBackToTop)
`

export default (() => BackToTop) satisfies QuartzComponentConstructor
