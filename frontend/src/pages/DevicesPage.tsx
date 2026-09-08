import React, { useState } from 'react';
import { useDevices } from '../context/DeviceContext';
import { useTelemetry } from '../context/TelemetryContext';
import type { Device } from '../types';

export const DevicesPage: React.FC = () => {
  const { devices, addDevice, updateDevice, deleteDevice, toggleValve } = useDevices();
  const { inletFlow, outletFlow, flowDifference } = useTelemetry();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Form states for add device
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // Form states for edit device
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newLocation) return;
    const res = await addDevice(newName, newLocation);
    setCreatedKey(res.rawKey);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDevice && editName && editLocation) {
      await updateDevice(editingDevice.id, editName, editLocation);
      setEditingDevice(null);
    }
  };

  return (
    <div className="w-full pb-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between pb-5 border-b border-[#c6c6cd]/40">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">Devices</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#eff4ff] text-[#006398] border border-[#c6c6cd]/40 font-mono">
              {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}
            </span>
          </div>
          <p className="text-xs text-[#76777d] mt-1">
            Manage hardware telemetry monitors, flow sensors, and motorized shutoff valves.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewName('');
            setNewLocation('');
            setCreatedKey(null);
            setAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0f172a] hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Add Device</span>
        </button>
      </div>

      {/* Device Cards Grid */}
      <div className="grid grid-cols-1 gap-4">
        {devices.map((device) => {
          const isArmed = device.valveState === 'OPEN';
          return (
            <div
              key={device.id}
              className="bg-white rounded-xl border border-[#c6c6cd]/50 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:border-[#006398]/50"
            >
              {/* Left Info */}
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#eff4ff] border border-[#c6c6cd]/40 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#006398] text-[24px]">
                    developer_board
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#0b1c30]">{device.name}</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {device.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                        device.status === 'ONLINE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          device.status === 'ONLINE' ? 'bg-emerald-500 status-dot-pulse' : 'bg-rose-500'
                        }`}
                      ></span>
                      {device.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#76777d] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">location_on</span>
                    <span>{device.location}</span>
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-[#45464d]">
                    <div>
                      Inlet:{' '}
                      <span className="font-semibold text-[#0b1c30]">
                        {inletFlow.toFixed(1)} L/min
                      </span>
                    </div>
                    <div>
                      Outlet:{' '}
                      <span className="font-semibold text-[#0b1c30]">
                        {outletFlow.toFixed(1)} L/min
                      </span>
                    </div>
                    <div>
                      Diff:{' '}
                      <span className="font-semibold text-[#069669]">
                        +{flowDifference.toFixed(1)} L/min
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-[#e5eeff]">
                {/* Valve Toggle Action */}
                <button
                  type="button"
                  onClick={() => toggleValve(device.id, isArmed ? 'CLOSED' : 'OPEN')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isArmed
                      ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isArmed ? 'power_settings_new' : 'lock_open'}
                  </span>
                  <span>{isArmed ? 'Emergency Cutoff' : 'Open Valve (Arm)'}</span>
                </button>

                {/* Edit Button */}
                <button
                  type="button"
                  onClick={() => {
                    setEditingDevice(device);
                    setEditName(device.name);
                    setEditLocation(device.location);
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  title="Edit Device"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${device.name}? This will remove telemetry monitoring.`)) {
                      deleteDevice(device.id);
                    }
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  title="Delete Device"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Device */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Provision New LeakLens Device</h3>
              <button
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {createdKey ? (
              <div className="p-6 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Device Provisioned Successfully!
                  </div>
                  <p className="text-emerald-800">
                    Flash this Secret Device Key onto your micro-controller/gateway firmware for API authentication:
                  </p>
                  <div className="p-2.5 bg-white border border-emerald-300 rounded font-mono text-emerald-950 font-semibold break-all select-all">
                    {createdKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateDevice} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Device Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zone C Kitchen Main Riser"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Physical Location</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Building C, Floor 2 Service Shaft"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Create & Generate Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Edit Device */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Edit Device Details</h3>
              <button
                onClick={() => setEditingDevice(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Device Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Location</label>
                <input
                  type="text"
                  required
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
