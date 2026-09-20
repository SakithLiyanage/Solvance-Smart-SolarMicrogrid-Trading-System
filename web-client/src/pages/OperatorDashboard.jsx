// ============================================================================
// File: OperatorDashboard.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: H.N. Madubashini (IT23192300)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Site Operator workstation for cryptographic QR verification, booking approval, and battery telemetry.
// References & Citations:
//   - React 18 Dynamic Refs & Modal Portals (useRef, useState):
//     https://react.dev/
//   - Cryptographic QR Verification & Business Logic Finalization:
//     https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography
//   - Tailwind CSS Complex Operational Terminal Dashboard:
//     https://tailwindcss.com/
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  Battery, QrCode, CheckCircle2, AlertCircle, Search, RefreshCw, 
  Zap, Clock, ShieldCheck, Filter, Scan, Check, BatteryCharging,
  ArrowRight, Radio, Eye, Plus, Edit3, XCircle, Trash2, Calendar
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

export default function OperatorDashboard({ user, theme, activeTab }) {
  const qrSectionRef = useRef(null);
  const qrInputRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'bookings' && qrSectionRef.current) {
      qrSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      qrInputRef.current?.focus();
    }
  }, [activeTab]);

  const [stations, setStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState('');
  const [availableSlots, setAvailableSlots] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);
  const [slotUpdateMsg, setSlotUpdateMsg] = useState('');

  // Reservations Monitor
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchNic, setSearchNic] = useState('');

  // Create / Edit / Cancel / Approve State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    prosumerNic: '',
    stationId: '',
    scheduledDateTime: '',
    energyAmountKwh: 15,
    tradeType: 'DropOff'
  });
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const [editingReservation, setEditingReservation] = useState(null);
  const [editForm, setEditForm] = useState({
    scheduledDateTime: '',
    energyAmountKwh: 15,
    tradeType: 'DropOff'
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const [cancellingReservation, setCancellingReservation] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  const [approvalMsg, setApprovalMsg] = useState('');

  // QR Verification
  const [qrToken, setQrToken] = useState('');
  const [qrResult, setQrResult] = useState(null);
  const [qrError, setQrError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const loadOperationalData = async () => {
    try {
      const stationRes = await api.get('/stations');
      const stationList = stationRes.data || [];
      setStations(stationList);
      if (stationList.length > 0 && !selectedStationId) {
        setSelectedStationId(stationList[0].id);
        setAvailableSlots(stationList[0].availableBatterySlots);
        setTotalSlots(stationList[0].totalBatterySlots);
      }
    } catch (err) {
      console.error('Failed to load solar stations', err);
    }

    try {
      const resRes = await api.get('/reservations');
      setReservations(resRes.data || []);
    } catch (err) {
      console.error('Failed to load reservations', err);
    } finally {
      setLoadingReservations(false);
    }
  };

  useEffect(() => {
    loadOperationalData();
  }, []);

  const handleStationChange = (id) => {
    setSelectedStationId(id);
    const station = stations.find((s) => s.id === id);
    if (station) {
      setAvailableSlots(station.availableBatterySlots);
      setTotalSlots(station.totalBatterySlots);
    }
  };

  const handleUpdateSlots = async () => {
    if (!selectedStationId) {
      alert('Please select an active solar hub first.');
      return;
    }

    try {
      await api.patch(`/stations/${selectedStationId}/battery-slots`, {
        availableSlots: parseInt(availableSlots)
      });
      setSlotUpdateMsg('Battery slot inventory synchronized with the live microgrid.');
      setTimeout(() => setSlotUpdateMsg(''), 4000);
      loadOperationalData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update battery slots.');
    }
  };

  const handleVerifyQr = async (tokenToVerify) => {
    const token = tokenToVerify || qrToken;
    if (!token.trim()) return;

    setVerifying(true);
    setQrError('');
    setQrResult(null);

    try {
      const res = await api.post('/reservations/verify-qr', {
        qrCodeToken: token.trim()
      });
      setQrResult(res.data.summary || res.data.reservation);
      setQrToken('');
      loadOperationalData();
    } catch (err) {
      setQrError(err.response?.data?.message || 'Verification failed. Invalid or already processed QR token.');
    } finally {
      setVerifying(false);
    }
  };

  const handleApproveReservation = async (id) => {
    try {
      await api.post(`/reservations/${id}/approve`);
      setApprovalMsg(`Reservation approved successfully! Cryptographic QR code pass issued.`);
      setTimeout(() => setApprovalMsg(''), 4000);
      loadOperationalData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve reservation.');
    }
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    try {
      if (!createForm.stationId) {
        setCreateError('Please select a solar station hub.');
        return;
      }
      const payload = {
        ...createForm,
        energyAmountKwh: parseFloat(createForm.energyAmountKwh),
        scheduledDateTime: new Date(createForm.scheduledDateTime).toISOString()
      };
      const res = await api.post('/reservations', payload);
      setCreateSuccess(`Booking ${res.data.reservationNumber} created successfully.`);
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess('');
      }, 1500);
      loadOperationalData();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create reservation.');
    }
  };

  const handleOpenEdit = (res) => {
    setEditingReservation(res);
    const d = new Date(res.scheduledDateTime);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditForm({
      scheduledDateTime: localIso,
      energyAmountKwh: res.energyAmountKwh,
      tradeType: res.tradeType || 'DropOff'
    });
    setEditError('');
    setEditSuccess('');
  };

  const handleUpdateReservation = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');
    try {
      const payload = {
        scheduledDateTime: new Date(editForm.scheduledDateTime).toISOString(),
        energyAmountKwh: parseFloat(editForm.energyAmountKwh),
        tradeType: editForm.tradeType
      };
      await api.put(`/reservations/${editingReservation.id}`, payload);
      setEditSuccess('Reservation modified successfully.');
      setTimeout(() => {
        setEditingReservation(null);
        setEditSuccess('');
      }, 1500);
      loadOperationalData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to modify reservation.');
    }
  };

  const handleOpenCancel = (res) => {
    setCancellingReservation(res);
    setCancelReason('');
    setCancelError('');
    setCancelSuccess('');
  };

  const handleCancelReservation = async (e) => {
    e.preventDefault();
    setCancelError('');
    setCancelSuccess('');
    try {
      await api.post(`/reservations/${cancellingReservation.id}/cancel`, {
        reason: cancelReason || 'Cancelled by Operator / Backoffice'
      });
      setCancelSuccess('Reservation cancelled successfully.');
      setTimeout(() => {
        setCancellingReservation(null);
        setCancelSuccess('');
      }, 1500);
      loadOperationalData();
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel reservation.');
    }
  };

  const filteredReservations = reservations.filter((r) => {
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchesNic =
      !searchNic ||
      r.prosumerNic.toLowerCase().includes(searchNic.toLowerCase()) ||
      r.reservationNumber.toLowerCase().includes(searchNic.toLowerCase());
    return matchesStatus && matchesNic;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Operations Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Grid Operator Terminal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time battery inventory synchronization, simulated optical QR scanner, and automated job completion.
          </p>
        </div>

        <button
          onClick={loadOperationalData}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
          <span>Sync Grid State</span>
        </button>
      </div>

      {/* Interactive Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Battery Slot Manager */}
        <div className="lg:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-sm dark:shadow-xl space-y-5 transition-colors duration-300">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white font-display font-bold text-lg">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center">
              <Battery className="h-5 w-5" />
            </div>
            <div>
              <h3>Battery Storage Slot Inventory</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-normal">Adjust live available battery racks at solar hubs</p>
            </div>
          </div>

          {slotUpdateMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>{slotUpdateMsg}</span>
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Active Solar Hub</label>
              <select
                value={selectedStationId}
                onChange={(e) => handleStationChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stationCode} &mdash; {s.name} ({s.availableBatterySlots}/{s.totalBatterySlots} Available)
                  </option>
                ))}
              </select>
            </div>

            {/* Slider & Meter */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">Available Battery Capacity:</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono text-sm">{availableSlots} of {totalSlots} Slots Free</span>
              </div>

              <input
                type="range"
                min="0"
                max={totalSlots || 20}
                value={availableSlots}
                onChange={(e) => setAvailableSlots(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
              />

              <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                <span>0 Occupied (Exhausted)</span>
                <span>Max Capacity ({totalSlots})</span>
              </div>
            </div>

            {/* Micro Stepper and Save Button */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAvailableSlots(Math.max(0, availableSlots - 1))}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 active:scale-95 transition cursor-pointer"
              >
                -1
              </button>

              <input
                type="number"
                min="0"
                max={totalSlots}
                value={availableSlots}
                onChange={(e) => setAvailableSlots(parseInt(e.target.value) || 0)}
                className="w-20 text-center py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
              />

              <button
                type="button"
                onClick={() => setAvailableSlots(Math.min(totalSlots, availableSlots + 1))}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 active:scale-95 transition cursor-pointer"
              >
                +1
              </button>

              <button
                onClick={handleUpdateSlots}
                className="ml-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
              >
                Sync Battery State
              </button>
            </div>
          </div>
        </div>

        {/* Optical QR Scanner Viewport */}
        <div 
          ref={qrSectionRef}
          className={`lg:col-span-6 rounded-3xl border ${
            activeTab === 'bookings' 
              ? 'border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10' 
              : 'border-slate-200 dark:border-slate-800/80'
          } bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-sm dark:shadow-xl space-y-5 transition-all duration-300`}
        >
          <div className="flex items-center gap-3 text-slate-900 dark:text-white font-display font-bold text-lg">
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <h3>QR Dispatch &amp; Physical Scan Terminal</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-normal">Decode prosumer tamper-proof tokens to finalize transactions</p>
            </div>
          </div>

          {/* Scanner Simulation Window */}
          <div className="relative h-44 rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden flex flex-col items-center justify-center p-4 shadow-inner">
            <div className="absolute inset-6 border border-cyan-500/20 rounded-xl pointer-events-none" />
            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

            <div className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scan-laser pointer-events-none" />

            <QrCode className="h-12 w-12 text-slate-600 mb-2" />
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
              HOLOGRAPHIC SCANNER ACTIVE
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">Ready to parse SOLAR-TX tokens</span>
          </div>

          {/* Verification Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleVerifyQr(); }} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transaction Token Payload
              </label>
              <div className="flex gap-2">
                <input
                  ref={qrInputRef}
                  type="text"
                  required
                  placeholder="e.g. SOLAR-TX:RES-18498637:07AF828EED4D"
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-cyan-600 dark:text-cyan-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 transition shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {verifying ? 'Decoding...' : 'Execute'}
                </button>
              </div>
            </div>
          </form>

          {qrError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{qrError}</span>
            </div>
          )}

          {qrResult && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span>Job Completed &amp; Transaction Finalized!</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div>Reservation: <span className="font-bold text-slate-900 dark:text-white">{qrResult.reservationNumber}</span></div>
                <div>Prosumer NIC: <span className="font-bold text-slate-900 dark:text-white">{qrResult.prosumerNic}</span></div>
                <div>Energy Amount: <span className="font-bold text-slate-900 dark:text-white">{qrResult.energyAmountKwh} kWh</span></div>
                <div>Station Hub: <span className="font-bold text-slate-900 dark:text-white">{qrResult.stationName}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Success Banner */}
      {approvalMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{approvalMsg}</span>
        </div>
      )}

      {/* Bookings Monitoring Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Live Microgrid Trading Ledger</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time schedule of prosumer energy drop-offs, approvals, and battery draws.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setCreateForm({
                  prosumerNic: '',
                  stationId: stations[0]?.id || '',
                  scheduledDateTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
                  energyAmountKwh: 15,
                  tradeType: 'DropOff'
                });
                setCreateError('');
                setCreateSuccess('');
                setIsCreateModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Booking</span>
            </button>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter NIC or Res #"
                value={searchNic}
                onChange={(e) => setSearchNic(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-44 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {['All', 'Approved', 'Pending', 'Completed', 'Cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loadingReservations ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <RefreshCw className="h-6 w-6 text-amber-500 dark:text-amber-400 animate-spin mx-auto mb-2" />
            <span>Loading reservation feed...</span>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No energy reservations match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Reservation #</th>
                  <th className="px-6 py-4">Prosumer NIC</th>
                  <th className="px-6 py-4">Station &amp; Trade Type</th>
                  <th className="px-6 py-4">Scheduled Window</th>
                  <th className="px-6 py-4">Lifecycle Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                {filteredReservations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-amber-600 dark:text-amber-400">{r.reservationNumber}</td>
                    <td className="px-6 py-4 font-mono text-slate-600 dark:text-slate-300">{r.prosumerNic}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-white">{r.stationName}</div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-semibold">
                        {r.energyAmountKwh} kWh &bull; {r.tradeType}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(r.scheduledDateTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          r.status === 'Approved'
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                            : r.status === 'Completed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                            : r.status === 'Cancelled'
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span>{r.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === 'Pending' && (
                          <button
                            onClick={() => handleApproveReservation(r.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                            title="Approve Reservation & Issue QR"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        {r.status === 'Approved' && r.qrCodeToken && (
                          <button
                            onClick={() => handleVerifyQr(r.qrCodeToken)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                            title="Simulate immediate optical scan"
                          >
                            <Scan className="h-3.5 w-3.5" />
                            <span>Verify QR</span>
                          </button>
                        )}
                        {(r.status === 'Pending' || r.status === 'Approved') && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                              title="Modify scheduled window or energy"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleOpenCancel(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                              title="Cancel reservation"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}
                        {(r.status === 'Completed' || r.status === 'Cancelled') && (
                          <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]">Finalized</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Reservation */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Prosumer Reservation"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateReservation} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}
          {createSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{createSuccess}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Prosumer NIC</label>
            <input
              type="text"
              required
              placeholder="e.g. 200012345678 or 987654321V"
              value={createForm.prosumerNic}
              onChange={(e) => setCreateForm({ ...createForm, prosumerNic: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Solar Microgrid Hub</label>
            <select
              value={createForm.stationId}
              onChange={(e) => setCreateForm({ ...createForm, stationId: e.target.value })}
              required
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">Select station...</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.location})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Energy Quota (kWh)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="500"
                required
                value={createForm.energyAmountKwh}
                onChange={(e) => setCreateForm({ ...createForm, energyAmountKwh: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Trade Type</label>
              <select
                value={createForm.tradeType}
                onChange={(e) => setCreateForm({ ...createForm, tradeType: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="DropOff">DropOff (Feed to Grid)</option>
                <option value="PickUp">PickUp (Draw from Grid)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Scheduled Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              value={createForm.scheduledDateTime}
              onChange={(e) => setCreateForm({ ...createForm, scheduledDateTime: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              Submit Booking
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Reservation */}
      <Modal
        isOpen={editingReservation !== null}
        onClose={() => setEditingReservation(null)}
        title={`Modify Reservation #${editingReservation?.reservationNumber || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateReservation} className="space-y-4 text-xs">
          {editError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}
          {editSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{editSuccess}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Energy Quota (kWh)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="500"
              required
              value={editForm.energyAmountKwh}
              onChange={(e) => setEditForm({ ...editForm, energyAmountKwh: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Trade Type</label>
            <select
              value={editForm.tradeType}
              onChange={(e) => setEditForm({ ...editForm, tradeType: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="DropOff">DropOff (Feed to Grid)</option>
              <option value="PickUp">PickUp (Draw from Grid)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Scheduled Date &amp; Time</label>
            <input
              type="datetime-local"
              required
              value={editForm.scheduledDateTime}
              onChange={(e) => setEditForm({ ...editForm, scheduledDateTime: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditingReservation(null)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Cancel Reservation */}
      <Modal
        isOpen={cancellingReservation !== null}
        onClose={() => setCancellingReservation(null)}
        title={`Cancel Reservation #${cancellingReservation?.reservationNumber || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCancelReservation} className="space-y-4 text-xs">
          {cancelError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{cancelError}</span>
            </div>
          )}
          {cancelSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{cancelSuccess}</span>
            </div>
          )}

          <p className="text-slate-600 dark:text-slate-300">
            Are you sure you want to cancel this reservation? This will release reserved capacity back to the microgrid node.
          </p>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Cancellation Reason</label>
            <textarea
              rows={3}
              placeholder="e.g. Schedule conflict, equipment offline, customer request..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCancellingReservation(null)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-md shadow-red-500/20 transition active:scale-95 cursor-pointer"
            >
              Confirm Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
