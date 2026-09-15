/**
 * PATCH (normcontrol-kb): страницы-секреты.
 * Такие файлы не попадают в contentIndex, а значит — в поиск, граф связей, проводник
 * (Explorer), sitemap.xml и RSS. Страница при этом собирается и доступна по прямому URL.
 *
 * В этой версии Quartz нет frontmatter-флага `unlisted`, поэтому скрытие задаётся списком.
 */
export const HIDDEN_SLUGS = ["echelon"]

/** Скрыт ли слага (сам файл или что-то внутри его папки). */
export function isHiddenSlug(slug?: string | null): boolean {
  if (!slug) return false
  const clean = slug.replace(/^\/+|\/+$/g, "")
  return HIDDEN_SLUGS.some((hidden) => clean === hidden || clean.startsWith(hidden + "/"))
}
