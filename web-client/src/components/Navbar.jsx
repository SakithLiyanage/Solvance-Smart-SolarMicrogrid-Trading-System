// ============================================================================
// File: Navbar.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Modern navigation header with role-based routing, theme switching, and responsive layout.
// References & Citations:
//   - Tailwind CSS Responsive Navbar:
//     https://tailwindcss.com/
//   - Lucide React Iconography:
//     https://lucide.dev/
// ============================================================================

import React from 'react';
import {
  Sun, Moon, LogOut, Cpu, LayoutDashboard, Users,
  CalendarClock, Radio, Zap
} from 'lucide-react';

export default function Navbar({ user, activeTab, setActiveTab, onLogout, theme, onToggleTheme }) {
  const isBackoffice = user?.role === 'Backoffice';
  const isDark = theme === 'dark';

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 transition-colors duration-300 shadow-xs">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">

          {/* 1. Left: Brand & Standalone Logo Mark */}
          <div
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0 group"
            onClick={() => setActiveTab('overview')}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition duration-300" />
              <img
                src={isDark ? "/solvance_mark_dark_trans.png" : "/solvance_mark_light_trans.png"}
                alt="Solvance"
                className="relative h-10 sm:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-lg sm:text-xl tracking-wider text-slate-900 dark:text-white">
                SOLVANCE
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 hidden sm:inline-block">
                {user?.role === 'Backoffice' ? 'Backoffice' : 'Grid Operator'}
              </span>
            </div>
          </div>

          {/* 2. Center: Navigation Tabs (Backoffice only) */}
          {isBackoffice && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shrink-0">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${activeTab === 'overview'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('prosumers')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${activeTab === 'prosumers'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Prosumers</span>
              </button>

              <button
                onClick={() => setActiveTab('nodes')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${activeTab === 'nodes'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>Solar Nodes</span>
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${activeTab === 'staff'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Staff &amp; Operators</span>
              </button>

              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${activeTab === 'bookings'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Bookings</span>
              </button>
            </nav>
          )}

          {/* 3. Right: Theme Toggle, User Profile & Always-Visible Sign Out */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">

            {/* Theme Toggle (Light / Dark Mode) */}
            <button
              onClick={onToggleTheme}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-800 transition active:scale-95 shadow-xs cursor-pointer shrink-0"
            >
              {isDark ? (
                <Sun className="h-4 w-4 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 transition-transform hover:-rotate-12" />
              )}
            </button>

            {/* Divider */}
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block shrink-0" />

            {/* User Profile Avatar & Name */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-bold text-xs shadow-xs shrink-0 select-none"
                title={`${user?.fullName} (${user?.nic})`}
              >
                {getInitials(user?.fullName)}
              </div>

              <div className="hidden xl:block text-left leading-tight max-w-[120px] 2xl:max-w-[160px]">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  {user?.fullName || 'User'}
                </p>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {user?.nic}
                </p>
              </div>
            </div>

            {/* Always Visible Logout Button */}
            <button
              onClick={onLogout}
              title="Disconnect & Sign Out"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/25 transition active:scale-95 shrink-0 cursor-pointer text-xs font-bold"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}