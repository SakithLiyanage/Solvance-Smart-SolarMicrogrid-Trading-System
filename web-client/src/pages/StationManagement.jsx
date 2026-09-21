import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Zap, Battery, MapPin, Power, Edit3, Trash2, 
  RefreshCw, CheckCircle2, AlertCircle, X, ShieldAlert, Clock
} from 'lucide-react';
import api from '../api/client';

export default function StationManagement({ theme }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    stationCode: '',
    name: '',
    latitude: '',
    longitude: '',
    address: '',
    capacityKwh: 500,
    totalBatterySlots: 20,
    availableBatterySlots: 15,
    openTime: '06:00',
    closeTime: '20:00',
    isActive: true
  });

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

  const openCreateModal = () => {
    setEditingStation(null);
    setFormData({
      stationCode: `ST-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      latitude: 6.9271,
      longitude: 79.8612,
      address: '',
      capacityKwh: 450,
      totalBatterySlots: 16,
      availableBatterySlots: 12,
      openTime: '06:00',
      closeTime: '20:00',
      isActive: true
    });
    setError('');
    setShowModal(true);
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
      closeTime: station.schedule?.closeTime || '20:00',
      isActive: station.isActive
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      stationCode: formData.stationCode.trim(),
      name: formData.name.trim(),
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      address: formData.address.trim(),
      capacityKwh: parseFloat(formData.capacityKwh),
      totalBatterySlots: parseInt(formData.totalBatterySlots),
      availableBatterySlots: parseInt(formData.availableBatterySlots),
      schedule: {
        openTime: formData.openTime,
        closeTime: formData.closeTime,
        operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
      },
      isActive: formData.isActive
    };

    try {
      if (editingStation) {
        await api.put(`/stations/${editingStation.id}`, payload);
        setMessage(`Station '${payload.name}' updated successfully.`);
      } else {
        await api.post('/stations', payload);
        setMessage(`Microgrid node '${payload.name}' provisioned successfully.`);
      }
      setShowModal(false);
      fetchStations();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save station specifications.');
    }
  };

  const handleToggleStatus = async (station) => {
    try {
      setError('');
      if (station.isActive) {
        await api.put(`/stations/${station.id}/deactivate`);
        setMessage(`Microgrid node '${station.name}' deactivated.`);
      } else {
        await api.put(`/stations/${station.id}/reactivate`);
        setMessage(`Microgrid node '${station.name}' reactivated.`);
      }
      fetchStations();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed.');
    }
  };

  const filteredStations = stations.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.stationCode.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Grid Infrastructure
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Microgrid Hub Nodes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage solar distribution stations, GPS locations, capacity (kW/h), and battery slot storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStations}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Node</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {message && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search stations by name, code, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Total Hubs: <span className="text-amber-500 font-bold">{stations.length}</span> ({stations.filter(s => s.isActive).length} Active)
        </div>
      </div>

      {/* Stations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <RefreshCw className="h-6 w-6 text-amber-500 animate-spin mx-auto mb-2" />
            <span>Loading microgrid stations...</span>
          </div>
        ) : filteredStations.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            No microgrid stations match your search.
          </div>
        ) : (
          filteredStations.map((station) => (
            <div 
              key={station.id || station.stationCode}
              className={`p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl flex flex-col justify-between ${
                station.isActive 
                  ? 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/40' 
                  : 'bg-slate-100/60 dark:bg-slate-950/40 border-slate-300 dark:border-slate-800/40 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      {station.stationCode}
                    </span>
                    <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white mt-1.5">
                      {station.name}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    station.isActive 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' 
                      : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${station.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span>{station.isActive ? 'Active' : 'Offline'}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5 mb-4">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{station.address}</span>
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/60 text-xs mb-4">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Capacity</div>
                    <div className="font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                      <Zap className="h-3.5 w-3.5" />
                      <span>{station.capacityKwh} kWh</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Battery Slots</div>
                    <div className="font-bold text-emerald-500 flex items-center gap-1 mt-0.5">
                      <Battery className="h-3.5 w-3.5" />
                      <span>{station.availableBatterySlots} / {station.totalBatterySlots}</span>
                    </div>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-800/40 text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>Operating Hours: {station.schedule?.openTime || '06:00'} - {station.schedule?.closeTime || '20:00'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800/60 gap-2">
                <button
                  onClick={() => openEditModal(station)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5 text-amber-500" />
                  <span>Edit</span>
                </button>

                <button
                  onClick={() => handleToggleStatus(station)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    station.isActive
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>{station.isActive ? 'Deactivate' : 'Reactivate'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                {editingStation ? 'Edit Microgrid Hub' : 'Provision Microgrid Hub'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-300 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Station Code</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingStation}
                    value={formData.stationCode}
                    onChange={(e) => setFormData({ ...formData, stationCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hub Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kandy Solar Substation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  required
                  placeholder="Street Address, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Latitude (GPS)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Longitude (GPS)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Capacity (kWh)</label>
                  <input
                    type="number"
                    required
                    value={formData.capacityKwh}
                    onChange={(e) => setFormData({ ...formData, capacityKwh: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Total Slots</label>
                  <input
                    type="number"
                    required
                    value={formData.totalBatterySlots}
                    onChange={(e) => setFormData({ ...formData, totalBatterySlots: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Available Slots</label>
                  <input
                    type="number"
                    required
                    value={formData.availableBatterySlots}
                    onChange={(e) => setFormData({ ...formData, availableBatterySlots: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Open Time</label>
                  <input
                    type="time"
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Close Time</label>
                  <input
                    type="time"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 active:scale-95"
                >
                  {editingStation ? 'Update Station' : 'Save Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
