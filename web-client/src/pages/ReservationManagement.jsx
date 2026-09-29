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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertTriangle, Search,
  Filter, Plus, RefreshCw, Zap, BatteryCharging, ArrowUpDown,
  ShieldCheck, AlertCircle, ShieldAlert, Check, X, Eye, FileText,
  User, Users, QrCode, Phone, Mail, Copy, Edit3
} from 'lucide-react';
import QRCode from 'qrcode';
import api from '../api/client';
import Modal from '../components/Modal';
import Pagination, { usePagination } from '../components/Pagination';

// Compact, locale-aware schedule label, e.g. "Thu, 01 Oct, 19:42"
const formatSchedule = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

const formatTimestamp = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

const isActiveBooking = (r) => r.status === 'Pending' || r.status === 'Approved';

// Rule errors come back as { message }; model validation errors as ASP.NET ProblemDetails ({ title, errors })
const getApiError = (err, fallback) => err.response?.data?.message || err.response?.data?.title || fallback;

export default function ReservationManagement({ theme }) {
  const [reservations, setReservations] = useState([]);
  const [stations, setStations] = useState([]);
  const [prosumers, setProsumers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

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
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [viewingRes, setViewingRes] = useState(null);
  const [auditRes, setAuditRes] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedRes, setCopiedRes] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', type: '' });
  // Errors from an open modal are shown inside it (the page banner is hidden behind the overlay)
  const [modalError, setModalError] = useState('');
  const feedbackTimerRef = useRef(null);
  const actionLockRef = useRef(false);

  // Edit booking (backend enforces the 12-hour notice and 7-day window on update)
  const [editingRes, setEditingRes] = useState(null);
  const [editForm, setEditForm] = useState({
    scheduledDateTime: '',
    energyAmountKwh: 15,
    tradeType: 'DropOff'
  });

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
      const availableStation = stationList.find(s => s.isActive && s.availableBatterySlots > 0) || stationList.find(s => s.isActive);
      const defaultProsumer = prosumerList[0]?.nic || '';

      setCreateForm(prev => ({
        ...prev,
        stationId: prev.stationId || availableStation?.id || '',
        prosumerNic: prev.prosumerNic || defaultProsumer
      }));
    } catch (err) {
      console.error('Failed to load bookings, stations or prosumers', err);
      showFeedback('Failed to load reservations. Check that the API is running and try again.', 'error');
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    loadData();
    return () => clearTimeout(feedbackTimerRef.current);
  }, []);

  const showFeedback = (text, type = 'success') => {
    // Restart the timer so an older message's timeout can't clear a newer message early
    clearTimeout(feedbackTimerRef.current);
    setFeedbackMsg({ text, type });
    feedbackTimerRef.current = setTimeout(() => setFeedbackMsg({ text: '', type: '' }), 4000);
  };

  // One write request at a time; the ref also blocks double clicks that land before React re-renders
  const runAction = async (action) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setActionLoading(true);
    setModalError('');
    try {
      await action();
    } finally {
      actionLockRef.current = false;
      setActionLoading(false);
    }
  };

  const copyText = async (text, onCopied) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied();
    } catch {
      // Clipboard API is unavailable outside secure contexts (e.g. http://<LAN-IP>)
      showFeedback('Copy failed. Select the text and copy it manually.', 'error');
    }
  };

  // 12-Hour notice calculator helper (mirrors the backend modification/cancellation rule)
  const getNoticeDetails = (scheduledIso) => {
    if (!scheduledIso) return { hoursLeft: 0, isLocked: true, isPast: false, label: 'N/A' };
    const scheduledTime = new Date(scheduledIso).getTime();
    const now = Date.now();
    const diffMs = scheduledTime - now;
    const hoursLeft = diffMs / (1000 * 60 * 60);

    if (hoursLeft < 0) {
      return { hoursLeft, isLocked: true, isPast: true, label: 'Time passed' };
    }
    if (hoursLeft < 12) {
      return {
        hoursLeft: +hoursLeft.toFixed(1),
        isLocked: true,
        isPast: false,
        label: `Locked <12h · ${hoursLeft.toFixed(1)}h left`
      };
    }
    return {
      hoursLeft: +hoursLeft.toFixed(1),
      isLocked: false,
      isPast: false,
      label: `Editable · ${hoursLeft.toFixed(1)}h left`
    };
  };

  // Filtered reservations list, in queue order: upcoming active bookings (soonest first),
  // then overdue active ones, then closed history (newest first)
  const filteredReservations = useMemo(() => {
    const now = Date.now();
    const rank = (r) => {
      if (!isActiveBooking(r)) return 2;
      return new Date(r.scheduledDateTime).getTime() >= now ? 0 : 1;
    };
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
    }).sort((a, b) => {
      const rankA = rank(a);
      const rankB = rank(b);
      if (rankA !== rankB) return rankA - rankB;
      const timeA = new Date(a.scheduledDateTime).getTime();
      const timeB = new Date(b.scheduledDateTime).getTime();
      return rankA === 0 ? timeA - timeB : timeB - timeA;
    });
  }, [reservations, statusFilter, stationFilter, searchQuery, selectedDaysFilter]);

  const {
    pageItems: pagedReservations,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalItems
  } = usePagination(filteredReservations, 10, `${statusFilter}|${stationFilter}|${searchQuery}|${selectedDaysFilter}`);

  // Statistics summaries (always from the full list, not the current page)
  const stats = useMemo(() => {
    const total = reservations.length;
    const pending = reservations.filter(r => r.status === 'Pending').length;
    const approved = reservations.filter(r => r.status === 'Approved').length;
    const completed = reservations.filter(r => r.status === 'Completed').length;
    const cancelled = reservations.filter(r => r.status === 'Cancelled').length;
    // Only completed bookings actually moved energy; pending/cancelled ones would inflate the figure
    const completedKwh = reservations
      .filter(r => r.status === 'Completed')
      .reduce((acc, r) => acc + (r.energyAmountKwh || 0), 0);
    return { total, pending, approved, completed, cancelled, completedKwh: completedKwh.toFixed(1) };
  }, [reservations]);

  // Modal openers reset the previous booking's reason/error so nothing carries over
  const openApproveModal = (res) => {
    setSelectedRes(res);
    setRejectMode(false);
    setRejectReason('');
    setModalError('');
    setIsApproveModalOpen(true);
  };

  const openCancelModal = (res) => {
    setSelectedRes(res);
    setCancelReason('');
    setModalError('');
    setIsCancelModalOpen(true);
  };

  const openEditModal = (res) => {
    setEditingRes(res);
    setEditForm({
      // datetime-local needs local time (toISOString() would show UTC)
      scheduledDateTime: res.scheduledDateTime ? toLocalIsoString(new Date(res.scheduledDateTime)) : '',
      energyAmountKwh: res.energyAmountKwh,
      tradeType: res.tradeType || 'DropOff'
    });
    setModalError('');
  };

  // Approve Reservation Handler
  const handleApprove = () => runAction(async () => {
    if (!selectedRes) return;
    try {
      await api.post(`/reservations/${selectedRes.id || selectedRes.reservationNumber}/approve`);
      showFeedback(`Reservation ${selectedRes.reservationNumber} approved. QR pass issued.`);
      setIsApproveModalOpen(false);
      loadData();
    } catch (err) {
      setModalError(getApiError(err, 'Failed to approve reservation.'));
    }
  });

  // Cancel Reservation Handler (Backoffice may cancel inside the 12-hour window)
  const handleCancel = () => runAction(async () => {
    if (!selectedRes) return;
    try {
      await api.post(`/reservations/${selectedRes.id || selectedRes.reservationNumber}/cancel`, {
        reason: cancelReason.trim() || 'Cancelled by Backoffice Administration'
      });
      showFeedback(`Reservation ${selectedRes.reservationNumber} cancelled.`);
      setIsCancelModalOpen(false);
      setCancelReason('');
      loadData();
    } catch (err) {
      setModalError(getApiError(err, 'Failed to cancel reservation.'));
    }
  });

  // Reject Reservation Handler (Direct Reject inside Approval Modal)
  const handleReject = (customReason) => runAction(async () => {
    if (!selectedRes) return;
    try {
      const resReason = customReason || rejectReason.trim() || 'Rejected by Backoffice Administrator during approval review';
      await api.post(`/reservations/${selectedRes.id || selectedRes.reservationNumber}/cancel`, {
        reason: resReason
      });
      showFeedback(`Reservation ${selectedRes.reservationNumber} rejected and its slot released.`);
      setIsApproveModalOpen(false);
      setRejectMode(false);
      setRejectReason('');
      loadData();
    } catch (err) {
      setModalError(getApiError(err, 'Failed to reject reservation.'));
    }
  });

  // Edit Reservation Handler (PUT /api/Reservations/{id}; backend re-checks the 12h notice and 7-day window)
  const handleEditSubmit = (e) => {
    e.preventDefault();
    return runAction(async () => {
      if (!editingRes) return;
      try {
        await api.put(`/reservations/${editingRes.id || editingRes.reservationNumber}`, {
          scheduledDateTime: new Date(editForm.scheduledDateTime).toISOString(),
          energyAmountKwh: parseFloat(editForm.energyAmountKwh),
          tradeType: editForm.tradeType
        });
        showFeedback(`Reservation ${editingRes.reservationNumber} updated.`);
        setEditingRes(null);
        loadData();
      } catch (err) {
        setModalError(getApiError(err, 'Failed to update reservation.'));
      }
    });
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
    setCopiedToken(false);
    setQrDataUrl('');
    // Only the signed token verifies at the hub; a QR of anything else would be rejected by the operator scan
    if (!res.qrCodeToken) return;
    try {
      const url = await QRCode.toDataURL(res.qrCodeToken, {
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
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (isStationFullForDropOff) {
      setModalError(`Selected hub '${selectedStation?.name}' has 0 available slots. Choose another hub.`);
      return;
    }
    if (!createForm.prosumerNic) {
      setModalError('Please select an active prosumer.');
      return;
    }
    return runAction(async () => {
      try {
        const isoUtc = new Date(createForm.scheduledDateTime).toISOString();
        await api.post('/reservations', {
          prosumerNic: createForm.prosumerNic.trim(),
          stationId: createForm.stationId,
          scheduledDateTime: isoUtc,
          energyAmountKwh: parseFloat(createForm.energyAmountKwh),
          tradeType: createForm.tradeType
        });
        showFeedback('Reservation created.');
        setIsCreateModalOpen(false);
        const availableStation = stations.find(s => s.isActive && s.availableBatterySlots > 0) || stations.find(s => s.isActive);
        setCreateForm({
          prosumerNic: prosumers[0]?.nic || '',
          stationId: availableStation?.id || '',
          scheduledDateTime: '',
          energyAmountKwh: 15,
          tradeType: 'DropOff'
        });
        loadData();
      } catch (err) {
        setModalError(getApiError(err, 'Failed to create reservation.'));
      }
    });
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

  // Approval guards (computed once instead of repeating the lookup in the JSX)
  const approveStation = selectedRes
    ? stations.find(s => s.id === selectedRes.stationId || s.name === selectedRes.stationName)
    : null;
  const approveBlockedByFullHub = selectedRes?.tradeType === 'DropOff' && !!approveStation && approveStation.availableBatterySlots <= 0;
  const approveBlockedByTime = selectedRes ? getNoticeDetails(selectedRes.scheduledDateTime).isPast : false;
  const approveBlocked = approveBlockedByFullHub || approveBlockedByTime;

  const cancelNotice = selectedRes ? getNoticeDetails(selectedRes.scheduledDateTime) : null;

  // Error box shown inside the open modal
  const renderModalError = () =>
    modalError ? (
      <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
        <span>{modalError}</span>
      </div>
    ) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
              Energy Reservations
            </h1>
            <p className="mt-1.5 text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Reservations must be scheduled within 7 days. Changes, and cancellations by prosumers, need at least 12 hours' notice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            >
              <RefreshCw className={`h-4 w-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => { setModalError(''); setIsCreateModalOpen(true); }}
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
        <div role={feedbackMsg.type === 'error' ? 'alert' : 'status'} className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-3 animate-in fade-in ${
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
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Reservations</span>
          <div className="text-2xl font-display font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-amber-500/30 shadow-xs">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Pending</span>
          <div className="text-2xl font-display font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-500/30 shadow-xs">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Approved</span>
          <div className="text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-cyan-500/30 shadow-xs">
          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Completed</span>
          <div className="text-2xl font-display font-bold text-cyan-600 dark:text-cyan-400 mt-1">{stats.completed}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-rose-500/30 shadow-xs">
          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Cancelled</span>
          <div className="text-2xl font-display font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.cancelled}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-violet-500/30 shadow-xs">
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">Completed Energy</span>
          <div className="text-2xl font-display font-bold text-violet-600 dark:text-violet-400 mt-1">{stats.completedKwh} <span className="text-xs font-normal">kWh</span></div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC, reservation # or station"
            aria-label="Search reservations by NIC, reservation number or station"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {/* Filters Group */}
        <div className="w-full sm:w-auto grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Station Filter */}
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            aria-label="Filter by station"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="All">All Stations</option>
            {stations.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Schedule Date Quick Filter */}
          <select
            value={selectedDaysFilter}
            onChange={(e) => setSelectedDaysFilter(e.target.value)}
            aria-label="Filter by scheduled date"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="All">Any Date</option>
            <option value="Next48h">Next 48 Hours</option>
            <option value="Within7Days">Next 7 Days</option>
          </select>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">
                <th className="py-4 px-4 sm:px-6">Reservation #</th>
                <th className="py-4 px-3">Prosumer NIC</th>
                <th className="py-4 px-3">Station</th>
                <th className="py-4 px-3">Scheduled Time &amp; 12-Hour Rule</th>
                <th className="py-4 px-3">Energy &amp; Type</th>
                <th className="py-4 px-3">Status</th>
                <th className="py-4 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
              {!hasLoaded ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 mx-auto mb-2 text-amber-500 animate-spin" />
                    <p className="font-semibold">Loading reservations…</p>
                  </td>
                </tr>
              ) : filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold">No reservations match the current filters.</p>
                  </td>
                </tr>
              ) : (
                pagedReservations.map((res) => {
                  const notice = getNoticeDetails(res.scheduledDateTime);
                  const isPending = res.status === 'Pending';
                  const isActive = isActiveBooking(res);

                  return (
                    <tr key={res.id || res.reservationNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Reservation Number */}
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {res.reservationNumber}
                        </div>
                        {/* The backend also stamps a token on edited Pending bookings; a pass only exists once approved */}
                        {res.qrCodeToken && (res.status === 'Approved' || res.status === 'Completed') && (
                          <span className="tabular-nums text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                            <ShieldCheck className="h-3 w-3" /> QR issued
                          </span>
                        )}
                      </td>

                      {/* NIC */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium">
                          {res.prosumerNic}
                        </span>
                      </td>

                      {/* Station (min-width on the inner div: browsers ignore min-width on table cells) */}
                      <td className="py-4 px-3 font-medium text-slate-900 dark:text-slate-100">
                        <div className="min-w-[140px]">{res.stationName || '—'}</div>
                      </td>

                      {/* Scheduled Time + 12-hour rule (the rule only matters while a booking can still change) */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        <div className="tabular-nums text-slate-600 dark:text-slate-300">
                          {formatSchedule(res.scheduledDateTime)}
                        </div>
                        {isActive && (
                          <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            notice.isLocked
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          }`}>
                            {notice.isLocked ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                            <span>{notice.label}</span>
                          </span>
                        )}
                      </td>

                      {/* Energy & Trade */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                          {res.tradeType === 'DropOff' ? (
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span>{res.energyAmountKwh} kWh</span>
                        </div>
                        <span className="text-[11px] text-slate-500">{res.tradeType}</span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-3 whitespace-nowrap">
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
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {/* View QR pass */}
                          {(res.status === 'Approved' || res.status === 'Completed') && (
                            <button
                              onClick={() => handleOpenPassModal(res)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-[11px] transition shadow-xs active:scale-95 cursor-pointer"
                              title="View the QR pass"
                            >
                              <QrCode className="h-3 w-3 text-amber-500" />
                              <span>Pass</span>
                            </button>
                          )}

                          {/* Booking details & history */}
                          <button
                            onClick={() => { setAuditRes(res); setIsAuditDrawerOpen(true); }}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                            title="Reservation details & history"
                            aria-label={`Details for ${res.reservationNumber}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Action (backend rejects changes inside 12 hours for every role) */}
                          {isActive && (
                            <button
                              onClick={() => openEditModal(res)}
                              disabled={notice.isLocked}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[11px] transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                              title={
                                notice.isPast
                                  ? 'The scheduled time has passed'
                                  : notice.isLocked
                                  ? 'Changes close 12 hours before the scheduled time'
                                  : 'Change the time, energy or trade type'
                              }
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Approve Action */}
                          {isPending && (
                            <button
                              onClick={() => openApproveModal(res)}
                              disabled={notice.isPast}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition shadow-xs active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                              title={notice.isPast ? 'The scheduled time has passed. Reject or cancel it instead.' : 'Review and approve'}
                            >
                              Approve
                            </button>
                          )}

                          {/* Cancel Action */}
                          {isActive && (
                            <button
                              onClick={() => openCancelModal(res)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                              title={notice.isLocked ? "Cancel on the prosumer's behalf (Backoffice may override the 12-hour rule)" : 'Cancel reservation'}
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

        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="reservations"
        />
      </div>

      {/* Modal: Approve Reservation (Enriched with Station Free Slot Count & Direct Reject) */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => { setIsApproveModalOpen(false); setRejectMode(false); }}
        title="Confirm Reservation Approval"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Approving issues the QR pass the prosumer shows at the hub.
        </p>

        {renderModalError()}

        {selectedRes && (() => {
          const currentStation = approveStation;

          return (
            <div className="space-y-3 mb-5">
              {/* Station battery slot status */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <BatteryCharging className="h-4 w-4 text-cyan-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {selectedRes.stationName || currentStation?.name || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Capacity: {currentStation?.capacityKwh != null ? `${currentStation.capacityKwh} kWh` : '—'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`tabular-nums font-bold text-xs ${
                    (currentStation?.availableBatterySlots || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {currentStation ? `${currentStation.availableBatterySlots} / ${currentStation.totalBatterySlots} free slots` : 'Slot info unavailable'}
                  </div>
                  {currentStation && (
                    <div className="text-[11px] text-slate-400">
                      {currentStation.availableBatterySlots > 0 ? 'Slots available' : 'Full'}
                    </div>
                  )}
                </div>
              </div>

              {/* Warning if 0 slots free for DropOff */}
              {approveBlockedByFullHub && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Can't approve a DropOff: no free battery slots</p>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                      This hub has 0 free battery slots. Reject or cancel this reservation, or ask the prosumer to choose another station.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning if the scheduled time has already passed */}
              {approveBlockedByTime && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="font-bold">The scheduled time has passed. Reject or cancel this reservation instead.</p>
                </div>
              )}

              {/* Booking Summary Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Reservation #:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedRes.reservationNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Prosumer NIC:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{selectedRes.prosumerNic}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Scheduled Time:</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">{formatSchedule(selectedRes.scheduledDateTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Energy:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{selectedRes.energyAmountKwh} kWh ({selectedRes.tradeType})</span>
                </div>
              </div>

              {/* Inline Reject Form */}
              {rejectMode && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-2 animate-in fade-in duration-200">
                  <label htmlFor="reject-reason" className="block text-xs font-bold text-rose-700 dark:text-rose-300">
                    Rejection reason
                  </label>
                  <textarea
                    id="reject-reason"
                    rows={2}
                    placeholder="e.g. Station capacity full or prosumer request..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-800 text-xs text-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectMode(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject()}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            {!rejectMode && (
              <button
                type="button"
                onClick={() => setRejectMode(true)}
                disabled={actionLoading}
                className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Reject Reservation</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsApproveModalOpen(false); setRejectMode(false); }}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={handleApprove}
              disabled={actionLoading || approveBlocked}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition ${
                approveBlocked
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-wait'
              }`}
            >
              {actionLoading ? 'Approving...' : 'Confirm & Issue QR Pass'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Cancel Reservation */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={`Cancel Reservation ${selectedRes?.reservationNumber || ''}`}
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Cancelling releases any battery slot held for this reservation.
        </p>

        {/* Backoffice may cancel inside the 12-hour window that blocks prosumers */}
        {cancelNotice?.isLocked && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              {cancelNotice.isPast
                ? 'The scheduled time has already passed.'
                : 'This reservation starts in less than 12 hours, so the prosumer can no longer cancel it themselves.'}{' '}
              You are cancelling it as Backoffice (override). Please record the reason.
            </span>
          </div>
        )}

        {renderModalError()}

        <div className="space-y-3 mb-5">
          <label htmlFor="cancel-reason" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Cancellation reason
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            placeholder="e.g. Prosumer schedule conflict or station maintenance..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setIsCancelModalOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
          >
            Keep Reservation
          </button>
          <button
            onClick={handleCancel}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </Modal>

      {/* Modal: Create Reservation (7-day rule validated) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Reservation"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold">
            7-day rule: schedule between now and {maxDateObj.toLocaleDateString()} 23:59.
          </div>

          {renderModalError()}

          {/* Prosumer Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="create-prosumer" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Prosumer (active accounts only)
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {prosumers.length} Active {prosumers.length === 1 ? 'Account' : 'Accounts'}
              </span>
            </div>

            {prosumers.length > 0 ? (
              <select
                id="create-prosumer"
                required
                value={createForm.prosumerNic}
                onChange={(e) => setCreateForm({ ...createForm, prosumerNic: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="">-- Select a prosumer --</option>
                {prosumers.map(p => (
                  <option key={p.nic} value={p.nic}>
                    {p.fullName} ({p.nic})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                No active prosumers found. A prosumer must be approved by Backoffice before reservations can be made.
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    <ShieldCheck className="h-3 w-3" />
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-200 dark:border-slate-800/80">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Solar Capacity:</span>{' '}
                    <span className="font-bold text-amber-600 dark:text-amber-400">{selectedProsumer.solarCapacityKw ?? '—'} kW</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Inverter:</span>{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">{selectedProsumer.inverterSerial || '—'}</span>
                  </div>
                  <div className="sm:col-span-2 text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-500">Contact:</span> {selectedProsumer.phone || selectedProsumer.email || '—'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-station" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Station
              </label>
              <select
                id="create-station"
                required
                value={createForm.stationId}
                onChange={(e) => setCreateForm({ ...createForm, stationId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {/* Deactivated hubs can't take bookings (the backend rejects them) */}
                {stations.map(s => {
                  const isFull = createForm.tradeType === 'DropOff' && s.availableBatterySlots <= 0;
                  return (
                    <option key={s.id} value={s.id} disabled={isFull || !s.isActive}>
                      {s.name} ({s.availableBatterySlots} slots free){!s.isActive ? ' — inactive' : isFull ? ' — full' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label htmlFor="create-trade" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Trade Type
              </label>
              <select
                id="create-trade"
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
                <option value="DropOff">DropOff (sell energy to the hub)</option>
                <option value="PickUp">PickUp (buy energy from the hub)</option>
              </select>
            </div>
          </div>

          {/* Station Capacity Warning if 0 slots free for DropOff */}
          {isStationFullForDropOff && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No free battery slots</p>
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                  "{selectedStation?.name}" has 0 free battery slots, so DropOff reservations can't be made there right now.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-schedule" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scheduled Date &amp; Time
              </label>
              <input
                id="create-schedule"
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
                <label htmlFor="create-energy" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Energy (kWh)
                </label>
                <div className="flex items-center gap-1">
                  {[5, 10, 15, 25].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, energyAmountKwh: val })}
                      aria-label={`${val} kWh`}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                        +createForm.energyAmountKwh === val
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="create-energy"
                type="number"
                step="0.1"
                min="0.1"
                max={selectedStation?.capacityKwh || 10000}
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
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || isStationFullForDropOff || !createForm.prosumerNic || !createForm.stationId || !createForm.scheduledDateTime}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${
                actionLoading || isStationFullForDropOff || !createForm.prosumerNic || !createForm.stationId || !createForm.scheduledDateTime
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 hover:brightness-105 active:scale-95 cursor-pointer'
              }`}
            >
              {actionLoading ? 'Scheduling...' : isStationFullForDropOff ? 'No Free Slots' : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Reservation (12-hour notice + 7-day window, re-checked by the backend) */}
      <Modal
        isOpen={editingRes !== null}
        onClose={() => setEditingRes(null)}
        title={`Edit Reservation ${editingRes?.reservationNumber || ''}`}
        maxWidth="max-w-lg"
      >
        {editingRes && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Changes are allowed until 12 hours before the reservation. The new time must be between now and {maxDateObj.toLocaleDateString()} 23:59.
            </p>

            {editingRes.status === 'Approved' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <span>This reservation is already approved. Saving issues a new QR pass, so the prosumer's current QR code will stop working.</span>
              </div>
            )}

            {renderModalError()}

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <div>
                <span className="text-slate-500">Prosumer NIC:</span>{' '}
                <span className="font-mono font-bold text-slate-900 dark:text-white">{editingRes.prosumerNic}</span>
              </div>
              <div>
                <span className="text-slate-500">Station:</span>{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{editingRes.stationName || '—'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-schedule" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Scheduled Date &amp; Time
                </label>
                <input
                  id="edit-schedule"
                  type="datetime-local"
                  required
                  min={minIsoString}
                  max={maxIsoString}
                  value={editForm.scheduledDateTime}
                  onChange={(e) => setEditForm({ ...editForm, scheduledDateTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="edit-energy" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Energy (kWh)
                </label>
                <input
                  id="edit-energy"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={stations.find(s => s.id === editingRes.stationId)?.capacityKwh || 10000}
                  required
                  value={editForm.energyAmountKwh}
                  onChange={(e) => setEditForm({ ...editForm, energyAmountKwh: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-trade" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Trade Type
              </label>
              <select
                id="edit-trade"
                value={editForm.tradeType}
                onChange={(e) => setEditForm({ ...editForm, tradeType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="DropOff">DropOff (sell energy to the hub)</option>
                <option value="PickUp">PickUp (buy energy from the hub)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRes(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: View Digital Energy Pass / Details */}
      <Modal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        title="QR Pass"
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
                    <div className="text-xs text-slate-400 font-bold">Reservation #</div>
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

              {/* QR code (only a real signed token is shown; anything else would fail the operator scan) */}
              {qrDataUrl ? (
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 mb-4 shadow-inner">
                  <img src={qrDataUrl} alt={`QR pass for ${viewingRes.reservationNumber}`} className="w-44 h-44 object-contain" />
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    {viewingRes.status === 'Completed'
                      ? 'Already used: this reservation has been completed.'
                      : 'The Grid Operator scans this code at the hub to complete the reservation.'}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs mb-4 text-center">
                  {viewingRes.qrCodeToken
                    ? 'Generating QR code…'
                    : 'No QR pass has been issued for this reservation. A pass is created when the reservation is approved.'}
                </div>
              )}

              {/* Raw Token Box with Copy */}
              {viewingRes.qrCodeToken && (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 mb-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                    <span>QR token</span>
                    <button
                      type="button"
                      onClick={() => copyText(viewingRes.qrCodeToken, () => {
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      })}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedToken ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedToken ? 'Token Copied!' : 'Copy Token'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 break-all select-all">
                    {viewingRes.qrCodeToken}
                  </div>
                </div>
              )}

              {/* Key Pass Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block font-semibold">Prosumer NIC</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{viewingRes.prosumerNic}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block font-semibold">Trade Type</span>
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
                  <span className="text-xs text-slate-400 block font-semibold">Energy</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                    {viewingRes.energyAmountKwh} kWh
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block font-semibold">Station</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate block">
                    {viewingRes.stationName || '—'}
                  </span>
                </div>
                <div className="col-span-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-400 block font-semibold">Scheduled Time</span>
                  <span className="tabular-nums text-slate-900 dark:text-white">
                    {formatSchedule(viewingRes.scheduledDateTime)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => copyText(viewingRes.reservationNumber, () => {
                  setCopiedRes(true);
                  setTimeout(() => setCopiedRes(false), 2000);
                })}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                {copiedRes ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedRes ? 'Copied Res #' : 'Copy Res #'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPassModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal / Drawer: Audit Details & Lifecycle History */}
      <Modal
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        title={`Reservation Details: ${auditRes?.reservationNumber || ''}`}
      >
        {auditRes && (
          <div className="space-y-4">
            {/* Header Identity Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 block">Reservation #</span>
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{auditRes.reservationNumber}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  auditRes.status === 'Approved'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : auditRes.status === 'Pending'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : auditRes.status === 'Completed'
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}>
                  {auditRes.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-500">Prosumer NIC:</span>{' '}
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{auditRes.prosumerNic}</span>
                </div>
                <div>
                  <span className="text-slate-500">Station:</span>{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{auditRes.stationName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Energy:</span>{' '}
                  <span className="font-bold text-amber-600 dark:text-amber-400">{auditRes.energyAmountKwh} kWh ({auditRes.tradeType})</span>
                </div>
                {isActiveBooking(auditRes) && (
                  <div>
                    <span className="text-slate-500">12-hour rule:</span>{' '}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{getNoticeDetails(auditRes.scheduledDateTime).label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Completion by a Grid Operator (only relevant once a pass exists) */}
            {(auditRes.status === 'Approved' || auditRes.status === 'Completed') && (
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                    <ShieldCheck className="h-4 w-4 text-cyan-500" />
                    <span>Grid Operator Verification</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    auditRes.status === 'Completed'
                      ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {auditRes.status === 'Completed' ? 'Completed' : 'Not yet verified'}
                  </span>
                </div>

                {auditRes.status === 'Completed' ? (
                  <div className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Completed by:</span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30">
                        {auditRes.completedByOperatorNic || 'Not recorded'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Completed at:</span>
                      <span className="tabular-nums">
                        {formatTimestamp(auditRes.completedAt || auditRes.updatedAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Completes when a Grid Operator verifies the prosumer's QR pass at {auditRes.stationName || 'the station'}.
                  </p>
                )}
              </div>
            )}

            {/* Cancellation details (if cancelled) */}
            {auditRes.status === 'Cancelled' && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                  <XCircle className="h-4 w-4 text-rose-500" />
                  <span>Cancellation</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <span className="font-medium text-slate-500 dark:text-slate-400">Reason:</span>
                    <p className="font-semibold text-rose-700 dark:text-rose-300 mt-0.5 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                      {auditRes.cancellationReason || 'No reason recorded.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Cancelled at:</span>
                    <span className="tabular-nums text-slate-700 dark:text-slate-300">{formatTimestamp(auditRes.updatedAt)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <span className="font-bold text-slate-900 dark:text-white block">Timeline</span>
              <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center justify-between gap-3">
                  <span>Created:</span>
                  <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatTimestamp(auditRes.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Scheduled for:</span>
                  <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatTimestamp(auditRes.scheduledDateTime)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Last updated:</span>
                  <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatTimestamp(auditRes.updatedAt)}</span>
                </div>
                {auditRes.qrCodeToken && (auditRes.status === 'Approved' || auditRes.status === 'Completed') && (
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-0.5">QR token:</span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 break-all">{auditRes.qrCodeToken}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsAuditDrawerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
