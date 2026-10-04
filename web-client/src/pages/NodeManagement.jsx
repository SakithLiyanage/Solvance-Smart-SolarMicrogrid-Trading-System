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

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Cpu, MapPin, Battery, Calendar, AlertCircle, AlertTriangle,
  CheckCircle2, Edit3, Power, RefreshCw, Clock, ExternalLink, Map,
  BatteryCharging, LayoutGrid, Info, Trash2, Search, X
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';

const STATUS_FILTERS = ['All', 'Active', 'Inactive'];
const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SRI_LANKA_REGIONS = [
  { city: 'Colombo', name: 'Colombo Harbor Microgrid Substation', code: 'MG-COL', lat: 6.9428, lng: 79.8512, address: 'Port Access Road, Colombo 13, Western Province' },
  { city: 'Kandy', name: 'Kandy Central Energy Depot', code: 'MG-KND', lat: 7.2906, lng: 80.6337, address: 'William Gopallawa Mawatha, Kandy, Central Province' },
  { city: 'Galle', name: 'Galle Fort Coastal Solar Hub', code: 'MG-GAL', lat: 6.0328, lng: 80.2170, address: 'Rampart Street, Galle, Southern Province' },
  { city: 'Jaffna', name: 'Jaffna Peninsula Solar Array', code: 'MG-JAF', lat: 9.6615, lng: 80.0255, address: 'Kandy Road, Jaffna, Northern Province' },
  { city: 'Hambantota', name: 'Hambantota Green Energy Exchange', code: 'MG-HMB', lat: 6.1429, lng: 81.1212, address: 'Mirijjawila Industrial Corridor, Hambantota' },
  { city: 'Negombo', name: 'Negombo Coastal Substation', code: 'MG-NEG', lat: 7.2008, lng: 79.8737, address: 'Main Street, Negombo, Western Province' },
  { city: 'Kurunegala', name: 'Kurunegala Grid Intertie', code: 'MG-KUR', lat: 7.4863, lng: 80.3623, address: 'Dambulla Road, Kurunegala, North Western Province' }
];

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const loadGoogleMapsScript = (apiKey) => {
  if (!apiKey) return Promise.reject(new Error('No API key'));
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps);
  const existingScript = document.getElementById('google-maps-script');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      if (window.google?.maps?.places) return resolve(window.google.maps);
      existingScript.addEventListener('load', () => resolve(window.google.maps));
      existingScript.addEventListener('error', reject);
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

// Local calendar date as YYYY-MM-DD. toISOString() gives the UTC date, which is
// still "yesterday" in Sri Lanka between 00:00 and 05:30.
const todayLocalIso = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "HH:mm" -> minutes since midnight
const toMinutes = (hhmm) => {
  const [h, m] = (hhmm || '').split(':').map(Number);
  return h * 60 + m;
};

