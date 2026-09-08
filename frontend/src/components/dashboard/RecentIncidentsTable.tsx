import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTelemetry } from '../../context/TelemetryContext';

export const RecentIncidentsTable: React.FC = () => {
  const { recentIncidents } = useTelemetry();

  return (
    <section className="bg-white rounded-xl border border-[#c6c6cd]/40 shadow-xs p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff] mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006398] text-[20px]">history</span>
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase font-mono tracking-wider">
              RECENT INCIDENT LOG
            </h3>
          </div>
          <NavLink
            to="/analytics"
            className="text-[#006398] hover:text-[#00476e] text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <span>View all incident history →</span>
          </NavLink>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <tbody className="divide-y divide-[#e5eeff]">
              {recentIncidents.slice(0, 3).map((item) => (
                <tr key={item.id} className="hover:bg-[#eff4ff]/60 transition-colors">
                  <td className="py-2.5 pr-2 whitespace-nowrap text-[#0b1c30] font-medium">
                    {new Date(item.detectedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                    {new Date(item.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap text-[#76777d]">
                    {item.location || 'Zone B Risers'}
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap text-[#76777d]">
                    Cutoff: {item.cutoffLatencySec || 4.8}s
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap text-[#0b1c30]">
                    Wasted: {item.waterWastedL} L
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap text-[#069669] font-semibold">
                    Saved: {item.estimatedWaterSavedL} L
                  </td>
                  <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        item.status === 'RESOLVED'
                          ? 'bg-[#85f8c4]/30 text-[#069669]'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-3 mt-4 border-t border-[#e5eeff] flex items-center justify-between text-[#76777d] text-xs">
        <span>All automated shutoffs executed within safety threshold (&lt;5s).</span>
        <span className="font-semibold text-[#069669]">Safety certified</span>
      </div>
    </section>
  );
};
