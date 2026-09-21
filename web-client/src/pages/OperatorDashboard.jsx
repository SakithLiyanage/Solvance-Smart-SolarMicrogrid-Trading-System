import React, { useState, useEffect } from 'react';
import { 
  Zap, Battery, QrCode, CheckCircle2, AlertCircle, RefreshCw, 
  Building2, ArrowRight, ShieldCheck, Clock
} from 'lucide-react';
import api from '../api/client';

export default function OperatorDashboard({ theme }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrInput, setQrInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [slotUpdatingId, setSlotUpdatingId] = useState(null);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stations');
      setStations(res.data || []);
    } catch (err) {
      console.error('Failed to load stations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleVerifyQr = async (e) => {
    e.preventDefault();
    if (!qrInput.trim()) return;

    setVerifying(true);
    setVerifyResult(null);
    setVerifyError('');

    try {
      const res = await api.post('/reservations/verify-qr', {
        qrCodeToken: qrInput.trim()
      });
      setVerifyResult(res.data?.message || 'QR code verified successfully. Job completed.');
      setQrInput('');
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'QR verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleAdjustSlots = async (station, delta) => {
    const newCount = station.availableBatterySlots + delta;
    if (newCount < 0 || newCount > station.totalBatterySlots) return;

    setSlotUpdatingId(station.id);
    try {
      await api.put(`/stations/${station.id}/battery-slots`, {
        availableBatterySlots: newCount
      });
      fetchStations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update battery slots.');
    } finally {
      setSlotUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Operational Terminal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Grid Operator Station Terminal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time battery storage monitoring, dynamic slot adjustments, and QR validation.
          </p>
        </div>

        <button
          onClick={fetchStations}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-emerald-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Telemetry</span>
        </button>
      </div>

      {/* QR Code Verification Card */}
      <div className="p-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-slate-900/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <QrCode className="h-5 w-5 text-emerald-500" />
          <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
            Dispatch QR Code Verification & Job Finalizer
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Enter or scan the cryptographic token from prosumer mobile app to verify booking and finalize power transfer.
        </p>

        <form onSubmit={handleVerifyQr} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            placeholder="e.g. SLV-A1B2C3D4E5F6..."
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <button
            type="submit"
            disabled={verifying}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{verifying ? 'Verifying...' : 'Validate & Finalize Transfer'}</span>
          </button>
        </form>

        {verifyResult && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{verifyResult}</span>
          </div>
        )}

        {verifyError && (
          <div className="mt-4 p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}
      </div>

      {/* Real-time Stations Slot Monitor */}
      <div>
        <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white mb-3">
          Active Station Slot Telemetry & Quick Adjust
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin mx-auto mb-2" />
              <span>Loading station telemetry...</span>
            </div>
          ) : (
            stations.map((station) => (
              <div 
                key={station.id || station.stationCode}
                className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 backdrop-blur-xl shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      {station.stationCode}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">{station.name}</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    station.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {station.isActive ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Battery Storage Slots:</span>
                    <span className="font-bold text-emerald-500 font-mono text-sm">
                      {station.availableBatterySlots} / {station.totalBatterySlots} Available
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(station.availableBatterySlots / (station.totalBatterySlots || 1)) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">Quick Adjust Slots:</span>
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleAdjustSlots(station, -1)}
                        disabled={station.availableBatterySlots <= 0 || slotUpdatingId === station.id}
                        className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold flex items-center justify-center text-sm disabled:opacity-40"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleAdjustSlots(station, 1)}
                        disabled={station.availableBatterySlots >= station.totalBatterySlots || slotUpdatingId === station.id}
                        className="h-7 w-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold flex items-center justify-center text-sm disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
