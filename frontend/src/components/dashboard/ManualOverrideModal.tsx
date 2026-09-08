import React, { useState } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

interface Props {
  onClose: () => void;
}

export const ManualOverrideModal: React.FC<Props> = ({ onClose }) => {
  const { manualOverrideValve } = useTelemetry();
  const [reason, setReason] = useState('');

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    manualOverrideValve();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
          <div className="flex items-center gap-2 text-red-700">
            <span className="material-symbols-outlined text-[20px]">warning</span>
            <h3 className="text-sm font-bold leading-tight">Confirm Manual Valve Override</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Manual override will immediately command the motorized shutoff valve to <strong>RE-OPEN</strong> at 100% stroke, allowing water to flow back into the line.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Override Authorization Rationale
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Line physically inspected; false trigger"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Confirm Override & Open Valve
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
