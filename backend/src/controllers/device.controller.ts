import { Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { generateDeviceKey, hashDeviceKey } from '../utils/crypto';
import { AuthenticatedRequest } from '../types/index';

const createDeviceSchema = z.object({
  name: z.string().min(2, 'Device name must be at least 2 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters'),
});

const updateDeviceSchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
});

export const createDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { name, location } = createDeviceSchema.parse(req.body);

    const rawDeviceKey = generateDeviceKey();
    const deviceKeyHash = hashDeviceKey(rawDeviceKey);

    const result = await pool.query(
      `INSERT INTO devices (user_id, name, location, device_key_hash, status, valve_state)
       VALUES ($1, $2, $3, $4, 'OFFLINE', 'UNKNOWN')
       RETURNING id, user_id, name, location, status, valve_state, created_at`,
      [userId, name, location, deviceKeyHash]
    );

    const row = result.rows[0];
    const device = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      location: row.location,
      status: row.status,
      valveState: row.valve_state || 'OPEN',
      createdAt: row.created_at,
      user_id: row.user_id,
      valve_state: row.valve_state || 'OPEN',
      created_at: row.created_at,
    };

    return res.status(201).json({
      status: 'success',
      data: {
        device,
        deviceKey: rawDeviceKey,
        rawDeviceKey,
        notice: 'Store this deviceKey safely! It will NOT be displayed again.',
      },
      device,
      deviceKey: rawDeviceKey,
      rawDeviceKey,
      notice: 'Store this deviceKey safely! It will NOT be displayed again.',
    });
  } catch (error) {
    next(error);
  }
};

export const getDevices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      `SELECT d.id, d.user_id, d.name, d.location, d.status, d.valve_state, d.last_seen, d.last_reading_at, d.created_at,
              COALESCE(
                json_build_object(
                  'inlet_flow_lpm', sr.inlet_flow_lpm,
                  'outlet_flow_lpm', sr.outlet_flow_lpm,
                  'flow_difference_lpm', sr.flow_difference_lpm,
                  'leak_detected', sr.leak_detected,
                  'valve_state', sr.valve_state,
                  'recorded_at', sr.recorded_at
                ), NULL
              ) as latest_reading
       FROM devices d
       LEFT JOIN LATERAL (
         SELECT inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, leak_detected, valve_state, recorded_at
         FROM sensor_readings
         WHERE device_id = d.id
         ORDER BY recorded_at DESC
         LIMIT 1
       ) sr ON true
       WHERE d.user_id = $1
       ORDER BY d.created_at DESC`,
      [userId]
    );

    const devices = result.rows.map((d) => ({
      id: d.id,
      userId: d.user_id,
      name: d.name,
      location: d.location,
      status: (d.last_reading_at || d.last_seen) && Date.now()-new Date(d.last_reading_at || d.last_seen).getTime()<35000 ? 'ONLINE' : 'OFFLINE',
      valveState: d.valve_state || d.latest_reading?.valve_state || 'OPEN',
      lastSeen: d.last_reading_at || d.last_seen,
      createdAt: d.created_at,
      latestReading: d.latest_reading,
      user_id: d.user_id,
      valve_state: d.valve_state || d.latest_reading?.valve_state || 'OPEN',
      last_seen: d.last_seen,
      created_at: d.created_at,
      latest_reading: d.latest_reading,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        devices,
      },
      devices,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeviceById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.id, d.user_id, d.name, d.location, d.status, d.valve_state, d.last_seen, d.last_reading_at, d.created_at
       FROM devices d
       WHERE d.id = $1 AND d.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found.',
      });
    }

    const latestReadings = await pool.query(
      `SELECT inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at
       FROM sensor_readings
       WHERE device_id = $1
       ORDER BY recorded_at DESC
       LIMIT 10`,
      [id]
    );

    const activeLeaks = await pool.query(
      `SELECT id, status, detected_at, avg_leak_flow_lpm, water_wasted_l
       FROM leak_events
       WHERE device_id = $1 AND status IN ('ACTIVE', 'CUTOFF')`,
      [id]
    );

    const d = result.rows[0];
    const device = {
      id: d.id,
      userId: d.user_id,
      name: d.name,
      location: d.location,
      status: (d.last_reading_at || d.last_seen) && Date.now()-new Date(d.last_reading_at || d.last_seen).getTime()<35000 ? 'ONLINE' : 'OFFLINE',
      valveState: d.valve_state || 'OPEN',
      lastSeen: d.last_reading_at || d.last_seen,
      createdAt: d.created_at,
      user_id: d.user_id,
      valve_state: d.valve_state || 'OPEN',
      last_seen: d.last_seen,
      created_at: d.created_at,
    };

    return res.status(200).json({
      status: 'success',
      data: {
        device,
        latestReadings: latestReadings.rows,
        activeLeaks: activeLeaks.rows,
      },
      device,
      latestReadings: latestReadings.rows,
      activeLeaks: activeLeaks.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, location } = updateDeviceSchema.parse(req.body);

    const result = await pool.query(
      `UPDATE devices
       SET name = COALESCE($1, name),
           location = COALESCE($2, location)
       WHERE id = $3 AND user_id = $4
       RETURNING id, name, location, status, valve_state, last_seen, last_reading_at`,
      [name, location, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or unauthorized.',
      });
    }

    const d = result.rows[0];
    const device = {
      id: d.id,
      name: d.name,
      location: d.location,
      status: (d.last_reading_at || d.last_seen) && Date.now()-new Date(d.last_reading_at || d.last_seen).getTime()<35000 ? 'ONLINE' : 'OFFLINE',
      valveState: d.valve_state || 'OPEN',
      lastSeen: d.last_reading_at || d.last_seen,
      valve_state: d.valve_state || 'OPEN',
      last_seen: d.last_seen,
    };

    return res.status(200).json({
      status: 'success',
      data: {
        device,
      },
      device,
    });
  } catch (error) {
    next(error);
  }
};

export const toggleValve = async (_req:AuthenticatedRequest,res:Response) => {
  return res.status(409).json({status:'error',message:'Valve control is local to the hardware. Inspect and rearm at the device.'});
};

export const deleteDevice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM devices WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or unauthorized.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Device deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
