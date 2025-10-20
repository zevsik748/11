import "dotenv/config";
import express from "express";
import morgan from "morgan";
import cron from "node-cron";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { loadKB, getSuggestions } from "./kb.js";
import { webChat } from "./web.js";
import { telegramWebhook, setTelegramWebhook } from "./telegram.js";
import logger from "./logger.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("tiny", { stream: { write: (s) => logger.info(s.trim()) } }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

/** Simple per-user rate limit (IP or chat_id) */
const rateLimiter = new RateLimiterMemory({ points: 10, duration: 5 }); // 10 запросов за 5 секунд
app.use(async (req, res, next) => {
  const key = req.headers["x-forwarded-for"] || req.ip || "anon";
  try { await rateLimiter.consume(key.toString()); next(); }
  catch {
    logger.warn("rate limit exceeded for", key);
    res.status(429).json({ error: "Слишком много запросов. Подождите чуть-чуть." });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/suggestions", async (req, res) => {
  await loadKB(process.env, false);
  res.json({ suggestions: getSuggestions(10) });
});

app.post("/api/reload", async (req, res) => {
  await loadKB(process.env, true);
  res.json({ ok: true, reloaded: true });
});

app.post("/api/chat", async (req, res) => {
  const r = await webChat(new Request("", { method: "POST", body: JSON.stringify(req.body) }), process.env);
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

app.post("/telegram", async (req, res) => {
  const r = await telegramWebhook(new Request("", { method: "POST", body: JSON.stringify(req.body) }), process.env);
  res.status(r.status).set(Object.fromEntries(r.headers)).send(await r.text());
});

app.get("/set-telegram-webhook", async (req, res) => {
  const out = await setTelegramWebhook(process.env);
  res.json(out);
});

// cron: обновление KB раз в час
cron.schedule("0 * * * *", async () => {
  try { await loadKB(process.env, true); logger.info("KB reloaded by cron"); }
  catch(e){ logger.warn("KB cron error", String(e)); }
});

app.listen(PORT, () => logger.info(`Ferixdi bot running on :${PORT}`));
