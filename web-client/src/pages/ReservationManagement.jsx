// ============================================================================
// File: ReservationManagement.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: L.T. Jayawardhana (IT23156760)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Backoffice Energy Reservation Management & 7-Day / 12-Hour Rule Enforcement Ledger.
// References & Citations:
//   - React 18 Dynamic State & Hooks (useState, useEffect, useMemo):
//     https://react.dev/
//   - Tailwind CSS Complex Operational Ledger & Filter Controls:
//     https://tailwindcss.com/
//   - Lucide React Iconography:
//     https://lucide.dev/
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, Search,
  Filter, Plus, RefreshCw, Zap, BatteryCharging, ArrowUpDown,
  ShieldCheck, AlertCircle, ShieldAlert, Check, X, Eye, FileText
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

export default function ReservationManagement({ theme }) {
  const [reservations, setReservations] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [stationFilter, setStationFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDaysFilter, setSelectedDaysFilter] = useState('All'); // 'All' | 'Next48h' | 'Within7Days'

  // Action states
  const [selectedRes, setSelectedRes] = useState(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });

  // Create booking form
  const [createForm, setCreateForm] = useState({
    prosumerNic: '',
    stationId: '',
    scheduledDateTime: '',
    energyAmountKwh: 15,
    tradeType: 'DropOff'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [resResponse, stationsResponse] = await Promise.all([
        api.get('/reservations'),
        api.get('/stations')
      ]);
      setReservations(resResponse.data || []);
      setStations(stationsResponse.data || []);
      if (stationsResponse.data?.length > 0 && !createForm.stationId) {
        setCreateForm(prev => ({ ...prev, stationId: stationsResponse.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load reservations or stations', err);
      showFeedback('Failed to synchronize reservations data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (text, type = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg({ text: '', type: '' }), 4000);
  };

  // 12-Hour notice calculator helper
  const getNoticeDetails = (scheduledIso) => {
    if (!scheduledIso) return { hoursLeft: 0, isLocked: true, label: 'N/A' };
    const scheduledTime = new Date(scheduledIso).getTime();
    const now = Date.now();
    const diffMs = scheduledTime - now;
    const hoursLeft = diffMs / (1000 * 60 * 60);

    if (hoursLeft < 0) {
      return { hoursLeft, isLocked: true, label: 'Past Schedule' };
    }
    if (hoursLeft < 12) {
      return {
        hoursLeft: +hoursLeft.toFixed(1),
        isLocked: true,
        label: `Locked (<12h Notice: ${hoursLeft.toFixed(1)}h left)`
      };
    }
    return {
      hoursLeft: +hoursLeft.toFixed(1),
      isLocked: false,
      label: `Editable (>12h: ${hoursLeft.toFixed(1)}h notice)`
    };
  };

  // Filtered reservations list
  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      // Status filter
      if (statusFilter !== 'All' && res.status !== statusFilter) return false;

      // Station filter
      if (stationFilter !== 'All' && res.stationId !== stationFilter && res.stationName !== stationFilter) return false;

      // Search query (NIC, Res number, station name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNic = res.prosumerNic?.toLowerCase().includes(query);
        const matchRes = res.reservationNumber?.toLowerCase().includes(query);
        const matchStation = res.stationName?.toLowerCase().includes(query);
        if (!matchNic && !matchRes && !matchStation) return false;
      }

      // Schedule horizon filter
      if (selectedDaysFilter !== 'All' && res.scheduledDateTime) {
        const sched = new Date(res.scheduledDateTime).getTime();
        const now = Date.now();
        const diffHours = (sched - now) / (1000 * 3600);
        if (selectedDaysFilter === 'Next48h' && (diffHours < 0 || diffHours > 48)) return false;
        if (selectedDaysFilter === 'Within7Days' && (diffHours < 0 || diffHours > 168)) return false;
      }

      return true;
    });
  }, [reservations, statusFilter, stationFilter, searchQuery, selectedDaysFilter]);

  // Statistics summaries
  const stats = useMemo(() => {
    const total = reservations.length;
    const pending = reservations.filter(r => r.status === 'Pending').length;
    const approved = reservations.filter(r => r.status === 'Approved').length;
    const completed = reservations.filter(r => r.status === 'Completed').length;
    const cancelled = reservations.filter(r => r.status === 'Cancelled').length;
    const totalKwh = reservations.reduce((acc, r) => acc + (r.energyAmountKwh || 0), 0);
    return { total, pending, approved, completed, cancelled, totalKwh: totalKwh.toFixed(1) };
  }, [reservations]);

  // Approve Reservation Handler
  const handleApprove = async () => {
    if (!selectedRes) return;
    try {
      setActionLoading(true);
      await api.post(`/reservations/${selectedRes.id || selectedRes.reservationNumber}/approve`);
      showFeedback(`Reservation ${selectedRes.reservationNumber} approved! Digital QR generated.`);
      setIsApproveModalOpen(false);
      loadData();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to approve reservation.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel Reservation Handler (Backoffice Admin Override)
  const handleCancel = async () => {
    if (!selectedRes) return;
    try {
      setActionLoading(true);
      await api.post(`/reservations/${selectedRes.id || selectedRes.reservationNumber}/cancel`, {
        reason: cancelReason || 'Cancelled by Backoffice Administration'
      });
      showFeedback(`Reservation ${selectedRes.reservationNumber} cancelled.`);
      setIsCancelModalOpen(false);
      setCancelReason('');
      loadData();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to cancel reservation.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Create Reservation Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const isoUtc = new Date(createForm.scheduledDateTime).toISOString();
      await api.post('/reservations', {
        prosumerNic: createForm.prosumerNic.trim(),
        stationId: createForm.stationId,
        scheduledDateTime: isoUtc,
        energyAmountKwh: parseFloat(createForm.energyAmountKwh),
        tradeType: createForm.tradeType
      });
      showFeedback('Reservation created successfully under 7-day rule constraint.');
      setIsCreateModalOpen(false);
      setCreateForm({
        prosumerNic: '',
        stationId: stations[0]?.id || '',
        scheduledDateTime: '',
        energyAmountKwh: 15,
        tradeType: 'DropOff'
      });
      loadData();
    } catch (err) {
      showFeedback(err.response?.data?.message || 'Failed to create reservation.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Min and max date strings for HTML input
  const minIsoString = new Date().toISOString().slice(0, 16);
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 7);
  const maxIsoString = maxDateObj.toISOString().slice(0, 16);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-3">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>7-Day Schedule &amp; 12-Hour Notice Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
              Energy Trading Reservations &amp; Bookings Ledger
            </h1>
            <p className="mt-1.5 text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Enforce enterprise booking policies: 7-day advance reservation windows, 12-hour cancellation notice locks, and cryptographic digital pass issuance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs font-bold transition shadow-sm active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Ledger</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Reservation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg.text && (
        <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 animate-in fade-in ${
          feedbackMsg.type === 'error'
            ? 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300'
            : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
        }`}>
          {feedbackMsg.type === 'error' ? (
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Bookings</span>
          <div className="text-2xl font-display font-black text-slate-900 dark:text-white mt-1">{stats.total}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-amber-500/30 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Review</span>
          <div className="text-2xl font-display font-black text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-500/30 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Approved</span>
          <div className="text-2xl font-display font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-cyan-500/30 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Completed</span>
          <div className="text-2xl font-display font-black text-cyan-600 dark:text-cyan-400 mt-1">{stats.completed}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-rose-500/30 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Cancelled</span>
          <div className="text-2xl font-display font-black text-rose-600 dark:text-rose-400 mt-1">{stats.cancelled}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-violet-500/30 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Traded Volume</span>
          <div className="text-2xl font-display font-black text-violet-600 dark:text-violet-400 mt-1">{stats.totalKwh} <span className="text-xs font-normal">kWh</span></div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC, Res Number, Station..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Station Filter */}
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="All">All Solar Hubs</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* 7-Day Window Quick Filter */}
          <select
            value={selectedDaysFilter}
            onChange={(e) => setSelectedDaysFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="All">All Schedule Dates</option>
            <option value="Next48h">Next 48 Hours</option>
            <option value="Within7Days">Within 7-Day Horizon</option>
          </select>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-4 px-4 sm:px-6">Reservation #</th>
                <th className="py-4 px-4">Prosumer NIC</th>
                <th className="py-4 px-4">Solar Station Hub</th>
                <th className="py-4 px-4">Scheduled Time</th>
                <th className="py-4 px-4">Quota &amp; Type</th>
                <th className="py-4 px-4">12-Hour Rule Notice</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold">No reservations matching current filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => {
                  const notice = getNoticeDetails(res.scheduledDateTime);
                  const isPending = res.status === 'Pending';
                  const isApproved = res.status === 'Approved';

                  return (
                    <tr key={res.id || res.reservationNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Reservation Number */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {res.reservationNumber}
                        </div>
                        {res.qrCodeToken && (
                          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3 w-3" /> QR Active
                          </span>
                        )}
                      </td>

                      {/* NIC */}
                      <td className="py-4 px-4">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                          {res.prosumerNic}
                        </span>
                      </td>

                      {/* Station */}
                      <td className="py-4 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {res.stationName || 'Microgrid Hub'}
                      </td>

                      {/* Scheduled Time */}
                      <td className="py-4 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {res.scheduledDateTime ? new Date(res.scheduledDateTime).toLocaleString() : 'N/A'}
                      </td>

                      {/* Energy & Trade */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          {res.tradeType === 'DropOff' ? (
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span>{res.energyAmountKwh} kWh</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{res.tradeType}</span>
                      </td>

                      {/* 12-Hour Rule Notice Indicator */}
                      <td className="py-4 px-4">
                        {res.status === 'Cancelled' || res.status === 'Completed' ? (
                          <span className="text-[11px] text-slate-400 font-mono">Finalized</span>
                        ) : notice.isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{notice.label}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <Check className="h-3 w-3" />
                            <span>{notice.label}</span>
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          res.status === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                            : res.status === 'Pending'
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                            : res.status === 'Completed'
                            ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                        }`}>
                          {res.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => { setSelectedRes(res); setIsApproveModalOpen(true); }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition shadow-xs active:scale-95 cursor-pointer"
                              title="Approve & Generate QR Pass"
                            >
                              Approve
                            </button>
                          )}

                          {res.status !== 'Cancelled' && res.status !== 'Completed' && (
                            <button
                              onClick={() => { setSelectedRes(res); setIsCancelModalOpen(true); }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                              title="Cancel Reservation"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Approve Reservation */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Confirm Booking Approval"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Approving this booking will allocate battery slot capacity and generate a cryptographically signed transaction QR code for the prosumer.
        </p>

        {selectedRes && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 mb-5">
            <div><span className="font-bold">Reservation #:</span> {selectedRes.reservationNumber}</div>
            <div><span className="font-bold">Prosumer NIC:</span> {selectedRes.prosumerNic}</div>
            <div><span className="font-bold">Station:</span> {selectedRes.stationName}</div>
            <div><span className="font-bold">Schedule:</span> {new Date(selectedRes.scheduledDateTime).toLocaleString()}</div>
            <div><span className="font-bold">Energy Quota:</span> {selectedRes.energyAmountKwh} kWh ({selectedRes.tradeType})</div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setIsApproveModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
          >
            Dismiss
          </button>
          <button
            onClick={handleApprove}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm"
          >
            {actionLoading ? 'Approving...' : 'Confirm & Issue QR Pass'}
          </button>
        </div>
      </Modal>

      {/* Modal: Cancel Reservation */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Power Trading Reservation"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Specification Rule: Cancellations by prosumers require at least 12 hours notice. As Backoffice Administrator, your action provides official override and releases locked slot inventory.
        </p>

        <div className="space-y-3 mb-5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Administrative Cancellation Reason
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g. Prosumer schedule conflict or grid node maintenance..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setIsCancelModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
          >
            Keep Reservation
          </button>
          <button
            onClick={handleCancel}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm"
          >
            {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </Modal>

      {/* Modal: Create Reservation (7-day rule validated) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Energy Reservation (7-Day Horizon)"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            7-Day Booking Window: Schedule must fall between today and {maxDateObj.toLocaleDateString()}.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Prosumer National Identity Card (NIC)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 199812345678"
              value={createForm.prosumerNic}
              onChange={(e) => setCreateForm({ ...createForm, prosumerNic: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Solar Microgrid Hub
              </label>
              <select
                value={createForm.stationId}
                onChange={(e) => setCreateForm({ ...createForm, stationId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {stations.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.availableBatterySlots} slots free)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Trade Direction
              </label>
              <select
                value={createForm.tradeType}
                onChange={(e) => setCreateForm({ ...createForm, tradeType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="DropOff">DropOff (Discharge Battery / Sell)</option>
                <option value="PickUp">PickUp (Charge Battery / Buy)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Schedule Date &amp; Time
              </label>
              <input
                type="datetime-local"
                required
                min={minIsoString}
                max={maxIsoString}
                value={createForm.scheduledDateTime}
                onChange={(e) => setCreateForm({ ...createForm, scheduledDateTime: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Energy Quota (kWh)
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="500"
                required
                value={createForm.energyAmountKwh}
                onChange={(e) => setCreateForm({ ...createForm, energyAmountKwh: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold shadow-sm"
            >
              {actionLoading ? 'Scheduling...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
