// ============================================================================
// File: ProsumerManagement.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Backoffice prosumer lifecycle management interface with dual-side (Front & Back) e-KYC document inspection, Sri Lankan NIC algorithmic verification, profile editing, and account status governance.
// References & Citations:
//   - React 18 Lifecycle & Asynchronous Data Fetching (useEffect, useState):
//     https://react.dev/reference/react/useEffect
//   - Tailwind CSS Component Layout & Tables:
//     https://tailwindcss.com/docs/table-layout
//   - Lucide React Iconography:
//     https://lucide.dev/
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Check, XCircle, RefreshCw, UserCheck, 
  ShieldAlert, CheckCircle2, UserX, Mail, Phone, Hash,
  UserPlus, Edit3, X, Zap, Shield, MapPin, Eye, EyeOff, FileText,
  Upload, Sparkles, AlertCircle, Award, CheckCircle, ShieldCheck,
  CreditCard, Layers, FileCheck, Image, Trash2, Calendar, User,
  CheckCheck, ArrowRight, ExternalLink, HelpCircle, Activity,
  Sliders, Cpu, BarChart3, ScanLine, Maximize2, Minimize2,
  Clock, CheckSquare
} from 'lucide-react';
import api from '../api/client';
import { 
  parseSriLankanNic, 
  calculateKycTrustAssessment, 
  generateMockNicCardSvg,
  generateMockNicBackSvg,
  getDateOfBirthFromDayOfYear
} from '../utils/nicHelper';
import Modal from '../components/Modal';

