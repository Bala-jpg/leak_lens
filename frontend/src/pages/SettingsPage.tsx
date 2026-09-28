import { Icon } from '../components/Icon';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import axios from 'axios';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('leaklens_theme') === 'dark' ? 'dark' : 'light');

  const changeTheme = (nextTheme: 'light' | 'dark') => {
    setTheme(nextTheme);
    localStorage.setItem('leaklens_theme', nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  };

  // Profile Form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user?.name, user?.email]);

  // Settings switches
  const [notifyLeak, setNotifyLeak] = useState(true);
  const [notifyCutoff, setNotifyCutoff] = useState(true);
  const [notifyOffline, setNotifyOffline] = useState(true);
  const [notifyResolved, setNotifyResolved] = useState(true);

  // Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setSaveSuccess(false);
    try { await updateProfile(name.trim(), email.trim()); setError(''); setSaveSuccess(true); }
    catch (cause) {
      setError(axios.isAxiosError(cause) && cause.response?.status === 409
        ? 'That email address is already in use.'
        : 'Could not save profile. Please try again.');
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError('');
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setPasswordModalOpen(false); setOldPassword(''); setNewPassword(''); setPasswordSuccess(true);
    } catch (cause) {
      setPasswordError(axios.isAxiosError(cause) && cause.response?.status === 401
        ? 'Current password is incorrect.'
        : 'Could not change password. Please try again.');
    } finally { setSavingPassword(false); }
  };

  return (
    <div className="w-full pb-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="pb-5 border-b border-[#c6c6cd]/40">
        <h1 className="text-2xl font-bold text-[#0b1c30] tracking-tight">Profile / Settings</h1>
        <p className="text-xs text-[#76777d] mt-1">
          Manage your account credentials, preferences, and hardware calibration parameters.
        </p>

        <div className="inline-flex p-1 bg-[#eff4ff] rounded-lg border border-[#c6c6cd]/40 text-xs font-semibold mt-4">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'profile' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'settings' ? 'bg-white text-[#0b1c30] shadow-xs' : 'text-[#76777d]'
            }`}
          >
            System Preferences
          </button>
        </div>
      </div>

      {activeTab === 'profile' ? (
        <div className="space-y-5">
          {/* User Card */}
          <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-6 flex items-center gap-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#0f172a] text-white font-semibold flex items-center justify-center text-base shrink-0">
              {name ? name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'MC'}
            </div>
            <div>
              <div className="text-base font-bold text-[#0b1c30]">{name}</div>
              <div className="text-xs text-[#76777d]">{email}</div>
            </div>
          </div>

          {/* Personal Information Form */}
          <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider pb-3 border-b border-[#e5eeff]">
              Personal Information
            </h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs text-slate-800 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {saveSuccess && (
                  <span className="text-xs text-emerald-600 font-medium">Changes saved successfully.</span>
                )}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="ml-auto bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Security */}
          <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-6 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-[#0b1c30]">Password</div>
              <div className="text-[#76777d] font-mono text-sm tracking-wider">••••••••••••</div>
            </div>
            <button
              type="button"
              onClick={() => setPasswordModalOpen(true)}
              className="border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Change Password
            </button>
          </div>
          {passwordSuccess && <p role="status" className="text-xs text-emerald-700">Password changed successfully.</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* General Preferences */}
          <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider pb-3 border-b border-[#e5eeff]">
              General Settings
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Interface Theme</div>
                  <div className="text-[11px] text-[#76777d]">Application appearance mode</div>
                </div>
                <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold" role="group" aria-label="Interface theme">
                  <button type="button" aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${theme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}>Light</button>
                  <button type="button" aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}
                    className={`px-2.5 py-1 rounded cursor-pointer ${theme === 'dark' ? 'bg-slate-600 text-white shadow-xs' : 'text-slate-500'}`}>Dark</button>
                </div>
              </div>

              <div className="pt-3 border-t border-[#e5eeff] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Flow Rate Unit</div>
                  <div className="text-[11px] text-[#76777d]">Real-time instantaneous telemetry</div>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200 font-semibold">
                  L/min
                </span>
              </div>

              <div className="pt-3 border-t border-[#e5eeff] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Cumulative Volume Unit</div>
                  <div className="text-[11px] text-[#76777d]">Aggregated consumption and savings</div>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-xs rounded border border-slate-200 font-semibold">
                  Litres
                </span>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider pb-1">
              Notification Preferences
            </h2>
            <p className="text-xs text-[#76777d] pb-2 border-b border-[#e5eeff]">
              Notification preferences are not configurable yet. Hardware leak alerts remain enabled.
            </p>

            <div className="divide-y divide-[#e5eeff] text-xs">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Leak Detected Alert</div>
                  <div className="text-[#76777d] text-[11px]">Differential spike exceeded threshold</div>
                </div>
                <input
                  type="checkbox"
                  disabled
                  checked={notifyLeak}
                  onChange={(e) => setNotifyLeak(e.target.checked)}
                  className="w-4 h-4 accent-slate-900 cursor-pointer"
                />
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Automatic Cutoff Executed</div>
                  <div className="text-[#76777d] text-[11px]">Motorized valve closed automatically</div>
                </div>
                <input
                  type="checkbox"
                  disabled
                  checked={notifyCutoff}
                  onChange={(e) => setNotifyCutoff(e.target.checked)}
                  className="w-4 h-4 accent-slate-900 cursor-pointer"
                />
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Device Offline / Fault</div>
                  <div className="text-[#76777d] text-[11px]">Hardware heartbeat missed</div>
                </div>
                <input
                  type="checkbox"
                  disabled
                  checked={notifyOffline}
                  onChange={(e) => setNotifyOffline(e.target.checked)}
                  className="w-4 h-4 accent-slate-900 cursor-pointer"
                />
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Incident Resolved</div>
                  <div className="text-[#76777d] text-[11px]">Operator marked issue as addressed</div>
                </div>
                <input
                  type="checkbox"
                  disabled
                  checked={notifyResolved}
                  onChange={(e) => setNotifyResolved(e.target.checked)}
                  className="w-4 h-4 accent-slate-900 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Hardware Calibration Parameters */}
          <div className="bg-white rounded-xl border border-[#c6c6cd]/40 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#0b1c30] uppercase font-mono tracking-wider pb-1">
              Leak Detection Calibration Parameters
            </h2>
            <p className="text-xs text-[#76777d] pb-2 border-b border-[#e5eeff]">
              Calibrated on edge micro-controller firmware.
            </p>

            <div className="divide-y divide-[#e5eeff] text-xs">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Flow Difference Threshold</div>
                  <div className="text-[#76777d] text-[11px]">Minimum variance triggering leak alarm</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#0b1c30]">0.5 L/min</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono border border-slate-200">
                    Read only
                  </span>
                </div>
              </div>

              <div className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Leak Confirmation Duration</div>
                  <div className="text-[#76777d] text-[11px]">Continuous check interval before valve cutoff</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#0b1c30]">3 seconds</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-mono border border-slate-200">
                    Read only
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              <button
                onClick={() => setPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordError && <p role="alert" className="text-xs text-red-700">{passwordError}</p>}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Current Password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
