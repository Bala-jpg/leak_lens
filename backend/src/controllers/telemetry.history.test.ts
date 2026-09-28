import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pool from '../config/db';
import { getTelemetryHistory } from './telemetry.controller';
import type { AuthenticatedRequest } from '../types';
import type { Response } from 'express';

// Opt in with DATABASE_TESTS=1 and a migrated DATABASE_URL. All fixtures roll back.
test('flow windows filter time, aggregate full history, and enforce ownership',
  { skip: process.env.DATABASE_TESTS !== '1' }, async () => {
    const client = await pool.connect();
    const originalQuery = pool.query;
    try {
      await client.query('BEGIN');
      pool.query = client.query.bind(client) as typeof pool.query;
      const userId = randomUUID();
      const deviceId = randomUUID();
      await client.query(`INSERT INTO users (id, name, email, password_hash) VALUES ($1, 'History test', $2, 'unused')`,
        [userId, `${userId}@example.invalid`]);
      await client.query(`INSERT INTO devices (id, user_id, name, location, device_key_hash) VALUES ($1, $2, 'History test', 'Test', 'unused')`,
        [deviceId, userId]);
      const insert = async (timestamp: Date, inlet: number) => client.query(
        `INSERT INTO sensor_readings (device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm,
          inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at)
         VALUES ($1, $2::numeric, 1, $2::numeric - 1, 0, 0, false, 'OPEN', $3)`, [deviceId, inlet, timestamp]);
      const now = Date.now();
      for (const minutes of [1, 30, 720, 1560, -60]) {
        await insert(new Date(now - minutes * 60000), 3);
      }
      // More than the former 200-reading cap, all in one bucket; none may be discarded.
      const batchTime = new Date(Math.floor((now - 120000) / 1000) * 1000);
      for (let i = 0; i < 201; i++) await insert(batchTime, i === 200 ? 5 : 2);
      const request = async (query: Record<string, string>, owner = userId) => {
        let status = 200;
        let body: any;
        let error: unknown;
        const res = {
          status(code: number) { status = code; return this; },
          json(data: unknown) { body = data; return this; },
        } as Response;
        await getTelemetryHistory({ params: { deviceId }, query, user: { userId: owner } } as unknown as AuthenticatedRequest,
          res, (err) => { error = err; });
        return { status, body, error };
      };
      for (const [range, count] of [['5m', 2], ['1h', 3], ['24h', 4]] as const) {
        const result = await request({ range });
        assert.ifError(result.error);
        assert.equal(result.status, 200);
        const { points, from, to } = result.body.data;
        if (range === '24h') assert.ok(points.length === 3 || points.length === 4);
        else assert.equal(points.length, count);
        assert.ok(points.every((p: { timestamp: number }) => p.timestamp >= Date.parse(from) && p.timestamp <= Date.parse(to)));
        if (range !== '24h') assert.ok(points.some((p: { inletFlow: number }) => Math.abs(p.inletFlow - 405 / 201) < 0.00001));
        assert.deepEqual(points.map((p: { timestamp: number }) => p.timestamp),
          points.map((p: { timestamp: number }) => p.timestamp).sort((a: number, b: number) => a - b));
      }
      assert.equal((await request({ range: '5m' }, randomUUID())).status, 404);
      assert.ok((await request({ range: 'invalid' })).error);
      assert.ok((await request({ limit: '-1' })).error);
      assert.equal((await request({ limit: '50' })).body.data.readings.length, 50);
      await client.query('DELETE FROM sensor_readings WHERE device_id = $1', [deviceId]);
      assert.deepEqual((await request({ range: '24h' })).body.data.points, []);
    } finally {
      pool.query = originalQuery;
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });
