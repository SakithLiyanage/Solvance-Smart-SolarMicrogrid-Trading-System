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
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import BackofficeDashboard from './pages/BackofficeDashboard';
import ProsumerManagement from './pages/ProsumerManagement';
import NodeManagement from './pages/NodeManagement';
import OperatorDashboard from './pages/OperatorDashboard';
import StaffManagement from './pages/StaffManagement';
import ReservationManagement from './pages/ReservationManagement';
import { Smartphone } from 'lucide-react';

// Roles allowed into the web console (Prosumers use the Android app)
const STAFF_ROLES = ['Backoffice', 'GridOperator'];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [publicView, setPublicView] = useState('home'); // 'home' | 'login'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('solar_theme') || 'light';
  });

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

  // The API client fires this when the token is rejected (expired or invalid)
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setActiveTab('overview');
      setPublicView('login');
    };
    window.addEventListener('solvance:session-expired', handleSessionExpired);
    return () => window.removeEventListener('solvance:session-expired', handleSessionExpired);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('solar_auth_token');
    localStorage.removeItem('solar_user_data');
    setUser(null);
    setActiveTab('overview');
    setPublicView('home');
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

  // Safety net: a non-staff session must never reach the staff console
  if (!STAFF_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4 shadow-xl">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Smartphone className="h-6 w-6" />
          </div>
          <h1 className="font-display font-bold text-xl">This console is for staff</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The web console is used by Backoffice and Grid Operator staff. Prosumers manage their bookings in the Solvance Android app.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
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

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl py-6 px-4 sm:px-8 relative z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-slate-900 dark:text-white tracking-wider text-sm bg-gradient-to-r from-amber-500 to-amber-400 bg-clip-text text-transparent">
              SOLVANCE
            </span>
            <span>&bull; Smart Solar Microgrid Trading</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
