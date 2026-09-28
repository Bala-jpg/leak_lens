import { Icon } from '../components/Icon';
import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { useTelemetry } from '../context/TelemetryContext';

export const AnalyticsPage: React.FC = () => {
  const { waterSaved30d, waterWasted30d, recentIncidents, flowHistory, cutoffLatency } = useTelemetry();
  const [activeTab, setActiveTab] = useState<'30d' | '90d' | '1y'>('30d');

  const days = activeTab === '30d' ? 30 : activeTab === '90d' ? 90 : 365;
  const since = Date.now() - days * 86400000;
  const periodIncidents = recentIncidents.filter((e) => new Date(e.detectedAt).getTime() >= since);
  const weeklyMap = new Map<string, { name: string; saved: number; lost: number }>();
  for (const incident of periodIncidents) {
    const date = new Date(incident.detectedAt);
    const week = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()).toLocaleDateString();
    const row = weeklyMap.get(week) || { name: week, saved: 0, lost: 0 };
    row.saved += incident.estimatedWaterSavedL; row.lost += incident.waterWastedL;
    weeklyMap.set(week, row);
  }
  const weeklyData = [...weeklyMap.values()];
  const dailyMap = new Map<string, { day: string; normalFlow: number; spikeCutoff: number | null; count: number }>();
  for (const reading of flowHistory.filter((r) => r.timestamp >= since)) {
    const day = new Date(reading.timestamp).toLocaleDateString();
    const row = dailyMap.get(day) || { day, normalFlow: 0, spikeCutoff: null, count: 0 };
    row.normalFlow += reading.outletFlow; row.count++;
    if (reading.difference >= 0.5) row.spikeCutoff = Math.max(row.spikeCutoff || 0, reading.inletFlow);
    dailyMap.set(day, row);
  }
  const dailyUsageData = [...dailyMap.values()].map(({ day, normalFlow, spikeCutoff, count }) => ({ day, normalFlow: normalFlow / count, spikeCutoff }));

  return (
    <div className="w-full pb-8 max-w-7xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#c6c6cd]/40 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0b1c30] tracking-tight">
            Analytics — Water Loss, Usage & Conservation
          </h1>
          <p className="text-xs text-[#76777d] mt-1">
            Quantifying automated valve mitigation efficacy and volumetric baseline trends.
          </p>
        </div>

        <div className="inline-flex p-1 bg-[#eff4ff] rounded-lg border border-[#c6c6cd]/40 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('30d')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === '30d' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setActiveTab('90d')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === '90d' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            Quarterly
          </button>
          <button
            onClick={() => setActiveTab('1y')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === '1y' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            Year-to-Date
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase text-[#76777d] font-semibold">
              Total Water Saved
            </span>
            <Icon name="eco" className="text-[#069669] text-[20px]" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-3xl font-bold font-mono text-[#069669] tabular-nums">
              {waterSaved30d}
            </span>
            <span className="font-mono text-sm text-[#069669] font-medium">Liters</span>
          </div>
          <span className="text-xs text-[#069669] font-medium flex items-center gap-1 mt-1">
            <Icon name="trending_up" className="text-[14px]" />
            Based on recorded incidents
          </span>
        </div>

        <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase text-[#76777d] font-semibold">
              Actual Loss Incurred
            </span>
            <Icon name="water_damage" className="text-[#ba1a1a] text-[20px]" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-3xl font-bold font-mono text-[#ba1a1a] tabular-nums">
              {waterWasted30d}
            </span>
            <span className="font-mono text-sm text-[#45464d] font-medium">Liters</span>
          </div>
          <span className="text-xs text-[#76777d] mt-1">Cumulative loss before shutoff</span>
        </div>

        <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase text-[#76777d] font-semibold">
              Active incident confirmation
            </span>
            <Icon name="timer" className="text-[#006398] text-[20px]" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-3xl font-bold font-mono text-[#0b1c30] tabular-nums">{cutoffLatency == null ? '?' : cutoffLatency.toFixed(1)}</span>
            <span className="font-mono text-sm text-[#45464d] font-medium">seconds</span>
          </div>
          <span className="text-xs text-[#069669] font-medium mt-1">
            Hardware confirmation interval; not physical closure time
          </span>
        </div>

        <div className="bg-white border border-[#c6c6cd]/40 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase text-[#76777d] font-semibold">
              Estimated Loss Avoided
            </span>
            <Icon name="shield" className="text-[#006398] text-[20px]" />
          </div>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className="text-3xl font-bold font-mono text-[#0b1c30] tabular-nums">{waterSaved30d}</span>
            <span className="font-mono text-sm text-[#45464d] font-medium">Liters</span>
          </div>
          <span className="text-xs text-[#76777d] mt-1">Assumes two hours of continued leakage</span>
        </div>
      </div>

      {/* Two Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Weekly Water Conservation Bar Chart */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#c6c6cd]/40 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#e5eeff]">
              <div>
                <h2 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider">
                  Weekly Water Saved vs Actual Loss
                </h2>
                <p className="text-xs text-[#76777d]">
                  Comparing prevented flood volume against pre-cutoff loss per weekly block
                </p>
              </div>
            </div>

            <div className="h-64 w-full select-none pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eff4ff" vertical={false} />
                  <XAxis dataKey="name" stroke="#76777d" fontSize={11} tickLine={false} />
                  <YAxis stroke="#76777d" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}L`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#c6c6cd',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [
                      `${Number(val).toFixed(2)} Liters`,
                      name === 'saved' ? 'Water Saved' : 'Actual Loss',
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="saved" name="Water Saved" fill="#069669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" name="Actual Loss" fill="#ba1a1a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-[#e5eeff] flex items-center justify-between text-xs font-mono text-[#76777d]">
            <span>Savings assumption: 2 hours of continued leakage</span>
            <span className="text-[#069669] font-semibold">Estimated values</span>
          </div>
        </div>

        {/* Daily Usage & Volumetric Balance Line Chart */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#c6c6cd]/40 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#e5eeff]">
              <div>
                <h2 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider">
                  Recent Daily Average Flow
                </h2>
                <p className="text-xs text-[#76777d]">
                  Average of available recent readings; not daily volume
                </p>
              </div>
            </div>

            <div className="h-64 w-full select-none pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsageData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eff4ff" vertical={false} />
                  <XAxis dataKey="day" stroke="#76777d" fontSize={11} tickLine={false} />
                  <YAxis stroke="#76777d" fontSize={11} domain={[0, 20]} tickLine={false} tickFormatter={(v) => `${v}L`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#c6c6cd',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="normalFlow"
                    name="Normal Flow (L/min)"
                    stroke="#006398"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="spikeCutoff"
                    name="Spike Cutoff (L/min)"
                    stroke="#ba1a1a"
                    strokeWidth={0}
                    dot={{ r: 6, fill: '#ba1a1a' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-[#e5eeff] flex items-center justify-between text-xs font-mono text-[#76777d]">
            <span>Recent telemetry only</span>
            <span className="text-[#006398] font-semibold">Sensor flow in L/min</span>
          </div>
        </div>
      </div>

      {/* Incident Log Table */}
      <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider mb-3">
          Historical Incident Audit Log
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#c6c6cd]/40 text-[#76777d] uppercase text-[10px]">
                <th className="py-2.5 pr-3">Incident ID</th>
                <th className="py-2.5 px-3">Device Location</th>
                <th className="py-2.5 px-3">First Observed</th>
                <th className="py-2.5 px-3">Output Confirmation Interval</th>
                <th className="py-2.5 px-3">Water Wasted</th>
                <th className="py-2.5 px-3">Estimated Saved</th>
                <th className="py-2.5 pl-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5eeff]">
              {recentIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-[#eff4ff]/50 transition-colors">
                  <td className="py-3 pr-3 font-semibold text-[#006398]">{inc.id}</td>
                  <td className="py-3 px-3 text-[#0b1c30]">{inc.location || 'Zone B Risers'}</td>
                  <td className="py-3 px-3 text-[#76777d]">
                    {new Date(inc.detectedAt).toLocaleDateString()} {new Date(inc.detectedAt).toLocaleTimeString()}
                    <div className="text-[10px]">{inc.detectionOccurredAt ? `Estimated occurrence: ${new Date(inc.detectionOccurredAt).toLocaleString()}` : 'Occurrence time unknown'}</div>
                  </td>
                    <td className="py-3 px-3 text-[#45464d]">{inc.cutoffLatencySec != null ? inc.cutoffLatencySec.toFixed(1) : '—'}s</td>
                  <td className="py-3 px-3 text-[#ba1a1a] font-semibold">{inc.waterWastedL} L</td>
                  <td className="py-3 px-3 text-[#069669] font-bold">+{inc.estimatedWaterSavedL} L</td>
                  <td className="py-3 pl-3 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-[#85f8c4]/30 text-[#069669]">
                      {inc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
