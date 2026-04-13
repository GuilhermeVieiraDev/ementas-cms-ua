# ementas-cms

Small Express.js API in TypeScript that scrapes the public UA canteen CMS and exposes normalized menu data.

## What It Does

- Fetches `https://cms.ua.pt/ementas/ementas`
- Parses canteen tables into a typed API
- Normalizes lunch/dinner rows, weekend split rows, empty rows, and `Encerrado` entries
- Repairs some malformed CMS headers, including broken years when they can be inferred
- Caches the full scrape in memory for 10 minutes by default

## Requirements

- Node.js `>= 22`
- npm

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:3000` by default.

## Docker

Build the image:

```bash
docker build -t ementas-cms .
```

Run the container:

```bash
docker run --rm -p 3000:3000 ementas-cms
```

With custom env values:

```bash
docker run --rm -p 3000:3000 \
  -e LOG_LEVEL=debug \
  -e CACHE_TTL_MS=300000 \
  -e STALE_CACHE_MAX_AGE_MS=21600000 \
  ementas-cms
```

Use Docker Compose with a local build:

```bash
docker-compose up --build
```

Run it in the background:

```bash
docker-compose up --build -d
```

Stop it:

```bash
docker-compose down
```

## Environment Variables

```env
PORT=3000
LOG_LEVEL=info
CACHE_TTL_MS=600000
STALE_CACHE_MAX_AGE_MS=21600000
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
```

## Routes

### `GET /health`

Returns server health plus current cache state.

### `GET /api/v1/canteens`

Returns stable canteen identifiers:

```json
{
  "canteens": [
    { "id": "crasto", "name": "Crasto" },
    { "id": "grelhados", "name": "Grelhados" },
    { "id": "estga", "name": "ESTGA" },
    { "id": "restaurante-vegetariano", "name": "Restaurante Vegetariano" },
    { "id": "tresde", "name": "TrêsDê" }
  ]
}
```

### `GET /api/v1/menus`

Query params:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `canteens=crasto,estga`
- `includeAnomalies=true`

If no dates are sent, the API defaults to today in `Europe/Lisbon`.

Example:

```bash
curl "http://localhost:3000/api/v1/menus?from=2026-04-07&to=2026-04-10&canteens=crasto,estga"
```

Example response shape:

```json
{
  "meta": {
    "sourceUrl": "https://cms.ua.pt/ementas/ementas",
    "fetchedAt": "2026-04-07T12:00:00.000Z",
    "requestedRange": {
      "from": "2026-04-07",
      "to": "2026-04-10"
    },
    "availableRange": {
      "from": "2026-04-07",
      "to": "2026-05-11"
    },
    "timezone": "Europe/Lisbon",
    "cached": true,
    "stale": false,
    "anomalyCount": 3
  },
  "canteens": [],
  "anomalies": []
}
```

## Data Model

Key normalized enums:

- `MealService`: `lunch | dinner | unknown`
- `MealStatus`: `available | closed | empty`
- `MenuItemCategory`: `soup | meat | fish | diet | vegetarian | other`

Each menu item keeps:

- `category`
- `sourceLabel`
- `text`

The API intentionally does not split items into a `name` and `description` because the CMS content is inconsistent.

## Parser Notes

The current scraper relies on:

- `div.view-content table.tabelahead.views-table`
- `caption`
- `td.views-field-title`
- `td.views-field-body`

Known CMS issues handled by the parser:

- incorrect weekday labels
- malformed years such as `08/04/206`
- double slashes such as `05/05//2026`
- weekend rows with both lunch and dinner in one body
- empty body rows
- `Encerrado` rows
- logical line breaks encoded with `<br>` inside a paragraph
