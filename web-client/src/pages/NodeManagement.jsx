/**
 * Microgrid Hubs & Node Management Console with Interactive Google Maps Explorer
 * Author: G.L.S. Chanlaka (IT23151260)
 * Module: SE4040 - Enterprise Application Development (SLIIT)
 *
 * References & Technical Citations:
 * - Google Maps Embed API: https://developers.google.com/maps/documentation/embed/get-started
 * - OpenStreetMap Foundation Tile Service: https://www.openstreetmap.org/
 */

// ============================================================================
// File: NodeManagement.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: G.L.S. Chanlaka (IT23151260)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Microgrid solar station administration portal with GPS coordinates, battery slot drawer, and deactivation safeguards.
// References & Citations:
//   - Google Maps Embed API (Responsive Station Visualizer):
//     https://developers.google.com/maps/documentation/embed/
//   - React 18 Form State & Dynamic Modal Drawers:
//     https://react.dev/
//   - Tailwind CSS Grid, Flexbox, and Glassmorphism Styling:
//     https://tailwindcss.com/
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Plus, Cpu, MapPin, Battery, Calendar, AlertCircle,
  CheckCircle2, ShieldAlert, Edit3, Power, RefreshCw,
  Clock, Navigation, ShieldCheck, ExternalLink, Eye, Map,
  BatteryCharging, Layers, Info
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [selectedMapStation, setSelectedMapStation] = useState(null);

  // Slots Management State
  const [slotStation, setSlotStation] = useState(null);
  const [stationSlots, setStationSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotDateFilter, setSlotDateFilter] = useState('');
  const [slotError, setSlotError] = useState('');
  const [slotSuccess, setSlotSuccess] = useState('');
  const [newSlotForm, setNewSlotForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: '08:00',
    endTime: '10:00',
    slotCapacityKwh: 50,
    availableSlots: 5,
    status: 'Open'
  });

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

  const fetchSlots = async (stationId, date) => {
    try {
      setLoadingSlots(true);
      setSlotError('');
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await api.get(`/slots/station/${stationId}${q}`);
      setStationSlots(res.data || []);
    } catch (err) {
      setSlotError('Failed to load trading slots for this solar hub.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const openSlotsModal = (station) => {
    setSlotStation(station);
    setSlotError('');
    setSlotSuccess('');
    setSlotDateFilter('');
    setNewSlotForm({
      date: new Date().toISOString().slice(0, 10),
      startTime: '08:00',
      endTime: '10:00',
      slotCapacityKwh: 50,
      availableSlots: 5,
      status: 'Open'
    });
    fetchSlots(station.id);
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!slotStation) return;
    setSlotError('');
    setSlotSuccess('');
    try {
      const payload = {
        stationId: slotStation.id,
        date: newSlotForm.date,
        startTime: newSlotForm.startTime,
        endTime: newSlotForm.endTime,
        slotCapacityKwh: parseFloat(newSlotForm.slotCapacityKwh),
        allocatedKwh: 0,
        availableSlots: parseInt(newSlotForm.availableSlots, 10),
        status: newSlotForm.status || 'Open'
      };
      await api.post('/slots', payload);
      setSlotSuccess('Trading slot created successfully.');
      fetchSlots(slotStation.id, slotDateFilter);
    } catch (err) {
      setSlotError(err.response?.data?.message || 'Failed to create energy slot.');
    }
  };

  const handleUpdateSlotAvailability = async (slotId, newAvailable, newAllocated) => {
    try {
      setSlotError('');
      await api.put(`/slots/${slotId}/availability`, {
        availableSlots: parseInt(newAvailable, 10),
        allocatedKwh: parseFloat(newAllocated)
      });
      setSlotSuccess('Slot capacity updated.');
      if (slotStation) fetchSlots(slotStation.id, slotDateFilter);
    } catch (err) {
      setSlotError(err.response?.data?.message || 'Failed to update slot.');
    }
  };

  const fetchStations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stations');
      const data = res.data || [];
      setStations(data);
      if (data.length > 0) {
        setSelectedMapStation((prev) => prev ? data.find(s => s.id === prev.id) || data[0] : data[0]);
      }
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
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Solar Microgrid Hub Nodes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure generation capacity, battery storage slots, and daily operating windows.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Grid View
            </button>
            <button
              onClick={() => {
                setViewMode('map');
                if (!selectedMapStation && stations.length > 0) setSelectedMapStation(stations[0]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'map'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Map className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              Google Map View
            </button>
          </div>

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

      {/* Notice Banner */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] dark:bg-slate-900/60 backdrop-blur-md p-3.5 sm:p-4 flex items-center gap-3 transition-colors duration-300">
        <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <strong className="font-semibold text-slate-900 dark:text-white mr-1.5">Notice:</strong>
          Solar hub stations with active or scheduled energy reservations cannot be deactivated until all bookings are completed or cancelled.
        </p>
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

      {/* Stations View: Map or Cards Grid */}
      {viewMode === 'map' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive Google Map Panel */}
          <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden shadow-sm dark:shadow-xl backdrop-blur-xl flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm">
                    {selectedMapStation ? selectedMapStation.name : 'Interactive Solar Map'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedMapStation ? `${selectedMapStation.latitude}° N, ${selectedMapStation.longitude}° E • ${selectedMapStation.address}` : 'Select a hub node to focus GPS coordinates'}
                  </p>
                </div>
              </div>
              {selectedMapStation && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedMapStation.latitude},${selectedMapStation.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition border border-slate-200 dark:border-slate-700"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="relative w-full h-[450px] sm:h-[520px] bg-slate-100 dark:bg-slate-950">
              {selectedMapStation ? (
                <iframe
                  title="Google Maps Station Explorer"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${selectedMapStation.latitude},${selectedMapStation.longitude}&hl=en&z=14&output=embed`}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Select a station node from the list to view on Google Maps.
                </div>
              )}
            </div>
          </div>

          {/* Station Selector & Telemetry List */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Active Microgrid Nodes ({stations.length})
            </h3>
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {stations.map((s) => {
                const isSelected = selectedMapStation && selectedMapStation.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedMapStation(s)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {s.stationCode}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.isActive ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
                        }`}>
                        {s.isActive ? 'Operational' : 'Inactive'}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{s.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{s.address}</p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-mono">
                      <span>{s.capacityKwh} kW Output</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openSlotsModal(s); }}
                        className="text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 font-sans text-xs cursor-pointer"
                        title="Configure Energy Trading Slots"
                      >
                        <BatteryCharging className="h-3.5 w-3.5" />
                        <span>Slots ({s.availableBatterySlots})</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Stations Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stations.map((station) => {
            const slotPercent = Math.round((station.availableBatterySlots / (station.totalBatterySlots || 1)) * 100);
            return (
              <div
                key={station.id}
                className={`rounded-3xl border transition-all duration-300 overflow-hidden backdrop-blur-xl shadow-sm dark:shadow-xl ${station.isActive
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
                      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${station.isActive
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

                  {/* Battery Storage Slots */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Battery className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Battery Storage Slots:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white font-mono">
                        {station.availableBatterySlots} / {station.totalBatterySlots} free
                      </span>
                    </div>
                    {/* Capacity Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${slotPercent > 50 ? 'bg-emerald-500' : slotPercent > 20 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        style={{ width: `${slotPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Operating Schedule Window */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-sky-500 dark:text-sky-400" /> Daily Window:
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
                      {station.schedule ? `${station.schedule.openTime} - ${station.schedule.closeTime}` : '06:00 - 22:00'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-6 pt-0 flex flex-wrap gap-2">
                  <button
                    onClick={() => openSlotsModal(station)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl transition cursor-pointer"
                    title="Manage Energy Trading Time Slots"
                  >
                    <BatteryCharging className="h-3.5 w-3.5" />
                    <span>Trading Slots</span>
                  </button>
                  <button
                    onClick={() => openEditModal(station)}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                    <span>Specs</span>
                  </button>
                  <button
                    onClick={() => handleToggleActive(station)}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${station.isActive
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
      )}

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

      {/* Energy Slots Management Modal */}
      <Modal
        isOpen={slotStation !== null}
        onClose={() => setSlotStation(null)}
        title={`Energy Trading Slots - ${slotStation?.name || ''}`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5 text-xs">
          {/* Notifications */}
          {slotError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{slotError}</span>
            </div>
          )}
          {slotSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{slotSuccess}</span>
            </div>
          )}

          {/* Filter by Date */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">Filter by Date:</span>
              <input
                type="date"
                value={slotDateFilter}
                onChange={(e) => {
                  setSlotDateFilter(e.target.value);
                  if (slotStation) fetchSlots(slotStation.id, e.target.value);
                }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
              {slotDateFilter && (
                <button
                  onClick={() => {
                    setSlotDateFilter('');
                    if (slotStation) fetchSlots(slotStation.id, '');
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              onClick={() => slotStation && fetchSlots(slotStation.id, slotDateFilter)}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 cursor-pointer"
              title="Refresh slots"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingSlots ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Existing Slots Table */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">Configured Trading Slots</h4>
            {loadingSlots ? (
              <div className="p-6 text-center text-slate-400">Loading slots...</div>
            ) : stationSlots.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                No trading slots configured for this date. Add one below.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Time Window</th>
                      <th className="px-3 py-2">Capacity</th>
                      <th className="px-3 py-2">Allocated</th>
                      <th className="px-3 py-2">Available Slots</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Adjust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                    {stationSlots.map((slot) => (
                      <tr key={slot.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{slot.date}</td>
                        <td className="px-3 py-2 text-amber-600 dark:text-amber-400">{slot.startTime} - {slot.endTime}</td>
                        <td className="px-3 py-2">{slot.slotCapacityKwh} kWh</td>
                        <td className="px-3 py-2 text-slate-500">{slot.allocatedKwh} kWh</td>
                        <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{slot.availableSlots}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${slot.status === 'Open' ? 'bg-emerald-500/15 text-emerald-600' :
                              slot.status === 'Full' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600'
                            }`}>
                            {slot.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1 font-sans">
                            <button
                              onClick={() => handleUpdateSlotAvailability(slot.id, Math.max(0, slot.availableSlots - 1), slot.allocatedKwh)}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-xs cursor-pointer"
                              title="Decrement available slot"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleUpdateSlotAvailability(slot.id, slot.availableSlots + 1, slot.allocatedKwh)}
                              className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-xs cursor-pointer"
                              title="Increment available slot"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add New Slot Form */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-amber-500" />
              <span>Create Energy Slot for this Hub</span>
            </h4>
            <form onSubmit={handleCreateSlot} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newSlotForm.date}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={newSlotForm.startTime}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, startTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={newSlotForm.endTime}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, endTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Slot Capacity (kWh)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={newSlotForm.slotCapacityKwh}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, slotCapacityKwh: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Total Booking Slots</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newSlotForm.availableSlots}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, availableSlots: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:flex sm:items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition active:scale-95 cursor-pointer shadow-sm text-xs"
                >
                  Add Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}