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
  Upload, AlertCircle, Award, CheckCircle, ShieldCheck,
  CreditCard, Layers, FileCheck, Image, Trash2, Cpu
} from 'lucide-react';
import api from '../api/client';
import { 
  parseSriLankanNic, 
  calculateKycTrustAssessment
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
      const frontToSend = formData.nicDocumentBase64 || null;
      const backToSend = formData.nicBackDocumentBase64 || null;

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
                <th className="py-3.5 px-4 whitespace-nowrap">Prosumer &amp; NIC</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Solar Installation</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Contact Details</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Verification &amp; Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
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
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 shrink-0 text-sm">
                            {u.fullName?.charAt(0) || 'P'}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{u.fullName}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold whitespace-nowrap">
                                <Hash className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span>{u.nic}</span>
                              </span>
                              {assessment.nicInfo.isValid && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                  {assessment.nicInfo.gender} &bull; Born {assessment.nicInfo.birthYear} ({assessment.nicInfo.estimatedAge} yrs)
                                </span>
                              )}
                            </div>
                            {u.approvedBy && (
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 whitespace-nowrap">
                                Verified by: {u.approvedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 space-y-1 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-bold text-xs shadow-xs whitespace-nowrap ${
                          u.solarCapacityKw > 0
                            ? 'bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                        }`}>
                          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{u.solarCapacityKw > 0 ? `${u.solarCapacityKw} kW Array` : 'Unspecified Array'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <Cpu className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{u.inverterSerial || 'Unassigned Inverter'}</span>
                        </div>
                        {u.address && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{u.address}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 space-y-1 whitespace-nowrap">
                        <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{u.email}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{u.phone}</span>
                        </p>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
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
                          </div>

                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {assessment.allPassed ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span>NIC Verified</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span>{assessment.statusLabel}</span>
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border whitespace-nowrap ${u.nicDocumentBase64 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`} title="NIC Front Document">Front</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border whitespace-nowrap ${u.nicBackDocumentBase64 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`} title="NIC Back Document">Back</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleOpenKycDossier(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition active:scale-95 cursor-pointer text-xs border border-slate-200 dark:border-slate-700 shadow-xs whitespace-nowrap shrink-0"
                            title="Verify NIC and Registration Details"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            <span className="whitespace-nowrap">Review NIC</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0"
                            title="Edit Profile"
                          >
                            <Edit3 className="h-3.5 w-3.5 shrink-0" />
                          </button>

                          {u.status === 'Pending' && (
                            <button
                              onClick={() => handleStatusChange(u.nic, 'Active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow-sm active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              <span>Approve</span>
                            </button>
                          )}

                          {u.status === 'Active' && (
                            <button
                              onClick={() => handleStatusChange(u.nic, 'Deactivated')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 font-bold transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <UserX className="h-3.5 w-3.5 shrink-0" />
                              <span>Deactivate</span>
                            </button>
                          )}

                          {u.status === 'Deactivated' && (
                            <button
                              onClick={() => handleStatusChange(u.nic, 'Active')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <UserCheck className="h-3.5 w-3.5 shrink-0" />
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
          const frontDoc = selectedKycUser.nicDocumentBase64;
          const backDoc = selectedKycUser.nicBackDocumentBase64;
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
                      <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>{selectedKycUser.solarCapacityKw || 15.0} kW</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">Inverter Serial</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                        {selectedKycUser.inverterSerial || 'Default'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Premises Address</span>
                      <span className="text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{selectedKycUser.address || '—'}</span>
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

                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-4 flex flex-col items-center justify-center min-h-[240px]">
                  {kycDocTab === 'front' && (
                    <div className="w-full max-w-lg">
                      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                        <span>Sri Lankan NIC — Front Card Copy</span>
                        <span className="font-semibold text-slate-400">{frontDoc ? 'Uploaded Document' : 'Not Provided'}</span>
                      </div>
                      {frontDoc ? (
                        <img
                          src={frontDoc}
                          alt={`NIC Front - ${selectedKycUser.nic}`}
                          className="w-full h-auto object-contain max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
                        />
                      ) : (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                          <FileText className="h-10 w-10 text-slate-400 mb-2" />
                          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No NIC Front Document Attached</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                            The applicant has not uploaded a digital copy of their National Identity Card front.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {kycDocTab === 'back' && (
                    <div className="w-full max-w-lg">
                      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                        <span>Sri Lankan NIC — Reverse Side Copy</span>
                        <span className="font-semibold text-slate-400">{backDoc ? 'Uploaded Document' : 'Not Provided'}</span>
                      </div>
                      {backDoc ? (
                        <img
                          src={backDoc}
                          alt={`NIC Back - ${selectedKycUser.nic}`}
                          className="w-full h-auto object-contain max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
                        />
                      ) : (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                          <Layers className="h-10 w-10 text-slate-400 mb-2" />
                          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Reverse Document Attached</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                            The applicant has not uploaded the reverse side copy of their National Identity Card.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {kycDocTab === 'utility' && (
                    <div className="w-full max-w-lg">
                      <div className="flex items-center justify-between mb-2 text-[11px] text-slate-500">
                        <span>Electricity Utility Interconnect Proof</span>
                        <span className="font-semibold text-slate-400">{utilityBill ? 'Uploaded Document' : 'Not Provided'}</span>
                      </div>
                      {utilityBill ? (
                        <img
                          src={utilityBill}
                          alt="Utility Bill"
                          className="w-full h-auto object-contain max-h-72 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md"
                        />
                      ) : (
                        <div className="py-12 px-6 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                          <FileText className="h-10 w-10 text-slate-400 mb-2" />
                          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No Utility Bill Attached</p>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                            Electricity interconnection billing proof was not provided.
                          </p>
                        </div>
                      )}
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
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setFormData(initialForm);
        }}
        maxWidth="max-w-2xl"
        title="Onboard Microgrid Prosumer"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Prosumer account will enter <span className="font-bold text-amber-500">Pending</span> status awaiting Backoffice review and approval.
          </p>

          <form onSubmit={handleCreateProsumer} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  National Identity Card (NIC) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 981234567V or 200012345678"
                  value={formData.nic}
                  onChange={(e) => setFormData({ ...formData, nic: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                {formData.nic.length > 0 && (() => {
                  const parsed = parseSriLankanNic(formData.nic);
                  if (parsed.isValid) {
                    return (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span>{parsed.format} &bull; {parsed.gender} &bull; Born {parsed.birthYear} ({parsed.estimatedAge} yrs)</span>
                      </p>
                    );
                  }
                  return (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Format: 9 digits + V/X (e.g. 981234567V) or 12 digits (e.g. 200012345678)
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Full Legal Name *
                </label>
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
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Email Address *
                </label>
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
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Phone Number *
                </label>
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
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Installation Premises Address
              </label>
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
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Solar Array Peak Capacity *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="1000"
                    required
                    placeholder="15.0"
                    value={formData.solarCapacityKw}
                    onChange={(e) => setFormData({ ...formData, solarCapacityKw: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    kW
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Inverter Serial Identifier
                </label>
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
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                Prosumer Portal Password *
              </label>
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
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span>Identity Document Attachments</span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Front copy required for verification</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Slot 1: NIC Front */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                      <span>1. NIC Front Side *</span>
                    </span>
                    {formData.nicDocumentBase64 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('nicDocumentBase64')}
                        className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {formData.nicDocumentBase64 ? (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
                      <img
                        src={formData.nicDocumentBase64}
                        alt="NIC Front"
                        className="h-10 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Front Copy Attached</span>
                        </span>
                        <span className="text-slate-400 text-[9px] block truncate">Ready for verification</span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/60 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-amber-500/5 transition cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'nicDocumentBase64')}
                        className="hidden"
                      />
                      <Upload className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition mb-1" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        Select Front Document
                      </span>
                      <span className="text-[10px] text-slate-400">JPG, PNG up to 2MB</span>
                    </label>
                  )}
                </div>

                {/* Slot 2: NIC Back */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-amber-500" />
                      <span>2. NIC Reverse Side</span>
                    </span>
                    {formData.nicBackDocumentBase64 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('nicBackDocumentBase64')}
                        className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {formData.nicBackDocumentBase64 ? (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
                      <img
                        src={formData.nicBackDocumentBase64}
                        alt="NIC Back"
                        className="h-10 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Reverse Copy Attached</span>
                        </span>
                        <span className="text-slate-400 text-[9px] block truncate">Address &amp; record proof</span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/60 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-amber-500/5 transition cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'nicBackDocumentBase64')}
                        className="hidden"
                      />
                      <Upload className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition mb-1" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        Select Reverse Document
                      </span>
                      <span className="text-[10px] text-slate-400">JPG, PNG up to 2MB</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Slot 3: Utility Bill */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-amber-500" />
                    <span>3. CEB / LECO Electricity Grid Utility Bill (Optional)</span>
                  </span>
                  {formData.utilityBillBase64 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile('utilityBillBase64')}
                      className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {formData.utilityBillBase64 ? (
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
                    <img
                      src={formData.utilityBillBase64}
                      alt="Utility Bill"
                      className="h-10 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                        <span>Grid Interconnect Bill Attached</span>
                      </span>
                      <span className="text-slate-400 text-[9px] block truncate">Premises utility interconnect</span>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/60 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-amber-500/5 transition cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'utilityBillBase64')}
                      className="hidden"
                    />
                    <Upload className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition mb-1" />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      Select Utility Bill Proof
                    </span>
                    <span className="text-[10px] text-slate-400">JPG, PNG up to 2MB</span>
                  </label>
                )}
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3.5 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 z-10">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData(initialForm);
                }}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 disabled:opacity-50 transition active:scale-95 cursor-pointer text-xs"
              >
                {submitting ? 'Registering...' : 'Register Prosumer Account'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Edit Prosumer Modal */}
      <Modal
        isOpen={showEditModal && !!editingUser}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        maxWidth="max-w-2xl"
        title="Update Prosumer Profile"
      >
        {editingUser && (
          <form onSubmit={handleUpdateProsumer} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">NIC Natural Key</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">{editingUser.nic}</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                editingUser.status === 'Active'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : editingUser.status === 'Pending'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'bg-red-500/15 text-red-700 dark:text-red-300'
              }`}>
                {editingUser.status}
              </span>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Full Legal Name *</label>
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
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
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
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Installation Premises Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Solar Capacity (kW) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="1000"
                    required
                    value={formData.solarCapacityKw}
                    onChange={(e) => setFormData({ ...formData, solarCapacityKw: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    kW
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Inverter Serial Identifier</label>
                <input
                  type="text"
                  value={formData.inverterSerial}
                  onChange={(e) => setFormData({ ...formData, inverterSerial: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Document Updates */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="h-4 w-4 text-amber-500" />
                <span>Identity Document Attachments</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                      <span>NIC Front Side Document</span>
                    </span>
                    {formData.nicDocumentBase64 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('nicDocumentBase64')}
                        className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {formData.nicDocumentBase64 ? (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
                      <img
                        src={formData.nicDocumentBase64}
                        alt="NIC Front"
                        className="h-10 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Front Copy Attached</span>
                        </span>
                        <span className="text-slate-400 text-[9px] block truncate">Document on file</span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/60 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-amber-500/5 transition cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'nicDocumentBase64')}
                        className="hidden"
                      />
                      <Upload className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition mb-1" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        Select Front Document
                      </span>
                      <span className="text-[10px] text-slate-400">JPG, PNG up to 2MB</span>
                    </label>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-amber-500" />
                      <span>NIC Reverse Side Document</span>
                    </span>
                    {formData.nicBackDocumentBase64 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('nicBackDocumentBase64')}
                        className="text-red-500 hover:text-red-400 text-[10px] flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {formData.nicBackDocumentBase64 ? (
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
                      <img
                        src={formData.nicBackDocumentBase64}
                        alt="NIC Back"
                        className="h-10 w-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>Reverse Copy Attached</span>
                        </span>
                        <span className="text-slate-400 text-[9px] block truncate">Document on file</span>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 dark:hover:border-amber-500/60 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-amber-500/5 transition cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'nicBackDocumentBase64')}
                        className="hidden"
                      />
                      <Upload className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition mb-1" />
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        Select Reverse Document
                      </span>
                      <span className="text-[10px] text-slate-400">JPG, PNG up to 2MB</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3.5 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 z-10">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 font-bold transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md disabled:opacity-50 transition active:scale-95 cursor-pointer text-xs"
              >
                {submitting ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
}
