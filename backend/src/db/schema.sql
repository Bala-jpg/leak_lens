-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2.1 Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 Devices Table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  device_key_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'FAULT')),
  valve_state VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (valve_state IN ('OPEN', 'CLOSED', 'UNKNOWN')),
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration compatibility for existing tables
ALTER TABLE devices ADD COLUMN IF NOT EXISTS valve_state VARCHAR(50) NOT NULL DEFAULT 'OPEN';

-- 2.3 Sensor Readings Table
CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  inlet_flow_lpm NUMERIC(10, 2) NOT NULL,
  outlet_flow_lpm NUMERIC(10, 2) NOT NULL,
  flow_difference_lpm NUMERIC(10, 2) NOT NULL,
  inlet_total_volume_l NUMERIC(12, 2) NOT NULL,
  outlet_total_volume_l NUMERIC(12, 2) NOT NULL,
  leak_detected BOOLEAN NOT NULL,
  valve_state VARCHAR(50) NOT NULL CHECK (valve_state IN ('OPEN', 'CLOSED', 'UNKNOWN')),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 Leak Events Table
CREATE TABLE IF NOT EXISTS leak_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL,
  cutoff_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  inlet_flow_at_detection_lpm NUMERIC(10, 2) NOT NULL,
  outlet_flow_at_detection_lpm NUMERIC(10, 2) NOT NULL,
  avg_leak_flow_lpm NUMERIC(10, 2) NOT NULL,
  inlet_volume_at_detection_l NUMERIC(12, 2) NOT NULL,
  inlet_volume_at_cutoff_l NUMERIC(12, 2) NULL,
  water_wasted_l NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_water_saved_l NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'CUTOFF', 'RESOLVED'))
);

-- 2.5 Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  leak_event_id UUID NULL REFERENCES leak_events(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  read_status BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Required Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_recorded ON sensor_readings(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_leak_events_device_detected ON leak_events(device_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Hardware integration: additive migration preserving existing data.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_reading_at TIMESTAMPTZ;
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS sample_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_sample ON sensor_readings(device_id,sample_id);
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS hardware_event_id VARCHAR(100);
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS outlet_volume_at_detection_l NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS cutoff_latency_ms BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hardware_event ON leak_events(device_id,hardware_event_id);

UPDATE devices d SET last_reading_at=(SELECT MAX(recorded_at) FROM sensor_readings WHERE device_id=d.id)
WHERE last_reading_at IS NULL;

-- Direct telemetry contract: historical sessions/timing remain unknown.
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS boot_id VARCHAR(64);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS sampled_uptime_ms BIGINT;
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS measurement_time_basis VARCHAR(24);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_reading_boot ON sensor_readings(device_id,boot_id,recorded_at);
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS origin_boot_id VARCHAR(64);
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS detected_uptime_ms BIGINT;
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS cutoff_uptime_ms BIGINT;
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS detection_occurred_at TIMESTAMPTZ;
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS cutoff_occurred_at TIMESTAMPTZ;
ALTER TABLE leak_events ADD COLUMN IF NOT EXISTS event_time_basis VARCHAR(24) NOT NULL DEFAULT 'UNKNOWN';
