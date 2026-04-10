import { Router } from 'express';

import { MenusController } from './menus.controller.js';
import type { MenusService } from './menus.service.js';

export function createMenusRouter(menusService: MenusService): Router {
  const controller = new MenusController(menusService);
  const router = Router();

  router.get('/health', controller.health);
  router.get('/api/v1/canteens', controller.canteens);
  router.get('/api/v1/menus', controller.menus);

  return router;
}
