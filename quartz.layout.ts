import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.BackgroundParticles(),
    Component.ReadingProgress(),
    Component.EditOnGitHub(),
    Component.BackToTop(),
    Component.SoundToggle(),
  ],
  footer: Component.Footer({
    links: {
      "✏ Как добавить заметку": "https://frinog1-a11y.github.io/normcontrol-kb/add-note",
      "Репозиторий базы": "https://github.com/frinog1-a11y/normcontrol-kb",
      "Редактор базы": "https://frinog1-a11y.github.io/normcontrol-kb/static/admin/",
      Quartz: "https://quartz.jzhao.xyz",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs({ rootName: "Главная", spacerSymbol: "›" }),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.ConditionalRender({
      component: Component.AddNoteLink(),
      // на самой странице-инструкции кнопка не нужна
      condition: (page) => page.fileData.slug !== "add-note",
    }),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    Component.Graph({
      // граф связей: полный граф базы (depth -1), просторная раскладка, при наведении светятся соседи
      localGraph: {
        depth: -1,
        showTags: true,
        removeTags: [],
        linkDistance: 50,
        repelForce: 1.5,
        focusOnHover: true,
      },
      globalGraph: { showTags: true, removeTags: [], linkDistance: 50, repelForce: 1.5 },
    }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs({ rootName: "Главная", spacerSymbol: "›" }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [
    // граф связей показываем и на страницах-списках (папки и теги): у такой страницы
    // собственного узла в contentIndex может не быть, поэтому здесь рисуем весь граф базы
    Component.Graph({
      localGraph: {
        depth: -1,
        showTags: true,
        removeTags: [],
        linkDistance: 50,
        repelForce: 1.5,
        focusOnHover: true,
      },
      globalGraph: { showTags: true, removeTags: [], linkDistance: 50, repelForce: 1.5 },
    }),
  ],
}
