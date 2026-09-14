import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const REPO = "frinog1-a11y/normcontrol-kb"
const BRANCH = "main"

/**
 * Ссылка «Править эту заметку» — открывает страницу файла в веб-редакторе GitHub.
 * Нужна для рабочих ПК, где заблокирован api.github.com (браузерный CMS там не работает),
 * но сам github.com доступен.
 */
const EditOnGitHub: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const rawPath = (fileData.filePath as string | undefined) ?? ""
  if (!rawPath) return null

  // в разных версиях Quartz путь может приходить и с префиксом content/, и без него
  const rel = rawPath.replace(/^content\//, "")
  const encodePath = (p: string) =>
    p
      .split("/")
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeURIComponent(segment))
      .join("/")

  const editHref = `https://github.com/${REPO}/edit/${BRANCH}/content/${encodePath(rel)}`
  const folder = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ""
  const newHref = folder
    ? `https://github.com/${REPO}/new/${BRANCH}/content/${encodePath(folder)}`
    : `https://github.com/${REPO}/new/${BRANCH}/content`

  return (
    <div class="edit-on-github">
      <a href={editHref} target="_blank" rel="noopener">
        ✎ Править эту заметку на GitHub
      </a>
      <a href={newHref} target="_blank" rel="noopener">
        ＋ Создать новую в этой папке
      </a>
    </div>
  )
}

export default (() => EditOnGitHub) satisfies QuartzComponentConstructor
