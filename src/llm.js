import { extractTextFromAny } from "./utils.js";
import logger from "./logger.js";

export async function callKIE(env, messages) {
  const baseA = (env.KIEAI_BASE_URL || "https://api.kie.ai/api/v1").replace(/\/$/, "");
  const baseB = "https://api.kie.ai/v1"; // запасной путь
  const model = env.MODEL || "gpt-4o";
  const payload = { model, temperature: 0.4, max_tokens: 800, messages };

  const variants = [
    { url: `${baseA}/chat/completions`, headers: { "Authorization": `Bearer ${env.KIEAI_API_KEY}` } },
    { url: `${baseA}/chat/completions`, headers: { "X-API-Key": env.KIEAI_API_KEY } },
    { url: `${baseB}/chat/completions`, headers: { "Authorization": `Bearer ${env.KIEAI_API_KEY}` } },
    { url: `${baseB}/chat/completions`, headers: { "X-API-Key": env.KIEAI_API_KEY } },
  ];

  let lastErr = "no-attempt";
  for (const v of variants) {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(v.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...v.headers },
          body: JSON.stringify(payload)
        });
        const txt = await r.text();
        logger.debug("KIE", v.url, r.status, txt.slice(0, 200));
        if (!r.ok) { lastErr = `HTTP ${r.status} ${txt}`; await wait(900); continue; }
        let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
        const out = extractTextFromAny(data);
        return out || "⚠️ Модель вернула пустой ответ. Проверьте модель/ключ.";
      } catch (e) {
        lastErr = String(e);
        logger.warn("KIE call error:", lastErr);
        await wait(900);
      }
    }
  }
  logger.error("KIE: all variants failed:", lastErr);
  return `⚠️ Модель временно недоступна. (${lastErr})`;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
