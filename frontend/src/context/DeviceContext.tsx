import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Device } from '../types';
import { deviceApi } from '../api';
import { useAuth } from './AuthContext';

interface DeviceContextType {
  devices: Device[];
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device) => void;
  addDevice: (name: string, location: string) => Promise<{ device: Device; rawKey: string }>;
  updateDevice: (id: string, name: string, location: string) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
}
const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  useEffect(() => {
    if (!isAuthenticated) { setDevices([]); setSelectedDevice(null); return; }
    let active = true;
    const refresh = () => deviceApi.getDevices().then((items) => {
      if (!active) return;
      setDevices(items);
      setSelectedDevice((current) => items.find((d) => d.id === current?.id) || items[0] || null);
    }).catch(console.error);
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [isAuthenticated]);

  const addDevice = async (name: string, location: string) => {
    const result = await deviceApi.createDevice(name, location);
    setDevices((current) => [...current, result.device]);
    setSelectedDevice((current) => current || result.device);
    return { device: result.device, rawKey: result.rawDeviceKey };
  };
  const updateDevice = async (id: string, name: string, location: string) => {
    const updated = await deviceApi.updateDevice(id, { name, location });
    setDevices((current) => current.map((d) => d.id === id ? { ...d, ...updated } : d));
    setSelectedDevice((current) => current?.id === id ? { ...current, ...updated } : current);
  };
  const deleteDevice = async (id: string) => {
    await deviceApi.deleteDevice(id);
    const remaining = devices.filter((d) => d.id !== id);
    setDevices(remaining);
    setSelectedDevice((current) => current?.id === id ? remaining[0] || null : current);
  };
  return <DeviceContext.Provider value={{ devices, selectedDevice, setSelectedDevice, addDevice, updateDevice, deleteDevice }}>{children}</DeviceContext.Provider>;
};
export const useDevices = () => {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevices must be used within a DeviceProvider');
  return context;
};
