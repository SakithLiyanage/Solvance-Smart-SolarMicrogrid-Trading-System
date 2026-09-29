// ============================================================================
// File: OperatorDashboard.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: H.N. Madubashini (IT23192300)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Grid Operator terminal with optical QR webcam scanner, physical pass inspection, server verification, station telemetry, and battery rack inventory synchronization.
// References & Citations:
//   - jsQR: JavaScript QR code decoding library (https://github.com/cozmo/jsQR)
//   - QRCode: Universal QR code generator (https://github.com/soldair/node-qrcode)
//   - React 18 Dynamic Refs & Modal Portals (useRef, useState, useEffect): https://react.dev/
//   - Cryptographic QR Verification & Business Logic: https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography
//   - Tailwind CSS Complex Operational Terminal Dashboard: https://tailwindcss.com/
// ============================================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Battery, QrCode, CheckCircle2, AlertCircle, Search, RefreshCw,
  Zap, Clock, ShieldCheck, Filter, Scan, Check, BatteryCharging,
  ArrowRight, Radio, Eye, Plus, Edit3, XCircle, Trash2, Calendar,
  Camera, CameraOff, Video, Sparkles, MapPin, AlertTriangle, Download,
  ExternalLink, Copy, HelpCircle, Layers, ArrowUpRight, CheckCheck,
  Activity, ArrowDownLeft, ShieldAlert
} from 'lucide-react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import api from '../api/client';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import Pagination, { usePagination } from '../components/Pagination';

// Queue filter pills, in booking lifecycle order
const STATUS_FILTERS = ['All', 'Pending', 'Approved', 'Completed', 'Cancelled'];

// Compact, locale-aware schedule label, e.g. "Thu, 01 Oct, 19:42"
const formatSchedule = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

