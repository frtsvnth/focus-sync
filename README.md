# Фокус Синк — генератор повестки командного синка

Одностраничное веб-приложение (HTML + CSS + JS) для генерации красивых названий повестки командных синков с помощью AI. Деплоится на GitHub Pages, бэкенд — Cloudflare Worker + RouterAI.

## Как работает

1. При загрузке выбирается завтрашняя дата, запускается сбор праздников
2. Собираются праздники из четырёх источников (в порядке приоритета):
   - **Локальная база** (~90 записей) — государственные и международные
   - **calend.ru** (через Cloudflare Worker) — неформальные, народный календарь
   - **Wikimedia API** (`api.wikimedia.org`, CORS) — «в этот день», международные
   - **Причудливый список** (24 неформальных «праздника») — fallback
3. Список отправляется в AI-модель через прокси
4. AI выбирает самое интересное название и возвращает в формате `📆 DD.MM <Название>`
5. Результат анимированно печатается на экране

## Архитектура

```
Браузер (index.html)
    ├── GitHub Pages (хостинг статики)
    ├── api.wikimedia.org (праздники, CORS * — прямой доступ)
    └── Cloudflare Worker (двойная роль)
            ├── calend.ru (парсинг HTML)
            └── RouterAI API (deepseek-v4-flash)
```

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| `index.html` | HTML5 + CSS3 + Vanilla JS | Всё приложение в одном файле |
| Cloudflare Worker | JavaScript (Workers runtime) | Проксирует запросы к RouterAI, добавляет CORS |
| RouterAI | OpenAI-совместимый API | Доступ к AI-моделям, оплата в рублях |
| calеnd.ru | HTML, через Worker | Неформальные + народные праздники, парсинг на Worker |
| Wikimedia | REST API, CORS * | Международные праздники «в этот день» |

## Деплой

### GitHub Pages
1. Форкнуть/склонировать репо
2. Ветка `main`, корень репо → Pages
3. Сайт: `https://<user>.github.io/focus-sync/`

### Cloudflare Worker
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create
2. Вставить код из `cloudflare-worker-gigachat.js`
3. Settings → Variables → Secrets → добавить `ROUTERAI_KEY` (ключ от [routerai.ru](https://routerai.ru))
4. Обновить `PROXY_URL` в `index.html` на URL воркера

## Как расширить базу праздников

База находится в `index.html` в константе `FH` (ключ `MM-DD`):

```javascript
const FH = {
  '07-14': ['🎆 День взятия Бастилии'],
  '09-13': ['🧑‍💻 День программиста'],
  // добавить сюда
};
```

Неформальные праздники — в массиве `QUIRKY` (24 строки с эмодзи).

## Как сменить AI-модель

В `index.html`:
```javascript
const MODEL = 'deepseek/deepseek-v4-flash';  // заменить на любую из routerai.ru/models
```

Модель должна быть OpenAI-совместимой и понимать русский язык. Рекомендуемые:
- `deepseek/deepseek-v4-flash` — текущая, быстрая, с reasoning
- `openai/gpt-4o-mini` — без reasoning, дешевле
- `google/gemini-2.5-flash` — быстрая, без reasoning

## Антибаги и архитектура состояния

- `S` — глобальный объект состояния (в памяти + localStorage)
- `genCount` — счётчик генераций (лимит 3/день)
- `madUsed` — использована ли «дичь» сегодня
- `unlocked` — снят ли пин-ограничение (пин 112)
- localStorage ключ: `focus-sync-YYYY-MM-DD` (автосброс на следующий день)
- Смена вкладок дат НЕ сбрасывает счётчик
- При исчерпании лимита «Ещё раз» показывает тост, PIN только через «разблокировать»
