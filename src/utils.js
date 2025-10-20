export const SYSTEM_PROMPT =
  "Ты — Ferixdi AI, наставник по Google Flow (Veo 3.1). " +
  "Отвечай ТОЛЬКО на русском, короткими пошаговыми инструкциями. " +
  "Если вопрос вне темы Veo/Google Flow/видеогенерации — мягко верни пользователя к теме.\n";

export function sanitizeText(s, max = 4000) {
  return (s || "").toString().slice(0, max);
}

// универсальный «достань текст» из разных вариантов JSON
export function extractTextFromAny(data) {
  const c0 = data?.choices?.[0];
  if (typeof c0?.message?.content === "string") return c0.message.content;
  if (Array.isArray(c0?.message?.content)) {
    const t = c0.message.content.map(x => (typeof x === "string" ? x : x?.text)).filter(Boolean).join("\n");
    if (t) return t;
  }
  if (typeof c0?.text === "string") return c0.text;
  if (typeof data?.output_text === "string") return data.output_text;
  if (typeof data?.response === "string") return data.response;
  if (typeof data?.result === "string") return data.result;

  try {
    const s = JSON.stringify(data);
    const m = s.match(/("content"|"text")\s*:\s*"([^"]+/);
    if (m && m[2]) return m[2].replace(/\\n/g, "\n");
  } catch {}
  return "";
}
