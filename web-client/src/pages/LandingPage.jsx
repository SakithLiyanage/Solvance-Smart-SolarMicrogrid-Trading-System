/**
 * Solvance Smart Solar Microgrid Trading System — Public Portal & Landing Page
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 * Authors:
 *   - M.L. Booso (IT23452916) - User Identity & Security Lead
 *   - G.L.S. Chanlaka (IT23151260) - Station Geolocation & Maps Lead
 *   - L.T. Jayawardhana (IT23156760) - Reservations & Rules Engine Lead
 *   - H.N. Madubashini (IT23192300) - Operator Terminal & QR Telemetry Lead
 */

import React, { useState, useEffect } from 'react';
import { 
  Zap, Sun, Moon, ArrowRight, ShieldCheck, Cpu, 
  MapPin, BatteryCharging, QrCode, Activity, Sparkles, 
  Layers, CheckCircle2, ChevronRight, ExternalLink, Globe,
  Users, BarChart3
} from 'lucide-react';
import api from '../api/client';

export default function LandingPage({ onGoToLogin, theme, onToggleTheme }) {
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);

  useEffect(() => {
    const loadPublicStations = async () => {
      try {
        const res = await api.get('/stations');
        setStations(res.data || []);
      } catch (err) {
        console.error('Failed to load public stations', err);
      } finally {
        setLoadingStations(false);
      }
    };
    loadPublicStations();
  }, []);

  const totalPvCapacity = stations.reduce((acc, s) => acc + (s.capacityKwh || 0), 0);
  const totalFreeSlots = stations.reduce((acc, s) => acc + (s.availableBatterySlots || 0), 0);

  const teamRoster = [
    {
      itNumber: 'IT23452916',
      name: 'M.L. Booso',
      role: 'User Identity & Auth Lead',
      focus: 'JWT RBAC Security, NIC Verification, Prosumer Lifecycle',
      color: 'from-amber-500 to-amber-600'
    },
    {
      itNumber: 'IT23151260',
      name: 'G.L.S. Chanlaka',
      role: 'Station Geolocation & Maps Lead',
      focus: 'Google Maps SDK, OpenStreetMap Fallback, Microgrid Hub Nodes',
      color: 'from-emerald-500 to-emerald-600'
    },
    {
      itNumber: 'IT23156760',
      name: 'L.T. Jayawardhana',
      role: 'Reservations & Rule Engine Lead',
      focus: 'Pending/Approved State Machine, 12h Modification Window, Slot Quotas',
      color: 'from-cyan-500 to-blue-600'
    },
    {
      itNumber: 'IT23192300',
      name: 'H.N. Madubashini',
      role: 'Operator Terminal & QR Telemetry Lead',
      focus: 'Holographic Scanner, Cryptographic QR Tokens, Telemetry Dashboard',
      color: 'from-violet-500 to-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-amber-500 selection:text-slate-950 transition-colors duration-300 flex flex-col">
      {/* Top Ambient Lights */}
      <div className="fixed top-0 left-1/4 w-[700px] h-[450px] bg-amber-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed top-1/3 right-10 w-[600px] h-[400px] bg-emerald-500/10 rounded-full blur-[180px] pointer-events-none" />

      {/* Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Zap className="h-6 w-6 text-amber-400 fill-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-xl tracking-tight bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                  SOLVANCE
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  SLIIT SE4040
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-0.5">Smart Solar Microgrid Trading System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleTheme}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
            </button>

            <button
              onClick={onGoToLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Operator &amp; Admin Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Next-Generation Decentralized Peer-to-Peer Clean Energy Exchange</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-black tracking-tight text-slate-900 dark:text-white max-w-4xl">
          Solar Power Traded{' '}
          <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
            Democratically
          </span>{' '}
          Across Sri Lanka
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl font-sans">
          Empowering residential rooftop prosumers to feed surplus photovoltaic energy into regional microgrid battery hubs, verified through tamper-proof cryptographic QR tokens.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onGoToLogin}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-display font-extrabold text-sm shadow-xl shadow-amber-500/25 transition active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <span>Launch Web Control Center</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 font-display font-bold text-sm shadow-sm transition active:scale-95 flex items-center gap-2"
          >
            <Globe className="h-4 w-4 text-emerald-500" />
            <span>GitHub Repository</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </a>
        </div>

        {/* Live Network Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 w-full max-w-5xl">
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Active Solar Hubs</div>
            <div className="text-2xl sm:text-3xl font-display font-black text-amber-500">{stations.length || 5} Nodes</div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>100% Operational Status</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">PV Generation Capacity</div>
            <div className="text-2xl sm:text-3xl font-display font-black text-emerald-500">{totalPvCapacity || 2500} kW</div>
            <div className="text-[11px] text-slate-500 mt-1">Solar Photovoltaic Infeed</div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Available Storage Slots</div>
            <div className="text-2xl sm:text-3xl font-display font-black text-cyan-500">{totalFreeSlots || 85} Slots</div>
            <div className="text-[11px] text-slate-500 mt-1">Dynamic Slot Allocation</div>
          </div>

          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-xl">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Security Token Protocol</div>
            <div className="text-2xl sm:text-3xl font-display font-black text-violet-500">AES-HMAC</div>
            <div className="text-[11px] text-slate-500 mt-1">Tamper-Proof QR Tokens</div>
          </div>
        </div>
      </section>

      {/* Architecture Showcase */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-display font-black tracking-tight text-slate-900 dark:text-white">
            Engineered for Enterprise Microgrid Operations
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Four specialized technical modules operating concurrently to manage decentralized solar distribution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-amber-500/40 transition duration-300 flex flex-col">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Prosumer Identity &amp; Auth</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              National Identity Card (NIC) validated onboarding, strict role-based access control, and SQLite local encrypted caching for offline readiness.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
              M.L. Booso (IT23452916)
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-emerald-500/40 transition duration-300 flex flex-col">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Station Geolocation &amp; Maps</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Google Maps Android SDK v2 integration with live OpenStreetMap fallbacks, Colombo station pins, interactive detail bottom-sheets, and distance calculation.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              G.L.S. Chanlaka (IT23151260)
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-cyan-500/40 transition duration-300 flex flex-col">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
              <BatteryCharging className="h-6 w-6" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Reservations &amp; Rule Engine</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Central business logic enforcing Pending/Approved lifecycle, strict 12-hour modification cutoff, and preventing node deactivation with scheduled trades.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              L.T. Jayawardhana (IT23156760)
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm hover:border-violet-500/40 transition duration-300 flex flex-col">
            <div className="h-12 w-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
              <QrCode className="h-6 w-6" />
            </div>
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">Operator Holographic Scanner</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">
              Physical dispatch terminal decoding cryptographically signed QR tokens upon physical energy drop-off to finalize transactions in real-time.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-violet-600 dark:text-violet-400 font-semibold">
              H.N. Madubashini (IT23192300)
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Microgrid Hubs Preview */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Network Topology
              </span>
              <h3 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">
                Active Solar Microgrid Hubs (Western Province)
              </h3>
            </div>
            <button
              onClick={onGoToLogin}
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              <span>Manage Nodes in Backoffice</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stations.slice(0, 3).map((st) => (
              <div key={st.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {st.stationCode}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Operational
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{st.name}</h4>
                <p className="text-xs text-slate-500 truncate">{st.address}</p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex justify-between text-xs font-mono">
                  <span className="text-slate-500">{st.capacityKwh} kW Output</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{st.availableBatterySlots} slots free</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Academic Attribution & Team Roster */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                SLIIT Academic Accreditation
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white">
              SE4040 — Enterprise Application Development
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Faculty of Computing, Sri Lanka Institute of Information Technology (SLIIT). Individual research, design, implementation, and empirical verification roster.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {teamRoster.map((m) => (
                <div key={m.itNumber} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 backdrop-blur-md">
                  <div className="font-mono text-xs font-bold text-amber-400">{m.itNumber}</div>
                  <div className="font-bold text-sm text-white mt-0.5">{m.name}</div>
                  <div className="text-[11px] font-semibold text-emerald-400 mt-0.5">{m.role}</div>
                  <p className="text-[10px] text-slate-400 mt-2">{m.focus}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800/80 py-8 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-slate-950/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Solvance Smart Solar Microgrid Trading System &bull; SE4040 SLIIT</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onGoToLogin} className="hover:text-amber-500 font-bold transition cursor-pointer">
              Operator Login
            </button>
            <a 
              href="https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-amber-500 font-bold transition flex items-center gap-1"
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
