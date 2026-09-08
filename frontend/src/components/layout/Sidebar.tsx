import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { unreadCount } = useNotifications();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors bg-[#e5eeff] text-[#0b1c30] font-semibold border-l-2 border-[#006398]'
      : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#45464d] hover:bg-[#eff4ff] hover:text-[#0b1c30] transition-colors font-medium';

  return (
    <aside className="w-64 bg-white border-r border-[#c6c6cd]/40 flex flex-col justify-between shrink-0 select-none z-20 min-h-screen">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[#c6c6cd]/30">
          <svg className="h-8 w-8 shrink-0 select-none" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" x="4" y="4" rx="6" fill="#0F172A" />
            <path
              d="M20 9C20 9 13 18 13 22.5C13 26.0899 15.9101 29 19.5 29C23.0899 29 26 26.0899 26 22.5C26 18 20 9 20 9Z"
              fill="#0284C7"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="20" cy="22" r="2.5" fill="#FFFFFF" />
            <path
              d="M11 20L8 20M32 20L29 20M20 7L20 4M20 33L20 30"
              stroke="#0284C7"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col justify-center min-w-0">
            <span className="font-bold text-sm text-[#0b1c30] tracking-tight uppercase leading-none">
              LEAKLENS
            </span>
            <span className="text-[11px] font-mono text-[#76777d] leading-none mt-1 truncate">
              Telemetry v2.4
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 p-3 mt-1 text-[13px]">
          <NavLink to="/" end className={navItemClass}>
            <span className="material-symbols-outlined text-[20px]">grid_view</span>
            <span>Overview</span>
          </NavLink>

          <NavLink to="/analytics" className={navItemClass}>
            <span className="material-symbols-outlined text-[20px]">monitoring</span>
            <span>Analytics</span>
          </NavLink>

          <NavLink to="/notifications" className={navItemClass}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span>Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="text-[11px] font-semibold bg-[#ba1a1a] text-white px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
          </NavLink>

          <NavLink to="/devices" className={navItemClass}>
            <span className="material-symbols-outlined text-[20px]">developer_board</span>
            <span>Devices</span>
          </NavLink>

          <NavLink to="/settings" className={navItemClass}>
            <span className="material-symbols-outlined text-[20px]">tune</span>
            <span>Profile / Settings</span>
          </NavLink>
        </nav>
      </div>

      {/* Bottom Section: Edge Gateway & Sign Out */}
      <div className="flex flex-col border-t border-[#c6c6cd]/30 p-3 bg-white">
        <div className="p-3 bg-[#eff4ff] border border-[#c6c6cd]/40 rounded-lg flex flex-col gap-1.5 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#45464d] uppercase tracking-wider font-mono">
              Edge Gateway
            </span>
            <span className="flex items-center gap-1 text-[11px] text-[#069669] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#069669] animate-pulse"></span>
              Online
            </span>
          </div>
          <div className="flex items-center justify-between text-[#0b1c30] text-[12px] font-mono">
            <span className="text-[#76777d]">Latency</span>
            <span className="font-semibold">18ms</span>
          </div>
          <div className="flex items-center justify-between text-[#0b1c30] text-[12px] font-mono">
            <span className="text-[#76777d]">Uptime</span>
            <span className="font-semibold">99.98%</span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 text-[#45464d] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 rounded-lg transition-colors text-[13px] font-medium w-full text-left"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
