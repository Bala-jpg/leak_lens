import { apiClient } from './client';
import type { Device, FlowDataPoint, LeakEvent, LeakStatsSummary, NotificationItem, SensorReading, User } from '../types';

// Older backend processes return database column names; normalize both contracts here.
const value = (row: Record<string, any>, camel: string, snake: string) => row[camel] ?? row[snake];
export const normalizeReading = (row: Record<string, any>): SensorReading => ({
  bootId: value(row, 'bootId', 'boot_id') ?? null,
  sampledUptimeMs: value(row, 'sampledUptimeMs', 'sampled_uptime_ms') == null ? null : Number(value(row, 'sampledUptimeMs', 'sampled_uptime_ms')),
  receivedAt: value(row, 'receivedAt', 'received_at') ?? null,
  measurementTimeBasis: value(row, 'measurementTimeBasis', 'measurement_time_basis') ?? null,
  id: row.id,
  deviceId: value(row, 'deviceId', 'device_id'),
  inletFlowLpm: Number(value(row, 'inletFlowLpm', 'inlet_flow_lpm') ?? 0),
  outletFlowLpm: Number(value(row, 'outletFlowLpm', 'outlet_flow_lpm') ?? 0),
  flowDifferenceLpm: Number(value(row, 'flowDifferenceLpm', 'flow_difference_lpm') ?? 0),
  inletTotalVolumeL: Number(value(row, 'inletTotalVolumeL', 'inlet_total_volume_l') ?? 0),
  outletTotalVolumeL: Number(value(row, 'outletTotalVolumeL', 'outlet_total_volume_l') ?? 0),
  leakDetected: Boolean(value(row, 'leakDetected', 'leak_detected')),
  valveState: value(row, 'valveState', 'valve_state') ?? 'UNKNOWN',
  recordedAt: value(row, 'recordedAt', 'recorded_at') ?? '',
});
const normalizeDevice = (row: Record<string, any>): Device => ({
  id: row.id, name: row.name, location: row.location, status: row.status,
  userId: value(row, 'userId', 'user_id'),
  valveState: value(row, 'valveState', 'valve_state') ?? 'UNKNOWN',
  lastSeen: value(row, 'lastSeen', 'last_seen'),
  createdAt: value(row, 'createdAt', 'created_at'),
});
const normalizeEvent = (row: Record<string, any>): LeakEvent => ({
  firstObservedAt: row.firstObservedAt ?? value(row, 'detectedAt', 'detected_at'),
  originBootId: value(row, 'originBootId', 'origin_boot_id') ?? null,
  detectionOccurredAt: value(row, 'detectionOccurredAt', 'detection_occurred_at') ?? null,
  cutoffOccurredAt: value(row, 'cutoffOccurredAt', 'cutoff_occurred_at') ?? null,
  eventTimeBasis: value(row, 'eventTimeBasis', 'event_time_basis') ?? 'UNKNOWN',
  id: row.id,
  deviceId: value(row, 'deviceId', 'device_id'),
  deviceName: value(row, 'deviceName', 'device_name'),
  location: row.location ?? row.device_location,
  detectedAt: value(row, 'detectedAt', 'detected_at'),
  cutoffAt: value(row, 'cutoffAt', 'cutoff_at'),
  resolvedAt: value(row, 'resolvedAt', 'resolved_at'),
  inletFlowAtDetectionLpm: Number(value(row, 'inletFlowAtDetectionLpm', 'inlet_flow_at_detection_lpm') ?? 0),
  outletFlowAtDetectionLpm: Number(value(row, 'outletFlowAtDetectionLpm', 'outlet_flow_at_detection_lpm') ?? 0),
  avgLeakFlowLpm: Number(value(row, 'avgLeakFlowLpm', 'avg_leak_flow_lpm') ?? 0),
  inletVolumeAtDetectionL: Number(value(row, 'inletVolumeAtDetectionL', 'inlet_volume_at_detection_l') ?? 0),
  inletVolumeAtCutoffL: Number(value(row, 'inletVolumeAtCutoffL', 'inlet_volume_at_cutoff_l') ?? 0),
  cutoffLatencySec: row.cutoffLatencySec ?? (row.cutoff_latency_ms == null ? undefined : Number(row.cutoff_latency_ms) / 1000),
  waterWastedL: Number(value(row, 'waterWastedL', 'water_wasted_l') ?? 0),
  estimatedWaterSavedL: Number(value(row, 'estimatedWaterSavedL', 'estimated_water_saved_l') ?? 0),
  status: row.status,
});
const normalizeNotification = (row: Record<string, any>): NotificationItem => ({
  id: row.id, type: row.type, message: row.message,
  userId: value(row, 'userId', 'user_id'),
  deviceId: value(row, 'deviceId', 'device_id'),
  deviceName: value(row, 'deviceName', 'device_name'),
  leakEventId: value(row, 'leakEventId', 'leak_event_id'),
  readStatus: Boolean(value(row, 'readStatus', 'read_status')),
  createdAt: value(row, 'createdAt', 'created_at'),
});

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const d = res.data.data || res.data;
    return {
      user: (d.user || res.data.user) as User,
      accessToken: (d.accessToken || d.tokens?.accessToken || res.data.accessToken) as string,
      refreshToken: (d.refreshToken || d.tokens?.refreshToken || res.data.refreshToken) as string,
    };
  },
  register: async (name: string, email: string, password: string) => {
    const res = await apiClient.post('/auth/register', { name, email, password });
    const d = res.data.data || res.data;
    return {
      user: (d.user || res.data.user) as User,
      accessToken: (d.accessToken || d.tokens?.accessToken || res.data.accessToken) as string,
      refreshToken: (d.refreshToken || d.tokens?.refreshToken || res.data.refreshToken) as string,
    };
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return (res.data.data?.user || res.data.user || res.data) as User;
  },
  updateMe: async (name: string, email: string) => {
    const res = await apiClient.patch('/auth/me', { name, email });
    return res.data.data.user as User;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    await apiClient.post('/auth/password', { currentPassword, newPassword });
  },
};