export default function OperatorDashboard({ user, theme, activeTab }) {
  const qrSectionRef = useRef(null);
  const qrInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const cameraStartingRef = useRef(false);

  // Active Terminal Tab: 0 = Scanner, 1 = Queue/Ledger, 2 = Battery Storage, 3 = Unified
  const [operatorTab, setOperatorTab] = useState(0);

  // Stations & Active Hub
  const [stations, setStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState('');
  const [availableSlots, setAvailableSlots] = useState(0);
  const [totalSlots, setTotalSlots] = useState(0);
  const [telemetry, setTelemetry] = useState(null);
  const [slotsDirty, setSlotsDirty] = useState(false); // unsaved slot edits

  // Reservations Monitor
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(true); // first load only
  const [isSyncing, setIsSyncing] = useState(false); // any refresh, incl. background
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchNic, setSearchNic] = useState('');

  // Camera Optical Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannerMode, setScannerMode] = useState('camera'); // 'camera' | 'manual'
  const [pendingCameraStart, setPendingCameraStart] = useState(false);

  // Direct QR Verification & Dispatch State
  const [qrToken, setQrToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedResult, setVerifiedResult] = useState(null);
  const [qrError, setQrError] = useState('');

  // Physical Pass Inspection Modal State
  const [inspectingPass, setInspectingPass] = useState(null);

  // Toast System
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const showToast = (message, type = 'success') => setToast({ message, type });
  // Stable callback so the toast's auto-dismiss timer isn't reset on every re-render
  const closeToast = useCallback(() => setToast({ message: '', type: 'success' }), []);

  // Approval & Digital QR Pass Issuance Modal
  const [approvedPassData, setApprovedPassData] = useState(null);
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState('');
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);

  // Create / Edit / Cancel Modals
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
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editingReservation, setEditingReservation] = useState(null);
  const [editForm, setEditForm] = useState({
    scheduledDateTime: '',
    energyAmountKwh: 15,
    tradeType: 'DropOff'
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [cancellingReservation, setCancellingReservation] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Row-level approve lock (prevents double approval clicks)
  const [approvingId, setApprovingId] = useState(null);

  // Latest values for callbacks that outlive a render (camera frame loop, 30s refresh timer)
  const reservationsRef = useRef([]);
  const selectedStationIdRef = useRef('');
  const slotsDirtyRef = useRef(false);
  useEffect(() => { reservationsRef.current = reservations; }, [reservations]);
  useEffect(() => { selectedStationIdRef.current = selectedStationId; }, [selectedStationId]);
  useEffect(() => { slotsDirtyRef.current = slotsDirty; }, [slotsDirty]);

  // 7-day schedule window helpers for datetime-local picker
  const toLocalIsoString = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  const minBookingLocalIso = toLocalIsoString(new Date());
  const maxBookingLimitObj = new Date();
  maxBookingLimitObj.setDate(maxBookingLimitObj.getDate() + 7);
  maxBookingLimitObj.setHours(23, 59, 59, 999);
  const maxBookingLocalIso = toLocalIsoString(maxBookingLimitObj);

  // Scroll to QR console if tab changed
  useEffect(() => {
    if (activeTab === 'bookings' && qrSectionRef.current) {
      qrSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      qrInputRef.current?.focus();
    }
  }, [activeTab]);

  // Load Operational Data (initial load, 30s auto-refresh and manual sync)
  const loadOperationalData = async () => {
    setIsSyncing(true);
    const currentStationId = selectedStationIdRef.current;
    try {
      const stationRes = await api.get('/stations');
      const stationList = stationRes.data || [];
      setStations(stationList);
      // Default the terminal to the first active hub on first load
      const activeStation = currentStationId
        ? stationList.find((s) => s.id === currentStationId)
        : stationList.find((s) => s.isActive) || stationList[0];
      if (!currentStationId && activeStation) {
        setSelectedStationId(activeStation.id);
      }
      // Keep slot counters in step with the server unless the operator has unsaved edits
      if (activeStation && !slotsDirtyRef.current) {
        setAvailableSlots(activeStation.availableBatterySlots);
        setTotalSlots(activeStation.totalBatterySlots);
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
      // Only the first load shows the full-table spinner; background refreshes keep the table on screen
      setLoadingReservations(false);
    }

    if (currentStationId) {
      try {
        const telemetryRes = await api.get(`/stations/${currentStationId}/telemetry`);
        setTelemetry(telemetryRes.data);
      } catch (err) {
        console.error('Failed to load station telemetry', err);
      }
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    loadOperationalData();
    const timer = setInterval(loadOperationalData, 30000);
    return () => clearInterval(timer);
  }, [selectedStationId]);

  const handleStationChange = (id) => {
    setSelectedStationId(id);
    setSlotsDirty(false);
    setTelemetry(null);
    const station = stations.find((s) => s.id === id);
    if (station) {
      setAvailableSlots(station.availableBatterySlots);
      setTotalSlots(station.totalBatterySlots);
    }
  };

  // Clamp operator slot edits to the hub's physical rack count and mark them unsaved
  const editAvailableSlots = (value) => {
    const next = Number.isFinite(value) ? value : 0;
    setAvailableSlots(Math.max(0, Math.min(totalSlots, next)));
    setSlotsDirty(true);
  };

  const handleUpdateSlots = async () => {
    if (!selectedStationId) {
      showToast('Please select an active solar hub first.', 'warning');
      return;
    }

    try {
      await api.patch(`/stations/${selectedStationId}/battery-slots`, {
        availableSlots: parseInt(availableSlots, 10)
      });
      showToast('Battery slots saved.', 'success');
      // Clear the unsaved flag before refreshing so the counters take the server values
      slotsDirtyRef.current = false;
      setSlotsDirty(false);
      loadOperationalData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update battery slots.', 'error');
    }
  };

  // =========================================================================
  // CAMERA SCANNER ENGINE (HTML5 MediaDevices + jsQR)
  // =========================================================================

  const startCameraScanner = async () => {
    // Ignore repeat clicks while a stream is starting or already running
    if (streamRef.current || cameraStartingRef.current) return;
    cameraStartingRef.current = true;
    setCameraError('');
    setQrError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported by your browser environment.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      // The viewport can unmount while the permission prompt is open; release the camera if so
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      await videoRef.current.play();
      setIsCameraActive(true);
      scanFrame();
    } catch (err) {
      console.warn('Camera stream initialisation notice:', err.message);
      setCameraError(err.message || 'Unable to access camera. Please use manual token input.');
      stopCameraScanner();
    } finally {
      cameraStartingRef.current = false;
    }
  };

  const stopCameraScanner = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        const decoded = code.data.trim();
        if (decoded.startsWith('SOLAR-TX:') || decoded.startsWith('RES-')) {
          stopCameraScanner();
          // Find matching reservation to inspect or directly verify (ref = latest list, not the one at scan start)
          const matched = reservationsRef.current.find(
            (r) => (r.qrCodeToken && r.qrCodeToken === decoded) || r.reservationNumber === decoded
          );
          if (matched) {
            setInspectingPass(matched);
          } else {
            handleDirectVerifyQr(decoded);
          }
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    return () => stopCameraScanner();
  }, []);

  const isScannerVisible = operatorTab === 0 || operatorTab === 3;

  // Release the camera whenever the scanner viewport is hidden (tab switch or manual mode)
  useEffect(() => {
    if (!isScannerVisible || scannerMode !== 'camera') {
      stopCameraScanner();
    }
  }, [isScannerVisible, scannerMode]);

  // Start a scan requested from the queue/pass modals once the scanner viewport has rendered
  useEffect(() => {
    if (pendingCameraStart && isScannerVisible && scannerMode === 'camera') {
      setPendingCameraStart(false);
      qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      startCameraScanner();
    }
  }, [pendingCameraStart, isScannerVisible, scannerMode]);

  // =========================================================================
  // DIRECT QR VERIFICATION & DISPATCH EXECUTION
  // =========================================================================

  const handleDirectVerifyQr = async (tokenToVerify) => {
    const rawToken = (tokenToVerify || qrToken || '').trim();
    if (!rawToken) {
      setQrError('Enter or scan a valid QR transaction token.');
      return;
    }

    setVerifying(true);
    setQrError('');
    setVerifiedResult(null);

    try {
      const payload = {
        qrCodeToken: rawToken,
        // Ref: this can run from the camera loop, whose closure may predate a hub change
        stationId: selectedStationIdRef.current || undefined
      };

      const res = await api.post('/reservations/verify-qr', payload);
      const resultData = res.data.summary || res.data.reservation || res.data;

      setVerifiedResult(resultData);
      setQrToken('');
      setInspectingPass(null);
      showToast(`Transfer completed. Pass verified by ${user?.fullName || 'Operator'}.`, 'success');
      loadOperationalData();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Verification failed. Invalid token, station mismatch, or already completed.';
      setQrError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  // =========================================================================
  // APPROVAL & QR DIGITAL PASS ISSUANCE
  // =========================================================================

  const handleApproveReservation = async (res) => {
    if (approvingId) return;
    setApprovingId(res.id);
    try {
      const apiRes = await api.post(`/reservations/${res.id}/approve`);
      const updated = apiRes.data?.reservation || {};
      const fullPassData = { ...res, ...updated, status: 'Approved' };
      loadOperationalData();

      // The backend signs a QR token on approval; never show a made-up token that can't be verified
      if (!fullPassData.qrCodeToken) {
        showToast(`Reservation #${fullPassData.reservationNumber} approved. Refresh to load its QR pass.`, 'warning');
        return;
      }

      setApprovedPassData(fullPassData);
      setGeneratedQrDataUrl('');
      setIsPassModalOpen(true);
      showToast(`Reservation #${fullPassData.reservationNumber} approved. QR pass issued.`, 'success');

      // Draw the QR image separately: a rendering failure must not look like a failed approval
      try {
        const qrDataUrl = await QRCode.toDataURL(fullPassData.qrCodeToken, {
          width: 320,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        setGeneratedQrDataUrl(qrDataUrl);
      } catch (qrErr) {
        console.error('Failed to render QR pass image', qrErr);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to approve reservation.', 'error');
    } finally {
      setApprovingId(null);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('QR token copied.', 'info');
    } catch {
      // Clipboard API is unavailable outside secure contexts (e.g. http://<LAN-IP>)
      showToast('Copy failed. Select the token text and copy it manually.', 'warning');
    }
  };

  // Inspect existing approved pass
  const handleOpenInspection = (res) => {
    setInspectingPass(res);
  };

  // Switch to Scanner view and trigger optical camera scan for pass
  const handleScanWithCamera = (res) => {
    if (!isScannerVisible) setOperatorTab(0);
    setScannerMode('camera');
    setQrToken(res?.qrCodeToken || res?.reservationNumber || '');
    // The camera starts in an effect once the scanner viewport is on screen
    setPendingCameraStart(true);
    showToast(`Webcam started for #${res?.reservationNumber}. Hold the QR pass inside the frame.`, 'info');
  };

  // =========================================================================
  // BOOKING CREATION, EDITING & CANCELLATION
  // =========================================================================

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (createSubmitting) return;
    setCreateError('');
    setCreateSuccess('');
    if (!createForm.stationId) {
      setCreateError('Please select a solar station hub.');
      return;
    }
    // Stays locked through the success message so a second click can't create a duplicate booking
    setCreateSubmitting(true);
    try {
      const payload = {
        ...createForm,
        prosumerNic: createForm.prosumerNic.trim(),
        energyAmountKwh: parseFloat(createForm.energyAmountKwh),
        scheduledDateTime: new Date(createForm.scheduledDateTime).toISOString()
      };
      const res = await api.post('/reservations', payload);
      setCreateSuccess(`Reservation #${res.data.reservationNumber} successfully created.`);
      showToast(`Reservation #${res.data.reservationNumber} scheduled successfully!`, 'success');
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess('');
        setCreateSubmitting(false);
      }, 1500);
      loadOperationalData();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create reservation.');
      setCreateSubmitting(false);
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
    setEditSubmitting(false);
  };

  const handleUpdateReservation = async (e) => {
    e.preventDefault();
    if (editSubmitting) return;
    setEditError('');
    setEditSuccess('');
    setEditSubmitting(true);
    try {
      const payload = {
        scheduledDateTime: new Date(editForm.scheduledDateTime).toISOString(),
        energyAmountKwh: parseFloat(editForm.energyAmountKwh),
        tradeType: editForm.tradeType
      };
      await api.put(`/reservations/${editingReservation.id}`, payload);
      setEditSuccess('Reservation updated.');
      showToast('Reservation updated.', 'success');
      setTimeout(() => {
        setEditingReservation(null);
        setEditSuccess('');
        setEditSubmitting(false);
      }, 1500);
      loadOperationalData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update reservation.');
      setEditSubmitting(false);
    }
  };

  const handleOpenCancel = (res) => {
    setCancellingReservation(res);
    setCancelReason('');
    setCancelError('');
    setCancelSuccess('');
    setCancelSubmitting(false);
  };

  const handleCancelReservation = async (e) => {
    e.preventDefault();
    if (cancelSubmitting) return;
    setCancelError('');
    setCancelSuccess('');
    setCancelSubmitting(true);
    try {
      await api.post(`/reservations/${cancellingReservation.id}/cancel`, {
        reason: cancelReason || 'Operator Administrative Cancellation'
      });
      setCancelSuccess('Reservation cancelled and slots released.');
      showToast('Reservation cancelled and slots released.', 'info');
      setTimeout(() => {
        setCancellingReservation(null);
        setCancelSuccess('');
        setCancelSubmitting(false);
      }, 1500);
      loadOperationalData();
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel reservation.');
      setCancelSubmitting(false);
    }
  };

  // 12-Hour notice calculator helper (mirrors the backend modification/cancellation rule)
  const getNoticeState = (scheduledIso) => {
    if (!scheduledIso) return { isLocked: true, isPast: false, hoursLeft: 0, label: 'N/A' };
    const diffMs = new Date(scheduledIso).getTime() - Date.now();
    const hoursLeft = diffMs / (1000 * 3600);
    if (hoursLeft < 0) return { isLocked: true, isPast: true, hoursLeft, label: 'Time passed' };
    if (hoursLeft < 12) return { isLocked: true, isPast: false, hoursLeft: +hoursLeft.toFixed(1), label: `Locked <12h · ${hoursLeft.toFixed(1)}h left` };
    return { isLocked: false, isPast: false, hoursLeft: +hoursLeft.toFixed(1), label: `Editable · ${hoursLeft.toFixed(1)}h left` };
  };

  const isActiveBooking = (r) => r.status === 'Pending' || r.status === 'Approved';

  // Filtered reservations list, in queue order: upcoming active bookings (soonest first),
  // then overdue active ones, then closed history (newest first)
  const filteredReservations = useMemo(() => {
    const query = searchNic.trim().toLowerCase();
    const now = Date.now();
    const rank = (r) => {
      if (!isActiveBooking(r)) return 2;
      return new Date(r.scheduledDateTime).getTime() >= now ? 0 : 1;
    };
    return reservations
      .filter((r) => {
        const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
        const matchesNic =
          !query ||
          (r.prosumerNic && r.prosumerNic.toLowerCase().includes(query)) ||
          (r.reservationNumber && r.reservationNumber.toLowerCase().includes(query)) ||
          (r.stationName && r.stationName.toLowerCase().includes(query));
        return matchesStatus && matchesNic;
      })
      .sort((a, b) => {
        const rankA = rank(a);
        const rankB = rank(b);
        if (rankA !== rankB) return rankA - rankB;
        const timeA = new Date(a.scheduledDateTime).getTime();
        const timeB = new Date(b.scheduledDateTime).getTime();
        return rankA === 0 ? timeA - timeB : timeB - timeA;
      });
  }, [reservations, statusFilter, searchNic]);

  // Queue pagination: filter pills and KPIs keep counting the full list
  const {
    pageItems: pagedReservations,
    page: queuePage,
    setPage: setQueuePage,
    pageSize: queuePageSize,
    setPageSize: setQueuePageSize,
    totalPages: queueTotalPages,
    totalItems: queueTotalItems
  } = usePagination(filteredReservations, 10, `${statusFilter}|${searchNic}`);

  // Per-status counts for the filter pills
  const statusCounts = useMemo(() => {
    const counts = { All: reservations.length };
    reservations.forEach((r) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return counts;
  }, [reservations]);

  // KPIs
  const kpis = useMemo(() => {
    const queue = reservations.filter(isActiveBooking).length;
    const verified = reservations.filter((r) => r.status === 'Completed').length;
    // Label says "across active grid hubs", so deactivated hubs don't count
    const totalBatteryCapacity = stations
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + (s.availableBatterySlots || 0), 0);
    return { queue, verified, totalBatteryCapacity };
  }, [reservations, stations]);

  const currentStationObj = stations.find((s) => s.id === selectedStationId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification Container */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

      {/* Top Header & Operator Profile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Grid Operator Dashboard
          </h1>
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium flex flex-wrap items-center gap-2">
            <span>Logged in as <strong className="text-slate-900 dark:text-white font-semibold">{user?.fullName || 'Grid Operator'}</strong> ({user?.nic || 'OPERATOR001'})</span>
            <span className="text-slate-300 dark:text-slate-600">&bull;</span>
            {/* Operating hub is global context: it drives QR verification, queue highlighting and inventory */}
            <label className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>Operating hub:</span>
              <select
                value={selectedStationId}
                onChange={(e) => handleStationChange(e.target.value)}
                aria-label="Operating hub"
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.isActive ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <button
          onClick={loadOperationalData}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-amber-500 dark:text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 3 KPI Cards (Matching Mobile Screen) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Reservation Queue</p>
            <p className="text-2xl font-display font-black text-amber-600 dark:text-amber-400 mt-1">
              {kpis.queue} Reservations
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pending &amp; approved, all stations</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Verified Trades</p>
            <p className="text-2xl font-display font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {kpis.verified} Completed
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Verified by QR scan</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Battery Capacity</p>
            <p className="text-2xl font-display font-black text-cyan-600 dark:text-cyan-400 mt-1">
              {kpis.totalBatteryCapacity} Slots Free
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Across all active stations</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Battery className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Operator Hub Segmented Tab Selector */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 dark:bg-slate-950/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setOperatorTab(0)}
          aria-pressed={operatorTab === 0}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            operatorTab === 0
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Scan className="h-4 w-4" />
          <span>QR Scanner</span>
        </button>
        <button
          onClick={() => setOperatorTab(1)}
          aria-pressed={operatorTab === 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            operatorTab === 1
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Reservation Queue ({kpis.queue})</span>
        </button>
        <button
          onClick={() => setOperatorTab(2)}
          aria-pressed={operatorTab === 2}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            operatorTab === 2
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Battery className="h-4 w-4" />
          <span>Battery Slots ({currentStationObj?.availableBatterySlots ?? availableSlots} free)</span>
        </button>
        <button
          onClick={() => setOperatorTab(3)}
          aria-pressed={operatorTab === 3}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            operatorTab === 3
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>All Panels</span>
        </button>
      </div>

      {/* Main Workstation Layout */}
      <div className={`grid gap-6 ${operatorTab === 3 ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        
        {/* SECTION 1: QR Scanner & Verification */}
        {(operatorTab === 0 || operatorTab === 3) && (
          <div
            ref={qrSectionRef}
            className={`${
              operatorTab === 3 ? 'lg:col-span-7' : 'w-full'
            } rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xs dark:shadow-xl space-y-5 transition-all duration-300`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-slate-900 dark:text-white font-display font-bold text-lg">
                <div className="h-10 w-10 shrink-0 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Scan className="h-5 w-5" />
                </div>
                <div>
                  <h3>Verify QR Pass</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-normal">
                    Scan the prosumer's QR pass with the webcam, or enter the token manually
                  </p>
                </div>
              </div>

              {/* Scanner Mode Toggle */}
              <div className="flex items-center gap-1 self-start sm:self-auto shrink-0 whitespace-nowrap bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode('camera');
                    // Started by the effect once the video element is rendered (it isn't in manual mode)
                    setPendingCameraStart(true);
                  }}
                  aria-pressed={scannerMode === 'camera'}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    scannerMode === 'camera'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Camera className="h-3 w-3" />
                  <span>Webcam</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode('manual');
                    stopCameraScanner();
                  }}
                  aria-pressed={scannerMode === 'manual'}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    scannerMode === 'manual'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Manual Entry</span>
                </button>
              </div>
            </div>

            {/* Scanner Viewport */}
            {scannerMode === 'camera' ? (
              <div className="relative h-64 rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden flex flex-col items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  className={`absolute inset-0 w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Reticle */}
                <div className="absolute inset-8 border border-cyan-500/30 rounded-xl pointer-events-none" />
                <div className="absolute top-5 left-5 w-5 h-5 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-5 right-5 w-5 h-5 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-5 left-5 w-5 h-5 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-5 right-5 w-5 h-5 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                {isCameraActive ? (
                  <>
                    <div className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-scan-laser pointer-events-none" />
                    <div className="absolute bottom-3 bg-slate-950/80 px-3.5 py-1 rounded-full text-[11px] font-mono text-cyan-400 border border-cyan-500/30 backdrop-blur-xs flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Scanning &bull; Hold the QR pass inside the frame</span>
                    </div>
                    <button
                      onClick={stopCameraScanner}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                      title="Stop camera"
                      aria-label="Stop camera"
                    >
                      <CameraOff className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="text-center p-4 space-y-2">
                    <QrCode className="h-12 w-12 text-slate-600 mx-auto" />
                    <p className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                      Camera Off
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Start the webcam to scan the QR pass on the prosumer's phone.
                    </p>
                    <button
                      type="button"
                      onClick={startCameraScanner}
                      className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition active:scale-95 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Start Webcam</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <label htmlFor="approved-pass-select">Approved reservations</label>
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold">
                    {reservations.filter((r) => r.status === 'Approved').length} ready
                  </span>
                </div>
                {/* Controlled at "" so it resets after each pick: the same pass can be reopened, and a
                    completed pass doesn't stay selected */}
                <select
                  id="approved-pass-select"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      setQrToken(e.target.value);
                      const matched = reservations.find(
                        (r) => (r.qrCodeToken && r.qrCodeToken === e.target.value) || r.reservationNumber === e.target.value
                      );
                      if (matched) setInspectingPass(matched);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                >
                  <option value="">Select an approved reservation to inspect…</option>
                  {reservations
                    .filter((r) => r.status === 'Approved')
                    .map((r) => (
                      <option key={r.id} value={r.qrCodeToken || r.reservationNumber}>
                        {r.reservationNumber} &bull; {r.prosumerNic} &bull; {r.energyAmountKwh}kWh ({r.stationName})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {cameraError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Verification Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDirectVerifyQr();
              }}
              className="space-y-3 pt-1"
            >
              <div>
                <label htmlFor="qr-token-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  QR Token
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="qr-token-input"
                    ref={qrInputRef}
                    type="text"
                    required
                    placeholder="e.g. SOLAR-TX:RES-78442525:07AF828EED4D or RES-78442525"
                    value={qrToken}
                    onChange={(e) => setQrToken(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-cyan-600 dark:text-cyan-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/50"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 transition shadow-md shadow-cyan-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{verifying ? 'Verifying...' : 'Verify & Complete'}</span>
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

            {/* Verification Result Card */}
            {verifiedResult && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-100 text-xs space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span>Transfer completed</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVerifiedResult(null)}
                    aria-label="Dismiss"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px] bg-white/60 dark:bg-slate-950/60 p-3 rounded-xl border border-emerald-500/20">
                  <div>Reservation #: <strong className="text-slate-900 dark:text-white">{verifiedResult.reservationNumber}</strong></div>
                  <div>Prosumer NIC: <strong className="text-slate-900 dark:text-white">{verifiedResult.prosumerNic}</strong></div>
                  <div>Energy: <strong className="text-emerald-600 dark:text-emerald-400">{verifiedResult.energyAmountKwh} kWh</strong></div>
                  <div>Station: <strong className="text-slate-900 dark:text-white">{verifiedResult.stationName}</strong></div>
                  <div>Status: <strong className="text-emerald-600 dark:text-emerald-400">Completed</strong></div>
                  <div>Operator: <strong className="text-cyan-600 dark:text-cyan-400">{user?.fullName || 'OPERATOR001'}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: Battery Storage Slot Inventory */}
        {(operatorTab === 2 || operatorTab === 3) && (
          <div
            className={`${
              operatorTab === 3 ? 'lg:col-span-5' : 'w-full'
            } rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl p-6 sm:p-7 shadow-xs dark:shadow-xl space-y-5 transition-colors duration-300`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-slate-900 dark:text-white font-display font-bold text-lg">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center">
                  <Battery className="h-5 w-5" />
                </div>
                <div>
                  <h3>Battery Slots</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-normal">
                    Update how many battery slots are free at this station
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div>
                <label htmlFor="inventory-station-select" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Station
                </label>
                <select
                  id="inventory-station-select"
                  value={selectedStationId}
                  onChange={(e) => handleStationChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.stationCode} &mdash; {s.name} ({s.availableBatterySlots}/{s.totalBatterySlots} Available){s.isActive ? '' : ' (inactive)'}
                    </option>
                  ))}
                </select>
              </div>

              {telemetry && (
                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">Occupied Slots</p>
                    <p className="text-base font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {telemetry.occupiedBatterySlots} / {telemetry.totalBatterySlots}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">Occupancy</p>
                    <p className="text-base font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                      {telemetry.batteryOccupancyPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}

              {/* Slider & Meter */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center gap-2 text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400">Free slots</span>
                  <span className="flex items-center gap-2">
                    {slotsDirty && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wide">
                        Unsaved
                      </span>
                    )}
                    <span className="text-amber-600 dark:text-amber-400 font-mono text-sm">
                      {availableSlots} of {totalSlots} free
                    </span>
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max={totalSlots}
                  value={availableSlots}
                  onChange={(e) => editAvailableSlots(parseInt(e.target.value, 10))}
                  aria-label="Available battery slots"
                  className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg"
                />

                <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  <span>0 (full)</span>
                  <span>{totalSlots} (all free)</span>
                </div>
              </div>

              {/* Micro Stepper and Save Button */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => editAvailableSlots(availableSlots - 1)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 active:scale-95 transition cursor-pointer"
                >
                  -1 Slot
                </button>

                <input
                  type="number"
                  min="0"
                  max={totalSlots}
                  value={availableSlots}
                  onChange={(e) => editAvailableSlots(parseInt(e.target.value, 10))}
                  aria-label="Available battery slots"
                  className="w-20 text-center py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() => editAvailableSlots(availableSlots + 1)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-700 active:scale-95 transition cursor-pointer"
                >
                  +1 Slot
                </button>

                <button
                  onClick={handleUpdateSlots}
                  disabled={!slotsDirty}
                  title={slotsDirty ? 'Save the new free-slot count' : 'No unsaved changes'}
                  className="ml-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: Booking Queue */}
      {(operatorTab === 1 || operatorTab === 3) && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-xs dark:shadow-xl transition-colors duration-300">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                  Reservation Queue
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Upcoming reservations first (soonest at the top), then overdue ones, then history.
                </p>
              </div>

              <button
                onClick={() => {
                  const defaultHub = stations.find((s) => s.id === selectedStationId && s.isActive) || stations.find((s) => s.isActive);
                  setCreateForm({
                    prosumerNic: '',
                    stationId: defaultHub?.id || '',
                    // datetime-local expects local time; toISOString() would give UTC (hours in the past for UTC+ zones)
                    scheduledDateTime: toLocalIsoString(new Date(Date.now() + 3600000)),
                    energyAmountKwh: 15,
                    tradeType: 'DropOff'
                  });
                  setCreateError('');
                  setCreateSuccess('');
                  setCreateSubmitting(false);
                  setIsCreateModalOpen(true);
                }}
                className="self-start sm:self-auto shrink-0 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Reservation</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-2.5">
              <div className="relative md:w-64 shrink-0">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter NIC, Res # or Hub"
                  aria-label="Filter reservations by NIC, reservation number or hub"
                  value={searchNic}
                  onChange={(e) => setSearchNic(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 w-full focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    aria-pressed={statusFilter === status}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      statusFilter === status
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {status} <span className="opacity-70 font-mono">({statusCounts[status] || 0})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingReservations ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <RefreshCw className="h-6 w-6 text-amber-500 dark:text-amber-400 animate-spin mx-auto mb-2" />
              <span>Loading reservations…</span>
            </div>
          ) : filteredReservations.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No reservations match these filters.
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap">
                  <tr>
                    <th className="px-5 py-4">Reservation #</th>
                    <th className="px-5 py-4">Prosumer NIC</th>
                    <th className="px-5 py-4">Station &amp; Trade Type</th>
                    <th className="px-5 py-4">Scheduled Window</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                  {pagedReservations.map((r) => {
                    const notice = getNoticeState(r.scheduledDateTime);
                    const isActive = isActiveBooking(r);
                    const isMatchingActiveStation = selectedStationId && r.stationId === selectedStationId;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {r.reservationNumber}
                        </td>
                        <td className="px-5 py-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {r.prosumerNic}
                        </td>
                        <td className="px-5 py-4">
                          {/* min-width lives on the inner div: browsers ignore min-width on table cells */}
                          <div className="min-w-[180px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{r.stationName}</span>
                            {!isMatchingActiveStation && (
                              <span className="shrink-0 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500" title="Reservation is for a different hub than your operating hub">
                                Other Hub
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-semibold whitespace-nowrap">
                            {r.energyAmountKwh} kWh &bull; {r.tradeType}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {formatSchedule(r.scheduledDateTime)}
                          </div>
                          {/* The 12-hour rule only matters while a booking can still change */}
                          {isActive && (
                            <div className="mt-1">
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold border ${
                                  notice.isPast
                                    ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                                    : notice.isLocked
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                }`}
                              >
                                {notice.label}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
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
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            {r.status === 'Pending' && (
                              <button
                                onClick={() => handleApproveReservation(r)}
                                disabled={notice.isPast || approvingId === r.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-[11px] transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                title={notice.isPast ? 'Appointment time has passed. Cancel it instead.' : 'Approve reservation & issue QR pass'}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{approvingId === r.id ? 'Approving…' : 'Approve'}</span>
                              </button>
                            )}
                            {r.status === 'Approved' && (
                              <>
                                <button
                                  onClick={() => handleOpenInspection(r)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                                  title="View pass details and verify"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                  <span>Inspect</span>
                                </button>
                                <button
                                  onClick={() => handleScanWithCamera(r)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] transition active:scale-95 cursor-pointer shadow-xs"
                                  title="Scan Prosumer QR Pass with Webcam"
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                  <span>Scan</span>
                                </button>
                              </>
                            )}
                            {isActive && (
                              <>
                                {/* The backend rejects modifications inside 12 hours for every role */}
                                <button
                                  onClick={() => handleOpenEdit(r)}
                                  disabled={notice.isLocked}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                  title={notice.isLocked ? 'Modifications close 12 hours before the scheduled time' : 'Modify scheduled window or energy'}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleOpenCancel(r)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                                  title={notice.isLocked ? "Cancel on the prosumer's behalf (operator override of the 12-hour rule)" : 'Cancel reservation'}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </>
                            )}
                            {/* Status column already says Completed; nothing left to do */}
                            {r.status === 'Completed' && (
                              <span className="text-slate-400 dark:text-slate-600 font-mono text-[11px]" aria-label="No actions">
                                &mdash;
                              </span>
                            )}
                            {r.status === 'Cancelled' && (
                              <span className="inline-block max-w-[240px] whitespace-normal text-right text-slate-500 dark:text-slate-500 font-mono text-[11px]">
                                Reason: {r.cancellationReason || 'Not recorded'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={queuePage}
              totalPages={queueTotalPages}
              totalItems={queueTotalItems}
              pageSize={queuePageSize}
              onPageChange={setQueuePage}
              onPageSizeChange={setQueuePageSize}
              itemLabel="reservations"
            />
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: QR PASS DETAILS */}
      {/* ===================================================================== */}
      <Modal
        isOpen={inspectingPass !== null}
        onClose={() => setInspectingPass(null)}
        title="QR Pass Details"
        maxWidth="max-w-lg"
      >
        {inspectingPass && (() => {
          // The backend rejects a pass verified at a different hub, or one that isn't Approved
          const passHubMatches = !!selectedStationId && inspectingPass.stationId === selectedStationId;
          const passIsApproved = inspectingPass.status === 'Approved';
          return (
          <div className="space-y-4 text-xs">
            {/* Station Hub Matching Badge */}
            {passHubMatches ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Correct station: <strong>{inspectingPass.stationName}</strong></span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    This pass is for <strong>{inspectingPass.stationName}</strong>, but you are operating <strong>{currentStationObj?.name || 'no station'}</strong>. It can only be completed at its own station.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStationChange(inspectingPass.stationId)}
                  className="ml-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition active:scale-95 cursor-pointer"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Switch to {inspectingPass.stationName}</span>
                </button>
              </div>
            )}

            {/* Inspection Details Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                <span className="text-slate-500 dark:text-slate-400">Reservation #:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {inspectingPass.reservationNumber}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                <span className="text-slate-500 dark:text-slate-400">Prosumer NIC:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {inspectingPass.prosumerNic}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                <span className="text-slate-500 dark:text-slate-400">Energy &amp; Trade Type:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {inspectingPass.energyAmountKwh} kWh &nbsp;({inspectingPass.tradeType})
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
                <span className="text-slate-500 dark:text-slate-400">Scheduled Time:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {formatSchedule(inspectingPass.scheduledDateTime)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    passIsApproved
                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  }`}
                >
                  {inspectingPass.status}
                </span>
              </div>
            </div>

            {inspectingPass.qrCodeToken && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] break-all">
                <span className="text-slate-400 font-sans block mb-0.5 uppercase tracking-wider font-bold text-[9px]">
                  QR Token
                </span>
                <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{inspectingPass.qrCodeToken}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const target = inspectingPass;
                  setInspectingPass(null);
                  handleScanWithCamera(target);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition"
              >
                <Camera className="h-3.5 w-3.5 text-cyan-500" />
                <span>Scan with Webcam</span>
              </button>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingPass(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={verifying || !passHubMatches || !passIsApproved}
                  onClick={() => handleDirectVerifyQr(inspectingPass.qrCodeToken || inspectingPass.reservationNumber)}
                  title={
                    !passIsApproved
                      ? `Only approved reservations can be completed (this one is ${inspectingPass.status})`
                      : !passHubMatches
                      ? "Switch to the pass's station first"
                      : 'Verify the pass and complete the energy transfer'
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-500/20 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>{verifying ? 'Completing…' : 'Verify & Complete'}</span>
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 2: ISSUED QR PASS */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isPassModalOpen && approvedPassData !== null}
        onClose={() => setIsPassModalOpen(false)}
        title="QR Pass Issued"
        maxWidth="max-w-md"
      >
        {approvedPassData && (
          <div className="space-y-4 text-xs text-center">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 inline-block shadow-md mx-auto">
              {generatedQrDataUrl ? (
                <img
                  src={generatedQrDataUrl}
                  alt={`QR pass for ${approvedPassData.reservationNumber}`}
                  className="h-48 w-48 mx-auto object-contain"
                />
              ) : (
                <div className="h-48 w-48 flex items-center justify-center text-slate-400 font-mono text-[11px]">
                  Rendering QR...
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="font-mono font-bold text-base text-amber-600 dark:text-amber-400">
                {approvedPassData.reservationNumber || '—'}
              </p>
              <p className="text-slate-700 dark:text-slate-300 font-semibold text-xs">
                {approvedPassData.stationName || '—'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-slate-500 dark:text-slate-400 text-[11px] pt-1">
                <span>NIC: <strong className="text-slate-800 dark:text-white font-mono">{approvedPassData.prosumerNic}</strong></span>
                <span>&bull;</span>
                <span>Energy: <strong className="text-amber-600 dark:text-amber-400 font-mono">{approvedPassData.energyAmountKwh} kWh</strong></span>
                <span>&bull;</span>
                <span>Type: <strong className="text-cyan-600 dark:text-cyan-400">{approvedPassData.tradeType}</strong></span>
              </div>
              {approvedPassData.scheduledDateTime && (
                <p className="text-slate-400 font-mono text-[10px] pt-0.5">
                  Scheduled: {formatSchedule(approvedPassData.scheduledDateTime)}
                </p>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left font-mono text-[10px] break-all">
              <span className="text-slate-400 font-sans block mb-0.5 font-bold uppercase tracking-wider text-[9px]">QR Token</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{approvedPassData.qrCodeToken}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (approvedPassData.qrCodeToken) copyToClipboard(approvedPassData.qrCodeToken);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Token</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = approvedPassData;
                  setIsPassModalOpen(false);
                  handleScanWithCamera(target);
                }}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Scan with Webcam</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPassModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 3: CREATE RESERVATION */}
      {/* ===================================================================== */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Reservation"
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
            <label htmlFor="create-nic" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Prosumer NIC</label>
            <input
              id="create-nic"
              type="text"
              required
              placeholder="e.g. 200012345678 or 987654321V"
              value={createForm.prosumerNic}
              onChange={(e) => setCreateForm({ ...createForm, prosumerNic: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="create-station" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Station</label>
            <select
              id="create-station"
              value={createForm.stationId}
              onChange={(e) => setCreateForm({ ...createForm, stationId: e.target.value })}
              required
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="">Select station...</option>
              {/* Deactivated hubs can't take bookings (the backend rejects them) */}
              {stations.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.isActive}>
                  {s.name} ({s.address}){s.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-energy" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Energy (kWh)</label>
              {/* Backend rejects more than the station's capacity, so cap it here */}
              <input
                id="create-energy"
                type="number"
                step="0.5"
                min="1"
                max={stations.find((s) => s.id === createForm.stationId)?.capacityKwh || 500}
                required
                value={createForm.energyAmountKwh}
                onChange={(e) => setCreateForm({ ...createForm, energyAmountKwh: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="create-type" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Trade Type</label>
              <select
                id="create-type"
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
            <label htmlFor="create-time" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Scheduled Date &amp; Time (Within 7 Days)</label>
            <input
              id="create-time"
              type="datetime-local"
              required
              min={minBookingLocalIso}
              max={maxBookingLocalIso}
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
              disabled={createSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {createSubmitting ? 'Creating…' : 'Create Reservation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 4: EDIT RESERVATION */}
      {/* ===================================================================== */}
      <Modal
        isOpen={editingReservation !== null}
        onClose={() => setEditingReservation(null)}
        title={`Edit Reservation #${editingReservation?.reservationNumber || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateReservation} className="space-y-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            Changes are allowed until 12 hours before the scheduled time.
          </p>
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
            <label htmlFor="edit-energy" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Energy (kWh)</label>
            {/* The update endpoint doesn't re-check station capacity, so the form caps it */}
            <input
              id="edit-energy"
              type="number"
              step="0.5"
              min="1"
              max={stations.find((s) => s.id === editingReservation?.stationId)?.capacityKwh || 500}
              required
              value={editForm.energyAmountKwh}
              onChange={(e) => setEditForm({ ...editForm, energyAmountKwh: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="edit-type" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Trade Type</label>
            <select
              id="edit-type"
              value={editForm.tradeType}
              onChange={(e) => setEditForm({ ...editForm, tradeType: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            >
              <option value="DropOff">DropOff (Feed to Grid)</option>
              <option value="PickUp">PickUp (Draw from Grid)</option>
            </select>
          </div>

          <div>
            <label htmlFor="edit-time" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Scheduled Date &amp; Time (Within 7 Days)</label>
            <input
              id="edit-time"
              type="datetime-local"
              required
              min={minBookingLocalIso}
              max={maxBookingLocalIso}
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
              disabled={editSubmitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {editSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ===================================================================== */}
      {/* MODAL 5: CANCEL RESERVATION */}
      {/* ===================================================================== */}
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
            Cancel this reservation? Its reserved battery slot will be released.
          </p>

          {/* Operator-assisted cancellation: prosumers are blocked inside 12 hours, operators may override */}
          {cancellingReservation && getNoticeState(cancellingReservation.scheduledDateTime).isLocked && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                {getNoticeState(cancellingReservation.scheduledDateTime).isPast
                  ? 'The scheduled time has already passed.'
                  : 'This reservation starts in less than 12 hours, so the prosumer can no longer cancel it themselves.'}{' '}
                You are cancelling on their behalf as a Grid Operator (override). Please record the reason.
              </span>
            </div>
          )}

          <div>
            <label htmlFor="cancel-reason" className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Cancellation Reason</label>
            <textarea
              id="cancel-reason"
              rows={3}
              required
              placeholder="e.g. Operator administrative cancellation, hardware maintenance, weather condition..."
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
              disabled={cancelSubmitting}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-md shadow-red-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancel'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}