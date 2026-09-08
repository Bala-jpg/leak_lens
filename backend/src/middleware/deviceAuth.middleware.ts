import { Response, NextFunction } from 'express';
import { hashDeviceKey } from '../utils/crypto';
import pool from '../config/db';
import { AuthenticatedRequest } from '../types/index';

export const authenticateDevice = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let rawKey = req.headers['x-device-key'] as string;

    if (!rawKey && req.headers.authorization?.startsWith('Bearer ')) {
      rawKey = req.headers.authorization.split(' ')[1];
    }

    if (!rawKey) {
      return res.status(401).json({
        status: 'error',
        message: 'Device API key required in x-device-key header or Bearer authorization.',
      });
    }

    const deviceKeyHash = hashDeviceKey(rawKey);

    const result = await pool.query(
      `SELECT id, user_id, name, location, status FROM devices WHERE device_key_hash = $1`,
      [deviceKeyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or unregistered device key.',
      });
    }

    const device = result.rows[0];
    req.device = {
      deviceId: device.id,
      userId: device.user_id,
      name: device.name,
      location: device.location,
      status: device.status,
    };

    next();
  } catch (error) {
    next(error);
  }
};
