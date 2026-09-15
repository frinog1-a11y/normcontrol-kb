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
        // «Мягкая лаванда» + кремовый фон: тёплый крем для чтения, лавандовые ссылки,
        // тёплый розовый акцент
        lightMode: {
          light: "#faf6f0", // фон: тёплый кремовый
          lightgray: "#e4dfec", // границы: светло-сиреневый
          gray: "#8a7f9a", // второстепенный текст: лавандово-серый
          darkgray: "#3a3448", // основной текст: глубокий фиолетово-серый
          dark: "#2a2438", // заголовки: почти чёрный фиолетовый
          secondary: "#6a5a8a", // ссылки: мягкий лавандовый
          tertiary: "#c87a9a", // акценты: тёплый розовый
          highlight: "rgba(200, 122, 154, 0.15)", // подсветка поиска
          textHighlight: "#c87a9a88",
        },
        darkMode: {
          light: "#1e1a26", // фон: тёмный фиолетовый
          lightgray: "#2e2840", // границы: тёмно-сиреневый
          gray: "#8a7f9a", // второстепенный текст: лавандово-серый
          darkgray: "#e8e2ec", // основной текст: светло-лавандовый
          dark: "#f7f5fa", // заголовки: почти белый
          secondary: "#b8a8d8", // ссылки: светлая лаванда
          tertiary: "#d89ab8", // акценты: светлый розовый
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
