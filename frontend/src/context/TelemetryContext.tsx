import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { FlowDataPoint, LeakEvent, ValveState } from '../types';
import { INITIAL_LEAKS, generateInitialFlowPoints } from '../mock/initialData';
import { useDevices } from './DeviceContext';
import { socket } from '../api/socket';

interface TelemetryContextType {
  inletFlow: number;
  outletFlow: number;
  flowDifference: number;
  flowHistory: FlowDataPoint[];
  valveState: ValveState;
  isLeakActive: boolean;
  activeLeak: LeakEvent | null;
  cutoffLatency: number;
  recentIncidents: LeakEvent[];
  waterWasted30d: number;
  waterSaved30d: number;
  triggerLeakSimulation: () => void;
  resolveLeak: (leakId?: string) => void;
  testValveCutoff: () => void;
  manualOverrideValve: () => void;
  refreshTelemetry: () => void;
  lastSyncedAgo: number;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedDevice, toggleValve } = useDevices();

  const [isLeakActive, setIsLeakActive] = useState<boolean>(false);
  const [activeLeak, setActiveLeak] = useState<LeakEvent | null>(null);
  const [cutoffLatency, setCutoffLatency] = useState<number>(4.8);
  const [recentIncidents, setRecentIncidents] = useState<LeakEvent[]>(INITIAL_LEAKS);
  const [lastSyncedAgo, setLastSyncedAgo] = useState<number>(3);

  const [inletFlow, setInletFlow] = useState<number>(12.5);
  const [outletFlow, setOutletFlow] = useState<number>(12.4);
  const [flowHistory, setFlowHistory] = useState<FlowDataPoint[]>(() =>
    generateInitialFlowPoints(20, false)
  );

  const valveState: ValveState = selectedDevice?.valveState || (isLeakActive ? 'CLOSED' : 'OPEN');

  const waterWasted30d = +(recentIncidents.reduce((acc, curr) => acc + curr.waterWastedL, 0)).toFixed(2);
  const waterSaved30d = +(recentIncidents.reduce((acc, curr) => acc + curr.estimatedWaterSavedL, 0)).toFixed(1);

  // Trigger simulated leak
  const triggerLeakSimulation = useCallback(() => {
    setIsLeakActive(true);
    const newIncident: LeakEvent = {
      id: `LK-${Math.floor(200 + Math.random() * 800)}`,
      deviceId: selectedDevice?.id || 'LLS-942-B4',
      deviceName: selectedDevice?.name || 'Zone B Main Line',
      location: selectedDevice?.location || 'Main Plant — Bldg 4 (Zone B Risers)',
      detectedAt: new Date().toISOString(),
      cutoffAt: new Date(Date.now() + 4800).toISOString(),
      inletFlowAtDetectionLpm: 12.5,
      outletFlowAtDetectionLpm: 7.1,
      avgLeakFlowLpm: 5.4,
      inletVolumeAtDetectionL: 1420.5,
      inletVolumeAtCutoffL: 1421.22,
      waterWastedL: 0.72,
      estimatedWaterSavedL: 84.6,
      status: 'ACTIVE',
      cutoffLatencySec: 4.8,
    };
    setActiveLeak(newIncident);
    setCutoffLatency(4.8);
    setInletFlow(12.5);
    setOutletFlow(7.1);
    if (selectedDevice) {
      toggleValve(selectedDevice.id, 'CLOSED');
    }
  }, [selectedDevice, toggleValve]);

  // Resolve leak
  const resolveLeak = useCallback((leakId?: string) => {
    setIsLeakActive(false);
    if (activeLeak) {
      const resolved = {
        ...activeLeak,
        status: 'RESOLVED' as const,
        resolvedAt: new Date().toISOString(),
      };
      setRecentIncidents((prev) => [resolved, ...prev.filter((i) => i.id !== activeLeak.id)]);
      setActiveLeak(null);
    } else if (leakId) {
      setRecentIncidents((prev) =>
        prev.map((item) => (item.id === leakId ? { ...item, status: 'RESOLVED' } : item))
      );
    }
    if (selectedDevice) {
      toggleValve(selectedDevice.id, 'OPEN');
    }
    setInletFlow(12.5);
    setOutletFlow(12.4);
  }, [activeLeak, selectedDevice, toggleValve]);

  // Test valve cutoff
  const testValveCutoff = useCallback(() => {
    if (selectedDevice) {
      const next = selectedDevice.valveState === 'OPEN' ? 'CLOSED' : 'OPEN';
      toggleValve(selectedDevice.id, next);
    }
  }, [selectedDevice, toggleValve]);

  // Manual override
  const manualOverrideValve = useCallback(() => {
    if (selectedDevice) {
      toggleValve(selectedDevice.id, 'OPEN');
    }
    if (isLeakActive) {
      setIsLeakActive(false);
    }
  }, [selectedDevice, toggleValve, isLeakActive]);

  // Refresh telemetry
  const refreshTelemetry = useCallback(() => {
    setLastSyncedAgo(0);
  }, []);

  // Sync timer
  useEffect(() => {
    const timer = setInterval(() => {
      setLastSyncedAgo((s) => (s >= 10 ? 1 : s + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Live telemetry pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setFlowHistory((prev) => {
        const now = Date.now();
        const time = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let newInlet = +(12.2 + (Math.random() * 0.6 - 0.3)).toFixed(2);
        let newOutlet = isLeakActive
          ? +(newInlet - 5.4 + (Math.random() * 0.4 - 0.2)).toFixed(2)
          : +(newInlet - (Math.random() * 0.15)).toFixed(2);

        if (selectedDevice?.valveState === 'CLOSED') {
          newInlet = +(newInlet * 0.1).toFixed(2);
          newOutlet = 0.0;
        }

        setInletFlow(newInlet);
        setOutletFlow(newOutlet);

        const newPoint: FlowDataPoint = {
          time,
          timestamp: now,
          inletFlow: newInlet,
          outletFlow: newOutlet,
          difference: +(newInlet - newOutlet).toFixed(2),
        };

        return [...prev.slice(1), newPoint];
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isLeakActive, selectedDevice?.valveState]);

  // Listen to real-time WebSocket events from backend when connected
  useEffect(() => {
    const handleTelemetryUpdate = (data: { deviceId: string; reading: any }) => {
      if (!selectedDevice || data.deviceId === selectedDevice.id) {
        const reading = data.reading;
        if (reading) {
          setInletFlow(Number(reading.inlet_flow_lpm || reading.inletFlowLpm || 12.5));
          setOutletFlow(Number(reading.outlet_flow_lpm || reading.outletFlowLpm || 12.4));
          setLastSyncedAgo(0);
        }
      }
    };

    const handleLeakAlert = (alert: any) => {
      if (!selectedDevice || alert.deviceId === selectedDevice.id) {
        setIsLeakActive(true);
      }
    };

    const handleValveCommand = (cmd: any) => {
      if (selectedDevice && cmd.deviceId === selectedDevice.id) {
        toggleValve(cmd.deviceId, cmd.targetState);
      }
    };

    socket.on('telemetry_update', handleTelemetryUpdate);
    socket.on('leak_alert', handleLeakAlert);
    socket.on('valve_command', handleValveCommand);

    return () => {
      socket.off('telemetry_update', handleTelemetryUpdate);
      socket.off('leak_alert', handleLeakAlert);
      socket.off('valve_command', handleValveCommand);
    };
  }, [selectedDevice, toggleValve]);

  const flowDifference = +(inletFlow - outletFlow).toFixed(2);

  return (
    <TelemetryContext.Provider
      value={{
        inletFlow,
        outletFlow,
        flowDifference,
        flowHistory,
        valveState,
        isLeakActive,
        activeLeak,
        cutoffLatency,
        recentIncidents,
        waterWasted30d,
        waterSaved30d,
        triggerLeakSimulation,
        resolveLeak,
        testValveCutoff,
        manualOverrideValve,
        refreshTelemetry,
        lastSyncedAgo,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry must be used within a TelemetryProvider');
  return context;
};
