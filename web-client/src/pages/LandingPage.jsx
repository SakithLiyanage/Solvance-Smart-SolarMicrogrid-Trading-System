// ============================================================================
// File: LandingPage.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Modern, consumer-friendly public web portal & landing page showcasing decentralized solar microgrid trading in Sri Lanka.
// References & Citations:
//   - React 18 & Hooks: https://react.dev/
//   - Tailwind CSS: https://tailwindcss.com/
//   - Lucide React Iconography: https://lucide.dev/
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Zap, Sun, Moon, ArrowRight, ShieldCheck, Cpu, 
  MapPin, BatteryCharging, QrCode, Activity, Sparkles, 
  Layers, CheckCircle2, ChevronRight, ExternalLink, Globe,
  Users, BarChart3, Smartphone, Clock, Shield, ArrowUpRight,
  ChevronDown, Flame, Leaf, Gauge
} from 'lucide-react';
import api from '../api/client';

export default function LandingPage({ onGoToLogin, theme, onToggleTheme }) {
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [selectedStationFilter, setSelectedStationFilter] = useState('All');
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [reservations, setReservations] = useState([]);

  const isDark = theme === 'dark';

  useEffect(() => {
    const loadPublicStations = async () => {
      try {
        const [stationsRes, reservationsRes] = await Promise.all([
          api.get('/stations'),
          api.get('/reservations').catch(() => ({ data: [] }))
        ]);
        if (stationsRes.data && stationsRes.data.length > 0) {
          setStations(stationsRes.data);
        }
        if (reservationsRes.data && Array.isArray(reservationsRes.data)) {
          setReservations(reservationsRes.data);
        }
      } catch (err) {
        console.error('Failed to load stations data', err);
      } finally {
        setLoadingStations(false);
      }
    };
    loadPublicStations();
  }, []);

  const totalPvCapacity = stations.reduce((acc, s) => acc + (s.capacityKwh || 0), 0);
  const totalFreeSlots = stations.reduce((acc, s) => acc + (s.availableBatterySlots || 0), 0);
  const totalCompletedKwh = reservations
    .filter(r => r.status === 'Completed')
    .reduce((acc, r) => acc + (r.energyAmountKwh || 0), 0);
  const estimatedCo2Offset = +((totalCompletedKwh > 0 ? totalCompletedKwh * 0.0007 : totalPvCapacity * 0.008) || 12.4).toFixed(1);

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 select-none">
            <div className="relative flex items-center justify-center">
              <img 
                src={isDark ? "/solvance_mark_dark_trans.png" : "/solvance_mark_light_trans.png"} 
                alt="Solvance Logo" 
                className="h-10 w-auto object-contain drop-shadow-sm" 
              />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-wider text-slate-900 dark:text-white">
                SOLVANCE
              </span>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 -mt-0.5 tracking-wide">
                Smart Solar Microgrid Trading
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              How It Works
            </button>
            <button onClick={() => scrollToSection('nodes-preview')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              Solar Hubs
            </button>
            <button onClick={() => scrollToSection('benefits')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              Prosumer Benefits
            </button>
            <button onClick={() => scrollToSection('mobile-app')} className="hover:text-amber-500 dark:hover:text-amber-400 transition cursor-pointer">
              Mobile App
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleTheme}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>

            <button
              onClick={() => setShowMobileModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-500" />
              <span>Get Android App</span>
            </button>

            <button
              onClick={onGoToLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Console Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Top Feature Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-6 shadow-xs animate-in fade-in">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Decentralized Peer-to-Peer Clean Energy Exchange • Sri Lanka</span>
        </div>

        {/* Main Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight">
          Solar Power Traded{' '}
          <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
            Directly in Your Community
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl font-normal leading-relaxed">
          Empowering residential rooftop solar prosumers to feed surplus photovoltaic energy into regional microgrid battery hubs, verified through tamper-proof cryptographic QR tokens.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onGoToLogin}
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-display font-extrabold text-sm shadow-xl shadow-amber-500/25 transition active:scale-95 flex items-center gap-2.5 cursor-pointer"
          >
            <span>Launch Web Console</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollToSection('nodes-preview')}
            className="px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 font-display font-bold text-sm shadow-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <MapPin className="h-4 w-4 text-emerald-500" />
            <span>Explore Solar Hubs</span>
          </button>
          <button
            onClick={() => setShowMobileModal(true)}
            className="px-5 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 hover:bg-slate-200 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800/80 font-display font-bold text-sm transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Smartphone className="h-4 w-4 text-amber-500" />
            <span>Prosumer Mobile App</span>
          </button>
        </div>

        {/* Hero Live Grid Telemetry Dashboard Mockup Card */}
        <div className="mt-16 w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-2xl p-6 sm:p-8 shadow-xl text-left relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  Live Microgrid Power Flow &amp; Regional Harvest
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aggregated real-time solar generation across Sri Lanka nodes</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                <Sun className="h-4 w-4" />
                <span>Live Grid Capacity</span>
              </div>
              <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 font-mono">
                {totalPvCapacity.toLocaleString() || '1,650'} <span className="text-xs text-slate-500 font-sans">kW</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Installed station capacity</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                <BatteryCharging className="h-4 w-4" />
                <span>Available Slots</span>
              </div>
              <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 font-mono">
                {totalFreeSlots} <span className="text-xs text-slate-500 font-sans">Slots Free</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Ready for drop-off booking</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 mb-1">
                <MapPin className="h-4 w-4" />
                <span>Active Hubs</span>
              </div>
              <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 font-mono">
                {stations.length || 4} <span className="text-xs text-slate-500 font-sans">Nodes</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Colombo, Kandy, Galle</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400 mb-1">
                <Leaf className="h-4 w-4" />
                <span>CO₂ Offset</span>
              </div>
              <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1 font-mono">
                {estimatedCo2Offset} <span className="text-xs text-slate-500 font-sans">Tons</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Clean energy generated</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Simple 3-Step Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-slate-900 dark:text-white mt-4">
            How Solvance Decentralized Trading Works
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            From residential rooftop generation to instant microgrid settlement in three effortless steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/40 transition flex flex-col relative group">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-display font-black text-xl mb-6 group-hover:scale-105 transition">
              01
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Onboard Rooftop Array
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Register via the native Android app using your National Identity Card (NIC). Configure your solar array kW capacity and inverter serial number for fast KYC activation.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>National ID Verification</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 transition flex flex-col relative group">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-display font-black text-xl mb-6 group-hover:scale-105 transition">
              02
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Schedule Energy Drop-Off
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Browse interactive map nodes and reserve battery infeed slots up to 7 days in advance. Modify or reschedule anytime up to 12 hours before your window.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>7-Day Booking Window</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-cyan-500/40 transition flex flex-col relative group">
            <div className="h-14 w-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-display font-black text-xl mb-6 group-hover:scale-105 transition">
              03
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              QR Verification &amp; Payout
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Present your tamper-proof cryptographic QR token at the microgrid terminal. The station operator validates the drop-off in seconds to credit your account.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400">
              <span>Cryptographic QR Validation</span>
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Microgrid Nodes Explorer Preview */}
      <section id="nodes-preview" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Network Infrastructure
              </span>
              <h3 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
                Active Solar Microgrid Hubs
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Regional charging nodes and battery stations connected to the Solvance exchange.
              </p>
            </div>

            <button
              onClick={onGoToLogin}
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 cursor-pointer self-start sm:self-auto"
            >
              <span>Manage Nodes in Backoffice</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {loadingStations ? (
              <div className="col-span-3 py-12 text-center text-slate-400">
                <Activity className="h-6 w-6 text-amber-500 animate-spin mx-auto mb-2" />
                <span>Loading live station grid...</span>
              </div>
            ) : (
              stations.map((st) => {
                const totalSlots = st.totalBatterySlots || 20;
                const freeSlots = st.availableBatterySlots || 0;
                const usedPct = Math.round(((totalSlots - freeSlots) / totalSlots) * 100);

                return (
                  <div key={st.id || st.stationCode} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {st.stationCode}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          Operational
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-slate-900 dark:text-white text-base">
                        {st.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{st.address}</span>
                      </p>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-500">Solar Infeed:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{st.capacityKwh} kW</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500">Storage Slots</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{freeSlots} / {totalSlots} Available</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.max(10, usedPct)}%` }}
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

      {/* Prosumer & Operator Benefits Showcase */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Prosumer Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-amber-500/10 via-slate-900/30 to-slate-950 border border-amber-500/20 shadow-xl flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-6">
                <Sun className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white">
                For Rooftop Solar Prosumers
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                Transform excess solar irradiation into tangible community value. Book scheduled drops with 100% transparency.
              </p>

              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Transparent 7-day advance booking window</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Fair energy credits verified by cryptographic QR tokens</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Offline-ready mobile app with SQLite session caching</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowMobileModal(true)}
              className="mt-8 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Download Prosumer App</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Grid Operator Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-slate-900/30 to-slate-950 border border-emerald-500/20 shadow-xl flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white">
                For Grid Operators &amp; Backoffice
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                Complete operational visibility over regional battery nodes, prosumer KYC onboarding, and physical QR drop-offs.
              </p>

              <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Holographic optical QR scanner terminal for real-time validation</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Active reservation guards preventing node deactivation with scheduled trades</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Enterprise rules engine enforcing strict 12h schedule lifecycle</span>
                </li>
              </ul>
            </div>

            <button
              onClick={onGoToLogin}
              className="mt-8 self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Access Operator Terminal</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Mobile App Spotlight */}
      <section id="mobile-app" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-white shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-xl space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Pure Native Android SDK + SQLite
            </span>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-white">
              Power in Your Pocket with the Solvance Android App
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Seamlessly manage your rooftop solar profile, schedule drop-offs at nearby nodes using Google Maps, and generate offline cryptographic QR codes anywhere in Sri Lanka.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <button
                onClick={() => setShowMobileModal(true)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Smartphone className="h-4 w-4" />
                <span>Download Android Client APK</span>
              </button>
            </div>
          </div>

          <div className="w-full lg:w-auto flex justify-center">
            <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 backdrop-blur-xl shadow-2xl max-w-xs w-full text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <QrCode className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-sm text-white">Instant QR Generation</h4>
              <p className="text-xs text-slate-400">Offline ZXing QR generator for tamper-proof drop-offs at solar stations.</p>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-[11px] text-emerald-400">
                SECURE AES-HMAC TOKEN
              </div>
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
              <p className="font-display font-black text-sm text-slate-900 dark:text-white">SOLVANCE</p>
              <p className="text-[11px] text-slate-500">Smart Solar Microgrid Trading Platform</p>
            </div>
          </div>

          {/* System Attribution */}
          <div className="text-center md:text-right text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p className="font-medium text-[11px]">Decentralized Clean Energy Trading Network</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              &copy; {new Date().getFullYear()} Solvance Microgrid System. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <button onClick={onGoToLogin} className="text-slate-600 dark:text-slate-300 hover:text-amber-500 transition cursor-pointer">
              Console Login
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

      {/* Mobile App Information Modal */}
      {showMobileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Solvance Mobile Client</h3>
                  <p className="text-xs text-slate-500">Android SDK • Pure Java &amp; SQLite</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              The Solvance Prosumer Android application is located in the repository under <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-amber-500">mobile-client/</code>. Build and launch directly via Android Studio to run on real hardware or emulator.
            </p>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
                <span>Architecture</span>
                <span className="font-mono text-amber-500 font-bold">Native Java + SQLite</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
                <span>Map Provider</span>
                <span className="font-mono text-emerald-500 font-bold">Google Maps SDK v2</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium">
                <span>QR Engine</span>
                <span className="font-mono text-cyan-500 font-bold">ZXing Embedded</span>
              </div>
            </div>

            <button
              onClick={() => setShowMobileModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition active:scale-95 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
