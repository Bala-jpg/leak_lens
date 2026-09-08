import type { Device, FlowDataPoint, LeakEvent, NotificationItem, User } from '../types';

export const INITIAL_USER: User = {
  id: 'usr-101',
  name: 'Marcus Chen',
  email: 'marcus.chen@leaklens.io',
  role: 'Lead Facility Eng.',
};

export const INITIAL_DEVICES: Device[] = [
  {
    id: 'LLS-942-B4',
    name: 'Zone B Main Line (Device #LLS-942)',
    location: 'Main Plant — Bldg 4 (Zone B Risers)',
    status: 'ONLINE',
    lastSeen: new Date().toISOString(),
    valveState: 'OPEN',
    deviceKey: 'raw-key-secret-942-b4',
    createdAt: '2026-08-15T08:00:00.000Z',
  },
  {
    id: 'LLS-881-A1',
    name: 'Basement Sump Supply Line',
    location: 'Building A — Sub-level 1 Utility Hub',
    status: 'ONLINE',
    lastSeen: new Date(Date.now() - 40000).toISOString(),
    valveState: 'OPEN',
    deviceKey: 'raw-key-secret-881-a1',
    createdAt: '2026-08-20T10:30:00.000Z',
  },
  {
    id: 'LLS-310-C2',
    name: 'Cooling Tower Riser Line',
    location: 'Plant 2 — Rooftop HVAC Mechanical Room',
    status: 'FAULT',
    lastSeen: new Date(Date.now() - 3600000).toISOString(),
    valveState: 'CLOSED',
    deviceKey: 'raw-key-secret-310-c2',
    createdAt: '2026-09-01T14:15:00.000Z',
  },
];

export const INITIAL_LEAKS: LeakEvent[] = [
  {
    id: 'LK-205',
    deviceId: 'LLS-942-B4',
    deviceName: 'Zone B Main Line (Device #LLS-942)',
    location: 'Main Plant — Bldg 4 (Zone B Risers)',
    detectedAt: '2026-10-24T14:32:18.000Z',
    cutoffAt: '2026-10-24T14:32:23.000Z',
    resolvedAt: '2026-10-24T15:10:00.000Z',
    inletFlowAtDetectionLpm: 12.5,
    outletFlowAtDetectionLpm: 7.1,
    avgLeakFlowLpm: 5.4,
    inletVolumeAtDetectionL: 1420.5,
    inletVolumeAtCutoffL: 1421.22,
    waterWastedL: 0.72,
    estimatedWaterSavedL: 84.6,
    status: 'RESOLVED',
    cutoffLatencySec: 4.8,
  },
  {
    id: 'LK-108',
    deviceId: 'LLS-881-A1',
    deviceName: 'Basement Sump Supply Line',
    location: 'Building A — Sub-level 1 Utility Hub',
    detectedAt: '2026-10-18T09:15:00.000Z',
    cutoffAt: '2026-10-18T09:15:05.100Z',
    resolvedAt: '2026-10-18T10:45:00.000Z',
    inletFlowAtDetectionLpm: 14.8,
    outletFlowAtDetectionLpm: 4.3,
    avgLeakFlowLpm: 10.5,
    inletVolumeAtDetectionL: 2150.0,
    inletVolumeAtCutoffL: 2151.05,
    waterWastedL: 1.05,
    estimatedWaterSavedL: 42.0,
    status: 'RESOLVED',
    cutoffLatencySec: 5.1,
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    deviceId: 'LLS-942-B4',
    deviceName: 'Zone B Risers',
    type: 'LEAK_DETECTED',
    message: 'Differential flow spike detected (>2.0 L/min variance between inlet and outlet).',
    readStatus: false,
    createdAt: '2026-10-24T14:32:18.000Z',
  },
  {
    id: 'notif-2',
    deviceId: 'LLS-942-B4',
    deviceName: 'Zone B Risers',
    type: 'VALVE_CUTOFF',
    message: 'Automated cutoff executed in 4.8s. Valve #LLS-942 is now 100% SEALED.',
    readStatus: false,
    createdAt: '2026-10-24T14:32:23.000Z',
  },
  {
    id: 'notif-3',
    deviceId: 'LLS-310-C2',
    deviceName: 'Cooling Tower Riser Line',
    type: 'DEVICE_OFFLINE',
    message: 'Gateway ping missed for 3 consecutive intervals. Device marked as FAULT.',
    readStatus: false,
    createdAt: '2026-10-24T12:00:00.000Z',
  },
  {
    id: 'notif-4',
    deviceId: 'LLS-881-A1',
    deviceName: 'Basement Sump Supply Line',
    type: 'LEAK_RESOLVED',
    message: 'Leak incident #LK-108 manually verified and marked resolved by Marcus Chen.',
    readStatus: true,
    createdAt: '2026-10-18T10:45:00.000Z',
  },
];

export function generateInitialFlowPoints(count = 20, isLeaking = false): FlowDataPoint[] {
  const points: FlowDataPoint[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * 5000;
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const inlet = +(12.2 + Math.sin(i * 0.5) * 0.4 + (Math.random() * 0.2 - 0.1)).toFixed(2);
    let outlet = +(inlet - (Math.random() * 0.15)).toFixed(2);
    if (isLeaking && i <= 5) {
      outlet = +(inlet - 5.4 + (Math.random() * 0.2 - 0.1)).toFixed(2);
    }
    const diff = +(inlet - outlet).toFixed(2);
    points.push({ time, timestamp, inletFlow: inlet, outletFlow: outlet, difference: diff });
  }
  return points;
}
