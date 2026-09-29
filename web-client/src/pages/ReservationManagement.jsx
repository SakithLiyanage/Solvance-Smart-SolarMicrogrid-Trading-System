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
  ShieldCheck, AlertCircle, ShieldAlert, Check, X, Eye, FileText,
  User, Users, QrCode, Phone, Mail, Copy
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '../api/client';
import Modal from '../components/Modal';

export default function ReservationManagement({ theme }) {
  const [reservations, setReservations] = useState([]);
  const [stations, setStations] = useState([]);
  const [prosumers, setProsumers] = useState([]);
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
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [viewingRes, setViewingRes] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedRes, setCopiedRes] = useState(false);
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
      const [resResponse, stationsResponse, prosumersResponse] = await Promise.all([
        api.get('/reservations'),
        api.get('/stations'),
        api.get('/users?role=Prosumer&status=Active')
      ]);
      const resData = resResponse.data || [];
      const stationList = stationsResponse.data || [];
      const prosumerList = prosumersResponse.data || [];

      setReservations(resData);
      setStations(stationList);
      setProsumers(prosumerList);

      // Smart default: prioritize active station with free battery slots
      const availableStation = stationList.find(s => s.isActive && s.availableBatterySlots > 0) || stationList[0];
      const defaultProsumer = prosumerList[0]?.nic || '';

      setCreateForm(prev => ({
        ...prev,
        stationId: prev.stationId || availableStation?.id || '',
        prosumerNic: prev.prosumerNic || defaultProsumer
      }));
    } catch (err) {
      console.error('Failed to load reservations, stations, or prosumers', err);
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

  // Selected Prosumer & Station helpers for reactive capacity & rule calculation
  const selectedProsumer = useMemo(() => {
    return prosumers.find(p => p.nic === createForm.prosumerNic) || null;
  }, [prosumers, createForm.prosumerNic]);

  const selectedStation = useMemo(() => {
    return stations.find(s => s.id === createForm.stationId) || null;
  }, [stations, createForm.stationId]);

  const isStationFullForDropOff = useMemo(() => {
    return createForm.tradeType === 'DropOff' && selectedStation && selectedStation.availableBatterySlots <= 0;
  }, [createForm.tradeType, selectedStation]);

  // View Digital Pass Modal Handler
  const handleOpenPassModal = async (res) => {
    setViewingRes(res);
    setIsPassModalOpen(true);
    setCopiedRes(false);
    try {
      const token = res.qrCodeToken || res.reservationNumber;
      const url = await QRCode.toDataURL(token, {
        width: 256,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code', err);
      setQrDataUrl('');
    }
  };

  // Create Reservation Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (isStationFullForDropOff) {
      showFeedback(`Selected hub '${selectedStation?.name}' has 0 available slots. Choose another hub.`, 'error');
      return;
    }
    if (!createForm.prosumerNic) {
      showFeedback('Please select an active verified prosumer.', 'error');
      return;
    }
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
      const availableStation = stations.find(s => s.isActive && s.availableBatterySlots > 0) || stations[0];
      setCreateForm({
        prosumerNic: prosumers[0]?.nic || '',
        stationId: availableStation?.id || '',
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

  // Helper to format local Date into YYYY-MM-DDTHH:mm for datetime-local inputs
  const toLocalIsoString = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Min and max date strings for HTML input (within 7 days, up to 23:59 on 7th day)
  const nowObj = new Date();
  const minIsoString = toLocalIsoString(nowObj);
  const maxDateObj = new Date();
  maxDateObj.setDate(maxDateObj.getDate() + 7);
  maxDateObj.setHours(23, 59, 59, 999);
  const maxIsoString = toLocalIsoString(maxDateObj);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/30 mb-3">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>7-Day Schedule &amp; 12-Hour Notice Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">
              Energy Trading Reservations &amp; Bookings Ledger
            </h1>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Enforce enterprise booking policies: 7-day advance reservation windows, 12-hour cancellation notice locks, and cryptographic digital pass issuance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Ledger</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
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
                          <button
                            onClick={() => handleOpenPassModal(res)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                            title="View Full Details & Digital Energy Pass"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

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
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between">
            <span>7-Day Booking Horizon: Schedule must fall between today and {maxDateObj.toLocaleDateString()}.</span>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-500/20 px-2 py-0.5 rounded-md">Policy Guard</span>
          </div>

          {/* Prosumer Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Verified Active Prosumer
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {prosumers.length} Active {prosumers.length === 1 ? 'Account' : 'Accounts'}
              </span>
            </div>

            {prosumers.length > 0 ? (
              <select
                required
                value={createForm.prosumerNic}
                onChange={(e) => setCreateForm({ ...createForm, prosumerNic: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="">-- Select Active Verified Prosumer --</option>
                {prosumers.map(p => (
                  <option key={p.nic} value={p.nic}>
                    {p.fullName} ({p.nic}) — {p.solarCapacityKw} kW Array
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                No active verified prosumers found. Prosumers must complete KYC verification before bookings can be scheduled.
              </div>
            )}

            {/* Selected Prosumer Summary Card */}
            {selectedProsumer && (
              <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-amber-500" />
                    <span>{selectedProsumer.fullName}</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">({selectedProsumer.nic})</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    <ShieldCheck className="h-3 w-3" />
                    Active &amp; KYC Approved
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-200 dark:border-slate-800/80">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Solar Capacity:</span>{' '}
                    <span className="font-bold text-amber-600 dark:text-amber-400">{selectedProsumer.solarCapacityKw} kW</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Inverter:</span>{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedProsumer.inverterSerial || 'Standard Grid-Tie'}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>
                      <span className="font-medium text-slate-500">Contact:</span> {selectedProsumer.phone || selectedProsumer.email}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Rec. daily quota: ~{(selectedProsumer.solarCapacityKw * 4.5).toFixed(1)} kWh
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                {stations.map(s => {
                  const isFull = createForm.tradeType === 'DropOff' && s.availableBatterySlots <= 0;
                  return (
                    <option key={s.id} value={s.id} disabled={isFull}>
                      {s.name} ({s.availableBatterySlots} slots free {isFull ? '— FULL' : ''})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Trade Direction
              </label>
              <select
                value={createForm.tradeType}
                onChange={(e) => {
                  const nextTrade = e.target.value;
                  setCreateForm(prev => {
                    const next = { ...prev, tradeType: nextTrade };
                    if (nextTrade === 'DropOff') {
                      const cur = stations.find(s => s.id === prev.stationId);
                      if (cur && cur.availableBatterySlots <= 0) {
                        const openStation = stations.find(s => s.isActive && s.availableBatterySlots > 0);
                        if (openStation) next.stationId = openStation.id;
                      }
                    }
                    return next;
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="DropOff">DropOff (Discharge Battery / Sell)</option>
                <option value="PickUp">PickUp (Charge Battery / Buy)</option>
              </select>
            </div>
          </div>

          {/* Station Capacity Warning if 0 slots free for DropOff */}
          {isStationFullForDropOff && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Solar Hub Battery Bay Full</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                  "{selectedStation?.name}" currently has 0 available battery slots. Drop-off (selling) reservations cannot be scheduled at this hub until bays are cleared.
                </p>
              </div>
            </div>
          )}

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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Energy Quota (kWh)
                </label>
                <div className="flex items-center gap-1">
                  {[5, 10, 15, 25].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, energyAmountKwh: val })}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                        +createForm.energyAmountKwh === val
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {val}k
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.1"
                min="1"
                max={selectedStation?.capacityKwh || 500}
                required
                value={createForm.energyAmountKwh}
                onChange={(e) => setCreateForm({ ...createForm, energyAmountKwh: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Quota advisory if exceeding prosumer capacity */}
          {selectedProsumer && +createForm.energyAmountKwh > (selectedProsumer.solarCapacityKw * 10) && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                Entered quota ({createForm.energyAmountKwh} kWh) exceeds standard single-day output of a {selectedProsumer.solarCapacityKw} kW array (~{(selectedProsumer.solarCapacityKw * 5).toFixed(0)} kWh).
              </span>
            </div>
          )}

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
              disabled={actionLoading || isStationFullForDropOff || !createForm.prosumerNic || !createForm.stationId || !createForm.scheduledDateTime}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${
                actionLoading || isStationFullForDropOff || !createForm.prosumerNic || !createForm.stationId || !createForm.scheduledDateTime
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:brightness-105 active:scale-95'
              }`}
            >
              {actionLoading ? 'Scheduling...' : isStationFullForDropOff ? 'Hub Bay Full' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Digital Energy Pass / Details */}
      <Modal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        title="Digital Energy Reservation Pass"
      >
        {viewingRes && (
          <div className="space-y-4">
            {/* Top Pass Card */}
            <div className="relative rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 p-5 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Trading Pass</div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {viewingRes.reservationNumber}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    viewingRes.status === 'Approved'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : viewingRes.status === 'Pending'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      : viewingRes.status === 'Completed'
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}>
                    {viewingRes.status}
                  </span>
                </div>
              </div>

              {/* QR Code graphic if Approved or Completed */}
              {qrDataUrl ? (
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 mb-4 shadow-inner">
                  <img src={qrDataUrl} alt="Reservation QR" className="w-44 h-44 object-contain" />
                  <p className="font-mono text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Cryptographic Station Token: {viewingRes.qrCodeToken ? 'Verified Active' : 'Fallback Res ID'}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs mb-4 text-center">
                  QR Pass is generated automatically once the reservation is approved by Backoffice.
                </div>
              )}

              {/* Key Pass Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Prosumer NIC</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{viewingRes.prosumerNic}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Trade Direction</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    {viewingRes.tradeType === 'DropOff' ? (
                      <>
                        <Zap className="h-3 w-3 text-amber-500" />
                        DropOff (Sell)
                      </>
                    ) : (
                      <>
                        <BatteryCharging className="h-3 w-3 text-emerald-500" />
                        PickUp (Buy)
                      </>
                    )}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Energy Quota</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {viewingRes.energyAmountKwh} kWh
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Microgrid Hub</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">
                    {viewingRes.stationName || 'Colombo Central Solar Hub'}
                  </span>
                </div>
                <div className="col-span-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Scheduled Appointment</span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {viewingRes.scheduledDateTime ? new Date(viewingRes.scheduledDateTime).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewingRes.reservationNumber);
                  setCopiedRes(true);
                  setTimeout(() => setCopiedRes(false), 2000);
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedRes ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedRes ? 'Copied Res #' : 'Copy Res #'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPassModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition"
              >
                Close Pass
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
