import React, { useState, useEffect } from 'react';
import { 
  Plus, Cpu, MapPin, Battery, Calendar, AlertCircle, 
  CheckCircle2, ShieldAlert, Edit3, Power, RefreshCw, 
  Clock, Navigation, ShieldCheck 
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

export default function NodeManagement({ theme }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    stationCode: '',
    name: '',
    latitude: 6.9271,
    longitude: 79.8612,
    address: '',
    capacityKwh: 500,
    totalBatterySlots: 20,
    availableBatterySlots: 20,
    openTime: '06:00',
    closeTime: '22:00'
  });

  const fetchStations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stations');
      setStations(res.data || []);
    } catch (err) {
      console.error('Failed to load solar stations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const openCreateModal = () => {
    setEditingStation(null);
    setFormData({
      stationCode: 'HUB-NEW-' + Math.floor(100 + Math.random() * 900),
      name: '',
      latitude: 6.9271,
      longitude: 79.8612,
      address: '',
      capacityKwh: 500,
      totalBatterySlots: 20,
      availableBatterySlots: 20,
      openTime: '06:00',
      closeTime: '22:00'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (station) => {
    setEditingStation(station);
    setFormData({
      stationCode: station.stationCode,
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
      address: station.address,
      capacityKwh: station.capacityKwh,
      totalBatterySlots: station.totalBatterySlots,
      availableBatterySlots: station.availableBatterySlots,
      openTime: station.schedule?.openTime || '06:00',
      closeTime: station.schedule?.closeTime || '22:00'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      stationCode: formData.stationCode,
      name: formData.name,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      address: formData.address,
      capacityKwh: parseFloat(formData.capacityKwh),
      totalBatterySlots: parseInt(formData.totalBatterySlots),
      availableBatterySlots: parseInt(formData.availableBatterySlots),
      schedule: {
        openTime: formData.openTime,
        closeTime: formData.closeTime,
        daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      isActive: true
    };

    try {
      if (editingStation) {
        await api.put(`/stations/${editingStation.id}`, payload);
        setSuccess(`Solar Station '${formData.name}' specifications updated.`);
      } else {
        await api.post('/stations', payload);
        setSuccess(`New Microgrid Station '${formData.name}' registered.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccess(''), 4000);
      fetchStations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save solar station.');
    }
  };

  const handleToggleActive = async (station) => {
    setError('');
    setSuccess('');
    try {
      if (station.isActive) {
        // Enforce backend check: blocked if active energy reservations exist
        await api.post(`/stations/${station.id}/deactivate`);
        setSuccess(`Station '${station.name}' successfully deactivated.`);
      } else {
        await api.post(`/stations/${station.id}/reactivate`);
        setSuccess(`Station '${station.name}' reactivated.`);
      }
      setTimeout(() => setSuccess(''), 4000);
      fetchStations();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
      setTimeout(() => setError(''), 6000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Infrastructure Grid
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Solar Microgrid Hub Nodes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure generation capacity, battery storage slots, and daily operating windows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStations}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-500 dark:text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Add Solar Hub</span>
          </button>
        </div>
      </div>

      {/* Enterprise Deactivation Rule Safeguard Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-slate-900/60 border border-amber-500/30 backdrop-blur-md flex items-start gap-3.5 transition-colors duration-300">
        <ShieldAlert className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-amber-700 dark:text-amber-300 block mb-0.5">FAT-Service Integrity Constraint:</span>
          <span className="text-slate-600 dark:text-slate-300">
            A solar microgrid node CANNOT be deactivated if active or pending energy reservations are scheduled against it. Deactivation requests are strictly evaluated on the central Web API.
          </span>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-start gap-3 font-medium animate-in fade-in">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-red-500" />
          <div>
            <strong className="block font-bold">Action Blocked by Central Business Rule:</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3 font-medium animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Stations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stations.map((station) => {
          const slotPercent = Math.round((station.availableBatterySlots / (station.totalBatterySlots || 1)) * 100);
          return (
            <div
              key={station.id}
              className={`rounded-3xl border transition-all duration-300 overflow-hidden backdrop-blur-xl shadow-sm dark:shadow-xl ${
                station.isActive
                  ? 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-amber-500/5 hover:-translate-y-1'
                  : 'bg-slate-50 dark:bg-slate-950/60 border-red-200 dark:border-red-900/30 opacity-75'
              }`}
            >
              {/* Card Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700/60 rounded-lg">
                    {station.stationCode}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                      station.isActive
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${station.isActive ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                    <span>{station.isActive ? 'Operational' : 'Deactivated'}</span>
                  </span>
                </div>

                <h3 className="mt-3.5 text-lg font-display font-bold text-slate-900 dark:text-white">{station.name}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{station.address}</span>
                </p>
              </div>

              {/* Card Specs */}
              <div className="p-6 space-y-4 text-xs">
                {/* Gen Capacity */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Photovoltaic Output:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{station.capacityKwh} kW</span>
                </div>

                {/* Battery Slots with Visual Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Battery className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Battery Storage Slots:
                    </span>
                    <span className="font-bold font-mono text-slate-900 dark:text-white">
                      {station.availableBatterySlots} / {station.totalBatterySlots} Free
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        slotPercent > 50
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : slotPercent > 20
                          ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                          : 'bg-gradient-to-r from-red-500 to-red-400'
                      }`}
                      style={{ width: `${slotPercent}%` }}
                    />
                  </div>
                </div>

                {/* Operating Window */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /> Schedule:
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {station.schedule?.openTime} - {station.schedule?.closeTime}
                  </span>
                </div>

                {/* GPS Coordinates */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" /> GPS:
                  </span>
                  <span>{station.latitude?.toFixed(4)}, {station.longitude?.toFixed(4)}</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => openEditModal(station)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Configure</span>
                </button>

                <button
                  onClick={() => handleToggleActive(station)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    station.isActive
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  }`}
                  title={station.isActive ? 'Deactivation blocked if active reservations exist' : 'Reactivate station'}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{station.isActive ? 'Deactivate' : 'Reactivate'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStation ? 'Configure Solar Hub Specifications' : 'Register New Solar Grid Hub'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Station Code</label>
              <input
                type="text"
                required
                value={formData.stationCode}
                onChange={(e) => setFormData({ ...formData, stationCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hub Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Colombo South Station"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Physical Location Address</label>
            <input
              type="text"
              required
              placeholder="e.g. 102 Baseline Road, Colombo"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS Latitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS Longitude</label>
              <input
                type="number"
                step="0.0001"
                required
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Output (kW)</label>
              <input
                type="number"
                min="1"
                required
                value={formData.capacityKwh}
                onChange={(e) => setFormData({ ...formData, capacityKwh: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Battery Storage Slots</label>
              <input
                type="number"
                min="1"
                required
                value={formData.totalBatterySlots}
                onChange={(e) => setFormData({ ...formData, totalBatterySlots: e.target.value, availableBatterySlots: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Open Time</label>
              <input
                type="time"
                value={formData.openTime}
                onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Close Time</label>
              <input
                type="time"
                value={formData.closeTime}
                onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
            >
              {editingStation ? 'Save Changes' : 'Register Hub'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
