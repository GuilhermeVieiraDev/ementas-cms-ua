# ementas-cms-ua

Monorepo for the UA canteen menu project.

- **`apps/api`** — TypeScript Express API that scrapes [cms.ua.pt/ementas](https://cms.ua.pt/ementas/ementas) and serves a normalized menu feed.

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
```

API runs on `http://localhost:3000`.

## Build

```bash
npm run build:api
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

Custom port:

```bash
API_PORT=3001 docker compose up --build
```

The compose file forwards `CMS_UA_USERNAME`, `CMS_UA_PASSWORD`, `LOG_LEVEL`, the cache settings, and the outbound proxy variables when present in your shell or in a root `.env`.

## Docs per package

- API details, environment variables, anomaly handling: [`apps/api/README.md`](./apps/api/README.md).