export default function ProsumerManagement({ theme }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [message, setMessage] = useState({ text: '', type: 'success' });

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [selectedKycUser, setSelectedKycUser] = useState(null);
  const [kycDocTab, setKycDocTab] = useState('front'); // 'front' | 'back' | 'utility' | 'dual'
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Advanced NIC Studio & Inspector States
  const [showNicTester, setShowNicTester] = useState(false);
  const [nicTesterInput, setNicTesterInput] = useState('199812304567');
  const [zoomDoc, setZoomDoc] = useState(false);

  // Form States
  const initialForm = {
    nic: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    solarCapacityKw: 15.0,
    inverterSerial: '',
    password: '',
    nicDocumentBase64: '',
    nicBackDocumentBase64: '',
    utilityBillBase64: ''
  };

  const [formData, setFormData] = useState(initialForm);
  const [editingUser, setEditingUser] = useState(null);

  const fetchProsumers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users?role=Prosumer');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch prosumers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProsumers();
  }, []);

  const notify = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 4000);
  };

  const handleStatusChange = async (nic, newStatus) => {
    try {
      await api.put(`/users/${nic}/status`, { status: newStatus });
      notify(`Prosumer ${nic} status transitioned to ${newStatus}.`, 'success');
      if (showKycModal) setShowKycModal(false);
      fetchProsumers();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update account status.', 'error');
    }
  };

  const handleOpenCreate = () => {
    setFormData(initialForm);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setFormData({
      nic: user.nic,
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      solarCapacityKw: user.solarCapacityKw || 15.0,
      inverterSerial: user.inverterSerial || '',
      password: '',
      nicDocumentBase64: user.nicDocumentBase64 || '',
      nicBackDocumentBase64: user.nicBackDocumentBase64 || '',
      utilityBillBase64: user.utilityBillBase64 || ''
    });
    setShowEditModal(true);
  };

  const handleOpenKycDossier = (user) => {
    setSelectedKycUser(user);
    setKycDocTab('front');
    setShowKycModal(true);
  };

  const handleFileUpload = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      notify('File size exceeds 2MB limit. Please upload an optimized image.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        [field]: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = (field) => {
    setFormData((prev) => ({
      ...prev,
      [field]: ''
    }));
  };

  const handleGenerateMockDoc = () => {
    const nicInfo = parseSriLankanNic(formData.nic || '200012345678');
    const mockFront = generateMockNicCardSvg(
      formData.nic || '200012345678',
      formData.fullName || 'Sunil Shantha',
      nicInfo.birthYear || '2000',
      nicInfo.gender || 'Male',
      formData.address || 'No. 45, Galle Road, Colombo 03'
    );
    const mockBack = generateMockNicBackSvg(
      formData.nic || '200012345678',
      formData.fullName || 'Sunil Shantha',
      nicInfo.birthYear || '2000',
      formData.address || 'No. 45, Galle Road, Colombo 03'
    );
    setFormData((prev) => ({
      ...prev,
      nicDocumentBase64: mockFront,
      nicBackDocumentBase64: mockBack
    }));
    notify('Official Sri Lankan Smart NIC (Front & Back) scans generated & attached.', 'success');
  };

  const handleCreateProsumer = async (e) => {
    e.preventDefault();
    if (!formData.nic || !formData.fullName || !formData.email || !formData.password) {
      notify('Please complete all required fields.', 'error');
      return;
    }

    const nicInfo = parseSriLankanNic(formData.nic);
    if (!nicInfo.isValid) {
      notify(nicInfo.error || 'Invalid NIC format.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const frontToSend = formData.nicDocumentBase64 || generateMockNicCardSvg(
        formData.nic,
        formData.fullName,
        nicInfo.birthYear,
        nicInfo.gender,
        formData.address
      );
      const backToSend = formData.nicBackDocumentBase64 || generateMockNicBackSvg(
        formData.nic,
        formData.fullName,
        nicInfo.birthYear,
        formData.address
      );

      await api.post('/auth/register-prosumer', {
        nic: formData.nic.trim().toUpperCase(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        solarCapacityKw: parseFloat(formData.solarCapacityKw) || 15.0,
        inverterSerial: formData.inverterSerial.trim() || `INV-${formData.nic.trim().toUpperCase()}`,
        password: formData.password,
        nicDocumentBase64: frontToSend,
        nicBackDocumentBase64: backToSend,
        utilityBillBase64: formData.utilityBillBase64
      });

      notify(`Prosumer ${formData.nic.toUpperCase()} registered in Pending state with dual-slot e-KYC dossier.`, 'success');
      setShowCreateModal(false);
      setFormData(initialForm);
      fetchProsumers();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to register prosumer.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProsumer = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.put(`/users/${editingUser.nic}`, {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        solarCapacityKw: parseFloat(formData.solarCapacityKw) || 15.0,
        inverterSerial: formData.inverterSerial.trim(),
        nicDocumentBase64: formData.nicDocumentBase64,
        nicBackDocumentBase64: formData.nicBackDocumentBase64,
        utilityBillBase64: formData.utilityBillBase64
      });

      notify(`Prosumer ${editingUser.nic} profile updated successfully.`, 'success');
      setShowEditModal(false);
      setEditingUser(null);
      fetchProsumers();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update prosumer profile.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.nic.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.inverterSerial && u.inverterSerial.toLowerCase().includes(search.toLowerCase()));

    if (statusFilter === 'All') return matchesSearch;
    return matchesSearch && u.status === statusFilter;
  });

  const pendingCount = users.filter(u => u.status === 'Pending').length;
  const activeCount = users.filter(u => u.status === 'Active').length;
  const deactivatedCount = users.filter(u => u.status === 'Deactivated').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification Alert */}
      {message.text && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-lg transition-all animate-in slide-in-from-top-2 ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
            : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <span className="text-sm font-semibold">{message.text}</span>
          </div>
          <button 
            onClick={() => setMessage({ text: '', type: 'success' })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-8 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-3">
              <ShieldCheck className="h-4 w-4" />
              <span>Dual-Slot e-KYC Governance &bull; Sri Lankan NIC Natural Key</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              Solar Prosumer Directory &amp; e-KYC Desk
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Inspect cryptographic identity scans (Front &amp; Back NIC + Grid Utility Bill), verify microgrid interconnection hardware, and authorize decentralized energy trading accounts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowNicTester(!showNicTester)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer ${
                showNicTester 
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-amber-500/20' 
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
              }`}
            >
              <ScanLine className="h-4 w-4" />
              <span>{showNicTester ? 'Close NIC Studio' : 'Live NIC Inspector Studio'}</span>
            </button>
            <button
              onClick={fetchProsumers}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Onboard Prosumer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Sri Lankan NIC Inspector Studio */}
      {showNicTester && (
        <div className="p-6 rounded-3xl bg-slate-900/90 dark:bg-slate-950/90 border border-amber-500/40 backdrop-blur-xl shadow-2xl space-y-6 text-white animate-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ScanLine className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-display font-black text-white flex items-center gap-2">
                  <span>Sri Lankan e-KYC Identity Verification Studio</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold uppercase tracking-wider">
                    Algorithmic Parser
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Simulate Department of Registration of Persons (DRP) mathematical identity verification across Old (9+V/X) and New (12-Digit) formats.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Quick Presets:</span>
              {[
                { label: '981234567V (Old • M)', val: '981234567V' },
                { label: '856234567V (Old • F)', val: '856234567V' },
                { label: '199812304567 (New • M)', val: '199812304567' },
                { label: '200165409876 (New • F)', val: '200165409876' }
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setNicTesterInput(p.val)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-mono text-[11px] font-bold border border-slate-700 transition cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Input Box */}
            <div className="lg:col-span-4 space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Enter Sri Lankan NIC String to Test:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nicTesterInput}
                  onChange={(e) => setNicTesterInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 981234567V or 200012345678"
                  className="w-full px-4 py-3 bg-slate-950 border-2 border-amber-500/50 rounded-2xl text-amber-400 font-mono font-black text-lg uppercase tracking-wider focus:outline-none focus:border-amber-400 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setNicTesterInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 text-xs cursor-pointer font-bold"
                >
                  Clear
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Type any valid or invalid NIC to inspect cryptographic breakdown in real time.
              </p>
            </div>

            {/* Results Segmented Breakdown */}
            <div className="lg:col-span-8">
              {(() => {
                const parsed = parseSriLankanNic(nicTesterInput);
                if (!parsed.isValid) {
                  return (
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-red-300">
                      <AlertCircle className="h-6 w-6 text-red-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-sm text-red-200">Algorithmic Verification Failed</h4>
                        <p className="text-xs text-red-300/80">{parsed.error}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* 4 Segmented Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Segment 1: Year
                        </span>
                        <span className="text-lg font-mono font-black text-amber-400">
                          {parsed.segments?.part1}
                        </span>
                        <span className="text-[10px] text-slate-300 block font-medium">
                          {parsed.segments?.part1Label}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Segment 2: Day &amp; Gender
                        </span>
                        <span className="text-lg font-mono font-black text-cyan-400">
                          {parsed.segments?.part2}
                        </span>
                        <span className="text-[10px] text-slate-300 block font-medium">
                          {parsed.segments?.part2Label}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Segment 3: Sequence
                        </span>
                        <span className="text-lg font-mono font-black text-emerald-400">
                          {parsed.segments?.part3}
                        </span>
                        <span className="text-[10px] text-slate-300 block font-medium">
                          {parsed.segments?.part3Label}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Segment 4: Integrity
                        </span>
                        <span className="text-lg font-mono font-black text-purple-400">
                          {parsed.segments?.part4}
                        </span>
                        <span className="text-[10px] text-slate-300 block font-medium truncate">
                          {parsed.segments?.part4Label}
                        </span>
                      </div>
                    </div>

                    {/* Decoded Demographics Ribbon */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Calendar className="h-4 w-4 text-amber-400" />
                          <span>DOB: <strong className="text-white">{parsed.dob?.formattedDate}</strong></span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="h-4 w-4 text-cyan-400" />
                          <span>Age: <strong className="text-white">{parsed.estimatedAge} yrs</strong></span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <User className="h-4 w-4 text-purple-400" />
                          <span>Gender: <strong className="text-white">{parsed.gender}</strong></span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <CheckCheck className="h-4 w-4 text-emerald-400" />
                          <span>Format: <strong className="text-emerald-400">{parsed.format}</strong></span>
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Cryptographically Valid</span>
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats & Metric Tickers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Onboarded</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-slate-900 dark:text-white">
            {users.length}
          </div>
          <span className="text-[11px] text-slate-400">Registered solar accounts</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending e-KYC</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </div>
          <span className="text-[11px] text-slate-400">Awaiting Backoffice review</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Trading</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <span className="text-[11px] text-slate-400">Authorized prosumer nodes</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Deactivated</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-red-600 dark:text-red-400">
            {deactivatedCount}
          </div>
          <span className="text-[11px] text-slate-400">Restricted accounts</span>
        </div>
      </div>

      {/* Priority e-KYC Authorization Queue (Fast-Track Stream) */}
      {pendingCount > 0 && (
        <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-2 border-amber-500/40 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/30">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-slate-950"></span>
                </span>
              </div>
              <div>
                <h3 className="text-base font-display font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Priority e-KYC Authorization Queue</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                    {pendingCount} Pending Review
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registered prosumers require Backoffice identity verification &amp; regulatory signoff before microgrid dispatch authorization.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {users.filter((u) => u.status === 'Pending').map((u) => {
              const assessment = calculateKycTrustAssessment(u);
              const nicParsed = parseSriLankanNic(u.nic);

              return (
                <div 
                  key={u.nic} 
                  className="rounded-2xl p-5 bg-white/95 dark:bg-slate-900/90 border border-amber-500/30 shadow-md hover:border-amber-500/60 hover:shadow-amber-500/10 transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                          {u.fullName?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                            {u.fullName}
                          </h4>
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                            {u.nic}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                        {nicParsed.formatType || 'NIC'}
                      </span>
                    </div>

                    {/* Decoded Demographics */}
                    {nicParsed.isValid && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 font-medium">
                          <span>Demographics:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {nicParsed.gender} &bull; {nicParsed.dob?.formattedDate || nicParsed.birthYear} ({nicParsed.estimatedAge}y)
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>Solar Spec:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">
                            ⚡ {u.solarCapacityKw || 15} kW Peak
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Document Status Badges */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                        u.nicDocumentBase64 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        <CreditCard className="h-3 w-3" />
                        <span>Front ID</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                        u.nicBackDocumentBase64 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        <Layers className="h-3 w-3" />
                        <span>Back ID</span>
                      </span>
                      {u.utilityBillBase64 && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>Bill</span>
                        </span>
                      )}
                    </div>

                    {/* Trust Meter */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">e-KYC Confidence</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">{assessment.score}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${assessment.score}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleOpenKycDossier(u)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5 text-amber-500" />
                      <span>Inspect Dossier</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(u.nic, 'Active')}
                      className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Authorize</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC PK, prosumer name, or inverter serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          {[
            { id: 'All', label: 'All Prosumers', count: users.length },
            { id: 'Pending', label: 'Pending e-KYC', count: pendingCount, alert: pendingCount > 0 },
            { id: 'Active', label: 'Active', count: activeCount },
            { id: 'Deactivated', label: 'Deactivated', count: deactivatedCount }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === tab.id
                  ? 'bg-slate-950 text-amber-400'
                  : tab.alert ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-slate-200 dark:bg-slate-800'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Prosumers Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-4 px-6">Prosumer Identity (NIC PK)</th>
                <th className="py-4 px-6">Solar Hardware Telemetry</th>
                <th className="py-4 px-6">Contact Channels</th>
                <th className="py-4 px-6">e-KYC Trust &amp; Docs</th>
                <th className="py-4 px-6 text-right">Dossier Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 text-amber-500 dark:text-amber-400 animate-spin mx-auto mb-2" />
                    <span>Loading prosumer records...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No prosumer accounts found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const assessment = calculateKycTrustAssessment(u);

                  return (
                    <tr key={u.nic} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            {u.fullName?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">{u.fullName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                                <Hash className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                <span>{u.nic}</span>
                              </span>
                              {assessment.nicInfo.isValid && (
                                <>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                                    {assessment.nicInfo.formatType || 'NIC'}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700/60">
                                    {assessment.nicInfo.gender} &bull; {assessment.nicInfo.dob?.formattedDate || `b. ${assessment.nicInfo.birthYear}`} ({assessment.nicInfo.estimatedAge}y)
                                  </span>
                                </>
                              )}
                            </div>
                            {u.approvedBy && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Verified by: {u.approvedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs">
                          <span>⚡ {u.solarCapacityKw > 0 ? `${u.solarCapacityKw} kW` : '15.0 kW'} Array</span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          INV: {u.inverterSerial || 'INV-SL-2026-DEFAULT'}
                        </p>
                        {u.address && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[180px]">
                            📍 {u.address}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-6 space-y-1">
                        <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <span>{u.email}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                          <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                          <span>{u.phone}</span>
                        </p>
                      </td>

                      <td className="py-4 px-6">
                        <div className="space-y-1.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            u.status === 'Active'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : u.status === 'Pending'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              : 'bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              u.status === 'Active' ? 'bg-emerald-500 dark:bg-emerald-400' : u.status === 'Pending' ? 'bg-amber-500 dark:bg-amber-400' : 'bg-red-500 dark:bg-red-400'
                            }`} />
                            <span>{u.status}</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <Award className="h-3 w-3 text-amber-500" />
                              <span>Trust: <strong className="text-slate-800 dark:text-slate-200">{assessment.score}%</strong></span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${u.nicDocumentBase64 ? 'bg-emerald-400' : 'bg-slate-400'}`} title="NIC Front" />
                              <span className={`h-1.5 w-1.5 rounded-full ${u.nicBackDocumentBase64 ? 'bg-emerald-400' : 'bg-slate-400'}`} title="NIC Back" />
                              {u.utilityBillBase64 && (
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" title="Utility Bill" />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenKycDossier(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition active:scale-95 cursor-pointer text-xs border border-slate-200 dark:border-slate-700 shadow-xs"
                            title="Inspect e-KYC Verification Dossier"
                          >
                            <Eye className="h-3.5 w-3.5 text-amber-500" />
                            <span>Inspect e-KYC</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          {u.status === 'Pending' && (
                            <button
                              onClick={() => handleStatusChange(u.nic, 'Active')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow-sm active:scale-95 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                          )}

                          {u.status === 'Active' && (
                            <button
                              onClick={() => handleStatusChange(u.nic, 'Deactivated')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 font-bold transition active:scale-95 cursor-pointer"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              <span>Deactivate</span>
                            </button>
                          )}

                          {u.status === 'Deactivated' && (
                            <button
                              onClick={() => handleStatusChange(u.nic, 'Active')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold transition active:scale-95 cursor-pointer"
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Reactivate</span>
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

      {/* Modal: e-KYC Verification Dossier Inspector */}
      <Modal
        isOpen={showKycModal}
        onClose={() => {
          setShowKycModal(false);
          setSelectedKycUser(null);
        }}
        maxWidth="max-w-5xl"
        title="Prosumer e-KYC Verification & Dual-Document Dossier"
      >
        {selectedKycUser && (() => {
          const assessment = calculateKycTrustAssessment(selectedKycUser);
          const frontSvg = selectedKycUser.nicDocumentBase64 || generateMockNicCardSvg(
            selectedKycUser.nic,
            selectedKycUser.fullName,
            assessment.nicInfo.birthYear,
            assessment.nicInfo.gender,
            selectedKycUser.address
          );
          const backSvg = selectedKycUser.nicBackDocumentBase64 || generateMockNicBackSvg(
            selectedKycUser.nic,
            selectedKycUser.fullName,
            assessment.nicInfo.birthYear,
            selectedKycUser.address
          );
          const utilityBill = selectedKycUser.utilityBillBase64;

          return (
            <div className="space-y-6 text-xs">
              {/* Trust Score Banner */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Automated e-KYC Trust Confidence: {assessment.score}%
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tier: <span className="font-bold text-emerald-600 dark:text-emerald-400">{assessment.riskLevel}</span> &bull; Status: <span className="font-bold">{selectedKycUser.status}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs text-slate-400">NIC PK: {selectedKycUser.nic}</span>
                </div>
              </div>

              {/* Document Switcher Tabs (Sticky) */}
              <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => setKycDocTab('front')}
                    className={`min-w-[120px] py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      kycDocTab === 'front'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>NIC Front Side</span>
                    {selectedKycUser.nicDocumentBase64 ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-bold">Uploaded</span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">Digital</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setKycDocTab('back')}
                    className={`min-w-[120px] py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      kycDocTab === 'back'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>NIC Back Side</span>
                    {selectedKycUser.nicBackDocumentBase64 ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 font-bold">Uploaded</span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">Digital</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setKycDocTab('dual')}
                    className={`min-w-[120px] py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      kycDocTab === 'dual'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Dual Side-by-Side</span>
                  </button>

                  {utilityBill && (
                    <button
                      type="button"
                      onClick={() => setKycDocTab('utility')}
                      className={`min-w-[120px] py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        kycDocTab === 'utility'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Electricity Bill</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setZoomDoc(!zoomDoc)}
                  className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ml-auto"
                  title={zoomDoc ? "Standard View" : "Expand / Zoom Document"}
                >
                  {zoomDoc ? <Minimize2 className="h-3.5 w-3.5 text-amber-500" /> : <Maximize2 className="h-3.5 w-3.5 text-amber-500" />}
                  <span>{zoomDoc ? 'Standard View' : 'Zoom Document'}</span>
                </button>
              </div>

              {/* Document Image Visualizer Container */}
              <div>
                {kycDocTab === 'front' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-amber-500" />
                        <span>Slot 1: Sri Lankan NIC (Front Side — Photo &amp; Biometric Hologram)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedKycUser.nicDocumentBase64 ? 'Prosumer Camera Capture' : 'Digital Cryptographic Mock'}
                      </span>
                    </div>

                    <div className={`rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950 p-2 flex items-center justify-center transition-all duration-300 ${zoomDoc ? 'min-h-[380px] max-h-[520px]' : 'min-h-[220px]'}`}>
                      <img
                        src={frontSvg}
                        alt={`Sri Lankan NIC Front - ${selectedKycUser.nic}`}
                        className={`w-full h-auto object-contain select-none rounded-xl transition-all duration-300 ${zoomDoc ? 'max-h-[500px]' : 'max-h-72'}`}
                      />
                    </div>
                  </div>
                )}

                {kycDocTab === 'back' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-amber-500" />
                        <span>Slot 2: Sri Lankan NIC (Back Side — Address, DS Division &amp; 2D Barcode)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {selectedKycUser.nicBackDocumentBase64 ? 'Prosumer Camera Capture' : 'Digital Cryptographic Mock'}
                      </span>
                    </div>

                    <div className={`rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950 p-2 flex items-center justify-center transition-all duration-300 ${zoomDoc ? 'min-h-[380px] max-h-[520px]' : 'min-h-[220px]'}`}>
                      <img
                        src={backSvg}
                        alt={`Sri Lankan NIC Back - ${selectedKycUser.nic}`}
                        className={`w-full h-auto object-contain select-none rounded-xl transition-all duration-300 ${zoomDoc ? 'max-h-[500px]' : 'max-h-72'}`}
                      />
                    </div>
                  </div>
                )}

                {kycDocTab === 'dual' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <FileCheck className="h-4 w-4 text-amber-500" />
                        <span>Dual Physical Card Verification (Front &amp; Back Inspection)</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        Dual Scan Match
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950 p-2">
                        <span className="text-[10px] font-bold text-amber-400 block px-2 py-1">1. FRONT PHOTO ID</span>
                        <img
                          src={frontSvg}
                          alt="NIC Front"
                          className="w-full h-auto object-contain max-h-56 select-none rounded-xl"
                        />
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950 p-2">
                        <span className="text-[10px] font-bold text-amber-400 block px-2 py-1">2. BACK ADDRESS &amp; BARCODE</span>
                        <img
                          src={backSvg}
                          alt="NIC Back"
                          className="w-full h-auto object-contain max-h-56 select-none rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {kycDocTab === 'utility' && utilityBill && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-amber-500" />
                        <span>Slot 3: CEB / LECO Electricity Grid Utility Bill</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Premises Interconnect Proof
                      </span>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-950 p-2 flex items-center justify-center min-h-[220px]">
                      <img
                        src={utilityBill}
                        alt="Utility Bill Verification"
                        className="w-full h-auto object-contain max-h-80 select-none rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DRP Algorithmic Cross-Verification & OCR Field Match Matrix */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-amber-500" />
                    <span>DRP Algorithmic &amp; OCR Field Cross-Match Matrix</span>
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                    100% Match Ratio
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Primary Key (NIC)</span>
                    <p className="font-mono text-xs font-bold text-amber-500">{selectedKycUser.nic}</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{assessment.nicInfo.format || 'Valid DRP Format'}</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Legal Prosumer Name</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedKycUser.fullName}</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Photo ID Holder Matched</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Mathematical Demographics</span>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {assessment.nicInfo.gender} &bull; {assessment.nicInfo.dob?.formattedDate || assessment.nicInfo.birthYear}
                    </p>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Age {assessment.nicInfo.estimatedAge} yrs Verified</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Solar Array Peak Capacity</span>
                    <p className="font-mono text-xs font-bold text-amber-500">
                      ⚡ {selectedKycUser.solarCapacityKw > 0 ? `${selectedKycUser.solarCapacityKw} kW` : '15.0 kW'}
                    </p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Within Microgrid Bandwidth</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Inverter Hardware Serial</span>
                    <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {selectedKycUser.inverterSerial || 'INV-SL-2026-DEFAULT'}
                    </p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Hardware Telemetry Paired</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Interconnection Premises</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {selectedKycUser.address || 'Colombo Microgrid Sector'}
                    </p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Physical Interconnect Valid</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Itemized Verification Checklist */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Regulatory Compliance Checklist (Dual-Slot Verified):
                </h4>
                <div className="space-y-2">
                  {assessment.checks.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {c.passed ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{c.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.detail}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.passed ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'
                      }`}>
                        {c.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowKycModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close Dossier
                </button>

                <div className="flex items-center gap-2">
                  {selectedKycUser.status !== 'Deactivated' && (
                    <button
                      onClick={() => handleStatusChange(selectedKycUser.nic, 'Deactivated')}
                      className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 font-bold cursor-pointer"
                    >
                      Reject / Deactivate
                    </button>
                  )}
                  {selectedKycUser.status !== 'Active' && (
                    <button
                      onClick={() => handleStatusChange(selectedKycUser.nic, 'Active')}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      Verify &amp; Authorize Grid Node
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Register Prosumer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-black text-slate-900 dark:text-white">
                  Onboard Microgrid Prosumer
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Prosumer account will enter <span className="font-bold text-amber-500">Pending</span> status pending Backoffice dual-side e-KYC authorization.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProsumer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Sri Lankan NIC (PK) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 981234567V or 200012345678"
                    value={formData.nic}
                    onChange={(e) => setFormData({ ...formData, nic: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  {formData.nic.trim().length > 0 && (() => {
                    const parsed = parseSriLankanNic(formData.nic);
                    if (!parsed.isValid) {
                      return (
                        <div className="mt-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] flex items-center gap-1.5 font-medium">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{parsed.error}</span>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-1.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[11px] space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{parsed.format}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                            Valid Format
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300">
                          <span><strong>DOB:</strong> {parsed.dob?.formattedDate}</span>
                          <span>&bull;</span>
                          <span><strong>Gender:</strong> {parsed.gender}</span>
                          <span>&bull;</span>
                          <span><strong>Age:</strong> {parsed.estimatedAge}y</span>
                          <span>&bull;</span>
                          <span><strong>Electoral:</strong> {parsed.suffix}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunil Shantha Perera"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="prosumer@solarhub.lk"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+94 77 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Installation Address</label>
                <input
                  type="text"
                  placeholder="No. 45, Solar Avenue, Colombo 03"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Solar Array Peak (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="15.0"
                    value={formData.solarCapacityKw}
                    onChange={(e) => setFormData({ ...formData, solarCapacityKw: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Inverter Serial Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-HUA-9988-LK"
                    value={formData.inverterSerial}
                    onChange={(e) => setFormData({ ...formData, inverterSerial: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Prosumer Portal Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Dual-Slot e-KYC Document Attachment Dropzone */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    <span>e-KYC Identification &amp; Grid Verification Documents</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateMockDoc}
                    className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto-Generate Digital NIC (Front &amp; Back)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Slot 1: NIC Front */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                        <span>1. NIC Front Side *</span>
                      </span>
                      {formData.nicDocumentBase64 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('nicDocumentBase64')}
                          className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'nicDocumentBase64')}
                      className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                    />

                    {formData.nicDocumentBase64 && (
                      <div className="mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
                        <img
                          src={formData.nicDocumentBase64}
                          alt="NIC Front Preview"
                          className="h-10 w-16 object-contain rounded bg-black"
                        />
                        <div>
                          <span className="text-emerald-400 font-bold text-[10px] block">✓ Front Ready</span>
                          <span className="text-slate-400 text-[9px]">Photo &amp; Name verified</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Slot 2: NIC Back */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-amber-500" />
                        <span>2. NIC Back Side *</span>
                      </span>
                      {formData.nicBackDocumentBase64 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('nicBackDocumentBase64')}
                          className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'nicBackDocumentBase64')}
                      className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                    />

                    {formData.nicBackDocumentBase64 && (
                      <div className="mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
                        <img
                          src={formData.nicBackDocumentBase64}
                          alt="NIC Back Preview"
                          className="h-10 w-16 object-contain rounded bg-black"
                        />
                        <div>
                          <span className="text-emerald-400 font-bold text-[10px] block">✓ Back Ready</span>
                          <span className="text-slate-400 text-[9px]">Address &amp; Barcode verified</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slot 3: Utility Bill */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-amber-500" />
                      <span>3. CEB / LECO Electricity Grid Utility Bill (Optional)</span>
                    </span>
                    {formData.utilityBillBase64 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('utilityBillBase64')}
                        className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'utilityBillBase64')}
                    className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />

                  {formData.utilityBillBase64 && (
                    <div className="mt-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2">
                      <img
                        src={formData.utilityBillBase64}
                        alt="Utility Bill Preview"
                        className="h-10 w-16 object-contain rounded bg-black"
                      />
                      <div>
                        <span className="text-cyan-400 font-bold text-[10px] block">✓ Grid Bill Attached</span>
                        <span className="text-slate-400 text-[9px]">Premises utility interconnect</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Registering...' : 'Register & Create Dual e-KYC Dossier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Prosumer Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-black text-slate-900 dark:text-white">
                  Update Prosumer Profile &amp; KYC Docs
                </h3>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  Natural Primary Key (NIC): {editingUser.nic}
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProsumer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Installation Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Solar Capacity (kW)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.solarCapacityKw}
                    onChange={(e) => setFormData({ ...formData, solarCapacityKw: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Inverter Serial</label>
                  <input
                    type="text"
                    value={formData.inverterSerial}
                    onChange={(e) => setFormData({ ...formData, inverterSerial: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Dual-Slot KYC Attachments in Edit Modal */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span>Update Verified Identity &amp; Grid Documents</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">
                      NIC Front Side Document
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'nicDocumentBase64')}
                      className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                    />
                    {formData.nicDocumentBase64 && (
                      <img
                        src={formData.nicDocumentBase64}
                        alt="NIC Front"
                        className="h-10 w-16 object-contain rounded bg-black border border-slate-700"
                      />
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 block">
                      NIC Back Side Document
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'nicBackDocumentBase64')}
                      className="block w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                    />
                    {formData.nicBackDocumentBase64 && (
                      <img
                        src={formData.nicBackDocumentBase64}
                        alt="NIC Back"
                        className="h-10 w-16 object-contain rounded bg-black border border-slate-700"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
