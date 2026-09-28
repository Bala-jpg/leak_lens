import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateId(_req: Request, res: Response, next: NextFunction, id: string) {
  if (!z.uuid().safeParse(id).success) return res.status(400).json({status:'error',message:'Invalid UUID.'});
  next();
}