// "2026-10-01" -> "Thu, 01 Oct" (falls back to the raw value if it isn't a date)
const formatSlotDate = (iso) => {
  const d = new Date(`${iso}T00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
};

// Our controllers return { message }; ASP.NET model validation returns { errors: { Field: [msg] } }
const getApiError = (err, fallback) => {
  const data = err?.response?.data;
  if (data?.message) return data.message;
  if (data?.errors) return Object.values(data.errors).flat().join(' ');
  return fallback;
};

const emptySlotForm = () => ({
  date: todayLocalIso(),
  startTime: '08:00',
  endTime: '10:00',
  slotCapacityKwh: 50,
  availableSlots: 5,
  status: 'Open'
});

export default function NodeManagement({ theme }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  // stationId -> upcoming Pending/Approved bookings (the condition that blocks deactivation)
  const [upcomingByStation, setUpcomingByStation] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [selectedMapStation, setSelectedMapStation] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Confirmation dialog for deactivate/delete, and the hub an action is running on
  const [confirmAction, setConfirmAction] = useState(null);
  const [busyStationId, setBusyStationId] = useState(null);

  // Toast System
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const showToast = (message, type = 'success') => setToast({ message, type });
  const closeToast = useCallback(() => setToast({ message: '', type: 'success' }), []);

  // Slots Management State
  const [slotStation, setSlotStation] = useState(null);
  const [stationSlots, setStationSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotDateFilter, setSlotDateFilter] = useState('');
  const [slotError, setSlotError] = useState('');
  const [slotSuccess, setSlotSuccess] = useState('');
  const [slotSubmitting, setSlotSubmitting] = useState(false);
  const [adjustingSlotId, setAdjustingSlotId] = useState(null);
  const [pendingDeleteSlotId, setPendingDeleteSlotId] = useState(null);
  const [generatingSlotsStationId, setGeneratingSlotsStationId] = useState(null);
  const [newSlotForm, setNewSlotForm] = useState(emptySlotForm);
  const slotsRequestRef = useRef(0);

  // Form State
  const [formData, setFormData] = useState({
    stationCode: '',
    name: '',
    latitude: '',
    longitude: '',
    address: '',
    capacityKwh: '',
    totalBatterySlots: '',
    gridConnection: 'Three-Phase 400V Grid Intertie',
    storageType: 'Lithium Iron Phosphate (LFP)',
    maxDischargeRateKw: '',
    openTime: '06:00',
    closeTime: '22:00',
    daysOpen: [...ALL_DAYS],
    autoGenerateSlots: true
  });

  // Google Maps Places Autocomplete State
  const placeInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [mapsApiLoaded, setMapsApiLoaded] = useState(false);
  const [mapsLoadError, setMapsLoadError] = useState('');
  const [locationSearchText, setLocationSearchText] = useState('');

  const handleSelectRegion = (region) => {
    setFormData((prev) => ({
      ...prev,
      stationCode: prev.stationCode || `${region.code}-01`,
      name: region.name,
      address: region.address,
      latitude: region.lat,
      longitude: region.lng
    }));
    setLocationSearchText('');
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    loadGoogleMapsScript(GOOGLE_MAPS_KEY)
      .then(() => setMapsApiLoaded(true))
      .catch(() => setMapsLoadError('Google Maps API key invalid or failed to load.'));
  }, []);

  useEffect(() => {
    if (!mapsApiLoaded || !placeInputRef.current || !isModalOpen) return;

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(placeInputRef.current, {
        componentRestrictions: { country: 'lk' },
        fields: ['name', 'formatted_address', 'geometry']
      });

      const listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.geometry || !place.geometry.location) return;

        const lat = place.geometry.location.lat().toFixed(6);
        const lng = place.geometry.location.lng().toFixed(6);
        const address = place.formatted_address || '';
        const name = place.name || '';

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          address: address || prev.address,
          name: prev.name ? prev.name : (name ? `${name} Solar Hub` : prev.name)
        }));
      });

      autocompleteRef.current = autocomplete;
      return () => {
        if (window.google?.maps?.event && listener) {
          window.google.maps.event.removeListener(listener);
        }
      };
    } catch (err) {
      console.error('Google Autocomplete initialization error:', err);
    }
  }, [mapsApiLoaded, isModalOpen]);

  const fetchSlots = async (stationId, date) => {
    // Ignore responses that arrive after the user has switched hub or date
    const requestId = ++slotsRequestRef.current;
    try {
      setLoadingSlots(true);
      setSlotError('');
      const q = date ? `?date=${encodeURIComponent(date)}` : '';
      const res = await api.get(`/slots/station/${stationId}${q}`);
      if (requestId === slotsRequestRef.current) setStationSlots(res.data || []);
    } catch (err) {
      if (requestId === slotsRequestRef.current) {
        setSlotError(getApiError(err, 'Failed to load trading slots for this solar hub.'));
      }
    } finally {
      if (requestId === slotsRequestRef.current) setLoadingSlots(false);
    }
  };

  const openSlotsModal = (station) => {
    setSlotStation(station);
    setStationSlots([]);
    setSlotError('');
    setSlotSuccess('');
    setSlotDateFilter('');
    setPendingDeleteSlotId(null);
    setNewSlotForm(emptySlotForm());
    fetchSlots(station.id);
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!slotStation || slotSubmitting) return;
    setSlotError('');
    setSlotSuccess('');

    const { date, startTime, endTime } = newSlotForm;
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    if (end <= start) {
      setSlotError('End time must be after the start time.');
      return;
    }

    const openTime = slotStation.schedule?.openTime;
    const closeTime = slotStation.schedule?.closeTime;
    if (openTime && closeTime && toMinutes(closeTime) > toMinutes(openTime)
      && (start < toMinutes(openTime) || end > toMinutes(closeTime))) {
      setSlotError(`Slots must fall within the hub's opening hours (${openTime} - ${closeTime}).`);
      return;
    }

    // Checked against the loaded list; with a date filter active that is only the filtered date
    const clash = stationSlots.find(
      (s) => s.date === date && start < toMinutes(s.endTime) && toMinutes(s.startTime) < end
    );
    if (clash) {
      setSlotError(`This overlaps an existing slot on ${formatSlotDate(date)} (${clash.startTime} - ${clash.endTime}).`);
      return;
    }

    setSlotSubmitting(true);
    try {
      const payload = {
        stationId: slotStation.id,
        date,
        startTime,
        endTime,
        slotCapacityKwh: parseFloat(newSlotForm.slotCapacityKwh),
        allocatedKwh: 0,
        availableSlots: parseInt(newSlotForm.availableSlots, 10),
        status: newSlotForm.status || 'Open'
      };
      await api.post('/slots', payload);
      setSlotSuccess(`Trading slot added for ${formatSlotDate(date)}, ${startTime} - ${endTime}.`);
      // Wait for the refreshed list so the overlap check sees the new slot before the button re-enables
      await fetchSlots(slotStation.id, slotDateFilter);
    } catch (err) {
      setSlotError(getApiError(err, 'Failed to create energy slot.'));
    } finally {
      setSlotSubmitting(false);
    }
  };

  const handleUpdateSlotAvailability = async (slot, newAvailable) => {
    if (adjustingSlotId) return;
    setAdjustingSlotId(slot.id);
    setSlotError('');
    setSlotSuccess('');
    try {
      await api.put(`/slots/${slot.id}/availability`, {
        availableSlots: newAvailable,
        allocatedKwh: slot.allocatedKwh
      });
      // Update the row in place (same status rule as the backend) so the next click builds on the new value
      setStationSlots((prev) =>
        prev.map((s) =>
          s.id === slot.id ? { ...s, availableSlots: newAvailable, status: newAvailable <= 0 ? 'Full' : 'Open' } : s
        )
      );
      setSlotSuccess('Slot availability updated.');
    } catch (err) {
      setSlotError(getApiError(err, 'Failed to update slot.'));
    } finally {
      setAdjustingSlotId(null);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    setPendingDeleteSlotId(null);
    setSlotError('');
    setSlotSuccess('');
    setAdjustingSlotId(slotId);
    try {
      await api.delete(`/slots/${slotId}`);
      setSlotSuccess('Trading slot deleted.');
      if (slotStation) fetchSlots(slotStation.id, slotDateFilter);
    } catch (err) {
      setSlotError(getApiError(err, 'Failed to delete slot. Check for linked upcoming reservations.'));
    } finally {
      setAdjustingSlotId(null);
    }
  };

  const fetchStations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stations');
      const data = res.data || [];
      setStations(data);
      setSelectedMapStation((prev) => (prev ? data.find((s) => s.id === prev.id) || data[0] || null : data[0] || null));
    } catch (err) {
      showToast(getApiError(err, 'Failed to load solar hubs.'), 'error');
    } finally {
      setLoading(false);
    }

    // Upcoming Pending/Approved bookings per hub: the same condition the backend uses to block deactivation
    try {
      const res = await api.get('/reservations');
      const now = Date.now();
      const counts = {};
      (res.data || []).forEach((r) => {
        if ((r.status === 'Pending' || r.status === 'Approved') && new Date(r.scheduledDateTime).getTime() >= now) {
          counts[r.stationId] = (counts[r.stationId] || 0) + 1;
        }
      });
      setUpcomingByStation(counts);
    } catch {
      // Informational only; the backend still enforces the rule
      setUpcomingByStation({});
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const openCreateModal = () => {
    setEditingStation(null);
    setFormError('');
    setLocationSearchText('');
    const defaultRegion = SRI_LANKA_REGIONS[0];
    const seq = String(stations.length + 1).padStart(2, '0');
    setFormData({
      stationCode: `MG-COL-${seq}`,
      name: defaultRegion.name,
      latitude: defaultRegion.lat,
      longitude: defaultRegion.lng,
      address: defaultRegion.address,
      capacityKwh: 1000,
      totalBatterySlots: 24,
      gridConnection: 'Three-Phase 400V Grid Intertie',
      storageType: 'Lithium Iron Phosphate (LFP)',
      maxDischargeRateKw: 200,
      openTime: '06:00',
      closeTime: '22:00',
      daysOpen: [...ALL_DAYS],
      autoGenerateSlots: true
    });
    setIsModalOpen(true);
  };

  const toggleDayOpen = (day) => {
    setFormData((prev) => {
      const current = prev.daysOpen || [];
      const updated = current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day];
      return { ...prev, daysOpen: updated };
    });
  };

  const openEditModal = (station) => {
    setEditingStation(station);
    setFormError('');
    setFormData({
      stationCode: station.stationCode,
      name: station.name,
      latitude: station.latitude,
      longitude: station.longitude,
      address: station.address,
      capacityKwh: station.capacityKwh,
      totalBatterySlots: station.totalBatterySlots,
      gridConnection: station.gridConnection || 'Three-Phase 400V Grid Intertie',
      storageType: station.storageType || 'Lithium Iron Phosphate (LFP)',
      maxDischargeRateKw: station.maxDischargeRateKw || Math.round(station.capacityKwh * 0.2),
      openTime: station.schedule?.openTime || '06:00',
      closeTime: station.schedule?.closeTime || '22:00',
      daysOpen: station.schedule?.daysOpen?.length ? station.schedule.daysOpen : [...ALL_DAYS],
      autoGenerateSlots: false
    });
    setIsModalOpen(true);
  };

  // Battery racks currently in use at the hub being edited
  const occupiedSlots = editingStation
    ? Math.max(0, (editingStation.totalBatterySlots || 0) - (editingStation.availableBatterySlots || 0))
    : 0;

  const handleGenerateSlotsQuick = async (station) => {
    if (generatingSlotsStationId) return;
    setGeneratingSlotsStationId(station.id);
    try {
      const res = await api.post(`/stations/${station.id}/generate-slots?days=7`);
      showToast(res.data?.message || 'Generated 7-day operational trading slots.', 'success');
    } catch (err) {
      showToast(getApiError(err, 'Failed to generate operational trading slots.'), 'error');
    } finally {
      setGeneratingSlotsStationId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setFormError('');

    const stationCode = formData.stationCode.trim().toUpperCase();
    const name = formData.name.trim();
    const address = formData.address.trim();
    const latitude = parseFloat(formData.latitude);
    const longitude = parseFloat(formData.longitude);
    const capacityKwh = parseFloat(formData.capacityKwh);
    const totalBatterySlots = parseInt(formData.totalBatterySlots, 10);
    const maxDischargeRateKw = parseFloat(formData.maxDischargeRateKw) || Math.round(capacityKwh * 0.2);

    if (isNaN(latitude) || isNaN(longitude)) {
      setFormError('Please provide valid GPS latitude and longitude coordinates.');
      return;
    }

    if (latitude < 5.8 || latitude > 9.9 || longitude < 79.5 || longitude > 82.0) {
      setFormError('GPS coordinates must be located within Sri Lanka boundaries (Lat 5.9°–9.9°N, Long 79.5°–81.9°E).');
      return;
    }

    if (isNaN(capacityKwh) || capacityKwh <= 0) {
      setFormError('Storage capacity must be a positive number in kWh.');
      return;
    }

    if (isNaN(totalBatterySlots) || totalBatterySlots < 1) {
      setFormError('Total battery slots must be at least 1.');
      return;
    }

    if (toMinutes(formData.closeTime) <= toMinutes(formData.openTime)) {
      setFormError('Closing time must be after opening time.');
      return;
    }

    if (!formData.daysOpen || formData.daysOpen.length === 0) {
      setFormError('At least one operational day must be selected.');
      return;
    }

    const duplicate = stations.find(
      (s) => s.id !== editingStation?.id && (s.stationCode || '').toUpperCase() === stationCode
    );
    if (duplicate) {
      setFormError(`Station code ${stationCode} is already used by ${duplicate.name}.`);
      return;
    }

    if (totalBatterySlots < occupiedSlots) {
      setFormError(`${occupiedSlots} battery slots are occupied right now, so the total can't be lower than ${occupiedSlots}.`);
      return;
    }

    if (editingStation) {
      // The backend answers "Station not found" when an update changes nothing, so skip no-op saves
      const unchanged =
        stationCode === editingStation.stationCode &&
        name === editingStation.name &&
        address === editingStation.address &&
        latitude === editingStation.latitude &&
        longitude === editingStation.longitude &&
        capacityKwh === editingStation.capacityKwh &&
        totalBatterySlots === editingStation.totalBatterySlots &&
        formData.openTime === editingStation.schedule?.openTime &&
        formData.closeTime === editingStation.schedule?.closeTime &&
        formData.gridConnection === editingStation.gridConnection &&
        formData.storageType === editingStation.storageType &&
        formData.maxDischargeRateKw === editingStation.maxDischargeRateKw &&
        JSON.stringify(formData.daysOpen) === JSON.stringify(editingStation.schedule?.daysOpen);
      if (unchanged) {
        setIsModalOpen(false);
        showToast('No changes to save.', 'info');
        return;
      }
    }

    const payload = {
      stationCode,
      name,
      latitude,
      longitude,
      address,
      capacityKwh,
      totalBatterySlots,
      // Racks that are occupied stay occupied when the total changes
      availableBatterySlots: totalBatterySlots - occupiedSlots,
      gridConnection: formData.gridConnection,
      storageType: formData.storageType,
      maxDischargeRateKw,
      schedule: {
        openTime: formData.openTime,
        closeTime: formData.closeTime,
        daysOpen: formData.daysOpen
      },
      autoGenerateSlots: !editingStation && formData.autoGenerateSlots,
      // Editing must not silently reactivate a deactivated hub
      isActive: editingStation ? editingStation.isActive : true
    };

    setSaving(true);
    try {
      if (editingStation) {
        await api.put(`/stations/${editingStation.id}`, payload);
        showToast(`Solar hub '${name}' updated.`);
      } else {
        await api.post('/stations', payload);
        showToast(`Solar hub '${name}' added with 7-day slots generated.`);
      }
      setIsModalOpen(false);
      fetchStations();
    } catch (err) {
      setFormError(getApiError(err, 'Failed to save the solar hub.'));
    } finally {
      setSaving(false);
    }
  };

  const runStationAction = async (station, action) => {
    setBusyStationId(station.id);
    try {
      if (action === 'deactivate') {
        await api.post(`/stations/${station.id}/deactivate`);
        showToast(`Solar hub '${station.name}' deactivated.`);
      } else if (action === 'reactivate') {
        await api.post(`/stations/${station.id}/reactivate`);
        showToast(`Solar hub '${station.name}' reactivated.`);
      } else {
        await api.delete(`/stations/${station.id}`);
        showToast(`Solar hub '${station.name}' and its trading slots deleted.`);
      }
      // Keep the card's buttons disabled until it shows the new state
      await fetchStations();
    } catch (err) {
      showToast(getApiError(err, 'Action failed.'), 'error');
    } finally {
      setBusyStationId(null);
      setConfirmAction(null);
    }
  };

  const upcomingWarning = (station) => {
    const upcoming = upcomingByStation[station.id] || 0;
    return upcoming > 0
      ? `This hub has ${upcoming} upcoming reservation${upcoming === 1 ? '' : 's'}, so the server will block this until ${upcoming === 1 ? 'it is' : 'they are'} completed or cancelled.`
      : '';
  };

  const requestToggleActive = (station) => {
    if (!station.isActive) {
      runStationAction(station, 'reactivate');
      return;
    }
    setConfirmAction({
      station,
      action: 'deactivate',
      title: `Deactivate ${station.name}?`,
      message: 'Prosumers will not be able to reserve energy at this hub until it is reactivated.',
      warning: upcomingWarning(station),
      confirmLabel: 'Deactivate'
    });
  };

  const requestDelete = (station) => {
    setConfirmAction({
      station,
      action: 'delete',
      title: `Delete ${station.name}?`,
      message: 'The hub and all of its trading slots will be permanently deleted. This cannot be undone.',
      warning: upcomingWarning(station),
      confirmLabel: 'Delete permanently'
    });
  };

  const statusCounts = useMemo(
    () => ({
      All: stations.length,
      Active: stations.filter((s) => s.isActive).length,
      Inactive: stations.filter((s) => !s.isActive).length
    }),
    [stations]
  );

  const filteredStations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stations.filter((s) => {
      if (statusFilter === 'Active' && !s.isActive) return false;
      if (statusFilter === 'Inactive' && s.isActive) return false;
      if (!query) return true;
      return [s.name, s.stationCode, s.address].some((v) => (v || '').toLowerCase().includes(query));
    });
  }, [stations, search, statusFilter]);

  // Page size 9 = three rows of three cards
  const hubPager = usePagination(filteredStations, 9, `${statusFilter}|${search}`);

  const sortedSlots = useMemo(
    () => [...stationSlots].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [stationSlots]
  );
  const slotPager = usePagination(sortedSlots, 10, `${slotStation?.id || ''}|${slotDateFilter}`);

  const statusBadge = (isActive) =>
    isActive
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
      : 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
        duration={toast.type === 'error' ? 7000 : 4000}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Solar Hubs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure capacity, battery storage slots, opening hours and trading slots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
            <button
              onClick={() => {
                setViewMode('map');
                if (!selectedMapStation && stations.length > 0) setSelectedMapStation(stations[0]);
              }}
              aria-pressed={viewMode === 'map'}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'map'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Map className="h-3.5 w-3.5" />
              Map
            </button>
          </div>

          <button
            onClick={fetchStations}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:cursor-wait"
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

      {/* Business rule notice */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] dark:bg-slate-900/60 backdrop-blur-md p-3.5 sm:p-4 flex items-center gap-3 transition-colors duration-300">
        <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <strong className="font-semibold text-slate-900 dark:text-white mr-1.5">Notice:</strong>
          A hub with upcoming Pending or Approved reservations can't be deactivated or deleted until those reservations are completed or cancelled.
        </p>
      </div>

      {/* Search & status filter */}
      <div className="flex flex-col md:flex-row md:items-center gap-2.5">
        <div className="relative md:w-72 shrink-0">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, code or address"
            aria-label="Search solar hubs by name, code or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              aria-pressed={statusFilter === status}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${statusFilter === status
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
            >
              {status} <span className="opacity-70 tabular-nums">({statusCounts[status]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stations View: loading / empty / map / cards */}
      {loading && stations.length === 0 ? (
        <div className="p-12 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center text-xs text-slate-400">
          <RefreshCw className="h-6 w-6 text-amber-500 animate-spin mx-auto mb-2" />
          Loading solar hubs...
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="p-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {stations.length === 0 ? 'No solar hubs yet.' : 'No solar hubs match your search or filter.'}
          </p>
          {stations.length === 0 ? (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add the first hub</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
              }}
              className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Clear search and filter
            </button>
          )}
        </div>
      ) : viewMode === 'map' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive Google Map Panel */}
          <div className="lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 overflow-hidden shadow-sm dark:shadow-xl backdrop-blur-xl flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm truncate">
                    {selectedMapStation ? selectedMapStation.name : 'Solar hub map'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {selectedMapStation
                      ? `${Number(selectedMapStation.latitude).toFixed(4)}, ${Number(selectedMapStation.longitude).toFixed(4)} • ${selectedMapStation.address}`
                      : 'Select a hub to show its GPS location'}
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

            <div className="relative w-full h-[360px] sm:h-[520px] bg-slate-100 dark:bg-slate-950">
              {selectedMapStation ? (
                <iframe
                  title={`Map of ${selectedMapStation.name}`}
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
                  Select a hub from the list to view it on Google Maps.
                </div>
              )}
            </div>
          </div>

          {/* Hub selector list */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 px-1">
              Solar hubs ({filteredStations.length})
            </h3>
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {hubPager.pageItems.map((s) => {
                const isSelected = selectedMapStation && selectedMapStation.id === s.id;
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={!!isSelected}
                    onClick={() => setSelectedMapStation(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedMapStation(s);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                        : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                        {s.stationCode}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusBadge(s.isActive)}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{s.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{s.address}</p>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <span className="tabular-nums">
                        {s.capacityKwh} kWh &bull; {s.availableBatterySlots}/{s.totalBatterySlots} battery slots free
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openSlotsModal(s);
                        }}
                        className="shrink-0 text-amber-600 dark:text-amber-400 hover:underline font-bold flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <BatteryCharging className="h-3.5 w-3.5" />
                        <span>Trading slots</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination
              page={hubPager.page}
              totalPages={hubPager.totalPages}
              totalItems={hubPager.totalItems}
              pageSize={hubPager.pageSize}
              onPageChange={hubPager.setPage}
              itemLabel="hubs"
              className="border-t-0"
            />
          </div>
        </div>
      ) : (
        /* Stations Cards Grid */
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hubPager.pageItems.map((station) => {
              const slotPercent = Math.min(
                100,
                Math.max(0, Math.round((station.availableBatterySlots / (station.totalBatterySlots || 1)) * 100))
              );
              const upcoming = upcomingByStation[station.id] || 0;
              const isBusy = busyStationId === station.id;
              return (
                <div
                  key={station.id}
                  className={`rounded-3xl border transition-all duration-300 overflow-hidden backdrop-blur-xl shadow-sm dark:shadow-xl flex flex-col ${station.isActive
                      ? 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:shadow-lg dark:hover:shadow-2xl dark:hover:shadow-amber-500/5'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-red-200 dark:border-red-900/30'
                    }`}
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 text-amber-600 dark:text-amber-400 border border-slate-200 dark:border-slate-700/60 rounded-lg">
                        {station.stationCode}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${statusBadge(station.isActive)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${station.isActive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500'}`} />
                        <span>{station.isActive ? 'Active' : 'Inactive'}</span>
                      </span>
                    </div>

                    <h3 className="mt-3.5 text-lg font-display font-bold text-slate-900 dark:text-white">{station.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{station.address}</span>
                    </p>
                  </div>

                  {/* Card Specs */}
                  <div className="p-6 space-y-4 text-xs flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Capacity:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums">{station.capacityKwh} kWh</span>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Battery className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Battery slots:
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {station.availableBatterySlots} / {station.totalBatterySlots} free
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${slotPercent > 50 ? 'bg-emerald-500' : slotPercent > 20 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${slotPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-sky-500 dark:text-sky-400" /> Opening hours:
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                        {station.schedule?.openTime && station.schedule?.closeTime
                          ? `${station.schedule.openTime} - ${station.schedule.closeTime}`
                          : 'Not set'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-violet-500 dark:text-violet-400" /> Upcoming reservations:
                      </span>
                      <span className={`font-bold tabular-nums ${upcoming > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {upcoming}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-6 pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openSlotsModal(station)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap"
                      >
                        <BatteryCharging className="h-3.5 w-3.5" />
                        <span>Trading slots</span>
                      </button>
                      <button
                        onClick={() => handleGenerateSlotsQuick(station)}
                        disabled={generatingSlotsStationId === station.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                        title="Generate 7-day hourly slots based on opening hours and operating days"
                      >
                        <RefreshCw className={`h-3 w-3 ${generatingSlotsStationId === station.id ? 'animate-spin' : ''}`} />
                        <span>{generatingSlotsStationId === station.id ? 'Generating...' : 'Auto-Gen 7D'}</span>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(station)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-slate-400" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => requestToggleActive(station)}
                        disabled={isBusy}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-wait ${station.isActive
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          }`}
                        title={station.isActive
                          ? (upcoming > 0 ? `Blocked while ${upcoming} upcoming reservation(s) exist` : 'Deactivate this hub')
                          : 'Reactivate this hub'}
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>{isBusy ? 'Working...' : station.isActive ? 'Deactivate' : 'Reactivate'}</span>
                      </button>
                      <button
                        onClick={() => requestDelete(station)}
                        disabled={isBusy}
                        aria-label={`Delete ${station.name}`}
                        title="Permanently delete this hub (blocked while upcoming reservations exist)"
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-red-500/10 text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-xs font-bold rounded-xl transition border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            page={hubPager.page}
            totalPages={hubPager.totalPages}
            totalItems={hubPager.totalItems}
            pageSize={hubPager.pageSize}
            onPageChange={hubPager.setPage}
            itemLabel="hubs"
            className="border-t-0"
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStation ? `Edit ${editingStation.name}` : 'Add Solar Hub'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {editingStation && !editingStation.isActive && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
              This hub is inactive. Saving changes keeps it inactive; use Reactivate on its card to bring it back.
            </div>
          )}

          {/* Location & Google Maps Integration */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="location-search-input" className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>Station Location &amp; Regional Coordinates (Sri Lanka)</span>
              </label>
              {GOOGLE_MAPS_KEY ? (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {mapsApiLoaded ? 'Google Places Live' : 'Loading Places API...'}
                </span>
              ) : (
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                  Regional Autocomplete Active
                </span>
              )}
            </div>

            {GOOGLE_MAPS_KEY ? (
              <input
                ref={placeInputRef}
                id="location-search-input"
                type="text"
                placeholder="Search place, landmark, or city (e.g. Kandy, Galle Fort, Colombo Port)..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            ) : (
              <div className="relative">
                <input
                  id="location-search-input"
                  type="text"
                  value={locationSearchText}
                  onChange={(e) => setLocationSearchText(e.target.value)}
                  placeholder="Type city or district (e.g. Kandy, Galle, Jaffna, Hambantota)..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {locationSearchText.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {SRI_LANKA_REGIONS.filter(
                      (r) =>
                        r.city.toLowerCase().includes(locationSearchText.toLowerCase()) ||
                        r.name.toLowerCase().includes(locationSearchText.toLowerCase()) ||
                        r.address.toLowerCase().includes(locationSearchText.toLowerCase())
                    ).map((r) => (
                      <button
                        key={r.city}
                        type="button"
                        onClick={() => handleSelectRegion(r)}
                        className="w-full text-left p-2.5 hover:bg-amber-500/10 text-xs flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">{r.name}</span>
                        <span className="text-[11px] text-slate-500">{r.address}</span>
                        <span className="text-[10px] font-mono text-amber-600">GPS: {r.lat}, {r.lng}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick-Pick Region Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quick Fill:</span>
              {SRI_LANKA_REGIONS.map((r) => (
                <button
                  key={r.city}
                  type="button"
                  onClick={() => handleSelectRegion(r)}
                  className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/20 rounded-md text-[11px] font-medium transition cursor-pointer"
                >
                  {r.city}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="hub-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Station Code</label>
              <input
                id="hub-code"
                type="text"
                required
                value={formData.stationCode}
                onChange={(e) => setFormData({ ...formData, stationCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label htmlFor="hub-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hub Name</label>
              <input
                id="hub-name"
                type="text"
                required
                placeholder="e.g. Colombo Harbor Microgrid Substation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="hub-address" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Address</label>
            <input
              id="hub-address"
              type="text"
              required
              placeholder="e.g. Port Access Road, Colombo 13, Western Province"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hub-lat" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS Latitude</label>
              <input
                id="hub-lat"
                type="number"
                step="any"
                min="5.8"
                max="9.9"
                required
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="hub-lng" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GPS Longitude</label>
              <input
                id="hub-lng"
                type="number"
                step="any"
                min="79.5"
                max="82.0"
                required
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 tabular-nums"
              />
            </div>
          </div>

          {/* Live In-Modal Google Maps Embed */}
          {formData.latitude && formData.longitude && !isNaN(parseFloat(formData.latitude)) && !isNaN(parseFloat(formData.longitude)) && (
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-500" />
                  Google Maps Pin Preview ({Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)})
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold text-xs"
                >
                  <span>Verify on Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="relative w-full h-[140px]">
                <iframe
                  title="Google Maps Pin Preview"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${formData.latitude},${formData.longitude}&hl=en&z=15&output=embed`}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hub-capacity" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Storage Capacity (kWh)</label>
              <input
                id="hub-capacity"
                type="number"
                step="any"
                min="1"
                max="100000"
                required
                value={formData.capacityKwh}
                onChange={(e) => {
                  const cap = e.target.value;
                  const numCap = parseFloat(cap);
                  setFormData((prev) => ({
                    ...prev,
                    capacityKwh: cap,
                    maxDischargeRateKw: !isNaN(numCap) && numCap > 0 ? Math.round(numCap * 0.2) : prev.maxDischargeRateKw
                  }));
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="hub-slots" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Battery Slots (Total Racks)</label>
              <input
                id="hub-slots"
                type="number"
                min={Math.max(1, occupiedSlots)}
                max="1000"
                required
                value={formData.totalBatterySlots}
                onChange={(e) => setFormData({ ...formData, totalBatterySlots: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 tabular-nums"
              />
              {editingStation && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {occupiedSlots} occupied now; free slots = total &minus; {occupiedSlots}.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="hub-grid" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Grid Connection Spec</label>
              <input
                id="hub-grid"
                type="text"
                value={formData.gridConnection}
                onChange={(e) => setFormData({ ...formData, gridConnection: e.target.value })}
                placeholder="e.g. Three-Phase 400V Grid Intertie"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label htmlFor="hub-storage-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Battery Chemistry</label>
              <select
                id="hub-storage-type"
                value={formData.storageType}
                onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="Lithium Iron Phosphate (LFP)">Lithium Iron Phosphate (LFP)</option>
                <option value="Lithium Nickel Manganese Cobalt (NMC)">Lithium Nickel Manganese Cobalt (NMC)</option>
                <option value="Flow Battery (Vanadium Redox)">Flow Battery (Vanadium Redox)</option>
                <option value="Sodium-Ion Commercial">Sodium-Ion Commercial</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hub-open" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Opening Time</label>
              <input
                id="hub-open"
                type="time"
                required
                value={formData.openTime}
                onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="hub-close" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Closing Time</label>
              <input
                id="hub-close"
                type="time"
                required
                value={formData.closeTime}
                onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Operational Days Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Operational Days</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS.map((day) => {
                const isSelected = formData.daysOpen?.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDayOpen(day)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          {!editingStation && (
            <div className="flex items-center gap-2 pt-1">
              <input
                id="auto-slots-checkbox"
                type="checkbox"
                checked={formData.autoGenerateSlots}
                onChange={(e) => setFormData({ ...formData, autoGenerateSlots: e.target.checked })}
                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="auto-slots-checkbox" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Automatically generate 7-day hourly energy trading slots upon creation
              </label>
            </div>
          )}

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
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : editingStation ? 'Save Changes' : 'Add Hub'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Deactivate / delete confirmation */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => {
          if (!busyStationId) setConfirmAction(null);
        }}
        title={confirmAction?.title || ''}
        maxWidth="max-w-md"
      >
        {confirmAction && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{confirmAction.message}</p>
            {confirmAction.warning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <span>{confirmAction.warning}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={!!busyStationId}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runStationAction(confirmAction.station, confirmAction.action)}
                disabled={!!busyStationId}
                className="px-4 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {busyStationId ? 'Working...' : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Energy Slots Management Modal */}
      <Modal
        isOpen={slotStation !== null}
        onClose={() => setSlotStation(null)}
        title={`Trading Slots - ${slotStation?.name || ''}`}
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
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <label htmlFor="slot-date-filter" className="font-semibold text-slate-700 dark:text-slate-300">Filter by date:</label>
              <input
                id="slot-date-filter"
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!slotStation || generatingSlotsStationId) return;
                  setGeneratingSlotsStationId(slotStation.id);
                  try {
                    const res = await api.post(`/stations/${slotStation.id}/generate-slots?days=7`);
                    setSlotSuccess(res.data?.message || 'Generated 7-day operational trading slots.');
                    await fetchSlots(slotStation.id, slotDateFilter);
                  } catch (err) {
                    setSlotError(getApiError(err, 'Failed to generate operational trading slots.'));
                  } finally {
                    setGeneratingSlotsStationId(null);
                  }
                }}
                disabled={generatingSlotsStationId === slotStation?.id}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${generatingSlotsStationId === slotStation?.id ? 'animate-spin' : ''}`} />
                <span>Auto-Generate 7-Day Slots</span>
              </button>
              <button
                onClick={() => slotStation && fetchSlots(slotStation.id, slotDateFilter)}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 cursor-pointer"
                title="Refresh slots"
                aria-label="Refresh slots"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingSlots ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Existing Slots Table */}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">Configured slots</h4>
            {loadingSlots && stationSlots.length === 0 ? (
              <div className="p-6 text-center text-slate-400">Loading slots...</div>
            ) : stationSlots.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                {slotDateFilter ? 'No trading slots on this date. Add one below.' : 'No trading slots for this hub yet. Add one below.'}
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold text-xs whitespace-nowrap">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Capacity</th>
                        <th className="px-3 py-2">Allocated</th>
                        <th className="px-3 py-2">Available</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Adjust</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 tabular-nums text-[13px]">
                      {slotPager.pageItems.map((slot) => {
                        const isAdjusting = adjustingSlotId === slot.id;
                        return (
                          <tr key={slot.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="px-3 py-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatSlotDate(slot.date)}</td>
                            <td className="px-3 py-2 text-amber-600 dark:text-amber-400 whitespace-nowrap">{slot.startTime} - {slot.endTime}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{slot.slotCapacityKwh} kWh</td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{slot.allocatedKwh} kWh</td>
                            <td className="px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400">{slot.availableSlots}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${slot.status === 'Open'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : slot.status === 'Full'
                                    ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                }`}>
                                {slot.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {pendingDeleteSlotId === slot.id ? (
                                <div className="inline-flex items-center gap-1 font-sans">
                                  <button
                                    onClick={() => handleDeleteSlot(slot.id)}
                                    className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] cursor-pointer"
                                  >
                                    Delete?
                                  </button>
                                  <button
                                    onClick={() => setPendingDeleteSlotId(null)}
                                    aria-label="Keep this slot"
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1 font-sans">
                                  {/* Backend reports "not found" for a no-op update, so "-" stops at 0 */}
                                  <button
                                    onClick={() => handleUpdateSlotAvailability(slot, slot.availableSlots - 1)}
                                    disabled={isAdjusting || slot.availableSlots <= 0}
                                    aria-label="One fewer available reservation slot"
                                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={() => handleUpdateSlotAvailability(slot, slot.availableSlots + 1)}
                                    disabled={isAdjusting}
                                    aria-label="One more available reservation slot"
                                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={() => setPendingDeleteSlotId(slot.id)}
                                    disabled={isAdjusting}
                                    aria-label="Delete this trading slot"
                                    title="Delete this trading slot"
                                    className="p-1 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded transition cursor-pointer ml-1 disabled:opacity-40"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={slotPager.page}
                  totalPages={slotPager.totalPages}
                  totalItems={slotPager.totalItems}
                  pageSize={slotPager.pageSize}
                  onPageChange={slotPager.setPage}
                  onPageSizeChange={slotPager.setPageSize}
                  itemLabel="slots"
                />
              </div>
            )}
          </div>

          {/* Add New Slot Form */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-amber-500" />
                <span>Add a trading slot</span>
              </h4>
              {slotStation?.schedule?.openTime && slotStation?.schedule?.closeTime && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hub hours: <strong className="tabular-nums">{slotStation.schedule.openTime} - {slotStation.schedule.closeTime}</strong>
                </span>
              )}
            </div>
            <form onSubmit={handleCreateSlot} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="slot-date" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Date</label>
                <input
                  id="slot-date"
                  type="date"
                  required
                  min={todayLocalIso()}
                  value={newSlotForm.date}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, date: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="slot-start" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Start Time</label>
                <input
                  id="slot-start"
                  type="time"
                  required
                  value={newSlotForm.startTime}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, startTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="slot-end" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">End Time</label>
                <input
                  id="slot-end"
                  type="time"
                  required
                  value={newSlotForm.endTime}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, endTime: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="slot-capacity" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Slot Capacity (kWh)</label>
                <input
                  id="slot-capacity"
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={newSlotForm.slotCapacityKwh}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, slotCapacityKwh: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="slot-count" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Reservation Slots</label>
                <input
                  id="slot-count"
                  type="number"
                  min="1"
                  required
                  value={newSlotForm.availableSlots}
                  onChange={(e) => setNewSlotForm({ ...newSlotForm, availableSlots: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs tabular-nums text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:flex sm:items-end">
                <button
                  type="submit"
                  disabled={slotSubmitting}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition active:scale-95 cursor-pointer shadow-sm text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {slotSubmitting ? 'Adding...' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
