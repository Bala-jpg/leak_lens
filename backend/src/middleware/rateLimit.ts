import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index';

const counters = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60000;

const limit = (max: number, identity: (req: Request) => string) => (req: Request, res: Response, next: NextFunction) => {
  const now = Date.now();
  const key = identity(req);
  const previous = counters.get(key);
  const entry = previous && previous.reset > now ? previous : { count: 0, reset: now + WINDOW_MS };
  entry.count++;
  counters.set(key, entry);
  if (entry.count > max) return res.status(429).json({ status: 'error', message: 'Too many requests. Try again shortly.' });
  if (counters.size > 10000) for (const [id, value] of counters) if (value.reset <= now) counters.delete(id);
  next();
};

export const authRateLimit = limit(30, (req) => `auth:${req.ip}`);
export const telemetryRateLimit = limit(120, (req) => `telemetry:${(req as AuthenticatedRequest).device?.deviceId || req.ip}`);
