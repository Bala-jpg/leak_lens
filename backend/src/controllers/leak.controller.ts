import { Response, NextFunction } from 'express';
import pool from '../config/db';
import { AuthenticatedRequest } from '../types/index';

export const getLeakEvents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      `SELECT le.id, le.device_id, d.name as device_name, d.location as device_location,
              le.detected_at, le.cutoff_at, le.resolved_at,
              le.inlet_flow_at_detection_lpm, le.outlet_flow_at_detection_lpm, le.avg_leak_flow_lpm,
              le.water_wasted_l, le.estimated_water_saved_l, le.status
       FROM leak_events le
       JOIN devices d ON le.device_id = d.id
       WHERE d.user_id = $1
       ORDER BY le.detected_at DESC`,
      [userId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        leakEvents: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getLeakStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const statsRes = await pool.query(
      `SELECT 
        COALESCE(SUM(le.water_wasted_l), 0) as total_water_wasted_l,
        COALESCE(SUM(le.estimated_water_saved_l), 0) as total_water_saved_l,
        COUNT(CASE WHEN le.status IN ('ACTIVE', 'CUTOFF') THEN 1 END) as active_leaks_count,
        COUNT(le.id) as total_incidents_count
       FROM leak_events le
       JOIN devices d ON le.device_id = d.id
       WHERE d.user_id = $1`,
      [userId]
    );

    const stats = statsRes.rows[0];

    return res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalWaterWastedL: Number(stats.total_water_wasted_l),
          totalWaterSavedL: Number(stats.total_water_saved_l),
          activeLeaksCount: Number(stats.active_leaks_count),
          totalIncidentsCount: Number(stats.total_incidents_count),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resolveLeakEvent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE leak_events le
       SET status = 'RESOLVED',
           resolved_at = NOW(),
           estimated_water_saved_l = GREATEST(10, le.avg_leak_flow_lpm * 60 * 2)
       FROM devices d
       WHERE le.device_id = d.id AND le.id = $1 AND d.user_id = $2
       RETURNING le.id, le.device_id, le.status, le.resolved_at, le.estimated_water_saved_l`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Leak event not found or unauthorized.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Leak incident resolved successfully.',
      data: {
        leakEvent: result.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
};
