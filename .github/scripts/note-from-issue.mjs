// Задача (issue) → заметка базы знаний.
// Если задан ключ LLM_API_KEY, текст заметки пишет ИИ по правилам из note-prompt.md;
// иначе заметка собирается простым конвертером (без выдумывания содержания).
import fs from "node:fs"
import path from "node:path"
import { askAI } from "./ai.mjs"

const E = process.env
const ROOT = process.cwd()
const CONTENT = path.join(ROOT, "content")

const section = (label) => {
  const m = E.ISSUE_BODY.match(new RegExp(`###\\s*${label}[^\\n]*\\n+([\\s\\S]*?)(?=\\n###\\s|$)`, "i"))
  return m ? m[1].trim() : ""
}

const kind = section("Что добавить") || "Быстрая запись"
const sectionName = (section("Раздел") || "").toLowerCase().trim()
const noteTitle = (section("Название") || E.ISSUE_TITLE || "").replace(/^\[Заметка\]\s*/i, "").trim()
const noteText = section("Текст") || E.ISSUE_BODY.trim()
const today = new Date().toISOString().slice(0, 10)
const byLine = `\n\n---\n\n_Источник: задача [#${E.ISSUE_NUMBER}](${E.ISSUE_URL})${E.ISSUE_AUTHOR ? ` от @${E.ISSUE_AUTHOR}` : ""}, ${today}._\n`

const ERROR_DIRS = {
  "спецификация": "02_Ошибки/Спецификация",
  "основная надпись": "02_Ошибки/Основная_надпись",
  "сборочный чертёж": "02_Ошибки/Сборочный_чертёж",
  "схемы": "02_Ошибки/Схемы",
}
const targetDir = /ошибк/i.test(kind)
  ? ERROR_DIRS[sectionName] || ERROR_DIRS["спецификация"]
  : /гост/i.test(kind)
    ? "03_ГОСТы"
    : /документ/i.test(kind)
      ? "04_Документы"
      : null

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (e.name.endsWith(".md")) acc.push(path.relative(CONTENT, p).replace(/\\/g, "/"))
  }
  return acc
}
const notes = walk(CONTENT)
const existing = notes.find((p) =>
  fs.readFileSync(path.join(CONTENT, p), "utf8").includes(`issue: ${E.ISSUE_NUMBER}\n`),
)

const slug = (s) =>
  String(s).replace(/[\\/:*?"<>|#]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 80) ||
  "заметка-" + E.ISSUE_NUMBER
const shortText = (t) => {
  const first = (t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").split(/\n+/)[0] || "")
    .replace(/[*_`>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return first.length <= 140 ? first : first.slice(0, 140).replace(/\s+\S*$/, "") + "…"
}

function insertInto(relPath, heading, line) {
  const file = path.join(CONTENT, relPath)
  const text = fs.readFileSync(file, "utf8")
  const marker = `## ${heading}`
  const at = text.indexOf(marker)
  if (at === -1) {
    fs.writeFileSync(file, text.trimEnd() + `\n\n${line}\n`, "utf8")
    return file
  }
  const next = text.slice(at + marker.length).search(/\n##\s/)
  const insertAt = next === -1 ? text.length : at + marker.length + next
  const updated = text.slice(0, insertAt).replace(/\s*$/, "\n") + line + "\n" + text.slice(insertAt).replace(/^\s*/, "\n")
  fs.writeFileSync(file, updated.replace(/\n{3,}/g, "\n\n"), "utf8")
  return file
}

function writeContent(dirRel, name, markdown) {
  const dir = path.join(CONTENT, dirRel)
  fs.mkdirSync(dir, { recursive: true })
  const target = existing ? path.join(CONTENT, existing) : path.join(dir, name)
  fs.writeFileSync(target, markdown, "utf8")
  return target
}

const withIssueMarker = (md) =>
  md.includes("issue:") ? md : md.replace(/^---\n/, `---\nissue: ${E.ISSUE_NUMBER}\n`)

const baseNote = (title, description, tags, body) =>
  [
    "---",
    `title: "${title.replace(/"/g, "'")}"`,
    `description: "${description.replace(/"/g, "'")}"`,
    `теги: [${tags}]`,
    `issue: ${E.ISSUE_NUMBER}`,
    "---",
    "",
    `# ${title}`,
    "",
    body,
    byLine,
  ].join("\n")

const ai = await askAI({ env: E, kind, sectionName, noteTitle, noteText, notes, root: ROOT })

let file = ""
let mode = ""

if (targetDir) {
  const tags = /ошибк/i.test(kind) ? `ошибка, ${sectionName || "спецификация"}` : /гост/i.test(kind) ? "гост" : "документ"
  if (ai) {
    const name = slug(String(ai.file_name || noteTitle).replace(/\.md$/i, "")) + ".md"
    file = writeContent(targetDir, name, withIssueMarker(String(ai.markdown).trimEnd() + "\n") + byLine)
    mode = `ИИ (${ai.model})`
  } else {
    file = writeContent(targetDir, slug(noteTitle) + ".md", baseNote(noteTitle, shortText(noteText), tags, noteText))
    mode = "простой конвертер (ключ ИИ не задан)"
  }
} else if (/вопрос/i.test(kind)) {
  file = insertInto("01_Вопросы.md", "Открытые", `- ${today} — **${noteTitle}**. ${noteText}`)
  mode = "вопрос → список вопросов"
} else {
  file = insertInto("00_Инбокс.md", "Не разобрано", `- ${today} — ${noteTitle ? noteTitle + " — " : ""}${noteText}`)
  mode = "быстрая запись → инбокс"
}

const rel = path.relative(ROOT, file).replace(/\\/g, "/")
console.log("NOTE_WRITTEN=" + rel + " MODE=" + mode)

if (E.GITHUB_TOKEN && E.GITHUB_REPOSITORY) {
  const h = {
    Authorization: `Bearer ${E.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "normcontrol-kb-bot",
  }
  const body =
    `Готово ✅\n\nЗаметка: \`${rel}\`\nОбработано: **${mode}**\n\n` +
    (ai && ai.comment ? `От ИИ: ${ai.comment}\n\n` : "") +
    "Сайт пересоберётся за 1–2 минуты (вкладка **Actions** — ход сборки)."
  await fetch(`https://api.github.com/repos/${E.GITHUB_REPOSITORY}/issues/${E.ISSUE_NUMBER}/comments`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ body }),
  })
  await fetch(`https://api.github.com/repos/${E.GITHUB_REPOSITORY}/issues/${E.ISSUE_NUMBER}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ state: "closed", state_reason: "completed" }),
  })
}
