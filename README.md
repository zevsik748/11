# Ferixdi Flow Bot

Простой Node.js (Express) сервер для веб-чата и Telegram, использующий Google Sheets (CSV) как базу знаний и KIE.ai (OpenAI-совместимый) как LLM.

Эндпоинты:
- GET / — веб-чат (public/index.html)
- POST /api/chat — ответы для веб-чата (json { text })
- POST /telegram — Telegram webhook
- GET /health — проверка живости
- POST /api/reload — принудительное обновление KB из Google Sheets CSV

Запуск в Codespaces / локально:
1. Скопируйте `.env.example` → `.env` и заполните:
   - KIEAI_API_KEY, KIEAI_BASE_URL, MODEL
   - KB_URL (Google Sheets CSV, публичный)
   - TELEGRAM_BOT_TOKEN и PUBLIC_BASE_URL (если нужен Telegram)
2. Установите зависимости:
   npm i
3. Запустите в dev режиме:
   npm run dev
4. Откройте порт 3000 (Codespaces) или http://localhost:3000
   - /health → { ok: true }
   - главная страница — веб-чат

KB:
- KB загружается из KB_URL (CSV) и кэшируется 1 час.
- Ручная перезагрузка: POST /api/reload
- Cron: автоматическая подгрузка каждый час (node-cron)

Особенности:
- Сначала бот ищет ответ в KB (Google Sheets). Если совпадение найдено — отвечает из KB. Иначе — вызывает KIE.ai.
- Автоподсказки: бот предлагает пользователю популярные вопросы из KB на /start и на веб-странице.
- KIE.ai вызовы с ретраями и tolerant-парсером
- Логирование (src/logger.js)
