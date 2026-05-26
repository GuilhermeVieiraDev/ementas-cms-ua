import type { Request, Response } from 'express';

import type { MenusService } from './menus.service.js';

export class MenusController {
  public constructor(private readonly menusService: MenusService) {}

  public health = (_request: Request, response: Response): void => {
    response.json(this.menusService.getHealth());
  };

  public canteens = async (_request: Request, response: Response): Promise<void> => {
    const payload = await this.menusService.getCanteens();
    response.json(payload);
  };

  public menus = async (request: Request, response: Response): Promise<void> => {
    const query = this.menusService.normalizeQuery(request.query);
    const payload = await this.menusService.getMenus(query);
    response.json(payload);
  };
}
