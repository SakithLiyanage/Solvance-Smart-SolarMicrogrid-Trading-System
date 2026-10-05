// ============================================================================
// File: LandingPage.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Public landing page: what Solvance does, live hub availability, and entry to the staff console.
// References & Citations:
//   - React 18 & Hooks: https://react.dev/
//   - Tailwind CSS: https://tailwindcss.com/
//   - Lucide React Iconography: https://lucide.dev/
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, ArrowRight, ShieldCheck, MapPin, BatteryCharging, QrCode,
  Activity, CheckCircle2, ChevronRight, ExternalLink, Smartphone, AlertCircle
} from 'lucide-react';
import api from '../api/client';

export default function LandingPage({ onGoToLogin, theme, onToggleTheme }) {
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const isDark = theme === 'dark';

  useEffect(() => {
    // Only public data here: /stations is anonymous. Booking data is staff-only (a 401 would
    // also trigger the app's session-expired handling and bounce visitors to the login screen).
    const loadPublicStations = async () => {
      try {
        const stationsRes = await api.get('/stations');
        setStations(Array.isArray(stationsRes.data) ? stationsRes.data : []);
      } catch (err) {
        console.error('Failed to load stations data', err);
        setLoadError(true);
      } finally {
        setLoadingStations(false);
      }
    };
    loadPublicStations();
  }, []);

  // Summary figures come straight from the hubs table; deactivated hubs don't take bookings
  const activeStations = stations.filter((s) => s.isActive);
  const totalCapacityKwh = activeStations.reduce((acc, s) => acc + (s.capacityKwh || 0), 0);
  const totalFreeSlots = activeStations.reduce((acc, s) => acc + (s.availableBatterySlots || 0), 0);
  const inactiveCount = stations.length - activeStations.length;
  const hasStats = !loadingStations && !loadError;

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-amber-500 selection:text-slate-950 transition-colors duration-300 flex flex-col font-sans">
      {/* Dynamic Ambient Background Lights */}
      <div className="fixed top-0 left-1/3 w-[650px] h-[450px] bg-amber-500/10 dark:bg-amber-500/8 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed top-1/2 right-10 w-[550px] h-[400px] bg-emerald-500/10 dark:bg-emerald-500/8 rounded-full blur-[180px] pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 select-none min-w-0">
            <div className="relative flex items-center justify-center shrink-0">
              <img
                src={isDark ? "/solvance_mark_dark_trans.png" : "/solvance_mark_light_trans.png"}
                alt="Solvance Logo"
                className="h-10 w-auto object-contain drop-shadow-sm"
              />
            </div>
            <div className="min-w-0">
              <span className="font-display font-extrabold text-xl tracking-wider text-slate-900 dark:text-white">
                SOLVANCE
              </span>
              <p className="hidden sm:block text-[11px] font-medium text-slate-500 dark:text-slate-400 -mt-0.5 tracking-wide">
                Smart Solar Microgrid Trading
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              How it works
            </button>
            <button onClick={() => scrollToSection('nodes-preview')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              Hubs
            </button>
            <button onClick={() => scrollToSection('benefits')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              Who it's for
            </button>
            <button onClick={() => scrollToSection('mobile-app')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              Android app
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onToggleTheme}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>

            <button
              onClick={onGoToLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <span>Staff sign in</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Main Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight">
          Solar energy, reserved{' '}
          <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
            at your local hub
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl font-normal leading-relaxed">
          Rooftop solar prosumers reserve battery slots at regional microgrid hubs from the Android app. At the hub, a Grid Operator scans the reservation's QR code to complete the energy hand-over.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onGoToLogin}
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-display font-bold text-sm shadow-xl shadow-amber-500/25 transition active:scale-95 flex items-center gap-2.5 cursor-pointer"
          >
            <span>Staff sign in</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollToSection('nodes-preview')}
            className="px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 font-display font-bold text-sm shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <MapPin className="h-4 w-4 text-emerald-500" />
            <span>View hubs</span>
          </button>
          <button
            onClick={() => scrollToSection('mobile-app')}
            className="px-5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 font-display font-bold text-sm transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Smartphone className="h-4 w-4 text-amber-500" />
            <span>Android app</span>
          </button>
        </div>

        {/* Hub network summary (real figures from the hubs table) */}
        <div className="mt-16 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl p-6 sm:p-8 shadow-xl text-left relative overflow-hidden">
          <div className="pb-6 border-b border-slate-200 dark:border-slate-800/80">
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Hub network at a glance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Capacity and free battery slots across active hubs</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 mb-1">
                <MapPin className="h-4 w-4" />
                <span>Active hubs</span>
              </div>
              <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {hasStats ? activeStations.length : '—'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {hasStats && inactiveCount > 0 ? `${inactiveCount} more temporarily inactive` : 'Taking reservations'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                <BatteryCharging className="h-4 w-4" />
                <span>Free battery slots</span>
              </div>
              <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {hasStats ? totalFreeSlots : '—'}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Available for drop-off reservations</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                <Sun className="h-4 w-4" />
                <span>Total hub capacity</span>
              </div>
              <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                {hasStats ? totalCapacityKwh.toLocaleString() : '—'} <span className="text-xs text-slate-500 font-sans">kWh</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Across active hubs</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-slate-900 dark:text-white">
            How Solvance works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            From registration to the energy hand-over at the hub, in three steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/40 transition flex flex-col relative group">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-display font-bold text-xl mb-6 group-hover:scale-105 transition">
              01
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Register in the app
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Sign up in the Android app with your National Identity Card (NIC), your solar system details and supporting documents. A Backoffice officer reviews and activates your account.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>Backoffice approval</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 transition flex flex-col relative group">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-display font-bold text-xl mb-6 group-hover:scale-105 transition">
              02
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Reserve a slot
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Find a hub on the map and reserve an energy drop-off or pick-up up to 7 days ahead. You can change or cancel a reservation until 12 hours before it starts.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>7-day reservation window</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-cyan-500/40 transition flex flex-col relative group">
            <div className="h-14 w-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-display font-bold text-xl mb-6 group-hover:scale-105 transition">
              03
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Show your QR code at the hub
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Once a reservation is approved, the app shows its QR code. The Grid Operator scans it at the hub to complete the hand-over.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400">
              <span>QR check-in</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Hubs Preview */}
      <section id="nodes-preview" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
                Solar hubs
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Free battery slots at each hub right now.
              </p>
            </div>

            <button
              onClick={onGoToLogin}
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 cursor-pointer self-start sm:self-auto"
            >
              <span>Staff: manage hubs</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {loadingStations ? (
              <div className="md:col-span-3 py-12 text-center text-slate-400 text-sm">
                <Activity className="h-6 w-6 text-amber-500 animate-spin mx-auto mb-2" />
                <span>Loading hubs...</span>
              </div>
            ) : loadError ? (
              <div className="md:col-span-3 py-12 text-center text-sm text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <span>Hub information is unavailable right now. Please try again later.</span>
              </div>
            ) : stations.length === 0 ? (
              <div className="md:col-span-3 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                No hubs have been added yet.
              </div>
            ) : (
              stations.map((st) => {
                const totalSlots = st.totalBatterySlots || 0;
                const freeSlots = st.availableBatterySlots || 0;
                // Bar shows the share of slots that are free, matching the "Available" label
                const freePct = totalSlots > 0 ? Math.round((freeSlots / totalSlots) * 100) : 0;

                return (
                  <div key={st.id || st.stationCode} className={`p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition ${st.isActive ? '' : 'opacity-70'}`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {st.stationCode}
                        </span>
                        {st.isActive ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </div>

                      <h4 className="font-display font-bold text-slate-900 dark:text-white text-base">
                        {st.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 min-w-0">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{st.address}</span>
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-slate-500">Capacity</span>
                        <span className="font-bold text-slate-900 dark:text-white">{st.capacityKwh} kWh</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">Battery slots</span>
                          <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">{freeSlots} / {totalSlots} free</span>
                        </div>
                        <div
                          className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-label={`${st.name}: ${freeSlots} of ${totalSlots} battery slots free`}
                          aria-valuemin={0}
                          aria-valuemax={totalSlots}
                          aria-valuenow={freeSlots}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${freePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Who it's for: Prosumers and staff */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Prosumer Card (light gradient in light mode so the dark text stays readable) */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-amber-500/10 to-white dark:via-slate-900/30 dark:to-slate-950 border border-amber-500/20 shadow-xl flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6">
                <Sun className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                For rooftop solar prosumers
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                Reserve battery slots at nearby hubs and keep track of every reservation from your phone.
              </p>

              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Reserve up to 7 days ahead</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Change or cancel until 12 hours before your slot</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>A QR code for every approved reservation</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => scrollToSection('mobile-app')}
              className="mt-8 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Explore mobile client</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Grid Operator & Backoffice Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-white dark:via-slate-900/30 dark:to-slate-950 border border-emerald-500/20 shadow-xl flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                For Grid Operators &amp; Backoffice
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                Manage hubs, approve prosumer accounts and reservations, and check in QR codes at the hub.
              </p>

              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Scan reservation QR codes with a webcam</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Hubs with upcoming reservations can't be deactivated</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>7-day reservation and 12-hour change rules checked automatically</span>
                </li>
              </ul>
            </div>

            <button
              onClick={onGoToLogin}
              className="mt-8 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Staff sign in</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Android App Spotlight */}
      <section id="mobile-app" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-xl space-y-4">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">
              The Solvance Android app
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Manage your profile, find hubs on Google Maps, reserve drop-offs and pick-ups, and show your reservation's QR code at the hub.
            </p>
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Built from <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 font-mono text-[11px]">mobile-client/</code> with Android Studio</span>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-auto flex justify-center">
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xl shadow-2xl max-w-xs w-full text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <QrCode className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-sm text-white">QR pass for each reservation</h4>
              <p className="text-xs text-slate-400">Each approved reservation gets a signed QR code that the Grid Operator scans at the hub.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800/80 py-10 px-4 sm:px-6 lg:px-8 bg-white/60 dark:bg-slate-950/60 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img
              src={isDark ? "/solvance_mark_dark_trans.png" : "/solvance_mark_light_trans.png"}
              alt="Solvance"
              className="h-8 w-auto object-contain"
            />
            <div>
              <p className="font-display font-extrabold text-sm text-slate-900 dark:text-white">SOLVANCE</p>
              <p className="text-[11px] text-slate-500">Smart Solar Microgrid Trading</p>
            </div>
          </div>

          <p className="text-center md:text-right text-[11px] text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Solvance
          </p>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <button onClick={onGoToLogin} className="text-slate-600 dark:text-slate-300 hover:text-amber-500 transition cursor-pointer">
              Staff sign in
            </button>
            <a
              href="https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 dark:text-slate-300 hover:text-amber-500 transition flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
