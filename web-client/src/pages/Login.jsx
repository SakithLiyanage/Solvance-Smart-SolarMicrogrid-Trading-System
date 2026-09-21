import React, { useState } from 'react';
import { 
  Shield, Zap, AlertCircle, ArrowRight, Sun, Moon, 
  Activity, Cpu, Sparkles 
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import api from '../api/client';

export default function Login({ onLoginSuccess, theme, onToggleTheme }) {
  const [usernameOrNic, setUsernameOrNic] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState('admin');

  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        usernameOrNic: usernameOrNic.trim(),
        password: password
      });

      const { token, role, nic, fullName, email, status } = response.data;

      // Ensure only web-authorized roles can access the web console
      if (role !== 'Backoffice' && role !== 'GridOperator') {
        setError('Prosumers must access system services via the Native Android Mobile Application.');
        setLoading(false);
        return;
      }

      localStorage.setItem('solar_auth_token', token);
      localStorage.setItem('solar_user_data', JSON.stringify({ nic, fullName, email, role, status }));
      onLoginSuccess({ nic, fullName, email, role, status });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setQuickCredentials = (userType) => {
    setSelectedRole(userType);
    if (userType === 'admin') {
      setUsernameOrNic('ADMIN001');
      setPassword('Admin@123');
    } else {
      setUsernameOrNic('OPERATOR001');
      setPassword('Operator@123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none transition-colors duration-300">
      
      {/* Floating Theme Toggle (Light Mode / Dark Mode) */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-amber-400 shadow-md transition active:scale-95 cursor-pointer text-xs font-bold"
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Dynamic Ambient Background Elements */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-amber-500/10 dark:bg-amber-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-1/2 -right-40 w-[550px] h-[550px] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-[150px] pointer-events-none animate-float-slow" />
      <div className="absolute -bottom-32 left-1/3 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header with Context-Aware Logo */}
        <div className="text-center">
          <div className="relative inline-block group">
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition duration-500" />
            
            <BrandLogo 
              className="relative h-24 sm:h-28 mx-auto transition transform group-hover:scale-105 duration-300"
              showTagline={false}
              isDark={isDark}
            />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/80 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-sm mt-3 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span>Enterprise Grid Operations Portal</span>
          </div>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-amber-500/20 via-slate-400/10 to-emerald-500/20 dark:from-amber-500/20 dark:via-slate-800 dark:to-emerald-500/20 rounded-3xl blur-sm opacity-60 group-hover:opacity-100 transition duration-500" />
          
          <div className="relative bg-white/90 dark:bg-slate-900/85 backdrop-blur-2xl py-8 px-6 sm:px-9 rounded-3xl border border-slate-200/90 dark:border-slate-800/80 shadow-xl dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] transition-colors duration-300">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Staff Authentication</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Sign in with Backoffice Admin or Grid Operator credentials</p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Staff Identifier (NIC or Email)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={usernameOrNic}
                    onChange={(e) => setUsernameOrNic(e.target.value)}
                    placeholder="e.g. ADMIN001 or OPERATOR001"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/70 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Secure Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/70 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-inner"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 relative overflow-hidden group/btn flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 shadow-md shadow-amber-500/25 transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <span>{loading ? 'Verifying Credentials...' : 'Authenticate & Access Console'}</span>
                {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />}
              </button>
            </form>

            {/* Quick Demo Credentials Switcher */}
            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 text-center">
                Select Pre-Configured Demo Persona:
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setQuickCredentials('admin')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition border ${
                    selectedRole === 'admin'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <span>Backoffice Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuickCredentials('operator')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition border ${
                    selectedRole === 'operator'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Zap className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  <span>Grid Operator</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Grid Metrics Ticker */}
        <div className="grid grid-cols-3 gap-2 px-2 text-center text-xs">
          <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 backdrop-blur-md shadow-sm">
            <div className="font-display font-bold text-amber-500 dark:text-amber-400 text-sm">24.5 MWh</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Solar Traded</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 backdrop-blur-md shadow-sm">
            <div className="font-display font-bold text-emerald-500 dark:text-emerald-400 text-sm">100% FAT</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Service Rule Engine</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 backdrop-blur-md shadow-sm">
            <div className="font-display font-bold text-cyan-500 dark:text-cyan-400 text-sm">8 Nodes</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Microgrid Online</div>
          </div>
        </div>
      </div>
    </div>
  );
}
