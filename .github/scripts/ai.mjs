// Модуль работы с языковой моделью (OpenAI-совместимый API).
// Провайдер определяется по виду ключа — подходит бесплатный ключ Gemini, OpenRouter или Groq.
import fs from "node:fs"
import path from "node:path"

const PRESETS = {
  deepseek: { base: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-reasoner"] },
  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  openrouter: {
    base: "https://openrouter.ai/api/v1",
    models: ["deepseek/deepseek-chat-v3-0324:free", "deepseek/deepseek-r1:free", "deepseek/deepseek-chat"],
  },
  groq: {
    base: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b"],
  },
  openai: { base: "https://api.openai.com/v1", models: ["gpt-4o-mini"] },
  ollama: { base: "http://localhost:11434/v1", models: ["deepseek-r1:7b", "qwen2.5:7b"] },
}

export function provider(env) {
  const custom = (env.LLM_BASE_URL || "").replace(/\/$/, "")
  const key = (env.LLM_API_KEY || "").trim()
  let name = (env.LLM_PROVIDER || "").toLowerCase().trim()

  // PATCH (normcontrol-kb): вычищаем из логов всё, что может содержать ключ API
  const scrub = (text) =>
    String(text || "")
      .replace(/([?&](?:key|api_key|api-key|apikey|token|access_token)=)[^&\s"']+/gi, "$1***")
      .replace(/\b(sk-[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{6,}/g, "$1***")
      .replace(/\b(gsk_[A-Za-z0-9]{4})[A-Za-z0-9]{6,}/g, "$1***")
      .replace(/\b(AIza[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{6,}/g, "$1***")
      .replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, "$1***")
      .slice(0, 160)

  const hostOf = (u) => {
    try {
      return new URL(u).hostname
    } catch {
      return ""
    }
  }

  if (!name) {
    if (custom) {
      const host = hostOf(custom)
      name = Object.keys(PRESETS).find((p) => host && hostOf(PRESETS[p].base) === host) || "custom"
    } else if (key.startsWith("AIza")) name = "gemini"
    else if (key.startsWith("sk-or-")) name = "openrouter"
    else if (key.startsWith("gsk_")) name = "groq"
    // ключи DeepSeek и OpenAI начинаются одинаково (sk-), поэтому по умолчанию считаем DeepSeek
    else if (key) name = "deepseek"
  }

  if (!name) return null

  const preset = PRESETS[name]
  const base = custom || preset?.base
  if (!base) return null
  if (!key && name !== "ollama") {
    console.log("LLM_SKIPPED: не задан LLM_API_KEY")
    return null
  }
  return {
    name,
    base,
    key,
    models: [env.LLM_MODEL, ...(preset?.models || ["gpt-4o-mini"])].filter(Boolean),
  }
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
      const headers = { "Content-Type": "application/json" }
      if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`
      const r = await fetch(cfg.base + "/chat/completions", {
        method: "POST",
        headers,
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
        console.log(`LLM ${model}: HTTP ${r.status} ${scrub(await r.text())}`)
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
      console.log(`LLM ${model}: ${scrub(err.message)}`)
    }
  }
  return null
}
