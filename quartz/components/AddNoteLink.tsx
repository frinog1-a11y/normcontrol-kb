import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"
import { classNames } from "../util/lang"

/**
 * PATCH (normcontrol-kb): заметная точка входа «Добавить заметку».
 * Показывается под заголовком каждой страницы (кроме самой /add-note):
 * крупная кнопка сразу открывает форму задачи, рядом — ссылка на инструкцию.
 */
const AddNoteLink: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const howto = resolveRelative(fileData.slug!, "add-note" as FullSlug) as string

  return (
    <div class={classNames(displayClass, "add-note-hint")}>
      <a
        href="https://github.com/frinog1-a11y/normcontrol-kb/issues/new?template=new-note.yml"
        class="add-note-pill"
        target="_blank"
        rel="noopener"
      >
        ✏ Добавить заметку
      </a>
      <span class="add-note-hint-text">
        напиши своими словами — ИИ оформит заметку. <a href={howto}>как это работает</a>
      </span>
    </div>
  )
}

AddNoteLink.css = `
.add-note-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
  margin: 0.8rem 0 1.2rem;
}

a.add-note-pill {
  display: inline-block;
  padding: 0.5rem 1.1rem;
  background: linear-gradient(135deg, #8a7ab8, #b86a8a);
  color: #f2eef8;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(138, 122, 184, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

a.add-note-pill:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(138, 122, 184, 0.5);
  color: #f2eef8;
  text-decoration: none;
}

.add-note-hint-text {
  font-size: 0.85rem;
  color: var(--gray);
}

[saved-theme="dark"] a.add-note-pill {
  background: linear-gradient(135deg, #b8a8d8, #d89ab8);
  color: #1a1626;
}
`

export default (() => AddNoteLink) satisfies QuartzComponentConstructor
