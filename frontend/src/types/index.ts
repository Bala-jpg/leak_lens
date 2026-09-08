export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'FAULT';
export type ValveState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type LeakStatus = 'ACTIVE' | 'CUTOFF' | 'RESOLVED';
export type NotificationType =
  | 'LEAK_DETECTED'
  | 'VALVE_CUTOFF'
  | 'DEVICE_OFFLINE'
  | 'LEAK_RESOLVED'
  | 'SYSTEM_ALERT';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: string;
}

export interface Device {
  id: string;
  userId?: string;
  name: string;
  location: string;
  status: DeviceStatus;
  lastSeen?: string;
  deviceKey?: string;
  valveState: ValveState;
  createdAt?: string;
}

export interface SensorReading {
  id?: number | string;
  deviceId: string;
  inletFlowLpm: number;
  outletFlowLpm: number;
  flowDifferenceLpm: number;
  inletTotalVolumeL: number;
  outletTotalVolumeL: number;
  leakDetected: boolean;
  valveState: ValveState;
  recordedAt: string;
}

export interface LeakEvent {
  id: string;
  deviceId: string;
  deviceName?: string;
  location?: string;
  detectedAt: string;
  cutoffAt?: string | null;
  resolvedAt?: string | null;
  inletFlowAtDetectionLpm: number;
  outletFlowAtDetectionLpm: number;
  avgLeakFlowLpm: number;
  inletVolumeAtDetectionL: number;
  inletVolumeAtCutoffL?: number | null;
  waterWastedL: number;
  estimatedWaterSavedL: number;
  status: LeakStatus;
  cutoffLatencySec?: number;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  deviceId: string;
  deviceName?: string;
  leakEventId?: string | null;
  type: NotificationType;
  message: string;
  readStatus: boolean;
  createdAt: string;
}

export interface FlowDataPoint {
  time: string;
  timestamp: number;
  inletFlow: number;
  outletFlow: number;
  difference: number;
}

export interface LeakStatsSummary {
  totalLeaks: number;
  activeLeaks: number;
  totalWaterWastedL: number;
  totalWaterSavedL: number;
  avgCutoffLatencySec: number;
  cutoffEfficiencyPercent: number;
}

