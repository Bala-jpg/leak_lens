import { apiClient } from './client';
import type { Device, LeakEvent, LeakStatsSummary, NotificationItem, SensorReading, User } from '../types';

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data as { user: User; accessToken: string; refreshToken: string };
  },
  register: async (name: string, email: string, password: string) => {
    const res = await apiClient.post('/auth/register', { name, email, password });
    return res.data as { user: User; accessToken: string; refreshToken: string };
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data.user as User;
  },
};

export const deviceApi = {
  getDevices: async () => {
    const res = await apiClient.get('/devices');
    return res.data as Device[];
  },
  getDeviceById: async (id: string) => {
    const res = await apiClient.get(`/devices/${id}`);
    return res.data as Device;
  },
  createDevice: async (name: string, location: string) => {
    const res = await apiClient.post('/devices', { name, location });
    return res.data as { device: Device; rawDeviceKey: string };
  },
  updateDevice: async (id: string, updates: { name?: string; location?: string }) => {
    const res = await apiClient.patch(`/devices/${id}`, updates);
    return res.data as Device;
  },
  toggleValve: async (id: string, state: 'OPEN' | 'CLOSED') => {
    const res = await apiClient.post(`/devices/${id}/valve`, { state });
    return res.data as { message: string; valveState: 'OPEN' | 'CLOSED' };
  },
  deleteDevice: async (id: string) => {
    const res = await apiClient.delete(`/devices/${id}`);
    return res.data as { message: string };
  },
};

export const telemetryApi = {
  getHistory: async (deviceId: string, limit = 50) => {
    const res = await apiClient.get(`/telemetry/device/${deviceId}?limit=${limit}`);
    return res.data as SensorReading[];
  },
};

export const leakApi = {
  getEvents: async (deviceId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (deviceId) params.append('deviceId', deviceId);
    if (status) params.append('status', status);
    const res = await apiClient.get(`/leaks?${params.toString()}`);
    return res.data as LeakEvent[];
  },
  getStats: async (deviceId?: string) => {
    const params = deviceId ? `?deviceId=${deviceId}` : '';
    const res = await apiClient.get(`/leaks/stats${params}`);
    return res.data as LeakStatsSummary;
  },
  resolveEvent: async (id: string) => {
    const res = await apiClient.patch(`/leaks/${id}/resolve`);
    return res.data as LeakEvent;
  },
};

export const notificationApi = {
  getNotifications: async () => {
    const res = await apiClient.get('/notifications');
    return res.data as NotificationItem[];
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
