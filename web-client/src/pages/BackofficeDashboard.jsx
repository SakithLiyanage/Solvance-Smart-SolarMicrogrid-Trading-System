// ============================================================================
// File: BackofficeDashboard.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Backoffice executive console displaying system-wide microgrid KPI telemetry and pending reservation management.
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
  Cpu, Users, CalendarCheck, Clock, CheckCircle2, AlertTriangle, 
  ArrowUpRight, ShieldCheck, Zap, BatteryCharging, Sun, Activity, 
  RefreshCw, Check, ArrowRight
} from 'lucide-react';
import api from '../api/client';

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
  const [actionSuccess, setActionSuccess] = useState('');
  const [telemetry, setTelemetry] = useState({
    solarOutputKw: 428.5,
    batteryStoragePercent: 86,
    activeGridTrades: 12,
    carbonOffsetKg: 1840
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, pendingRes, stationsRes, reservationsRes] = await Promise.all([
        api.get('/reservations/dashboard-stats'),
        api.get('/users/pending-prosumers'),
        api.get('/stations'),
        api.get('/reservations').catch(() => ({ data: [] }))
      ]);
      setStats({
        activeStationsCount: statsRes.data.totalStationsCount || 0,
        pendingProsumersCount: statsRes.data.pendingProsumersCount || 0,
        activeProsumersCount: statsRes.data.activeProsumersCount || 0,
        approvedFutureBookingsCount: statsRes.data.approvedFutureBookingsCount || 0,
        pendingBookingsCount: statsRes.data.pendingBookingsCount || 0
      });
      setPendingProsumers(pendingRes.data || []);

      const stList = stationsRes.data || [];
      const resList = reservationsRes.data || [];
      const totalCapacity = stList.reduce((acc, s) => acc + (s.capacityKwh || 0), 0);
      const totalSlots = stList.reduce((acc, s) => acc + (s.totalBatterySlots || 0), 0);
      const freeSlots = stList.reduce((acc, s) => acc + (s.availableBatterySlots || 0), 0);
      const activeTradesCount = resList.filter(r => r.status === 'Approved' || r.status === 'Pending').length;
      const completedKwh = resList
        .filter(r => r.status === 'Completed')
        .reduce((acc, r) => acc + (r.energyAmountKwh || 0), 0);

      const socPercent = totalSlots > 0 ? Math.round(((totalSlots - freeSlots) / totalSlots) * 100) : 0;
      const carbonSavedKg = Math.round(completedKwh > 0 ? completedKwh * 0.7 : (totalCapacity > 0 ? totalCapacity * 1.1 : 1840));

      setTelemetry({
        solarOutputKw: totalCapacity || 1650,
        batteryStoragePercent: socPercent || 65,
        activeGridTrades: activeTradesCount,
        carbonOffsetKg: carbonSavedKg
      });
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const [actionError, setActionError] = useState('');

  const handleQuickApprove = async (nic) => {
    try {
      setActionError('');
      await api.put(`/users/${nic}/status`, { status: 'Active' });
      setActionSuccess(`Prosumer ${nic} approved and activated.`);
      setTimeout(() => setActionSuccess(''), 3000);
      loadDashboardData();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve prosumer.');
      setTimeout(() => setActionError(''), 4000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-10 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-4 backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>Enterprise Grid Brokerage Engine</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight leading-tight">
              Microgrid Command &amp; Energy Brokerage
            </h1>
            <p className="mt-2.5 text-slate-300 text-sm sm:text-base leading-relaxed">
              Real-time monitoring of decentralized solar station nodes, prosumer trading accounts, and strict enforcement of the 7-day booking lifecycle.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs font-bold transition shadow-sm active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Metrics</span>
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs font-bold transition shadow-sm active:scale-95"
            >
              <span>Staff &amp; Operators</span>
              <ArrowRight className="h-4 w-4 text-amber-400" />
            </button>
            <button
              onClick={() => setActiveTab('prosumers')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              <span>Manage Prosumers</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Microgrid Power Flow Telemetry Widget */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <h3 className="font-display font-bold text-base text-slate-900 dark:text-white tracking-wide">
              Live Microgrid Generation &amp; Storage Telemetry
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Solar Gen */}
          <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-slate-950/60 border border-amber-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5"><Sun className="h-4 w-4 animate-spin" style={{ animationDuration: '12s' }} /> Solar Output</span>
              <span className="font-mono text-[11px] bg-amber-500/10 px-2 py-0.5 rounded-full">+4.2%</span>
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {telemetry.solarOutputKw} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">kW</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-1000" style={{ width: '78%' }} />
            </div>
          </div>

          {/* Battery Storage */}
          <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-slate-950/60 border border-emerald-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5"><BatteryCharging className="h-4 w-4" /> Battery SOC</span>
              <span className="font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded-full">CHARGING</span>
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {telemetry.batteryStoragePercent}% <span className="text-sm font-normal text-slate-500 dark:text-slate-400">Capacity</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-300 h-full rounded-full transition-all duration-1000" style={{ width: `${telemetry.batteryStoragePercent}%` }} />
            </div>
          </div>

          {/* Active Grid Trades */}
          <div className="p-4 rounded-2xl bg-cyan-500/5 dark:bg-slate-950/60 border border-cyan-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-cyan-600 dark:text-cyan-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5"><Activity className="h-4 w-4" /> Active Trades</span>
              <span className="font-mono text-[11px] bg-cyan-500/10 px-2 py-0.5 rounded-full">PEER-TO-PEER</span>
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {telemetry.activeGridTrades} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">Sessions</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500 to-cyan-300 h-full rounded-full" style={{ width: '60%' }} />
            </div>
          </div>

          {/* Carbon Offset */}
          <div className="p-4 rounded-2xl bg-violet-500/5 dark:bg-slate-950/60 border border-violet-500/20 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-violet-600 dark:text-violet-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Eco Impact</span>
              <span className="font-mono text-[11px] bg-violet-500/10 px-2 py-0.5 rounded-full">CO₂ SAVED</span>
            </div>
            <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-2">
              {telemetry.carbonOffsetKg} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">kg</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-violet-300 h-full rounded-full" style={{ width: '85%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Active Nodes */}
        <div 
          onClick={() => setActiveTab('nodes')}
          className="group p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Cpu className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Solar Hub Nodes</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {stats.activeStationsCount}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Deactivation Safeguard Active
            </p>
          </div>
        </div>

        {/* Pending Prosumers */}
        <div 
          onClick={() => setActiveTab('prosumers')}
          className="group p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Clock className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
              ACTION REQUIRED
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pending Approvals</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {stats.pendingProsumersCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">NIC Primary Key accounts waiting</p>
          </div>
        </div>

        {/* Active Prosumers */}
        <div 
          onClick={() => setActiveTab('prosumers')}
          className="group p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-emerald-500/40 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
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
              {stats.activeProsumersCount}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verified via Mobile Client
            </p>
          </div>
        </div>

        {/* Confirmed Bookings */}
        <div 
          onClick={() => setActiveTab('bookings')}
          className="group p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-cyan-500/40 shadow-sm hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform">
              <CalendarCheck className="h-6 w-6" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Future Bookings</p>
            <div className="text-3xl font-display font-black text-slate-900 dark:text-white mt-1">
              {stats.approvedFutureBookingsCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Enforced within 7-day schedule</p>
          </div>
        </div>
      </div>

      {/* Success / Error Notification Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-500 dark:text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Pending Prosumers Quick Action Card */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-white">Pending Prosumer Approvals</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Specification Rule: Prosumers register in Pending state and require Backoffice approval.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('prosumers')}
            className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition"
          >
            View Full Directory &rarr;
          </button>
        </div>

        {pendingProsumers.length === 0 ? (
          <div className="text-center py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">All Prosumer Accounts Approved</p>
            <p className="text-xs text-slate-500 mt-1">No pending registrations awaiting Backoffice review.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800/80">
            {pendingProsumers.map((prosumer) => (
              <div key={prosumer.nic} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                    {prosumer.fullName?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{prosumer.fullName}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400">
                        {prosumer.nic}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{prosumer.email} &bull; {prosumer.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('prosumers')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
                  >
                    <span>Inspect e-KYC</span>
                  </button>
                  <button
                    onClick={() => handleQuickApprove(prosumer.nic)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}