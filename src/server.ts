import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { MenusService } from './modules/menus/menus.service.js';

const menusService = new MenusService();
const app = createApp(menusService);

menusService.warmCache();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'HTTP server listening');
});