export const deviceApi = {
  getDevices: async () => {
    const res = await apiClient.get('/devices');
    return (res.data.data?.devices || res.data.devices || res.data).map(normalizeDevice) as Device[];
  },
  getDeviceById: async (id: string) => {
    const res = await apiClient.get(`/devices/${id}`);
    return normalizeDevice(res.data.data?.device || res.data.device || res.data);
  },
  createDevice: async (name: string, location: string) => {
    const res = await apiClient.post('/devices', { name, location });
    const d = res.data.data || res.data;
    return {
      device: normalizeDevice(d.device || res.data.device),
      rawDeviceKey: (d.rawDeviceKey || d.deviceKey || res.data.rawDeviceKey || res.data.deviceKey) as string,
    };
  },
  updateDevice: async (id: string, updates: { name?: string; location?: string }) => {
    const res = await apiClient.patch(`/devices/${id}`, updates);
    return normalizeDevice(res.data.data?.device || res.data.device || res.data);
  },
  deleteDevice: async (id: string) => {
    const res = await apiClient.delete(`/devices/${id}`);
    return res.data as { message: string };
  },
};

export const telemetryApi = {
  getFlowWindow: async (deviceId: string, range: '5m' | '1h' | '24h', signal?: AbortSignal) => {
    const res = await apiClient.get(`/telemetry/device/${deviceId}`, { params: { range }, signal });
    return res.data.data as {
      from: string; to: string; bucketSeconds: number; points: Omit<FlowDataPoint, 'time'>[];
    };
  },
  getHistory: async (deviceId: string, limit = 50) => {
    const res = await apiClient.get(`/telemetry/device/${deviceId}?limit=${limit}`);
    return (res.data.data?.readings || res.data.readings || res.data).map(normalizeReading) as SensorReading[];
  },
};

export const leakApi = {
  getEvents: async (deviceId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (deviceId) params.append('deviceId', deviceId);
    if (status) params.append('status', status);
    const res = await apiClient.get(`/leaks?${params.toString()}`);
    return (res.data.data?.leakEvents || res.data.leakEvents || res.data).map(normalizeEvent) as LeakEvent[];
  },
  getStats: async (deviceId?: string) => {
    const params = deviceId ? `?deviceId=${deviceId}` : '';
    const res = await apiClient.get(`/leaks/stats${params}`);
    return (res.data.data?.stats || res.data.stats || res.data) as LeakStatsSummary;
  },
  resolveEvent: async (id: string) => {
    const res = await apiClient.patch(`/leaks/${id}/resolve`);
    return normalizeEvent(res.data.data?.leakEvent || res.data.leakEvent || res.data);
  },
};

export const notificationApi = {
  getNotifications: async () => {
    const res = await apiClient.get('/notifications');
    return (res.data.data?.notifications || res.data.notifications || res.data).map(normalizeNotification) as NotificationItem[];
  },
  markAsRead: async (id: string) => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllAsRead: async () => {
    const res = await apiClient.patch('/notifications/read-all');
    return res.data;
  },
};
