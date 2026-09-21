import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Calendar, Clock, Zap, CheckCircle2, 
  XCircle, AlertCircle, RefreshCw, Eye, ArrowUpRight, ArrowDownLeft,
  User, Building2, QrCode, X
} from 'lucide-react';
import api from '../api/client';

export default function ReservationManagement({ theme }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [message, setMessage] = useState('');
  const [selectedRes, setSelectedRes] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reservations');
      setReservations(res.data || []);
    } catch (err) {
      console.error('Failed to load reservations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCancelReservation = async () => {
    if (!selectedRes) return;
    try {
      await api.post(`/reservations/${selectedRes.id}/cancel`, {
        reason: cancelReason || 'Cancelled by backoffice administration'
      });
      setMessage(`Reservation ${selectedRes.reservationNumber} cancelled successfully.`);
      setShowCancelModal(false);
      setSelectedRes(null);
      setCancelReason('');
      fetchReservations();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel reservation.');
    }
  };

  const filteredReservations = reservations.filter((r) => {
    const matchesSearch =
      (r.reservationNumber && r.reservationNumber.toLowerCase().includes(search.toLowerCase())) ||
      (r.prosumerNic && r.prosumerNic.toLowerCase().includes(search.toLowerCase())) ||
      (r.stationName && r.stationName.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchesType = typeFilter === 'All' || r.tradeType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Energy Trading Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Slot Booking & Reservations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            7-Day future schedule limits and 12-Hour modification rules strictly enforced by FAT API.
          </p>
        </div>

        <button
          onClick={fetchReservations}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Bookings</span>
        </button>
      </div>

      {/* Toast */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Res #, Prosumer NIC, Station..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['All', 'Approved', 'Completed', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === status
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-4 px-6">Booking Number</th>
                <th className="py-4 px-6">Prosumer NIC</th>
                <th className="py-4 px-6">Microgrid Hub</th>
                <th className="py-4 px-6">Scheduled Slot</th>
                <th className="py-4 px-6">Energy / Type</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 text-amber-500 animate-spin mx-auto mb-2" />
                    <span>Loading trading reservations...</span>
                  </td>
                </tr>
              ) : filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No reservations matching current filters.
                  </td>
                </tr>
              ) : (
                filteredReservations.map((r) => (
                  <tr key={r.id || r.reservationNumber} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                        {r.reservationNumber}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-bold">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{r.prosumerNic}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-semibold">{r.stationName}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>{new Date(r.scheduledDateTime).toLocaleString()}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{r.energyAmountKwh} kWh</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          r.tradeType === 'DropOff' 
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                            : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                        }`}>
                          {r.tradeType === 'DropOff' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          <span>{r.tradeType}</span>
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        r.status === 'Approved'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : r.status === 'Completed'
                          ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          r.status === 'Approved' ? 'bg-emerald-500' : r.status === 'Completed' ? 'bg-cyan-500' : 'bg-red-500'
                        }`} />
                        <span>{r.status}</span>
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right">
                      {r.status === 'Approved' && (
                        <button
                          onClick={() => {
                            setSelectedRes(r);
                            setShowCancelModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 text-xs font-bold transition cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && selectedRes && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Cancel Reservation {selectedRes.reservationNumber}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enforcing FAT rule: Are you sure you want to cancel this booking scheduled for {new Date(selectedRes.scheduledDateTime).toLocaleString()}?
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for Cancellation</label>
              <textarea
                rows={3}
                placeholder="Provide reason for audit log..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelReservation}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs shadow-md active:scale-95"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
