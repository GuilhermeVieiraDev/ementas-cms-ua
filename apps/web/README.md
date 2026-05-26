# @ementas/web

Minimal Vite + React frontend for browsing UA canteen menus served by `@ementas/api`.

## Run from the monorepo root

```bash
npm install
npm run dev:api
npm run dev:web
```

The web app runs on `http://localhost:5173` and requests the API through
same-origin `/api` paths. Vite proxies those requests to the API during dev.

To point it somewhere else:

```env
VITE_API_BASE_URL=https://api.example.com
```

## Docker

```bash
docker compose up --build
```

Compose exposes the web app and keeps the API internal. API routes are available
from the same public origin under `/api`.
