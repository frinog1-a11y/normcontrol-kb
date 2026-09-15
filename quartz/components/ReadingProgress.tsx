import { QuartzComponent, QuartzComponentConstructor } from "./types"

/** Полоса прогресса чтения и мелкие улучшения интерфейса (иконки у заголовков). */
const ReadingProgress: QuartzComponent = () => {
  return null
}

ReadingProgress.afterDOMLoaded = [
  "(function() {",
  "  function setupProgress() {",
  "    let bar = document.getElementById('reading-progress')",
  "    if (!bar) {",
  "      bar = document.createElement('div')",
  "      bar.id = 'reading-progress'",
  "      document.body.appendChild(bar)",
  "    }",
  "    const update = function() {",
  "      const doc = document.documentElement",
  "      const max = doc.scrollHeight - doc.clientHeight",
  "      const progress = max > 0 ? (doc.scrollTop / max) * 100 : 0",
  "      bar.style.width = progress + '%'",
  "    }",
  "    window.addEventListener('scroll', update, { passive: true })",
  "    window.addEventListener('resize', update)",
  "    update()",
  "    if (typeof window.addCleanup === 'function') {",
  "      window.addCleanup(function() {",
  "        window.removeEventListener('scroll', update)",
  "        window.removeEventListener('resize', update)",
  "      })",
  "    }",
  "  }",
  "  function decorateHeadings() {",
  "    const heads = document.querySelectorAll('article h2')",
  "    heads.forEach(function(h) {",
  "      const text = (h.textContent || '').trim()",
  "      if (h.dataset.iconified === '1') return",
  "      if (text === 'Как выглядит ошибка' || text === 'Как выглядит') {",
  "        h.insertBefore(document.createTextNode('⚠ '), h.firstChild)",
  "      } else if (text === 'Как правильно') {",
  "        h.insertBefore(document.createTextNode('✓ '), h.firstChild)",
  "      } else if (text.indexOf('Чек-лист') === 0) {",
  "        h.insertBefore(document.createTextNode('☑ '), h.firstChild)",
  "      }",
  "      h.dataset.iconified = '1'",
  "    })",
  "  }",
  "  document.addEventListener('nav', function() {",
  "    setupProgress()",
  "    decorateHeadings()",
  "  })",
  "  setupProgress()",
  "  decorateHeadings()",
  "})()",
].join("\n")

export default (() => ReadingProgress) satisfies QuartzComponentConstructor
