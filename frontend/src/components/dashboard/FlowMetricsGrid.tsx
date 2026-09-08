import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

export const FlowMetricsGrid: React.FC = () => {
  const { inletFlow, outletFlow, flowDifference, valveState, isLeakActive } = useTelemetry();

  const isDiffHigh = flowDifference > 0.5 || isLeakActive;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      {/* Card 1: Inlet Flow */}
      <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] uppercase text-[#45464d] font-semibold tracking-wider font-mono">
            Inlet Flow
          </span>
          <span className="px-2 py-0.5 rounded bg-[#eff4ff] font-mono text-[11px] text-[#006398] font-semibold">
            INCOMING
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 my-1">
          <span className="text-3xl font-bold font-mono text-[#0b1c30] tabular-nums">
            {inletFlow.toFixed(1)}
          </span>
          <span className="font-mono text-sm text-[#45464d] font-medium">L/min</span>
        </div>
        <div className="pt-2 border-t border-[#e5eeff] text-[#45464d] text-xs">
          Entering zone
        </div>
      </div>

      {/* Card 2: Outlet Flow */}
      <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] uppercase text-[#45464d] font-semibold tracking-wider font-mono">
            Outlet Flow
          </span>
          <span className="px-2 py-0.5 rounded bg-[#eff4ff] font-mono text-[11px] text-[#76777d] font-semibold">
            OUTGOING
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 my-1">
          <span className="text-3xl font-bold font-mono text-[#0b1c30] tabular-nums">
            {outletFlow.toFixed(1)}
          </span>
          <span className="font-mono text-sm text-[#45464d] font-medium">L/min</span>
        </div>
        <div className="pt-2 border-t border-[#e5eeff] text-[#45464d] text-xs">
          Delivering to fixtures
        </div>
      </div>

      {/* Card 3: Flow Difference */}
      <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] uppercase text-[#45464d] font-semibold tracking-wider font-mono">
            Flow Difference (Inlet − Outlet)
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono ${
              isDiffHigh
                ? 'bg-red-100 text-red-700'
                : 'bg-[#85f8c4]/40 text-[#069669]'
            }`}
          >
            {isDiffHigh ? '● Leak Variance' : '● In Spec'}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 my-1">
          <span
            className={`text-3xl font-bold font-mono tabular-nums ${
              isDiffHigh ? 'text-[#ba1a1a]' : 'text-[#069669]'
            }`}
          >
            +{flowDifference.toFixed(1)}
          </span>
          <span className="font-mono text-sm text-[#45464d] font-medium">L/min</span>
        </div>
        <div className="pt-2 border-t border-[#e5eeff] flex items-center gap-1 text-xs font-medium">
          {isDiffHigh ? (
            <span className="text-red-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              Variance exceeded threshold (&gt; 0.5 L/min)
            </span>
          ) : (
            <span className="text-[#069669] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#069669]"></span>
              Balanced / Normal Range (&lt; 0.5 L/min)
            </span>
          )}
        </div>
      </div>

      {/* Card 4: Valve Status */}
      <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[11px] uppercase text-[#45464d] font-semibold tracking-wider font-mono">
            Valve Status
          </span>
          <span
            className={`flex items-center gap-1 text-[11px] font-mono uppercase font-semibold ${
              valveState === 'OPEN' ? 'text-[#069669]' : 'text-[#ba1a1a]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                valveState === 'OPEN' ? 'bg-[#069669]' : 'bg-[#ba1a1a]'
              }`}
            ></span>
            {valveState === 'OPEN' ? 'Armed' : 'Cutoff'}
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-1">
          <span
            className={`text-3xl font-bold font-mono tabular-nums ${
              valveState === 'OPEN' ? 'text-[#0b1c30]' : 'text-[#ba1a1a]'
            }`}
          >
            {valveState}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
              valveState === 'OPEN'
                ? 'bg-[#85f8c4]/30 text-[#069669]'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {valveState === 'OPEN' ? '100% Stroke' : '0% Stroke (Sealed)'}
          </span>
        </div>
        <div className="pt-2 border-t border-[#e5eeff] text-[#45464d] text-xs">
          {valveState === 'OPEN' ? 'Automatic shutoff armed' : 'Emergency isolation active'}
        </div>
      </div>
    </section>
  );
};
