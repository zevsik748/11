import { sanitizeText, SYSTEM_PROMPT } from "./utils.js";
import { loadKB, matchKB } from "./kb.js";
import { callKIE } from "./llm.js";
import logger from "./logger.js";

export async function webChat(req, env) {
  try {
    const body = await req.json();
    const text = sanitizeText(body?.text, 4000);
    await loadKB(env, false);
    const kbAnswer = matchKB(globalThis.KB_CACHE?.rows || [], text, 3);
    if (kbAnswer && kbAnswer.trim()) {
      logger.info("webChat: answered from KB");
      return json({ reply: kbAnswer });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ];
    const reply = await callKIE(env, messages);
    logger.info("webChat reply generated");
    return json({ reply });
  } catch (e) {
    logger.warn("webChat error:", String(e));
    return json({ reply: "⚠️ Временная ошибка. Попробуйте ещё раз.", error: String(e) }, 200);
  }
}

function json(x, s = 200) { return new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } }); }
