import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

import { logger } from './logger.js';

function hasProxyEnv(): boolean {
  return Boolean(
    process.env.HTTP_PROXY ??
      process.env.http_proxy ??
      process.env.HTTPS_PROXY ??
      process.env.https_proxy,
  );
}

export function configureHttpProxy(): void {
  if (!hasProxyEnv()) {
    return;
  }

  setGlobalDispatcher(new EnvHttpProxyAgent());
  logger.info('Configured global HTTP proxy dispatcher from environment');
}
