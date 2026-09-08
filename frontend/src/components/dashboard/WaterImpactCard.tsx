import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

export const WaterImpactCard: React.FC = () => {
  const { waterWasted30d, waterSaved30d } = useTelemetry();

  return (
    <section className="bg-white rounded-xl border border-[#c6c6cd]/40 shadow-xs p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff] mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006398] text-[20px]">water_drop</span>
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase font-mono tracking-wider">
              WATER IMPACT & SAVINGS
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#76777d] uppercase font-semibold">
            30-Day Total
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Water Wasted */}
          <div className="p-4 bg-[#eff4ff] rounded-lg border border-[#c6c6cd]/30 flex flex-col">
            <span className="text-[11px] font-mono uppercase text-[#76777d] font-semibold">
              Water Wasted
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold font-mono text-[#0b1c30] tabular-nums">
                {waterWasted30d}
              </span>
              <span className="text-xs font-mono text-[#76777d] font-medium">Liters</span>
            </div>
            <span className="text-[11px] text-[#76777d] mt-1">
              Cumulative volume prior to auto-cutoffs
            </span>
          </div>

          {/* Water Saved */}
          <div className="p-4 bg-[#eff4ff] rounded-lg border border-[#c6c6cd]/30 flex flex-col">
            <span className="text-[11px] font-mono uppercase text-[#069669] font-semibold">
              Estimated Water Saved
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-2xl font-bold font-mono text-[#069669] tabular-nums">
                {waterSaved30d}
              </span>
              <span className="text-xs font-mono text-[#069669] font-medium">Liters</span>
            </div>
            <span className="text-[11px] text-[#069669] font-medium mt-1">
              Estimated avoided loss from automated valve cutoffs
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-[#eff4ff] rounded-lg border border-[#c6c6cd]/30 flex items-center gap-2 text-[#45464d] text-xs">
        <span className="material-symbols-outlined text-[#006398] text-[18px]">verified</span>
        <span>Automatic cutoff prevents an average of 42 L of structural water loss per incident.</span>
      </div>
    </section>
  );
};
