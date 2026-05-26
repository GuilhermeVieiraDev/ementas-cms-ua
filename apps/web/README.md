# @ementas/web

Minimal Vite + React frontend for browsing UA canteen menus served by `@ementas/api`.

## Run from the monorepo root

```bash
npm install
npm run dev:api
npm run dev:web
```

The web app runs on `http://localhost:5173` and expects the API at
`http://localhost:3000` by default.

To point it somewhere else:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Docker

```bash
VITE_API_BASE_URL=https://your-api.example.com docker compose up --build
```
