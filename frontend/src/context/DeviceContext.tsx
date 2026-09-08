import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Device, ValveState } from '../types';
import { INITIAL_DEVICES } from '../mock/initialData';
import { deviceApi } from '../api';

interface DeviceContextType {
  devices: Device[];
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device) => void;
  addDevice: (name: string, location: string) => Promise<{ device: Device; rawKey: string }>;
  updateDevice: (id: string, name: string, location: string) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  toggleValve: (id: string, targetState: ValveState) => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>(() => {
    const saved = localStorage.getItem('leaklens_devices');
    return saved ? JSON.parse(saved) : INITIAL_DEVICES;
  });

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(() => devices[0] || null);

  useEffect(() => {
    localStorage.setItem('leaklens_devices', JSON.stringify(devices));
  }, [devices]);

  const addDevice = async (name: string, location: string) => {
    try {
      const res = await deviceApi.createDevice(name, location);
      setDevices((prev) => [...prev, res.device]);
      return { device: res.device, rawKey: res.rawDeviceKey };
    } catch {
      // Local fallback
      const generatedId = `LLS-${Math.floor(100 + Math.random() * 900)}-${String.fromCharCode(65 + Math.floor(Math.random() * 6))}${Math.floor(1 + Math.random() * 4)}`;
      const rawKey = `key_${Math.random().toString(36).substring(2, 15)}`;
      const newDev: Device = {
        id: generatedId,
        name,
        location,
        status: 'ONLINE',
        lastSeen: new Date().toISOString(),
        valveState: 'OPEN',
        deviceKey: rawKey,
        createdAt: new Date().toISOString(),
      };
      setDevices((prev) => [...prev, newDev]);
      return { device: newDev, rawKey };
    }
  };

  const updateDevice = async (id: string, name: string, location: string) => {
    try {
      await deviceApi.updateDevice(id, { name, location });
    } catch {
      // ignore
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name, location } : d))
    );
    if (selectedDevice?.id === id) {
      setSelectedDevice((prev) => (prev ? { ...prev, name, location } : null));
    }
  };

  const deleteDevice = async (id: string) => {
    try {
      await deviceApi.deleteDevice(id);
    } catch {
      // ignore
    }
    setDevices((prev) => prev.filter((d) => d.id !== id));
    if (selectedDevice?.id === id) {
      setSelectedDevice(devices.find((d) => d.id !== id) || null);
    }
  };

  const toggleValve = async (id: string, targetState: ValveState) => {
    try {
      if (targetState === 'OPEN' || targetState === 'CLOSED') {
        await deviceApi.toggleValve(id, targetState);
      }
    } catch {
      // ignore
    }
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, valveState: targetState } : d))
    );
    if (selectedDevice?.id === id) {
      setSelectedDevice((prev) => (prev ? { ...prev, valveState: targetState } : null));
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDevice,
        setSelectedDevice,
        addDevice,
        updateDevice,
        deleteDevice,
        toggleValve,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevices = () => {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevices must be used within a DeviceProvider');
  return context;
};
