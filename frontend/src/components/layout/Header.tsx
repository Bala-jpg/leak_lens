import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevices } from '../../context/DeviceContext';
import { useTelemetry } from '../../context/TelemetryContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
  const { devices, selectedDevice, setSelectedDevice } = useDevices();
  const { isLeakActive, lastSyncedAgo, refreshTelemetry, triggerLeakSimulation, resolveLeak } = useTelemetry();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const handleRefresh = () => {
    setIsRotating(true);
    refreshTelemetry();
    setTimeout(() => setIsRotating(false), 600);
  };

  return (
    <header className="h-16 bg-white border-b border-[#c6c6cd]/30 z-30 flex items-center justify-between px-6 w-full shrink-0">
      {/* Left: Device / Location Selector */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setDeviceDropdownOpen(!deviceDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#eff4ff] border border-[#c6c6cd]/50 rounded-lg text-xs font-semibold text-[#0b1c30] hover:bg-[#e5eeff] transition-colors"
          >
            <span className="material-symbols-outlined text-[#006398] text-[18px]">domain</span>
            <span className="truncate max-w-[220px] sm:max-w-[320px]">
              {selectedDevice?.location || 'Main Plant — Bldg 4 (Zone B Risers)'}
            </span>
            <span className="material-symbols-outlined text-[#76777d] text-[16px]">expand_more</span>
          </button>

          {deviceDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-lg shadow-lg border border-[#c6c6cd]/50 py-1.5 z-50">
              <div className="px-3 py-1 text-[11px] font-mono text-[#76777d] uppercase tracking-wider">
                Select Active Device Line
              </div>
              {devices.map((dev) => (
                <button
                  key={dev.id}
                  onClick={() => {
                    setSelectedDevice(dev);
                    setDeviceDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-[#eff4ff] transition-colors ${
                    selectedDevice?.id === dev.id ? 'bg-[#eff4ff] font-semibold text-[#006398]' : 'text-[#0b1c30]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{dev.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      dev.status === 'ONLINE' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {dev.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#76777d] font-normal mt-0.5">{dev.location}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Device Status Tag */}
        <div className="hidden xl:flex items-center gap-3 border-l border-[#c6c6cd]/40 pl-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#45464d]">
            <span className="text-[#0b1c30] font-semibold">{selectedDevice?.id || 'LLS-942-B4'}</span>
          </div>
          {isLeakActive ? (
            <div className="flex items-center gap-1.5 text-[#ba1a1a] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-ping"></span>
              <span>Leak Cutoff Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#069669] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#069669] status-dot-pulse"></span>
              <span>Online</span>
            </div>
          )}
          <div className="text-[#76777d] hidden 2xl:block">
            <span>MQTT/TLS</span>
          </div>
          <div className="text-[#76777d] flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span>{lastSyncedAgo}s ago</span>
          </div>
        </div>
      </div>

      {/* Right Header Utilities */}
      <div className="flex items-center gap-3">
        {/* Quick Simulation State Toggle */}
        <div className="hidden sm:flex items-center bg-[#eff4ff] p-1 rounded-lg border border-[#c6c6cd]/40 text-xs">
          <button
            type="button"
            onClick={isLeakActive ? () => resolveLeak() : triggerLeakSimulation}
            className={`px-2.5 py-1 rounded font-semibold transition-colors flex items-center gap-1.5 ${
              isLeakActive
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-[#0b1c30] hover:bg-slate-50 border border-slate-200'
            }`}
            title="Toggle simulated leak incident to view active leak alert state"
          >
            <span className="material-symbols-outlined text-[15px]">
              {isLeakActive ? 'warning' : 'science'}
            </span>
            <span>{isLeakActive ? 'Active Leak Mode' : 'Simulate Leak'}</span>
          </button>
        </div>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#c6c6cd]/50 hover:bg-[#eff4ff] text-[#45464d] transition-colors"
          title="Refresh Telemetry"
          type="button"
        >
          <span className={`material-symbols-outlined text-[18px] transition-transform duration-500 ${isRotating ? 'rotate-180 text-[#006398]' : ''}`}>
            refresh
          </span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-[#c6c6cd]/50 hover:bg-[#eff4ff] text-[#45464d] transition-colors"
          title="Notifications"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ba1a1a] ring-2 ring-white animate-pulse"></span>
          )}
        </button>

        {/* User Badge */}
        <div
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2.5 pl-2 border-l border-[#c6c6cd]/40 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-[#0f172a] flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {user?.name ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'MC'}
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-xs font-semibold text-[#0b1c30] leading-tight">
              {user?.name || 'Marcus Chen'}
            </span>
            <span className="text-[10px] text-[#76777d] font-mono leading-tight">
              {user?.role || 'Lead Facility Eng.'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
