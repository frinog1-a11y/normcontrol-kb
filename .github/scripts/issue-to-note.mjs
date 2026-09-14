// Превращает GitHub-задачу (issue) в заметку базы знаний.
// Запускается в GitHub Actions — ПК пользователя не нужен.
import fs from "node:fs"
import path from "node:path"

const {
  ISSUE_NUMBER,
  ISSUE_TITLE = "",
  ISSUE_BODY = "",
  ISSUE_AUTHOR = "",
  ISSUE_URL = "",
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
} = process.env

const ROOT = process.cwd()
const CONTENT = path.join(ROOT, "content")

function section(label) {
  const re = new RegExp(`###\\s*${label}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###\\s|$)`, "i")
  const m = ISSUE_BODY.match(re)
  return m ? m[1].trim() : ""
}

const kind = section("Что добавить") || "Быстрая запись"
const sectionName = section("Раздел") || ""
const noteTitle = (section("Название") || ISSUE_TITLE || "").replace(/^\[Заметка\]\s*/i, "").trim()
const noteText = section("Текст") || ISSUE_BODY.trim()

function slugify(s) {
  return (
    s
      .replace(/[\\/:*?"<>|#]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "заметка-" + ISSUE_NUMBER
  )
}

function shortDescription(text, title) {
  const first = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "").split(/\n+/)[0] || title
  return first.replace(/[*_`>#-]/g, "").trim().slice(0, 140) || title
}

const today = new Date().toISOString().slice(0, 10)
const byLine = `\n\n---\n\n_Источник: задача [#${ISSUE_NUMBER}](${ISSUE_URL})${ISSUE_AUTHOR ? ` от @${ISSUE_AUTHOR}` : ""}, ${today}._\n`

function findExistingNote() {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        const found = walk(p)
        if (found) return found
      } else if (e.name.endsWith(".md")) {
        const t = fs.readFileSync(p, "utf8")
        if (t.includes(`issue: ${ISSUE_NUMBER}\n`) || t.includes(`issue: ${ISSUE_NUMBER}\r\n`)) return p
      }
    }
    return null
  }
  return walk(CONTENT)
}

function insertIntoFile(relPath, heading, line) {
  const file = path.join(CONTENT, relPath)
  const text = fs.readFileSync(file, "utf8")
  const marker = `## ${heading}`
  const start = text.indexOf(marker)
  if (start === -1) {
    fs.writeFileSync(file, text.trimEnd() + `\n\n${line}\n`, "utf8")
    return file
  }
  const rest = text.slice(start + marker.length)
  const nextHeadingRel = rest.search(/\n##\s/)
  const insertAt = nextHeadingRel === -1 ? text.length : start + marker.length + nextHeadingRel
  const updated = text.slice(0, insertAt).replace(/\s*$/, "\n") + line + "\n" + text.slice(insertAt).replace(/^\s*/, "\n")
  fs.writeFileSync(file, updated.replace(/\n{3,}/g, "\n\n"), "utf8")
  return file
}

function writeNote(dirRel, extraTags) {
  const existing = findExistingNote()
  const slug = existing ? path.basename(existing, ".md") : slugify(noteTitle)
  const dir = path.join(CONTENT, dirRel)
  fs.mkdirSync(dir, { recursive: true })
  const file = existing || path.join(dir, `${slug}.md`)
  const tags = [...extraTags].filter(Boolean).join(", ")
  const fm = [
    "---",
    `title: "${noteTitle.replace(/"/g, "'")}"`,
    `description: "${shortDescription(noteText, noteTitle).replace(/"/g, "'")}"`,
    `теги: [${tags}]`,
    `issue: ${ISSUE_NUMBER}`,
    "---",
    "",
    `# ${noteTitle}`,
    "",
    noteText,
    byLine,
  ].join("\n")
  fs.writeFileSync(file, fm, "utf8")
  return file
}

function comment(body) {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return Promise.resolve()
  return fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "normcontrol-kb-bot",
    },
    body: JSON.stringify({ body }),
  })
}

function closeIssue() {
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) return Promise.resolve()
  return fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${ISSUE_NUMBER}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "normcontrol-kb-bot",
    },
    body: JSON.stringify({ state: "closed", state_reason: "completed" }),
  })
}

let target = ""
let where = ""

if (/ошибк/i.test(kind)) {
  const map = {
    спецификация: "02_Ошибки/Спецификация",
    "основная надпись": "02_Ошибки/Основная_надпись",
    "сборочный чертёж": "02_Ошибки/Сборочный_чертёж",
    схемы: "02_Ошибки/Схемы",
  }
  const key = sectionName.toLowerCase().trim()
  const dir = map[key] || "02_Ошибки/Спецификация"
  target = writeNote(dir, ["ошибка", key || "спецификация"])
  where = `Ошибки → ${dir.split("/")[1]}`
} else if (/гост/i.test(kind)) {
  target = writeNote("03_ГОСТы", ["гост"])
  where = "ГОСТы"
} else if (/документ/i.test(kind)) {
  target = writeNote("04_Документы", ["документ"])
  where = "Документы"
} else if (/вопрос/i.test(kind)) {
  target = insertIntoFile("01_Вопросы.md", "Открытые", `- ${today} — **${noteTitle}**. ${noteText}`)
  where = "Вопросы"
} else {
  target = insertIntoFile("00_Инбокс.md", "Не разобрано", `- ${today} — ${noteTitle ? noteTitle + " — " : ""}${noteText}`)
  where = "Инбокс"
}

const rel = path.relative(ROOT, target).replace(/\\/g, "/")
console.log("NOTE_WRITTEN=" + rel + " WHERE=" + where)
fs.appendFileSync(path.join(ROOT, "_note_result.txt"), rel + "\n", "utf8")

await comment(
  `Готово ✅\n\nЗадача превращена в заметку в разделе **${where}**: \`${rel}\`\n\n` +
    `Она появится на сайте через 1–2 минуты после сборки. Проверить сборку: вкладка **Actions**.`,
)
await closeIssue()
