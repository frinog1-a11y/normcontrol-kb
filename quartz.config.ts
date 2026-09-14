import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "База знаний нормоконтролёра",
    pageTitleSuffix: " | Нормоконтроль",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "ru-RU",
    // ВАЖНО: при сборке на GitHub Actions адрес подставляется из переменной окружения
    // QUARTZ_BASE_URL = <владелец репозитория>.github.io/normcontrol-kb (см. .github/workflows/deploy.yml).
    // Ниже — значение для локальной сборки.
    baseUrl: process.env.QUARTZ_BASE_URL ?? "frinog1-a11y.github.io/normcontrol-kb",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        // все три гарнитуры поддерживают кириллицу (проверено по метаданным Google Fonts)
        title: "Playfair Display",
        header: "Playfair Display",
        body: "Inter",
        code: "JetBrains Mono",
      },
      colors: {
        // «Инженерный дневник»: тёплый крем, графит, приглушённый синий, терракота
        lightMode: {
          light: "#faf6f0", // фон: тёплый крем
          lightgray: "#e8e2d8", // границы: светло-песочный
          gray: "#8a8578", // второстепенный текст: мягкий пепел
          darkgray: "#2a2a2a", // основной текст: графит
          dark: "#1a1a1a", // заголовки: почти чёрный
          secondary: "#3a5a7a", // ссылки: приглушённый синий
          tertiary: "#a65a3a", // акценты: терракота
          highlight: "rgba(184, 150, 63, 0.15)", // подсветка поиска
          textHighlight: "#b8963f88",
        },
        darkMode: {
          light: "#1a1a1a", // фон: почти чёрный
          lightgray: "#2a2a2a", // границы: графит
          gray: "#8a8578", // мягкий пепел
          darkgray: "#e8e2d8", // текст: крем
          dark: "#faf6f0", // заголовки: яркий крем
          secondary: "#7aa8c8", // ссылки: светло-синий
          tertiary: "#d88a6a", // акценты: светло-терракота
          highlight: "rgba(184, 150, 63, 0.25)",
          textHighlight: "#b8963f88",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
