import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('marcus.chen@leaklens.io');
  const [password, setPassword] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await login(email, password);
    setIsSubmitting(false);
    navigate('/');
  };

  const handleDemoAccess = () => {
    demoLogin();
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9ff] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#c6c6cd]/50 shadow-xl p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <svg className="h-12 w-12" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <h1 className="text-xl font-bold tracking-tight text-[#0b1c30] uppercase">LEAKLENS</h1>
          <p className="text-xs text-[#76777d]">
            IoT Smart Water Leak Detection & Automated Valve Isolation
          </p>
        </div>

        {/* Demo Fast Track Button */}
        <div className="p-3 bg-[#eff4ff] border border-[#c6c6cd]/40 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-[#006398] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span>Quick Demo Fast Track</span>
          </div>
          <p className="text-[11px] text-[#45464d]">
            Experience the complete LeakLens dashboard immediately with pre-configured telemetry and simulated sensors:
          </p>
          <button
            type="button"
            onClick={handleDemoAccess}
            className="w-full py-2 bg-[#006398] hover:bg-[#00476e] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            Launch Demo Workspace
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#76777d]">
          <div className="flex-1 h-px bg-[#e5eeff]"></div>
          <span>Or sign in with credentials</span>
          <div className="flex-1 h-px bg-[#e5eeff]"></div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In to Portal'}
          </button>
        </form>
      </div>
    </div>
  );
};
