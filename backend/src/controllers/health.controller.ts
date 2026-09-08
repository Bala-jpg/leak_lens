import { Request, Response, NextFunction } from 'express';
import { checkDatabaseHealth } from '../config/db';

export const getHealth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isDbConnected = await checkDatabaseHealth();

    if (!isDbConnected) {
      return res.status(503).json({
        status: 'error',
        database: 'disconnected',
      });
    }

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    next(error);
  }
};
