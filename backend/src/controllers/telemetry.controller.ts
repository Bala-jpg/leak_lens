import { createHash } from 'node:crypto';
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { AuthenticatedRequest } from '../types/index';
import { broadcastTelemetry, broadcastLeakAlert, broadcastNotification } from '../socket/index';

const identifier = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);
const flow = z.number().finite().min(0).max(100000);
const volume = z.number().finite().min(0).max(9999999999.99);
const uptime = z.number().int().min(0).max(315576000000);
export const ingestSchema = z.object({
  bootId: identifier.max(64).optional(), sampledUptimeMs: uptime.optional(),
  inletFlowLpm: flow, outletFlowLpm: flow,
  inletTotalVolumeL: volume, outletTotalVolumeL: volume,
  valveState: z.enum(['OPEN','CLOSED','UNKNOWN']), leakDetected: z.boolean(),
  sampleId: identifier.optional(), ageMs: uptime.max(604800000).default(0),
  recordedAt: z.string().datetime().optional(),
  event: z.object({
    id: identifier, inletFlowLpm: flow, outletFlowLpm: flow, lossL: volume,
    cutoffDelayMs: uptime.max(604800000),
    originBootId: identifier.max(64).optional(),
    detectedUptimeMs: uptime.optional(), cutoffUptimeMs: uptime.optional(),
  }).optional(),
}).superRefine((d, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: 'custom', message });
  if ((d.bootId === undefined) !== (d.sampledUptimeMs === undefined)) invalid('bootId and sampledUptimeMs must be supplied together.');
  if (d.bootId && !d.sampleId) invalid('Session reports require sampleId.');
  if (d.event && !d.leakDetected) invalid('An event requires leakDetected=true.');
  const e = d.event;
  if (!e) return;
  const timed = [e.originBootId, e.detectedUptimeMs, e.cutoffUptimeMs];
  if (timed.some(v => v !== undefined)) {
    if (timed.some(v => v === undefined) || !d.bootId) return invalid('Event timing requires all timing fields and a sample session.');
    if (e.cutoffUptimeMs! < e.detectedUptimeMs! || e.cutoffUptimeMs! - e.detectedUptimeMs! !== e.cutoffDelayMs) invalid('Inconsistent event timing.');
    if (e.originBootId === d.bootId && e.cutoffUptimeMs! > d.sampledUptimeMs!) invalid('Event is later than its sample.');
    if (d.valveState !== 'CLOSED') invalid('A timed cutoff event requires CLOSED output.');
  }
});

