import pool from '../config/db';
import { runMigrations } from './migrate';
import { hashPassword, hashDeviceKey } from '../utils/crypto';

export const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...');
  try {
    // 1. Ensure migrations are applied first
    await runMigrations();

    // 2. Clean existing data in cascade order
    console.log('🧹 Truncating existing tables...');
    await pool.query('TRUNCATE users, devices, sensor_readings, leak_events, notifications RESTART IDENTITY CASCADE;');

    // 3. Seed 1 Test User
    console.log('👤 Inserting test user...');
    const userPasswordHash = await hashPassword('password123');
    const userRes = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      ['Balaji', 'user@example.com', userPasswordHash]
    );
    const user = userRes.rows[0];
    console.log(`  ✓ Test user created: ${user.email} (${user.id})`);

    // 4. Seed 1 Test Device
    console.log('📱 Inserting test device...');
    const rawDeviceKey = 'dev-key-kitchen-12345';
    const deviceKeyHash = hashDeviceKey(rawDeviceKey);
    const deviceRes = await pool.query(
      `INSERT INTO devices (user_id, name, location, device_key_hash, status, last_seen)
       VALUES ($1, $2, $3, $4, 'ONLINE', NOW())
       RETURNING id, name, location`,
      [user.id, 'LeakLens Home', 'Kitchen', deviceKeyHash]
    );
    const device = deviceRes.rows[0];
    console.log(`  ✓ Test device created: ${device.name} (${device.id})`);
    console.log(`  🔑 Plaintext Device Key for Testing: ${rawDeviceKey}`);

    // 5. Seed Normal Telemetry Samples
    console.log('📊 Inserting normal telemetry samples...');
    const now = Date.now();
    const normalSamples = [
      { minsAgo: 60, inlet: 10.0, outlet: 10.0, inVol: 100.0, outVol: 100.0, leak: false, valve: 'OPEN' },
      { minsAgo: 50, inlet: 12.0, outlet: 12.0, inVol: 110.0, outVol: 110.0, leak: false, valve: 'OPEN' },
      { minsAgo: 40, inlet: 8.5, outlet: 8.5, inVol: 118.5, outVol: 118.5, leak: false, valve: 'OPEN' },
      { minsAgo: 30, inlet: 0.0, outlet: 0.0, inVol: 118.5, outVol: 118.5, leak: false, valve: 'OPEN' },
    ];

    for (const sample of normalSamples) {
      const recordedAt = new Date(now - sample.minsAgo * 60 * 1000);
      const flowDiff = Math.max(0, sample.inlet - sample.outlet);
      await pool.query(
        `INSERT INTO sensor_readings 
          (device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [device.id, sample.inlet, sample.outlet, flowDiff, sample.inVol, sample.outVol, sample.leak, sample.valve, recordedAt]
      );
    }
    console.log(`  ✓ Created ${normalSamples.length} normal telemetry rows`);

    // 6. Seed Leak Telemetry & Leak Event
    console.log('🚨 Inserting leak telemetry and leak event...');
    const leakDetectedTime = new Date(now - 15 * 60 * 1000);
    const cutoffTime = new Date(now - 14 * 60 * 1000);

    await pool.query(
      `INSERT INTO sensor_readings 
        (device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at)
       VALUES ($1, 12.5, 9.2, 3.3, 131.0, 127.7, true, 'OPEN', $2)`,
      [device.id, leakDetectedTime]
    );

    await pool.query(
      `INSERT INTO sensor_readings 
        (device_id, inlet_flow_lpm, outlet_flow_lpm, flow_difference_lpm, inlet_total_volume_l, outlet_total_volume_l, leak_detected, valve_state, recorded_at)
       VALUES ($1, 0.0, 0.0, 0.0, 131.8, 127.7, true, 'CLOSED', $2)`,
      [device.id, cutoffTime]
    );

    const leakRes = await pool.query(
      `INSERT INTO leak_events
        (device_id, detected_at, cutoff_at, inlet_flow_at_detection_lpm, outlet_flow_at_detection_lpm, avg_leak_flow_lpm, inlet_volume_at_detection_l, inlet_volume_at_cutoff_l, water_wasted_l, estimated_water_saved_l, status)
       VALUES ($1, $2, $3, 12.5, 9.2, 3.3, 131.0, 131.8, 0.8, 0, 'CUTOFF')
       RETURNING id, status`,
      [device.id, leakDetectedTime, cutoffTime]
    );
    const leakEvent = leakRes.rows[0];
    console.log(`  ✓ Leak event created: ${leakEvent.id} (Status: ${leakEvent.status})`);

    // 7. Seed Notification
    console.log('🔔 Inserting notification...');
    await pool.query(
      `INSERT INTO notifications (user_id, device_id, leak_event_id, type, message)
       VALUES ($1, $2, $3, 'LEAK_CUTOFF', 'Leak detected! Automatic valve cutoff activated.')`,
      [user.id, device.id, leakEvent.id]
    );

    console.log('✅ Database seeding complete!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase().then(() => pool.end());
}
