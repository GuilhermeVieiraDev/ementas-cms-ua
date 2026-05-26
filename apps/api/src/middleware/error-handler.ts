import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  void next;

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  logger.error({ err: error }, 'Unhandled request error');
  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Unexpected internal error',
    },
  });
}
