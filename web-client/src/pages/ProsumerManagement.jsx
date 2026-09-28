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
  CreditCard, Layers, FileCheck, Image, Trash2
} from 'lucide-react';
import api from '../api/client';
import { 
  parseSriLankanNic, 
  calculateKycTrustAssessment, 
  generateMockNicCardSvg,
  generateMockNicBackSvg
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
    notify('Sample NIC preview documents attached.', 'success');
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

      notify(`Prosumer ${formData.nic.toUpperCase()} registered in Pending state awaiting Backoffice approval.`, 'success');
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
              <span>Identity Verification &bull; Sri Lankan NIC Natural Key</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              Solar Prosumer Directory &amp; Verification
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Review registered prosumer applications, verify Sri Lankan National Identity Card (NIC) details, and manage account statuses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Approvals</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </div>
          <span className="text-[11px] text-slate-400">Awaiting Backoffice review</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Prosumers</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
          <span className="text-[11px] text-slate-400">Authorized microgrid nodes</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Deactivated Accounts</span>
          <div className="mt-2 text-2xl font-display font-extrabold text-red-600 dark:text-red-400">
            {deactivatedCount}
          </div>
          <span className="text-[11px] text-slate-400">Suspended or inactive users</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC, applicant name, or inverter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          {[
            { id: 'All', label: 'All Prosumers', count: users.length },
            { id: 'Pending', label: 'Pending Approvals', count: pendingCount, alert: pendingCount > 0 },
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
                <th className="py-4 px-6">Prosumer &amp; NIC</th>
                <th className="py-4 px-6">Solar Installation</th>
                <th className="py-4 px-6">Contact Details</th>
                <th className="py-4 px-6">Verification &amp; Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
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
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-700/60">
                                  {assessment.nicInfo.gender} &bull; b.{assessment.nicInfo.birthYear} ({assessment.nicInfo.estimatedAge}y)
                                </span>
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
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              {assessment.allPassed ? '✓ NIC Valid' : 'Review Needed'}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                              <span className={`px-1 rounded text-[9px] font-mono ${u.nicDocumentBase64 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`} title="NIC Front Document">Front</span>
                              <span className={`px-1 rounded text-[9px] font-mono ${u.nicBackDocumentBase64 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`} title="NIC Back Document">Back</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenKycDossier(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition active:scale-95 cursor-pointer text-xs border border-slate-200 dark:border-slate-700 shadow-xs"
                            title="Verify NIC and Registration Details"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                            <span>Review NIC</span>
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

      {/* Modal: Prosumer Identity & NIC Verification */}
      <Modal
        isOpen={showKycModal}
        onClose={() => {
          setShowKycModal(false);
          setSelectedKycUser(null);
        }}
        maxWidth="max-w-4xl"
        title="Prosumer Identity & NIC Verification"
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
              {/* Applicant Header Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {selectedKycUser.fullName}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedKycUser.status === 'Active'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : selectedKycUser.status === 'Pending'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                      }`}>
                        {selectedKycUser.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      National Identity Card: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{selectedKycUser.nic}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                    assessment.allPassed 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}>
                    {assessment.status}
                  </span>
                </div>
              </div>

              {/* Data Verification Grid: Algorithmic Extraction vs Profile Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Column 1: Algorithmic NIC Extraction */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                      <span>NIC Algorithmic Extraction</span>
                    </h5>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {assessment.nicInfo.isValid ? 'Format Valid' : 'Format Invalid'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">NIC Format</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {assessment.nicInfo.format || 'Unknown'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Derived Gender</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {assessment.nicInfo.gender || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Calculated Birth Year</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {assessment.nicInfo.birthYear || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Estimated Age</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {assessment.nicInfo.estimatedAge ? `${assessment.nicInfo.estimatedAge} Years` : '—'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Voter Classification</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {assessment.nicInfo.suffix || 'Sri Lankan Citizen'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Registered Profile & Installation Details */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>Registration &amp; Solar Spec</span>
                    </h5>
                    <span className="text-[10px] font-mono text-slate-400">
                      ID: {selectedKycUser.nic}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email Address</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                        {selectedKycUser.email}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Phone Number</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedKycUser.phone || '—'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Solar Array Capacity</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        ⚡ {selectedKycUser.solarCapacityKw || 15.0} kW
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Inverter Serial</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 truncate block">
                        {selectedKycUser.inverterSerial || 'Default'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Premises Address</span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {selectedKycUser.address || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Image Visualizer Tabs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setKycDocTab('front')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs ${
                      kycDocTab === 'front'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>NIC Front</span>
                    {selectedKycUser.nicDocumentBase64 && (
                      <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">File</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setKycDocTab('back')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs ${
                      kycDocTab === 'back'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>NIC Back</span>
                    {selectedKycUser.nicBackDocumentBase64 && (
                      <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">File</span>
                    )}
                  </button>

                  {utilityBill && (
                    <button
                      type="button"
                      onClick={() => setKycDocTab('utility')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer text-xs ${
                        kycDocTab === 'utility'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Utility Bill</span>
                    </button>
                  )}
                </div>

                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3 flex flex-col items-center justify-center min-h-[220px]">
                  {kycDocTab === 'front' && (
                    <div className="w-full max-w-lg">
                      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                        <span>Sri Lankan NIC — Front Card</span>
                        <span>{selectedKycUser.nicDocumentBase64 ? 'Uploaded Image' : 'Card Preview'}</span>
                      </div>
                      <img
                        src={frontSvg}
                        alt={`NIC Front - ${selectedKycUser.nic}`}
                        className="w-full h-auto object-contain max-h-64 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
                      />
                    </div>
                  )}

                  {kycDocTab === 'back' && (
                    <div className="w-full max-w-lg">
                      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                        <span>Sri Lankan NIC — Reverse Side</span>
                        <span>{selectedKycUser.nicBackDocumentBase64 ? 'Uploaded Image' : 'Card Preview'}</span>
                      </div>
                      <img
                        src={backSvg}
                        alt={`NIC Back - ${selectedKycUser.nic}`}
                        className="w-full h-auto object-contain max-h-64 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
                      />
                    </div>
                  )}

                  {kycDocTab === 'utility' && utilityBill && (
                    <div className="w-full max-w-lg">
                      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                        <span>Electricity Utility Interconnect Proof</span>
                        <span>Uploaded Document</span>
                      </div>
                      <img
                        src={utilityBill}
                        alt="Utility Bill"
                        className="w-full h-auto object-contain max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Checklist */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Verification Criteria Checklist:
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
                          <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{c.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.detail}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.passed ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}>
                        {c.passed ? 'VALID' : 'CHECK'}
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
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {selectedKycUser.status !== 'Deactivated' && (
                    <button
                      onClick={() => handleStatusChange(selectedKycUser.nic, 'Deactivated')}
                      className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 font-bold cursor-pointer"
                    >
                      Deactivate Account
                    </button>
                  )}
                  {selectedKycUser.status !== 'Active' && (
                    <button
                      onClick={() => handleStatusChange(selectedKycUser.nic, 'Active')}
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      Approve &amp; Activate Account
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
                  Prosumer account will enter <span className="font-bold text-amber-500">Pending</span> status awaiting Backoffice review and approval.
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

              {/* Document Attachments Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    <span>Identity Document Attachments</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateMockDoc}
                    className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Generate Sample Card Preview</span>
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
                  {submitting ? 'Registering...' : 'Register Prosumer Account'}
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
                  Update Prosumer Profile
                </h3>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                  NIC: {editingUser.nic}
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
