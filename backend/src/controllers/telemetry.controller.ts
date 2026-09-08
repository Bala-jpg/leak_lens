import { Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { AuthenticatedRequest } from '../types/index';
import { getIO } from '../socket/index';

const ingestSchema = z.object({
  inletFlowLpm: z.number().min(0, 'Inlet flow rate must be >= 0'),
  outletFlowLpm: z.number().min(0, 'Outlet flow rate must be >= 0'),
  inletTotalVolumeL: z.number().min(0, 'Inlet total volume must be >= 0'),
  outletTotalVolumeL: z.number().min(0, 'Outlet total volume must be >= 0'),
  valveState: z.enum(['OPEN', 'CLOSED', 'UNKNOWN']).default('OPEN'),
  recordedAt: z.string().datetime().optional(),
});

export const ingestTelemetry = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const device = req.device;
    if (!device) {
      return res.status(401).json({
        status: 'error',
        message: 'Device context missing.',
      });
    }

    const {
      inletFlowLpm,
      outletFlowLpm,
      inletTotalVolumeL,
      outletTotalVolumeL,
      valveState: currentValveState,
      recordedAt,
    } = ingestSchema.parse(req.body);

    const timestamp = recordedAt ? new Date(recordedAt) : new Date();
    const flowDifferenceLpm = Math.max(0, Number((inletFlowLpm - outletFlowLpm).toFixed(2)));

    // Leak threshold criteria: inlet flow running > 0.3 LPM AND flow mismatch >= 0.5 LPM
    const leakDetected = inletFlowLpm > 0.3 && flowDifferenceLpm >= 0.5;

    // 1. Insert sensor reading record
    const readingRes = await pool.query(
      `INSERT INTO sensor_readings 
        (device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at`,
      [
        device.deviceId,
        inletFlowLpm,
        outletFlowLpm,
        flowDifferenceLpm,
        inletTotalVolumeL,
        outletTotalVolumeL,
        leakDetected,
        currentValveState,
        timestamp,
      ]
    );

    const reading = readingRes.rows[0];

    // 2. Update device online status & last seen
    await pool.query(
      `UPDATE devices SET status = 'ONLINE', last_seen = NOW() WHERE id = $1`,
      [device.deviceId]
    );

    let command = 'NONE';
    let targetValveState = currentValveState;

    // 3. Process Leak Detection & Automatic Cutoff Policy
    if (leakDetected) {
      // Check for active leak event
      const activeLeakRes = await pool.query(
        `SELECT id, status, water_wasted_l FROM leak_events 
         WHERE device_id = $1 AND status IN ('ACTIVE', 'CUTOFF')
         ORDER BY detected_at DESC LIMIT 1`,
        [device.deviceId]
      );

      let leakEventId: string;

      if (activeLeakRes.rows.length === 0) {
        // Create new active leak event
        const newLeakRes = await pool.query(
          `INSERT INTO leak_events 
            (device_id, detected_at, inlet_flow_at_detection_lpm, outlet_flow_at_detection_lpm, avg_leak_flow_lpm, inlet_volume_at_detection_l, water_wasted_l, status)
           VALUES ($1, $2, $3, $4, $5, $6, 0.5, 'ACTIVE')
           RETURNING id, status`,
          [
            device.deviceId,
            timestamp,
            inletFlowLpm,
            outletFlowLpm,
            flowDifferenceLpm,
            inletTotalVolumeL,
          ]
        );
        leakEventId = newLeakRes.rows[0].id;

        // Insert notification alert
        await pool.query(
          `INSERT INTO notifications (user_id, device_id, leak_event_id, type, message)
           VALUES ($1, $2, $3, 'LEAK_DETECTED', $4)`,
          [
            device.userId,
            device.deviceId,
            leakEventId,
            `🚨 Leak detected on ${device.name} (${device.location})! Flow loss: ${flowDifferenceLpm} LPM.`,
          ]
        );
      } else {
        leakEventId = activeLeakRes.rows[0].id;
        // Accumulate estimated wasted water
        await pool.query(
          `UPDATE leak_events 
           SET water_wasted_l = water_wasted_l + $1 
           WHERE id = $2`,
          [Number((flowDifferenceLpm * (10 / 60)).toFixed(2)), leakEventId] // estimated 10s interval
        );
      }

      // Automated Hardware Cutoff Action: Trigger valve shutdown if open
      if (currentValveState === 'OPEN') {
        command = 'CLOSE_VALVE';
        targetValveState = 'CLOSED';

        await pool.query(
          `UPDATE leak_events 
           SET status = 'CUTOFF', cutoff_at = $1, inlet_volume_at_cutoff_l = $2 
           WHERE id = $3`,
          [timestamp, inletTotalVolumeL, leakEventId]
        );

        // Add cutoff notification
        await pool.query(
          `INSERT INTO notifications (user_id, device_id, leak_event_id, type, message)
           VALUES ($1, $2, $3, 'LEAK_CUTOFF', $4)`,
          [
            device.userId,
            device.deviceId,
            leakEventId,
            `🛡️ Automated valve cutoff triggered on ${device.name} to stop water loss.`,
          ]
        );
      }
    }

    // 4. Real-time WebSocket Broadcast
    try {
      const io = getIO();
      io.emit('telemetry_update', {
        deviceId: device.deviceId,
        reading,
      });

      if (leakDetected) {
        io.emit('leak_alert', {
          deviceId: device.deviceId,
          deviceName: device.name,
          location: device.location,
          flowDifferenceLpm,
          command,
          timestamp,
        });
      }
    } catch (socketErr) {
      console.warn('Socket.IO broadcast skipped (not initialized)');
    }

    return res.status(200).json({
      status: 'ok',
      leakDetected,
      command,
      targetValveState,
      data: {
        reading,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTelemetryHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { deviceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Ensure user owns device
    const deviceRes = await pool.query('SELECT id FROM devices WHERE id = $1 AND user_id = $2', [deviceId, userId]);
    if (deviceRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or unauthorized.',
      });
    }

    const readings = await pool.query(
      `SELECT id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at
       FROM sensor_readings
       WHERE device_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [deviceId, limit]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        readings: readings.rows.reverse(), // ascending order for chart timeline
      },
    });
  } catch (error) {
    next(error);
  }
};
