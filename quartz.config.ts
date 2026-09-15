import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Между строк чертежа",
    // суффикс к заголовкам вкладок: пустая строка — во вкладке только название страницы,
    // поэтому на главной вкладка читается ровно как «Между строк чертежа»
    pageTitleSuffix: "",
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
        // «Астральная лаванда»: светлая лавандовая вселенная — сиреневый фон, глубокий фиолетовый текст
        lightMode: {
          light: "#f2eef8", // фон: светло-лавандовый
          lightgray: "#e0d8ec", // границы: сиреневый
          gray: "#6a5f78", // второстепенный текст
          darkgray: "#2e2840", // основной текст
          dark: "#1e1a30", // заголовки
          secondary: "#6a5a8a", // ссылки
          tertiary: "#b86a8a", // акценты
          highlight: "rgba(184, 106, 138, 0.15)", // подсветка поиска
          textHighlight: "#b86a8a88",
        },
        darkMode: {
          light: "#1a1626", // фон: тёмный фиолетовый
          lightgray: "#2a2440", // границы
          gray: "#8a7f9a", // второстепенный текст
          darkgray: "#e8e0f2", // основной текст
          dark: "#f2eef8", // заголовки
          secondary: "#b8a8d8", // ссылки
          tertiary: "#d89ab8", // акценты
          highlight: "rgba(184, 168, 216, 0.25)", // подсветка поиска
          textHighlight: "#b8a8d888",
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
