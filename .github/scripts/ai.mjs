// Модуль работы с языковой моделью (OpenAI-совместимый API).
// Провайдер определяется по виду ключа — подходит бесплатный ключ Gemini, OpenRouter или Groq.
import fs from "node:fs"
import path from "node:path"

export function provider(env) {
  if (!env.LLM_API_KEY) return null
  if (env.LLM_BASE_URL) {
    return { base: env.LLM_BASE_URL.replace(/\/$/, ""), models: [env.LLM_MODEL || "gpt-4o-mini"] }
  }
  const k = env.LLM_API_KEY
  if (k.startsWith("AIza")) {
    return {
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      models: [env.LLM_MODEL || "gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean),
    }
  }
  if (k.startsWith("sk-or-")) {
    return { base: "https://openrouter.ai/api/v1", models: [env.LLM_MODEL || "deepseek/deepseek-chat-v3.1:free"] }
  }
  if (k.startsWith("gsk_")) {
    return { base: "https://api.groq.com/openai/v1", models: [env.LLM_MODEL || "llama-3.3-70b-versatile"] }
  }
  if (k.startsWith("sk-")) {
    return { base: "https://api.openai.com/v1", models: [env.LLM_MODEL || "gpt-4o-mini"] }
  }
  return null
}

export function looseJson(text) {
  const a = text.indexOf("{")
  const b = text.lastIndexOf("}")
  if (a < 0 || b < 0) return null
  try {
    return JSON.parse(text.slice(a, b + 1))
  } catch {
    return null
  }
}

export async function askAI(ctx) {
  const { env, kind, sectionName, noteTitle, noteText, notes, root } = ctx
  const cfg = provider(env)
  if (!cfg) {
    console.log("LLM_SKIPPED: ключ LLM_API_KEY не задан — работает простой конвертер")
    return null
  }

  const rules = fs.readFileSync(path.join(root, ".github", "scripts", "note-prompt.md"), "utf8")
  const user = [
    `Тип заметки: ${kind}`,
    sectionName ? `Раздел: ${sectionName}` : "",
    `Название: ${noteTitle}`,
    "",
    "Текст задачи:",
    noteText,
    "",
    "Существующие заметки базы (для ссылок [[…]]):",
    notes
      .filter((p) => !p.endsWith("_index.md"))
      .map((p) => p.replace(/\.md$/, ""))
      .slice(0, 150)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n")

  for (const model of cfg.models) {
    try {
      const r = await fetch(cfg.base + "/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: rules },
            { role: "user", content: user },
          ],
        }),
      })
      if (!r.ok) {
        console.log(`LLM ${model}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`)
        continue
      }
      const j = await r.json()
      const out = looseJson(j.choices?.[0]?.message?.content || "")
      if (out && typeof out.markdown === "string" && out.markdown.includes("---")) {
        console.log("LLM_OK: " + model)
        return { ...out, model }
      }
      console.log(`LLM ${model}: ответ не разобран`)
    } catch (err) {
      console.log(`LLM ${model}: ${err.message}`)
    }
  }
  return null
}
