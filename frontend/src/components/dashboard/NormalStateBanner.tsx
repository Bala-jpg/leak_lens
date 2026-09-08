import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useDevices } from '../../context/DeviceContext';

export const NormalStateBanner: React.FC = () => {
  const { lastSyncedAgo, testValveCutoff, valveState } = useTelemetry();
  const { selectedDevice } = useDevices();

  return (
    <section className="w-full bg-white rounded-xl border border-[#c6c6cd]/40 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[#069669] font-bold text-xs bg-[#85f8c4]/30 border border-[#069669]/20">
            <span className="w-2.5 h-2.5 rounded-full bg-[#069669] status-dot-pulse"></span>
            ● SYSTEM NORMAL — NO ACTIVE LEAKS
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[#45464d] text-xs">
          <span className="font-semibold text-[#0b1c30]">
            {selectedDevice?.name || 'Main Building — Zone B Main Line (Device #LLS-942)'}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-[#069669] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#069669]"></span>
            Live • Telemetry synced {lastSyncedAgo}s ago
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
        <button
          type="button"
          onClick={testValveCutoff}
          className="flex items-center gap-1.5 px-4 py-2 border border-[#c6c6cd]/60 hover:bg-[#eff4ff] rounded-lg text-[#0b1c30] text-xs font-semibold transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-[#006398]">
            {valveState === 'OPEN' ? 'play_circle' : 'stop_circle'}
          </span>
          <span>{valveState === 'OPEN' ? 'Test Valve Cutoff' : 'Re-open Valve'}</span>
        </button>
      </div>
    </section>
  );
};
