import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useTelemetry } from '../../context/TelemetryContext';

export const FlowChart: React.FC = () => {
  const { flowHistory, inletFlow, outletFlow } = useTelemetry();
  const [range, setRange] = useState<'5m' | '1h' | '24h'>('5m');

  return (
    <section className="w-full bg-white rounded-xl border border-[#c6c6cd]/40 shadow-xs p-5 mb-4">
      {/* Chart Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#e5eeff]">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0b1c30]">
              Live Water Flow (Inlet vs Outlet)
            </h2>
            <span className="text-[11px] font-mono font-semibold bg-[#85f8c4]/30 text-[#069669] px-2 py-0.5 rounded">
              Realtime 3s
            </span>
          </div>
          <p className="text-xs text-[#76777d] mt-0.5">
            Comparing water entering versus exiting the zone in real time. Divergence indicates a leak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-xs bg-[#006398]"></span>
              <span className="text-[#0b1c30] font-medium">Inlet (~{inletFlow.toFixed(1)} L/min)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-xs bg-[#5bb8fe]"></span>
              <span className="text-[#0b1c30] font-medium">Outlet (~{outletFlow.toFixed(1)} L/min)</span>
            </div>
          </div>

          <div className="inline-flex bg-[#eff4ff] p-0.5 rounded text-xs font-semibold">
            <button
              onClick={() => setRange('5m')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                range === '5m'
                  ? 'bg-white shadow-xs text-[#0b1c30]'
                  : 'text-[#76777d] hover:text-[#0b1c30]'
              }`}
              type="button"
            >
              Live (5m)
            </button>
            <button
              onClick={() => setRange('1h')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                range === '1h'
                  ? 'bg-white shadow-xs text-[#0b1c30]'
                  : 'text-[#76777d] hover:text-[#0b1c30]'
              }`}
              type="button"
            >
              1 Hour
            </button>
            <button
              onClick={() => setRange('24h')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                range === '24h'
                  ? 'bg-white shadow-xs text-[#0b1c30]'
                  : 'text-[#76777d] hover:text-[#0b1c30]'
              }`}
              type="button"
            >
              24 Hours
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full select-none pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={flowHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eff4ff" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#76777d"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e5eeff' }}
            />
            <YAxis
              stroke="#76777d"
              fontSize={11}
              domain={[0, 16]}
              tickLine={false}
              axisLine={{ stroke: '#e5eeff' }}
              tickFormatter={(v) => `${v}L`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#c6c6cd',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
              formatter={(value: any, name: any) => [
                `${Number(value).toFixed(2)} L/min`,
                name === 'inletFlow' ? 'Inlet Flow' : 'Outlet Flow',
              ]}
            />
            <Line
              type="monotone"
              dataKey="inletFlow"
              stroke="#006398"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#006398', stroke: '#fff', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="outletFlow"
              stroke="#5bb8fe"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: '#5bb8fe', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
