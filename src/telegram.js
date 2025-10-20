import { sanitizeText, SYSTEM_PROMPT } from "./utils.js";
import { loadKB, matchKB, getSuggestions } from "./kb.js";
import { callKIE } from "./llm.js";
import logger from "./logger.js";

export async function telegramWebhook(req, env) {
  try {
    const update = await req.json();
    const chatId = update?.message?.chat?.id || update?.edited_message?.chat?.id;
    const text = sanitizeText(update?.message?.text || update?.edited_message?.text || "");
    if (!chatId) {
      logger.debug("tg webhook: missing chatId");
      return json({ ok: true });
    }

    if (!text) {
      // ignore non-text updates
      return json({ ok: true });
    }

    if (/^\/start/i.test(text)) {
      try {
        const suggestions = (typeof getSuggestions === "function") ? getSuggestions(8).slice(0, 8) : [];
        const list = (suggestions && suggestions.length)
          ? suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : "1. /help — краткая справка\n2. Задать вопрос по Veo/Google Flow";

        const msg =
          "Привет! Я Ferixdi AI — наставник по Veo 3.1 и Google Flow.\n" +
          "Вот быстрые подсказки, которые могут помочь:\n\n" +
          list +
          "\n\nЕсли нужно — напиши /help или задай вопрос прямо сейчас.";

        await tgSend(env, chatId, msg);
      } catch (e) {
        logger.warn("tg /start handler failed:", String(e));
      }
      return json({ ok: true });
    }

    await loadKB(env, false);
    const kbAnswer = matchKB(globalThis.KB_CACHE?.rows || [], text, 3);
    if (kbAnswer && kbAnswer.trim()) {
      logger.info("tg: answered from KB for", chatId);
      await tgSend(env, chatId, kbAnswer);
      return json({ ok: true });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ];
    const reply = await callKIE(env, messages);
    await tgSend(env, chatId, reply);
    logger.info("tg reply sent to", chatId);
    return json({ ok: true });
  } catch (e) {
    logger.warn("tg webhook err:", String(e));
    return json({ ok: true });
  }
}

export async function setTelegramWebhook(env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const base = env.PUBLIC_BASE_URL;
  if (!token || !base) {
    logger.warn("setTelegramWebhook: missing token or base url");
    return { ok: false, reason: "no token or base url" };
  }
  const hookUrl = base.replace(/\/$/, "") + "/telegram";
  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(hookUrl)}`;
  const r = await fetch(url);
  logger.info("setTelegramWebhook:", hookUrl, "status:", r.status);
  return { ok: r.ok, status: r.status, url: hookUrl };
}

async function tgSend(env, chatId, text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("tgSend: missing TELEGRAM_BOT_TOKEN");
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: sanitizeText(text, 4000) || "…" })
    });
  } catch (e) {
    logger.warn("tgSend failed:", String(e));
  }
}

function json(x, s = 200) { return new Response(JSON.stringify(x), { status: s, headers: { "content-type": "application/json" } }); }