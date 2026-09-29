// ============================================================================
// File: BackofficeDashboard.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Backoffice overview: network summary, headline counts and the pending prosumer approval queue.
// References & Citations:
//   - React 18 Lifecycle & Asynchronous State Synchronization:
//     https://react.dev/
//   - Tailwind CSS Grid Layout & KPI Stat Cards:
//     https://tailwindcss.com/
//   - Lucide React Iconography:
//     https://lucide.dev/
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Cpu, Users, CalendarCheck, Clock, CheckCircle2, AlertCircle,
  ArrowUpRight, Zap, BatteryCharging, Activity,
  RefreshCw, Check, ArrowRight
} from 'lucide-react';
import api from '../api/client';

// The overview is a summary: long lists live on their own tabs
const PENDING_PREVIEW_COUNT = 5;

export default function BackofficeDashboard({ setActiveTab, theme }) {
  const [stats, setStats] = useState({
    activeStationsCount: 0,
    pendingProsumersCount: 0,
    activeProsumersCount: 0,
    approvedFutureBookingsCount: 0,
    pendingBookingsCount: 0
  });
  const [pendingProsumers, setPendingProsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [approvingNic, setApprovingNic] = useState(null);
  // Figures derived from real station and booking records (no estimates)
  const [network, setNetwork] = useState({
    totalCapacityKwh: 0,
    totalSlots: 0,
    occupiedSlots: 0,
    openBookings: 0,
    completedKwh: 0
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [statsRes, pendingRes, stationsRes, reservationsRes] = await Promise.all([
        api.get('/reservations/dashboard-stats'),
        api.get('/users/pending-prosumers'),
        api.get('/stations'),
        api.get('/reservations').catch(() => ({ data: [] }))
      ]);
      setStats({
        // Backend counts active stations only
        activeStationsCount: statsRes.data.totalStationsCount || 0,
        pendingProsumersCount: statsRes.data.pendingProsumersCount || 0,
        activeProsumersCount: statsRes.data.activeProsumersCount || 0,
        approvedFutureBookingsCount: statsRes.data.approvedFutureBookingsCount || 0,
        pendingBookingsCount: statsRes.data.pendingBookingsCount || 0
      });
      setPendingProsumers(pendingRes.data || []);

      const activeStations = (stationsRes.data || []).filter((s) => s.isActive);
      const resList = reservationsRes.data || [];
      const totalSlots = activeStations.reduce((acc, s) => acc + (s.totalBatterySlots || 0), 0);
      const freeSlots = activeStations.reduce((acc, s) => acc + (s.availableBatterySlots || 0), 0);

      setNetwork({
        totalCapacityKwh: activeStations.reduce((acc, s) => acc + (s.capacityKwh || 0), 0),
        totalSlots,
        occupiedSlots: Math.max(0, totalSlots - freeSlots),
        openBookings: resList.filter((r) => r.status === 'Approved' || r.status === 'Pending').length,
        completedKwh: resList
          .filter((r) => r.status === 'Completed')
          .reduce((acc, r) => acc + (r.energyAmountKwh || 0), 0)
      });
      setHasLoaded(true);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setLoadError(err.response?.data?.message || 'Could not load the dashboard. Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleQuickApprove = async (nic) => {
    if (approvingNic) return;
    try {
      setApprovingNic(nic);
      setActionError('');
      await api.put(`/users/${nic}/status`, { status: 'Active' });
      setActionSuccess(`Prosumer ${nic} approved and activated.`);
      setTimeout(() => setActionSuccess(''), 3000);
      loadDashboardData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve prosumer.');
      setTimeout(() => setActionError(''), 4000);
    } finally {
      setApprovingNic(null);
    }
  };

  // Show a dash instead of a misleading 0 until the first load finishes
  const display = (value) => (hasLoaded ? value : '—');
  const slotUsagePercent = network.totalSlots > 0 ? Math.round((network.occupiedSlots / network.totalSlots) * 100) : 0;
  const previewProsumers = pendingProsumers.slice(0, PENDING_PREVIEW_COUNT);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-8 sm:p-10 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Backoffice Overview
            </h1>
            <p className="mt-2.5 text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
              Solar hubs, prosumer accounts and energy bookings at a glance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <RefreshCw className={`h-4 w-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              <span>Staff &amp; Operators</span>
              <ArrowRight className="h-4 w-4 text-amber-500" />
            </button>
            <button
              onClick={() => setActiveTab('prosumers')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <span>Manage Prosumers</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-sm font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </span>
          <button
            onClick={loadDashboardData}
            className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* Network summary (all figures come from station and booking records) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="mb-6 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <h3 className="font-display font-bold text-base text-slate-900 dark:text-white tracking-wide">
            Network Summary
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Across active solar hubs</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Station capacity */}
          <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-slate-950/60 border border-amber-500/20">
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
              <Zap className="h-4 w-4" /> Station Capacity
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {display(network.totalCapacityKwh)} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">kWh</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Combined capacity of active hubs</p>
          </div>

          {/* Battery slot usage */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-slate-950/60 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <BatteryCharging className="h-4 w-4" /> Battery Slots in Use
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {display(`${network.occupiedSlots} / ${network.totalSlots}`)}
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden" aria-hidden="true">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-300 h-full rounded-full transition-all duration-700" style={{ width: `${slotUsagePercent}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{display(`${slotUsagePercent}%`)} occupied</p>
          </div>

          {/* Open bookings */}
          <div className="p-4 rounded-2xl bg-cyan-500/5 dark:bg-slate-950/60 border border-cyan-500/20">
            <div className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-semibold">
              <Activity className="h-4 w-4" /> Open Bookings
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {display(network.openBookings)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Pending or approved</p>
          </div>

          {/* Energy delivered */}
          <div className="p-4 rounded-2xl bg-violet-500/5 dark:bg-slate-950/60 border border-violet-500/20">
            <div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Completed Energy
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {display(network.completedKwh.toFixed(1))} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">kWh</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">From completed bookings</p>
          </div>
        </div>
      </div>

      {/* Metric cards (each opens its management tab) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active hubs */}
        <button
          type="button"
          onClick={() => setActiveTab('nodes')}
          className="group text-left w-full p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Cpu className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Solar Hubs</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {display(stats.activeStationsCount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Manage hubs and battery slots</p>
          </div>
        </button>

        {/* Pending prosumers */}
        <button
          type="button"
          onClick={() => setActiveTab('prosumers')}
          className="group text-left w-full p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Clock className="h-6 w-6" />
            </div>
            {hasLoaded && stats.pendingProsumersCount > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                NEEDS REVIEW
              </span>
            ) : (
              <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Prosumers</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {display(stats.pendingProsumersCount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Waiting for Backoffice approval</p>
          </div>
        </button>

        {/* Active prosumers */}
        <button
          type="button"
          onClick={() => setActiveTab('prosumers')}
          className="group text-left w-full p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-emerald-500/40 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Users className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Prosumers</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {display(stats.activeProsumersCount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Approved and able to book</p>
          </div>
        </button>

        {/* Upcoming bookings */}
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className="group text-left w-full p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/40 shadow-sm hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Upcoming Bookings</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {display(stats.approvedFutureBookingsCount)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Approved &bull; {display(stats.pendingBookingsCount)} pending approval
            </p>
          </div>
        </button>
      </div>

      {/* Success / Error Notification Alerts */}
      {actionSuccess && (
        <div role="status" className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Pending Prosumers Quick Action Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">Pending Prosumer Approvals</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              New registrations start as Pending and can't book energy until a Backoffice officer approves them.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('prosumers')}
            className="self-start sm:self-auto shrink-0 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition cursor-pointer"
          >
            View all{pendingProsumers.length > 0 ? ` (${pendingProsumers.length})` : ''} &rarr;
          </button>
        </div>

        {!hasLoaded ? (
          <div className="text-center py-10 text-xs text-slate-400">
            {loading ? 'Loading pending registrations…' : 'Pending registrations are unavailable.'}
          </div>
        ) : pendingProsumers.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">No pending registrations</p>
            <p className="text-xs text-slate-500 mt-1">Every prosumer account has been reviewed.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {previewProsumers.map((prosumer) => (
                <div key={prosumer.nic} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                      {prosumer.fullName?.charAt(0) || 'P'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{prosumer.fullName}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400">
                          {prosumer.nic}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {[prosumer.email, prosumer.phone].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveTab('prosumers')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
                      title="Open the prosumer directory to review documents"
                    >
                      <span>Review</span>
                    </button>
                    <button
                      onClick={() => handleQuickApprove(prosumer.nic)}
                      disabled={approvingNic !== null}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{approvingNic === prosumer.nic ? 'Approving…' : 'Approve'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {pendingProsumers.length > PENDING_PREVIEW_COUNT && (
              <button
                onClick={() => setActiveTab('prosumers')}
                className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer"
              >
                View all {pendingProsumers.length} pending prosumers &rarr;
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