export const ingestTelemetry = async (req:AuthenticatedRequest,res:Response,next:NextFunction) => {
  let client;
  try {
    const device=req.device;
    if (!device) return res.status(401).json({message:'Device context missing.'});
    const d=ingestSchema.parse(req.body);
    const receivedAt = new Date();
    const timestamp=d.recordedAt ? new Date(d.recordedAt) : new Date(receivedAt.getTime()-d.ageMs);
    // ageMs changes on retries; all measurement/event fields are immutable per sample.
    const { ageMs: _age, ...identity } = d;
    const requestHash = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
    const acknowledge = (duplicate: boolean) => {
      if (d.sampleId) res.setHeader('X-Accepted-Sample', d.sampleId);
      if (d.event) res.setHeader('X-Accepted-Event', d.event.id);
      return {status:'ok', command:'NONE', duplicate, sampleId:d.sampleId ?? null, acceptedEventId:d.event?.id ?? null};
    };
    if (timestamp.getTime()>Date.now()+5000) return res.status(400).json({message:'Reading timestamp is in the future.'});
    client=await pool.connect();
    await client.query('BEGIN');
    // Serialize per device, including concurrent requests and retries.
    const locked = await client.query('SELECT id FROM devices WHERE id=$1 FOR UPDATE',[device.deviceId]);
    if (!locked.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({message:'Device no longer exists.'}); }
    if (d.sampleId) {
      const prior = await client.query('SELECT request_hash FROM sensor_readings WHERE device_id=$1 AND sample_id=$2',[device.deviceId,d.sampleId]);
      if (prior.rowCount) {
        await client.query('ROLLBACK');
        if (prior.rows[0].request_hash !== requestHash) return res.status(409).json({message:'Sample ID already exists with different or unverifiable content.'});
        return res.json(acknowledge(true));
      }
    }
    const inserted=await client.query(`INSERT INTO sensor_readings
      (device_id,inlet_flow_lpm,outlet_flow_lpm,flow_difference_lpm,inlet_total_volume_l,outlet_total_volume_l,leak_detected,valve_state,recorded_at,sample_id,boot_id,sampled_uptime_ms,received_at,measurement_time_basis,request_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(device_id,sample_id) DO NOTHING RETURNING *`,
      [device.deviceId,d.inletFlowLpm,d.outletFlowLpm,d.inletFlowLpm-d.outletFlowLpm,d.inletTotalVolumeL,d.outletTotalVolumeL,d.leakDetected,d.valveState,timestamp,d.sampleId??null,d.bootId??null,d.sampledUptimeMs??null,receivedAt,d.recordedAt?'DEVICE_REPORTED':'AGE_ESTIMATE',requestHash]);
    if (!inserted.rowCount) throw new Error('Unexpected sample conflict.');
    const current=await client.query(`UPDATE devices SET status='ONLINE',last_seen=NOW(),valve_state=$2,last_reading_at=$3
      WHERE id=$1 AND (last_reading_at IS NULL OR last_reading_at <= $3) RETURNING id`,[device.deviceId,d.valveState,timestamp]);
    const notices:string[]=[];
    if(d.leakDetected) {
      const prior=d.event
        ? await client.query('SELECT * FROM leak_events WHERE device_id=$1 AND hardware_event_id=$2',[device.deviceId,d.event.id])
        : await client.query("SELECT * FROM leak_events WHERE device_id=$1 AND status IN ('ACTIVE','CUTOFF') ORDER BY detected_at DESC LIMIT 1",[device.deviceId]);
      let event=prior.rows[0];
      if(!event) {
        const inlet=d.event?.inletFlowLpm??d.inletFlowLpm,outlet=d.event?.outletFlowLpm??d.outletFlowLpm;
        const created=await client.query(`INSERT INTO leak_events
          (device_id,detected_at,inlet_flow_at_detection_lpm,outlet_flow_at_detection_lpm,avg_leak_flow_lpm,inlet_volume_at_detection_l,outlet_volume_at_detection_l,hardware_event_id,water_wasted_l,status,origin_boot_id,detected_uptime_ms,cutoff_uptime_ms,detection_occurred_at,cutoff_occurred_at,event_time_basis)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',$10,$11,$12,$13,$14,$15) RETURNING *`,
          [device.deviceId,receivedAt,inlet,outlet,Math.max(0,inlet-outlet),d.inletTotalVolumeL,d.outletTotalVolumeL,d.event?.id??null,d.event?.lossL??0,d.event?.originBootId??d.bootId??null,
           d.event?.detectedUptimeMs??null,d.event?.cutoffUptimeMs??null,
           d.event?.originBootId && d.event.originBootId===d.bootId ? new Date(timestamp.getTime()-(d.sampledUptimeMs!-d.event.detectedUptimeMs!)) : null,
           d.event?.originBootId && d.event.originBootId===d.bootId ? new Date(timestamp.getTime()-(d.sampledUptimeMs!-d.event.cutoffUptimeMs!)) : null,
           d.event?.originBootId && d.event.originBootId===d.bootId ? 'UPTIME_ESTIMATE' : 'UNKNOWN']);
        event=created.rows[0];notices.push('LEAK_DETECTED');
      }
      if(event.status!=='RESOLVED') {
        const sameSession = !!d.bootId && event.origin_boot_id === d.bootId;
        const loss=d.event?.lossL??(sameSession ? Math.max(0,(d.inletTotalVolumeL-Number(event.inlet_volume_at_detection_l))-(d.outletTotalVolumeL-Number(event.outlet_volume_at_detection_l))) : Number(event.water_wasted_l));
        await client.query('UPDATE leak_events SET water_wasted_l=GREATEST(water_wasted_l,$2) WHERE id=$1',[event.id,loss]);
        if(d.valveState==='CLOSED' && event.status==='ACTIVE') {
          await client.query("UPDATE leak_events SET status='CUTOFF',cutoff_at=$2,inlet_volume_at_cutoff_l=$3,cutoff_latency_ms=$4 WHERE id=$1",[event.id,receivedAt,d.inletTotalVolumeL,d.event?.cutoffDelayMs??null]);
          notices.push('LEAK_CUTOFF');
        }
        for(const type of notices) await client.query('INSERT INTO notifications(user_id,device_id,leak_event_id,type,message) VALUES($1,$2,$3,$4,$5)',
          [device.userId,device.deviceId,event.id,type,type==='LEAK_DETECTED'?`Hardware reported a leak on ${device.name}.`:`Hardware reported the valve output closed on ${device.name}.`]);
      }
    }
    await client.query('COMMIT');
    const r=inserted.rows[0];
    const reading={bootId:r.boot_id,sampledUptimeMs:r.sampled_uptime_ms == null ? null : Number(r.sampled_uptime_ms),receivedAt:r.received_at,measurementTimeBasis:r.measurement_time_basis,id:r.id,deviceId:device.deviceId,inletFlowLpm:Number(r.inlet_flow_lpm),outletFlowLpm:Number(r.outlet_flow_lpm),flowDifferenceLpm:Number(r.flow_difference_lpm),inletTotalVolumeL:Number(r.inlet_total_volume_l),outletTotalVolumeL:Number(r.outlet_total_volume_l),leakDetected:r.leak_detected,valveState:r.valve_state,recordedAt:r.recorded_at};
    if(current.rowCount) broadcastTelemetry(device.deviceId,{deviceId:device.deviceId,reading});
    if(notices.length) { broadcastLeakAlert(device.deviceId,{deviceId:device.deviceId});broadcastNotification(device.userId,{deviceId:device.deviceId}); }
    return res.json({...acknowledge(false),data:{reading},reading});
  } catch(error) { if(client) await client.query('ROLLBACK');next(error); }
  finally {client?.release();}
};

