import { z } from 'zod';
import { Response, NextFunction } from 'express';
import pool from '../config/db';
import { AuthenticatedRequest } from '../types/index';

export const getLeakEvents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { deviceId, status } = z.object({deviceId:z.uuid().optional(),status:z.enum(['ACTIVE','CUTOFF','RESOLVED']).optional()}).parse(req.query);

    let query = `
      SELECT le.id, le.device_id, d.name as device_name, d.location as device_location,
              le.detected_at, le.cutoff_at, le.resolved_at, le.origin_boot_id, le.detection_occurred_at, le.cutoff_occurred_at, le.event_time_basis,
              le.inlet_flow_at_detection_lpm, le.outlet_flow_at_detection_lpm, le.avg_leak_flow_lpm,
              le.water_wasted_l, le.estimated_water_saved_l, le.cutoff_latency_ms, le.status
       FROM leak_events le
       JOIN devices d ON le.device_id = d.id
       WHERE d.user_id = $1
    `;
    const params: any[] = [userId];

    if (deviceId) {
      params.push(deviceId);
      query += ` AND le.device_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND le.status = $${params.length}`;
    }

    query += ` ORDER BY le.detected_at DESC`;

    const result = await pool.query(query, params);

    const formattedEvents = result.rows.map((row) => ({
      id: row.id,
      firstObservedAt: row.detected_at,
      originBootId: row.origin_boot_id,
      detectionOccurredAt: row.detection_occurred_at,
      cutoffOccurredAt: row.cutoff_occurred_at,
      eventTimeBasis: row.event_time_basis,
      deviceId: row.device_id,
      deviceName: row.device_name,
      location: row.device_location,
      detectedAt: row.detected_at,
      cutoffAt: row.cutoff_at,
      resolvedAt: row.resolved_at,
      inletFlowAtDetectionLpm: Number(row.inlet_flow_at_detection_lpm),
      outletFlowAtDetectionLpm: Number(row.outlet_flow_at_detection_lpm),
      avgLeakFlowLpm: Number(row.avg_leak_flow_lpm),
      cutoffLatencySec: row.cutoff_latency_ms == null ? null : Number(row.cutoff_latency_ms) / 1000,
      waterWastedL: Number(row.water_wasted_l),
      estimatedWaterSavedL: Number(row.estimated_water_saved_l),
      status: row.status,
      device_id: row.device_id,
      device_name: row.device_name,
      device_location: row.device_location,
      detected_at: row.detected_at,
      cutoff_at: row.cutoff_at,
      resolved_at: row.resolved_at,
      inlet_flow_at_detection_lpm: Number(row.inlet_flow_at_detection_lpm),
      outlet_flow_at_detection_lpm: Number(row.outlet_flow_at_detection_lpm),
      avg_leak_flow_lpm: Number(row.avg_leak_flow_lpm),
      water_wasted_l: Number(row.water_wasted_l),
      estimated_water_saved_l: Number(row.estimated_water_saved_l),
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        leakEvents: formattedEvents,
      },
      leakEvents: formattedEvents,
    });
  } catch (error) {
    next(error);
  }
};

export const getLeakStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { deviceId } = z.object({deviceId:z.uuid().optional()}).parse(req.query);

    let query = `
      SELECT
        COALESCE(SUM(le.water_wasted_l), 0) as total_water_wasted_l,
        COALESCE(SUM(le.estimated_water_saved_l), 0) as total_water_saved_l,
        COUNT(CASE WHEN le.status IN ('ACTIVE', 'CUTOFF') THEN 1 END) as active_leaks_count,
        COUNT(le.id) as total_incidents_count
       FROM leak_events le
       JOIN devices d ON le.device_id = d.id
       WHERE d.user_id = $1
    `;
    const params: any[] = [userId];

    if (deviceId) {
      params.push(deviceId);
      query += ` AND le.device_id = $${params.length}`;
    }

    const statsRes = await pool.query(query, params);
    const stats = statsRes.rows[0];

    const statsData = {
      totalLeaks: Number(stats.total_incidents_count),
      activeLeaks: Number(stats.active_leaks_count),
      totalIncidentsCount: Number(stats.total_incidents_count),
      activeLeaksCount: Number(stats.active_leaks_count),
      totalWaterWastedL: Number(stats.total_water_wasted_l),
      totalWaterSavedL: Number(stats.total_water_saved_l),
      avgCutoffLatencySec: null,
      cutoffEfficiencyPercent: null,
    };

    return res.status(200).json({
      status: 'success',
      data: {
        stats: statsData,
      },
      stats: statsData,
    });
  } catch (error) {
    next(error);
  }
};

export const resolveLeakEvent = async (req:AuthenticatedRequest,res:Response,next:NextFunction) => {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const owned=await client.query(`SELECT d.id FROM devices d JOIN leak_events le ON le.device_id=d.id WHERE le.id=$1 AND d.user_id=$2 FOR UPDATE OF d`,[req.params.id,req.user?.userId]);
    if(!owned.rowCount) {await client.query('ROLLBACK');return res.status(404).json({message:'Leak event not found.'});}
    const latest=await client.query('SELECT leak_detected,valve_state,recorded_at FROM sensor_readings WHERE device_id=$1 ORDER BY recorded_at DESC LIMIT 1',[owned.rows[0].id]);
    const reading=latest.rows[0];
    if(!reading || reading.leak_detected !== false || reading.valve_state!=='OPEN' || Date.now()-new Date(reading.recorded_at).getTime()>35000) {
      await client.query('ROLLBACK');return res.status(409).json({message:'Inspect and rearm the hardware first, then wait for a fresh normal reading before resolving.'});
    }
    const result=await client.query(`UPDATE leak_events SET status='RESOLVED',resolved_at=COALESCE(resolved_at,NOW()),estimated_water_saved_l=avg_leak_flow_lpm*120 WHERE id=$1 RETURNING *`,[req.params.id]);
    await client.query('COMMIT');
    return res.json({status:'success',data:{leakEvent:result.rows[0]}});
  } catch(error) {await client.query('ROLLBACK');next(error);}
  finally {client.release();}
};
