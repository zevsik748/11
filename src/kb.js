import { sanitizeText } from "./utils.js";
import logger from "./logger.js";

let CACHE = { ts: 0, rows: [], suggestions: [] };

export async function loadKB(env, force = false) {
  const now = Date.now();
  if (!force && CACHE.rows.length && now - CACHE.ts < 60 * 60 * 1000) {
    logger.debug("KB: returning cached rows");
    globalThis.KB_CACHE = CACHE;
    return CACHE.rows;
  }

  const url = env.KB_URL;
  if (!url) {
    CACHE = { ts: now, rows: [], suggestions: [] };
    globalThis.KB_CACHE = CACHE;
    logger.warn("KB: KB_URL not set, empty cache");
    return CACHE.rows;
  }

  try {
    logger.info("KB: fetching", url);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`KB HTTP ${r.status}`);
    const csv = await r.text();
    const rows = parseCSV(csv);
    // build suggestions from patterns
    const sugg = buildSuggestions(rows, 10);
    CACHE = { ts: now, rows, suggestions: sugg };
    globalThis.KB_CACHE = CACHE;
    logger.info("KB: loaded rows:", rows.length, "suggestions:", sugg.length);
    return rows;
  } catch (e) {
    logger.warn("KB load error:", String(e));
    globalThis.KB_CACHE = CACHE;
    return CACHE.rows;
  }
}

export function getSuggestions(limit = 10) {
  return (globalThis.KB_CACHE?.suggestions || []).slice(0, limit);
}

export function matchKB(rows, query, topK = 3) {
  const q = sanitizeText(query, 2000).toLowerCase();
  const scored = [];
  for (const r of rows || []) {
    const pats = (r.patterns || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    let score = Number(r.priority || 0);
    for (const p of pats) if (p && q.includes(p)) score += 10;
    if (score > 0) scored.push([score, r.answer_md || ""]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const out = scored.slice(0, topK).map(x => x[1]).join("\n\n---\n\n");
  logger.debug("KB match for query:", query, "=> matches:", scored.length);
  return out;
}

function buildSuggestions(rows, limit = 10) {
  const counts = new Map();
  for (const r of rows || []) {
    const pats = (r.patterns || "").split(",").map(x => x.trim()).filter(Boolean);
    for (const p of pats) {
      const key = p.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const arr = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(x => x[0]);
  return arr.map(s => s.charAt(0).toUpperCase() + s.slice(1));
}

function parseCSV(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = {
    patterns: headers.indexOf("patterns"),
    answer_md: headers.indexOf("answer_md") >= 0 ? headers.indexOf("answer_md") : headers.indexOf("answer"),
    priority: headers.indexOf("priority"),
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const get = j => (j >= 0 && j < cols.length ? cols[j] : "");
    out.push({
      patterns: get(idx.patterns) || "",
      answer_md: get(idx.answer_md) || cols.join(" "),
      priority: Number(get(idx.priority) || 0) || 0,
    });
  }
  return out;
}
function splitCSVLine(line) {
  const res = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== "\"")) { q = !q; continue; }
    if (ch === "," && !q) { res.push(cur); cur = ""; continue; }
    cur += ch;
  }
  res.push(cur);
  return res.map(s => s.replace(/\\"/g, '"').trim());
}
