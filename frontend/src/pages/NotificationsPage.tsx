import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useDevices } from '../context/DeviceContext';
import type { NotificationItem } from '../types';

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { devices } = useDevices();

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'critical'>('all');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread' && item.readStatus) return false;
    if (activeTab === 'critical' && item.type !== 'LEAK_DETECTED' && item.type !== 'VALVE_CUTOFF') return false;
    if (deviceFilter !== 'all' && item.deviceId !== deviceFilter) return false;
    return true;
  });

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'LEAK_DETECTED':
        return <span className="material-symbols-outlined text-red-600 text-[20px]">warning</span>;
      case 'VALVE_CUTOFF':
        return <span className="material-symbols-outlined text-amber-600 text-[20px]">power_settings_new</span>;
      case 'DEVICE_OFFLINE':
        return <span className="material-symbols-outlined text-slate-600 text-[20px]">cloud_off</span>;
      case 'LEAK_RESOLVED':
        return <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>;
      default:
        return <span className="material-symbols-outlined text-sky-600 text-[20px]">info</span>;
    }
  };

  return (
    <div className="w-full pb-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#c6c6cd]/40 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-[#76777d] mt-1">
            Real-time event ledger, differential alarm logs, and automated valve cutoff receipts.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllAsRead()}
            className="px-3.5 py-2 text-xs font-semibold text-[#006398] hover:bg-[#eff4ff] border border-[#c6c6cd]/50 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs & Device Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-[#eff4ff] rounded-lg border border-[#c6c6cd]/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'all' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            All Events
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unread')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'unread' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('critical')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'critical' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            Critical Alarms
          </button>
        </div>

        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-white border border-[#c6c6cd]/50 rounded-lg text-[#0b1c30] font-medium"
        >
          <option value="all">All Devices</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-xl border border-[#c6c6cd]/40 shadow-xs divide-y divide-[#e5eeff] overflow-hidden">
        {filteredNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#76777d]">
            No notifications found matching the selected filters.
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-4.5 flex items-start justify-between gap-4 transition-colors ${
                !notif.readStatus ? 'bg-[#eff4ff]/40' : 'hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">{getIcon(notif.type)}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0b1c30] uppercase font-mono tracking-wider">
                      {notif.type.replace('_', ' ')}
                    </span>
                    {!notif.readStatus && (
                      <span className="w-2 h-2 rounded-full bg-[#006398]"></span>
                    )}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {notif.deviceId}
                    </span>
                  </div>
                  <p className="text-xs text-[#45464d] leading-relaxed">{notif.message}</p>
                  <span className="text-[11px] font-mono text-[#76777d] block pt-0.5">
                    {new Date(notif.createdAt).toLocaleDateString()} at{' '}
                    {new Date(notif.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {!notif.readStatus && (
                <button
                  type="button"
                  onClick={() => markAsRead(notif.id)}
                  className="px-2.5 py-1 text-[11px] text-[#006398] hover:bg-[#eff4ff] rounded border border-[#c6c6cd]/40 font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