export const getTelemetryHistory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const deviceId = z.uuid().parse(req.params.deviceId);
    const { limit, range } = z.object({
      limit: z.coerce.number().int().min(1).max(1000).default(50),
      range: z.enum(['5m', '1h', '24h']).optional(),
    }).parse(req.query);

    // Ensure user owns device
    const deviceRes = await pool.query('SELECT id FROM devices WHERE id = $1 AND user_id = $2', [deviceId, userId]);
    if (deviceRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or unauthorized.',
      });
    }

    if (range) {
      const windows = { '5m': [300, 1], '1h': [3600, 10], '24h': [86400, 300] } as const;
      const [durationSeconds, bucketSeconds] = windows[range];
      const to = new Date();
      const from = new Date(to.getTime() - durationSeconds * 1000);
      const result = await pool.query(
        `SELECT MIN(recorded_at) AS recorded_at,
                AVG(inlet_flow_lpm) AS inlet_flow_lpm,
                AVG(outlet_flow_lpm) AS outlet_flow_lpm,
                AVG(flow_difference_lpm) AS flow_difference_lpm
         FROM sensor_readings
         WHERE device_id = $1 AND recorded_at >= $2 AND recorded_at <= $3
         GROUP BY FLOOR(EXTRACT(EPOCH FROM recorded_at) / $4)
         ORDER BY recorded_at ASC`,
        [deviceId, from, to, bucketSeconds]
      );
      return res.json({ status: 'success', data: {
        from: from.toISOString(), to: to.toISOString(), bucketSeconds,
        points: result.rows.map((r) => ({
          timestamp: new Date(r.recorded_at).getTime(),
          inletFlow: Number(r.inlet_flow_lpm), outletFlow: Number(r.outlet_flow_lpm),
          difference: Number(r.flow_difference_lpm),
        })),
      } });
    }

    const readings = await pool.query(
      `SELECT id, device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at, boot_id, sampled_uptime_ms, received_at, measurement_time_basis
       FROM sensor_readings
       WHERE device_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [deviceId, limit]
    );

    const formattedReadings = readings.rows.map((r) => ({
      bootId: r.boot_id,
      sampledUptimeMs: r.sampled_uptime_ms == null ? null : Number(r.sampled_uptime_ms),
      receivedAt: r.received_at,
      measurementTimeBasis: r.measurement_time_basis,
      id: r.id,
      deviceId: r.device_id || deviceId,
      inletFlowLpm: Number(r.inlet_flow_lpm),
      outletFlowLpm: Number(r.outlet_flow_lpm),
      flowDifferenceLpm: Number(r.flow_difference_lpm),
      inletTotalVolumeL: Number(r.inlet_total_volume_l),
      outletTotalVolumeL: Number(r.outlet_total_volume_l),
      leakDetected: r.leak_detected,
      valveState: r.valve_state,
      recordedAt: r.recorded_at,
      device_id: r.device_id || deviceId,
      inlet_flow_lpm: Number(r.inlet_flow_lpm),
      outlet_flow_lpm: Number(r.outlet_flow_lpm),
      flow_difference_lpm: Number(r.flow_difference_lpm),
      inlet_total_volume_l: Number(r.inlet_total_volume_l),
      outlet_total_volume_l: Number(r.outlet_total_volume_l),
      leak_detected: r.leak_detected,
      valve_state: r.valve_state,
      recorded_at: r.recorded_at,
    }));

    const reversed = formattedReadings.reverse();

    return res.status(200).json({
      status: 'success',
      data: {
        readings: reversed,
      },
      readings: reversed,
    });
  } catch (error) {
    next(error);
  }
};
