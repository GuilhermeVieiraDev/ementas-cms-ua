# ementas-cms-ua

Monorepo for the UA canteen menu project.

- **`apps/api`** — TypeScript Express API that scrapes [cms.ua.pt/ementas](https://cms.ua.pt/ementas/ementas) and serves a normalized menu feed.
- **`apps/web`** — Vite + React frontend for browsing menus across multiple days.

## Requirements

- Node.js `>= 22`
- npm `>= 9`

## Install

```bash
npm install
```

This installs every workspace through npm workspaces.

## Develop

```bash
npm run dev:api
npm run dev:web
```

API runs on `http://localhost:3000`.
Web runs on `http://localhost:5173` and reads `VITE_API_BASE_URL` when set.

## Build

```bash
npm run build:api
npm run build:web
```

Per-workspace lint / typecheck:

```bash
npm run lint
npm run typecheck
```

## Docker

`docker-compose.yml` builds and runs the API as a standalone image.

```bash
docker compose up --build
```

The API is exposed on `http://localhost:3000`.
The web app is exposed on `http://localhost:5173`.

Build the frontend against a deployed API:

```bash
VITE_API_BASE_URL=https://your-api.example.com docker compose up --build
```

Custom port:

```bash
API_PORT=3001 docker compose up --build
```

The compose file loads runtime variables from the root `.env` when present.
That same file can include API credentials such as `CMS_UA_USERNAME` and
`CMS_UA_PASSWORD`, plus compose values such as `API_PORT`, `WEB_PORT`, and
`VITE_API_BASE_URL`.

## Docs per package

- API details, environment variables, anomaly handling: [`apps/api/README.md`](./apps/api/README.md).
- Web details and environment variables: [`apps/web/README.md`](./apps/web/README.md).
