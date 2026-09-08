import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { ManualOverrideModal } from './ManualOverrideModal';

export const ActiveLeakBanner: React.FC = () => {
  const { activeLeak, cutoffLatency, resolveLeak } = useTelemetry();
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);

  return (
    <>
      <section className="w-full bg-red-500/10 border-2 border-red-600 rounded-xl overflow-hidden shadow-sm flex flex-col lg:flex-row items-stretch justify-between mb-4">
        <div className="p-5 flex-1 flex flex-col justify-center space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-red-950 flex items-center gap-2">
              ⚠️ LEAK DETECTED — AUTOMATIC CUTOFF ACTIVATED
            </h1>
          </div>
          <p className="text-sm text-red-950/80 max-w-3xl leading-relaxed">
            Abnormal water flow detected between inlet and outlet. The motorized shutoff valve has closed to isolate the line and prevent flooding.
          </p>
          <div className="flex items-center gap-2 font-mono text-xs text-red-900/90 pt-1 font-medium">
            <span className="material-symbols-outlined text-[15px]">schedule</span>
            <span>
              Detected at {activeLeak ? new Date(activeLeak.detectedAt).toLocaleTimeString() : '14:32:18'} • Valve sealed in {cutoffLatency}s (Automated Isolation Latency)
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 flex flex-row lg:flex-col items-center lg:items-end justify-center gap-2.5 bg-red-500/5 lg:border-l border-t lg:border-t-0 border-red-300 shrink-0">
          <button
            type="button"
            onClick={() => resolveLeak()}
            className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>✓ Mark Leak as Fixed</span>
          </button>
          <button
            type="button"
            onClick={() => setOverrideModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-red-600">lock_open</span>
            <span>Manual Override</span>
          </button>
        </div>
      </section>

      {overrideModalOpen && (
        <ManualOverrideModal onClose={() => setOverrideModalOpen(false)} />
      )}
    </>
  );
};
