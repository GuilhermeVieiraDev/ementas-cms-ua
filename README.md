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
Web runs on `http://localhost:5173` and proxies `/api` to the local API.

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

`docker-compose.yml` builds and runs the web app and API together.

```bash
docker compose up --build
```

The web app is exposed on `http://localhost:5173`.
API routes are available through the same origin under `/api`.

Custom port:

```bash
WEB_PORT=3001 docker compose up --build
```

Production deploy from GitHub Container Registry should use the published API
and web images in your deployment compose file:

```yaml
services:
  api:
    image: ghcr.io/guilhermevieiradev/ementas-cms-ua-api:latest
    expose:
      - "3000"

  web:
    image: ghcr.io/guilhermevieiradev/ementas-cms-ua-web:latest
    depends_on:
      - api
    environment:
      VITE_API_PROXY_TARGET: "http://api:3000"
    ports:
      - "${WEB_PORT:-5173}:5173"
    restart: unless-stopped
```

That exposes only the web service port. A reverse proxy can point the domain to
that port and serve both `/` and `/api` from the same origin.

The compose file loads runtime variables from the root `.env` when present.
That same file can include API credentials such as `CMS_UA_USERNAME` and
`CMS_UA_PASSWORD`, plus compose values such as `WEB_PORT`.

## Docs per package

- API details, environment variables, anomaly handling: [`apps/api/README.md`](./apps/api/README.md).
- Web details and environment variables: [`apps/web/README.md`](./apps/web/README.md).
