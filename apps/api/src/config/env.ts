import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

const envFiles = ['.env', '../../.env'];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
    break;
  }
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  PORT: parseNumber(process.env.PORT, 3000),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  CACHE_TTL_MS: parseNumber(process.env.CACHE_TTL_MS, 10 * 60 * 1000),
  STALE_CACHE_MAX_AGE_MS: parseNumber(
    process.env.STALE_CACHE_MAX_AGE_MS,
    6 * 60 * 60 * 1000,
  ),
  CMS_UA_USERNAME: process.env.CMS_UA_USERNAME,
  CMS_UA_PASSWORD: process.env.CMS_UA_PASSWORD,
} as const;
