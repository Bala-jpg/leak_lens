import React from 'react';
import {useTelemetry} from '../../context/TelemetryContext';
import {useDevices} from '../../context/DeviceContext';
export const NormalStateBanner:React.FC=()=>{
  const {lastSyncedAgo,isOnline,hasReading}=useTelemetry();const {selectedDevice}=useDevices();
  return <section className="bg-white rounded-xl border border-slate-300 p-5 mb-4">
    <h2 className="font-bold">{!hasReading?'Waiting for hardware readings':isOnline?'No active leak reported':'Device telemetry is stale'}</h2>
    <p className="text-xs mt-2">{selectedDevice?.name??'Select or register a device'}{hasReading?` ? Last reading ${lastSyncedAgo}s ago`:''}</p>
    <p className="text-xs mt-2">Automatic shutoff is controlled locally by the hardware.</p>
  </section>;
};
