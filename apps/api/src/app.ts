import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { createMenusRouter } from './modules/menus/menus.router.js';
import { MenusService } from './modules/menus/menus.service.js';

export function createApp(menusService: MenusService = new MenusService()) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
    }),
  );

  app.use(createMenusRouter(menusService));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
