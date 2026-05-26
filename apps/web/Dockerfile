FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace @ementas/web --include-workspace-root

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY apps/web ./apps/web
RUN npm run build --workspace @ementas/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173

COPY --from=build /app/apps/web/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json ./

EXPOSE 5173

CMD ["npm", "run", "preview"]
