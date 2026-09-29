// ============================================================================
// File: Login.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Multi-role authentication portal for Backoffice Administrators and Grid Operators.
// References & Citations:
//   - React 18 Hooks & Form State (useState):
//     https://react.dev/reference/react/useState
//   - Lucide React Iconography:
//     https://lucide.dev/
//   - Axios HTTP Client (Interceptors & Token injection):
//     https://axios-http.com/docs/intro
// ============================================================================

import React, { useState } from 'react';
import { 
  Shield, Zap, AlertCircle, ArrowRight, Sun, Moon, 
  Activity, Cpu, Eye, EyeOff, CheckCircle2, XCircle, Lock, Key, Sparkles
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

export default function Login({ onLoginSuccess, theme, onToggleTheme, onBackToHome }) {
  const [usernameOrNic, setUsernameOrNic] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mandatory password change state (when administrator forced reset)
  const [mustChangePasswordModal, setMustChangePasswordModal] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changeError, setChangeError] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  // Policy validation flags for mandatory password change
  const isLengthValid = newPassword.length >= 8;
  const isAlphaNumeric = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isLengthValid && isAlphaNumeric && isMatch;

  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        usernameOrNic: usernameOrNic.trim(),
        password: password
      });

      const { token, role, nic, fullName, email, status, mustChangePassword } = response.data;

      // Ensure only web-authorized roles can access the web console
      if (role !== 'Backoffice' && role !== 'GridOperator') {
        setError('Prosumers must access system services via the Native Android Mobile Application.');
        setLoading(false);
        return;
      }

      // If administrator required mandatory password change on sign-in, intercept session
      if (mustChangePassword) {
        setPendingAuth({ token, role, nic, fullName, email, status });
        setNewPassword('');
        setConfirmPassword('');
        setChangeError('');
        setMustChangePasswordModal(true);
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

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      setChangeError('Please satisfy all password complexity requirements.');
      return;
    }

    setChangeLoading(true);
    setChangeError('');

    try {
      await api.post('/auth/change-password', {
        currentPassword: password,
        newPassword,
        confirmPassword
      }, {
        headers: { Authorization: `Bearer ${pendingAuth.token}` }
      });

      // Complete session sign-in with updated credentials
      const { nic, fullName, email, role, status, token } = pendingAuth;
      localStorage.setItem('solar_auth_token', token);
      localStorage.setItem('solar_user_data', JSON.stringify({ nic, fullName, email, role, status }));
      setMustChangePasswordModal(false);
      onLoginSuccess({ nic, fullName, email, role, status });
    } catch (err) {
      setChangeError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden select-none transition-colors duration-300">
      
      {/* Floating Top Controls: Return to Landing and Theme Toggle */}
      <div className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between">
        {onBackToHome ? (
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-md transition active:scale-95 cursor-pointer text-xs font-bold hover:text-amber-500"
          >
            <span>&larr; Public Network Portal</span>
          </button>
        ) : <div />}

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
        {/* Brand Header with Exact Horizontal Logo */}
        <div className="text-center">
          <div className="relative inline-block group cursor-pointer" onClick={onBackToHome}>
            <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/30 to-emerald-500/30 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
            
            <img
              src={isDark ? "/solvance_logo_dark_trans.png" : "/solvance_logo_light_trans.png"}
              alt="Solvance Smart Solar Trading"
              className="relative h-20 sm:h-24 object-contain mx-auto drop-shadow-lg transition transform group-hover:scale-105 duration-300"
            />
          </div>
          
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/80 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-sm mt-3 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>Enterprise Grid Operations Portal</span>
            </div>
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
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/70 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
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
          </div>
        </div>
      </div>

      {/* Modal: Mandatory First-Sign-In Password Change */}
      <Modal
        isOpen={mustChangePasswordModal}
        onClose={() => setMustChangePasswordModal(false)}
        title="Mandatory Password Update Required"
      >
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Key className="h-3.5 w-3.5 text-amber-500" />
            <span>Account: {pendingAuth?.nic} ({pendingAuth?.role})</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Your temporary password was provisioned by a system administrator. Enterprise security policy requires you to establish a personal confidential password before accessing the operational console.
          </p>
        </div>

        {changeError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {changeError}
          </div>
        )}

        <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Personal Password *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 alphanumeric characters)"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                title={showNewPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {showNewPassword ? (
                  <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Personal Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password to verify"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Validation Criteria */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Password Complexity Requirements:
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {isLengthValid ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className={isLengthValid ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {isAlphaNumeric ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className={isAlphaNumeric ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                Contains both letters and numbers
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {isMatch ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className={isMatch ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                Passwords match
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMustChangePasswordModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeLoading || !isFormValid}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {changeLoading ? 'Updating Credentials...' : 'Set Password & Enter Console'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
