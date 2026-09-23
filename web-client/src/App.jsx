/**
 * Solvance Web Client — Grid Management & Administration Console
 * Authors:
 *   - M.L. Booso (IT23452916) - Prosumer & Auth Portals
 *   - G.L.S. Chanlaka (IT23151260) - Station Nodes & Google Maps
 *   - L.T. Jayawardhana (IT23156760) - Reservations & Rules View
 *   - H.N. Madubashini (IT23192300) - Operator & Telemetry Views
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Third-Party Libraries:
 * - React 18: https://react.dev/
 * - Tailwind CSS: https://tailwindcss.com/
 * - Lucide React (Icons): https://lucide.dev/
 * - Vite Build Tool: https://vitejs.dev/
 */

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Modal from './components/Modal';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import BackofficeDashboard from './pages/BackofficeDashboard';
import ProsumerManagement from './pages/ProsumerManagement';
import NodeManagement from './pages/NodeManagement';
import OperatorDashboard from './pages/OperatorDashboard';
import StaffManagement from './pages/StaffManagement';
import ReservationManagement from './pages/ReservationManagement';
import api from './api/client';
import { UserPlus, Shield, Zap, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [publicView, setPublicView] = useState('home'); // 'home' | 'login'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('solar_theme') || 'dark';
  });

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    nic: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'GridOperator'
  });
  const [staffSuccess, setStaffSuccess] = useState('');
  const [staffError, setStaffError] = useState('');

  // Synchronize HTML element class with selected theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('solar_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('solar_user_data');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('solar_user_data');
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('solar_auth_token');
    localStorage.removeItem('solar_user_data');
    setUser(null);
    setActiveTab('overview');
    setPublicView('home');
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffError('');
    setStaffSuccess('');

    try {
      await api.post('/auth/register-staff', staffForm);
      setStaffSuccess(`New ${staffForm.role} account created for ${staffForm.fullName} (${staffForm.nic}).`);
      setStaffForm({
        nic: '',
        fullName: '',
        email: '',
        phone: '',
        password: '',
        role: 'GridOperator'
      });
      setTimeout(() => {
        setIsStaffModalOpen(false);
        setStaffSuccess('');
      }, 2000);
    } catch (err) {
      setStaffError(err.response?.data?.message || 'Failed to create staff account.');
    }
  };

  if (!user) {
    if (publicView === 'home') {
      return (
        <LandingPage
          onGoToLogin={() => setPublicView('login')}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      );
    }
    return (
      <Login 
        onLoginSuccess={(userData) => setUser(userData)} 
        theme={theme}
        onToggleTheme={toggleTheme}
        onBackToHome={() => setPublicView('home')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col relative selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden transition-colors duration-300">
      {/* Dynamic Background Ambient Gradients */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[400px] bg-amber-500/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Navigation Bar with Theme Toggle */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        onOpenCreateStaff={() => setIsStaffModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {activeTab === 'overview' && (
          user.role === 'Backoffice' ? (
            <BackofficeDashboard setActiveTab={setActiveTab} theme={theme} />
          ) : (
            <OperatorDashboard user={user} theme={theme} activeTab={activeTab} />
          )
        )}

        {activeTab === 'prosumers' && user.role === 'Backoffice' && (
          <ProsumerManagement theme={theme} />
        )}

        {activeTab === 'nodes' && user.role === 'Backoffice' && (
          <NodeManagement theme={theme} />
        )}

        {activeTab === 'staff' && user.role === 'Backoffice' && (
          <StaffManagement theme={theme} currentUser={user} />
        )}

        {activeTab === 'bookings' && (
          user.role === 'Backoffice' ? (
            <ReservationManagement theme={theme} />
          ) : (
            <OperatorDashboard user={user} theme={theme} activeTab={activeTab} />
          )
        )}
      </main>

      {/* Modern Status Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl py-6 px-4 sm:px-8 relative z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-slate-900 dark:text-white tracking-wider text-sm bg-gradient-to-r from-amber-500 to-amber-400 bg-clip-text text-transparent">
              SOLVANCE
            </span>
            <span>&bull; Smart Solar Microgrid Trading Platform</span>
            <span className="hidden md:inline">&bull; Decentralized Clean Energy Network (2026)</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              FAT-Service API: Online
            </span>
            <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400"></span>
              MongoDB Atlas: Connected
            </span>
          </div>
        </div>
      </footer>

      {/* Modal: Create Staff User (Backoffice Only) */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title="Provision New Staff Account"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Specification Rule: Backoffice administrators provision authorized system accounts for Backoffice and Grid Operator personnel.
        </p>

        {staffSuccess && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>{staffSuccess}</span>
          </div>
        )}

        {staffError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium animate-in fade-in">
            {staffError}
          </div>
        )}

        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Staff NIC</label>
              <input
                type="text"
                required
                placeholder="e.g. 198512345678"
                value={staffForm.nic}
                onChange={(e) => setStaffForm({ ...staffForm, nic: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Role</label>
              <select
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="GridOperator">Grid Operator</option>
                <option value="Backoffice">Backoffice Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Legal Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Anura Bandara"
              value={staffForm.fullName}
              onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="staff@solargrid.lk"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                placeholder="+94771234567"
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Temporary Access Password</label>
            <input
              type="password"
              required
              placeholder="Minimum 6 characters"
              value={staffForm.password}
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition active:scale-95 shadow-lg shadow-amber-500/20"
            >
              Provision Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
