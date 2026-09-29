// ============================================================================
// File: StaffManagement.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Backoffice administration portal for managing Grid Operator and Backoffice staff accounts.
// References & Citations:
//   - React 18 Lifecycle & Asynchronous Data Fetching (useEffect, useState):
//     https://react.dev/reference/react/useEffect
//   - Tailwind CSS Component Layout & Data Tables:
//     https://tailwindcss.com/docs/table-layout
//   - Lucide React Iconography:
//     https://lucide.dev/
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Radio, Search, Filter, RefreshCw, UserPlus, 
  Edit3, CheckCircle2, XCircle, Shield, Mail, Phone, MapPin, 
  Hash, Lock, UserX, UserCheck, AlertCircle, Sparkles, Key, 
  Clock, ShieldAlert, Cpu, Eye, EyeOff, Copy, Check
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

export default function StaffManagement({ theme, currentUser }) {
  const [users, setUsers] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All'); // 'All' | 'GridOperator' | 'Backoffice'
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Deactivated'
  const [message, setMessage] = useState({ text: '', type: 'success' });

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [resetError, setResetError] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Form States
  const initialCreateForm = {
    nic: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    role: 'GridOperator',
    password: ''
  };

  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resettingStaff, setResettingStaff] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: ''
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Solvance#';
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const params = {};
      if (roleFilter !== 'All') params.role = roleFilter;
      if (statusFilter !== 'All') params.status = statusFilter;

      const res = await api.get('/users', { params });
      // Filter only Backoffice and GridOperator personnel if 'All' was queried
      const staffList = (res.data || []).filter(
        (u) => u.role === 'Backoffice' || u.role === 'GridOperator'
      );
      setUsers(staffList);
    } catch (err) {
      console.error('Failed to fetch staff accounts', err);
      notify('Failed to load staff accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await api.get('/stations');
      setStations(res.data || []);
    } catch (err) {
      console.error('Failed to fetch stations list', err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchStations();
  }, [roleFilter, statusFilter]);

  const notify = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'success' }), 4000);
  };

  const handleStatusChange = async (nic, currentStatus) => {
    if (nic === currentUser?.nic) {
      notify('Security Safeguard: You cannot deactivate your own active session account.', 'error');
      return;
    }

    const target = users.find((u) => u.nic === nic);
    if (target?.role === 'Backoffice' && nic !== currentUser?.nic) {
      notify('Security Safeguard: Administrators cannot deactivate other Backoffice Administrators.', 'error');
      return;
    }

    const newStatus = currentStatus === 'Active' ? 'Deactivated' : 'Active';
    try {
      await api.put(`/users/${nic}/status`, { status: newStatus });
      notify(`Staff account ${nic} status changed to ${newStatus}.`, 'success');
      fetchStaff();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update staff account status.', 'error');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      await api.post('/auth/register-staff', {
        ...createForm,
        nic: createForm.nic.trim().toUpperCase()
      });
      notify(`New ${createForm.role} '${createForm.fullName}' successfully provisioned.`, 'success');
      setShowCreateModal(false);
      setCreateForm(initialCreateForm);
      fetchStaff();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create staff account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (staff) => {
    if (staff.role === 'Backoffice' && staff.nic !== currentUser?.nic) {
      notify('Security Safeguard: You cannot edit profile details of other Backoffice Administrators.', 'error');
      return;
    }

    setEditingStaff(staff);
    setEditForm({
      fullName: staff.fullName || '',
      email: staff.email || '',
      phone: staff.phone || '',
      address: staff.address || ''
    });
    setModalError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      await api.put(`/users/${editingStaff.nic}`, editForm);
      notify(`Staff details for ${editingStaff.nic} updated successfully.`, 'success');
      setShowEditModal(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to update staff details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResetPassword = (staff) => {
    if (staff.role === 'Backoffice' && staff.nic !== currentUser?.nic) {
      notify('Security Safeguard: You cannot reset passwords for other Backoffice Administrators.', 'error');
      return;
    }

    setResettingStaff(staff);
    setNewPassword(generateRandomPassword());
    setResetError('');
    setCopiedPassword(false);
    setShowResetPassword(false);
    setShowResetModal(true);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSubmitting(true);

    try {
      await api.post(`/users/${resettingStaff.nic}/reset-password`, { newPassword });
      notify(`Password for ${resettingStaff.fullName} (${resettingStaff.nic}) successfully reset.`, 'success');
      setShowResetModal(false);
      setResettingStaff(null);
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Filter and Search Logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.nic || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalStaffCount = users.length;
  const operatorCount = users.filter((u) => u.role === 'GridOperator').length;
  const backofficeCount = users.filter((u) => u.role === 'Backoffice').length;
  const activeCount = users.filter((u) => u.status === 'Active').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification Alert */}
      {message.text && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border shadow-lg transition-all animate-in slide-in-from-top-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <span className="text-sm font-semibold">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage({ text: '', type: 'success' })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-8 shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              Staff &amp; Operator Administration
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Provision, monitor, and regulate system access privileges for Grid Operators and Backoffice Administration officers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchStaff}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95 shadow-xs"
            >
              <RefreshCw className={`h-4 w-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Staff</span>
            </button>

            <button
              onClick={() => {
                setCreateForm(initialCreateForm);
                setModalError('');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Provision Staff Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Staff</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-extrabold text-slate-900 dark:text-white">
            {totalStaffCount}
          </div>
          <span className="text-[11px] text-slate-400">Authorized personnel</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Grid Operators</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-extrabold text-emerald-600 dark:text-emerald-400">
            {operatorCount}
          </div>
          <span className="text-[11px] text-slate-400">Station telemetry &amp; dispatch</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Backoffice Admins</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-extrabold text-amber-600 dark:text-amber-400">
            {backofficeCount}
          </div>
          <span className="text-[11px] text-slate-400">System governance &amp; KYC</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Active Status</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-extrabold text-cyan-600 dark:text-cyan-400">
            {activeCount} / {totalStaffCount}
          </div>
          <span className="text-[11px] text-slate-400">Operational security ratio</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC, name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Role:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {['All', 'GridOperator', 'Backoffice'].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  roleFilter === role
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {role === 'All' ? 'All Roles' : role === 'GridOperator' ? 'Operators' : 'Backoffice'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 ml-2">
            <span>Status:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {['All', 'Active', 'Deactivated'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  statusFilter === status
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff User Accounts Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">
              Provisioned Staff Directory
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredUsers.length} records
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Scope: {roleFilter === 'All' ? 'All Roles' : roleFilter === 'GridOperator' ? 'Grid Operators' : 'Backoffice Admins'}</span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
            <span className="text-xs font-semibold">Loading authorized personnel records...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
            <UserX className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">No staff accounts matched criteria</span>
            <span className="text-xs">Adjust search queries or role filters to view accounts.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-6">Staff Personnel</th>
                  <th className="py-3.5 px-4">Role &amp; Privilege</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Command Post / Base</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredUsers.map((u) => {
                  const isCurrent = u.nic === currentUser?.nic;
                  const isOperator = u.role === 'GridOperator';
                  const isOtherAdmin = u.role === 'Backoffice' && !isCurrent;

                  return (
                    <tr 
                      key={u.nic}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs border shrink-0 ${
                            isOperator 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          }`}>
                            {isOperator ? <Radio className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {u.fullName}
                              </span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                              NIC: {u.nic}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isOperator
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                        }`}>
                          {isOperator ? <Radio className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                          <span>{isOperator ? 'Grid Operator' : 'Backoffice Admin'}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-1 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{u.email || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{u.phone || '—'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {u.address ? (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span className="truncate max-w-[200px]" title={u.address}>{u.address}</span>
                          </div>
                        ) : isOperator ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>Unassigned Station</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Operations HQ</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          u.status === 'Active'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'Active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span>{u.status}</span>
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit Profile Button: Guarded for other Backoffice Admins */}
                          {isOtherAdmin ? (
                            <button
                              disabled
                              title="Security Safeguard: You cannot edit profile details of other Backoffice Administrators"
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenEdit(u)}
                              title="Edit Staff Profile"
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Password Reset Action: Guarded for other Backoffice Admins */}
                          {isOtherAdmin ? (
                            <button
                              disabled
                              title="Security Safeguard: You cannot reset credentials for other Backoffice Administrators"
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenResetPassword(u)}
                              title="Reset Account Password"
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition cursor-pointer"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Deactivate/Reactivate Button */}
                          <button
                            onClick={() => handleStatusChange(u.nic, u.status)}
                            disabled={isCurrent || isOtherAdmin}
                            title={
                              isCurrent
                                ? 'Cannot deactivate currently active session'
                                : isOtherAdmin
                                ? 'Security Safeguard: Administrators cannot deactivate other Backoffice Administrators'
                                : u.status === 'Active'
                                ? 'Deactivate Account'
                                : 'Reactivate Account'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                              isCurrent || isOtherAdmin
                                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400'
                                : u.status === 'Active'
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 cursor-pointer'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 cursor-pointer'
                            }`}
                          >
                            {u.status === 'Active' ? (
                              <>
                                <UserX className="h-3.5 w-3.5" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Provision New Staff User */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Provision Authorized Staff Account"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Specification Rule: Only Backoffice officers can provision new system users with Grid Operator or Backoffice roles.
        </p>

        {modalError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Staff NIC Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 198812345678"
                value={createForm.nic}
                onChange={(e) => setCreateForm({ ...createForm, nic: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Role *
              </label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="GridOperator" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Grid Operator</option>
                <option value="Backoffice" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Backoffice Administrator</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Priyantha Jayasuriya"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official Email *
              </label>
              <input
                type="email"
                required
                placeholder="priyantha@solarmicrogrid.lk"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone *
              </label>
              <input
                type="text"
                required
                placeholder="+94 77 987 6543"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {createForm.role === 'GridOperator' ? 'Assigned Station Base Hub *' : 'Station Base / Administrative HQ'}
            </label>
            {createForm.role === 'GridOperator' ? (
              <select
                required
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">-- Select Operational Station Hub --</option>
                {stations.map((s) => (
                  <option key={s.id} value={`${s.stationCode} — ${s.name}`} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {s.stationCode} — {s.name} ({s.address})
                  </option>
                ))}
                <option value="Central Command & Dispatch Headquarters" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  Central Command &amp; Dispatch Headquarters
                </option>
              </select>
            ) : (
              <select
                value={createForm.address || 'Backoffice Operations HQ, Colombo'}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="Backoffice Operations HQ, Colombo" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Backoffice Operations HQ, Colombo</option>
                <option value="Regional Administration Center, Kandy" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Regional Administration Center, Kandy</option>
                <option value="Executive Governance Desk, Galle" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Executive Governance Desk, Galle</option>
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Temporary Secure Password *
              </label>
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, password: generateRandomPassword() })}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>Generate Secure Pass</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showCreatePassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCreatePassword(!showCreatePassword)}
                title={showCreatePassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {showCreatePassword ? (
                  <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Minimum 6 characters recommended</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
            >
              {submitting ? 'Provisioning...' : 'Provision Staff Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Staff Profile Details */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingStaff(null);
        }}
        title={`Edit Staff Profile — ${editingStaff?.nic}`}
      >
        {modalError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {modalError}
          </div>
        )}

        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Legal Name
            </label>
            <input
              type="text"
              required
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Official Email
              </label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                required
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {editingStaff?.role === 'GridOperator' ? 'Station Base / Operational Hub' : 'Administrative Base / Command Post'}
            </label>
            {editingStaff?.role === 'GridOperator' ? (
              <select
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">-- Select Operational Station Hub --</option>
                {stations.map((s) => (
                  <option key={s.id} value={`${s.stationCode} — ${s.name}`} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {s.stationCode} — {s.name} ({s.address})
                  </option>
                ))}
                <option value="Central Command & Dispatch Headquarters" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  Central Command &amp; Dispatch Headquarters
                </option>
                {editForm.address && !stations.some(s => `${s.stationCode} — ${s.name}` === editForm.address) && editForm.address !== "Central Command & Dispatch Headquarters" && (
                  <option value={editForm.address} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{editForm.address}</option>
                )}
              </select>
            ) : (
              <select
                value={editForm.address || 'Backoffice Operations HQ, Colombo'}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="Backoffice Operations HQ, Colombo" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Backoffice Operations HQ, Colombo</option>
                <option value="Regional Administration Center, Kandy" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Regional Administration Center, Kandy</option>
                <option value="Executive Governance Desk, Galle" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Executive Governance Desk, Galle</option>
                {editForm.address && !['Backoffice Operations HQ, Colombo', 'Regional Administration Center, Kandy', 'Executive Governance Desk, Galle'].includes(editForm.address) && (
                  <option value={editForm.address} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{editForm.address}</option>
                )}
              </select>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const target = editingStaff;
                setShowEditModal(false);
                handleOpenResetPassword(target);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer"
            >
              <Key className="h-3.5 w-3.5" />
              <span>Reset account password for {editingStaff?.fullName}</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingStaff(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50"
            >
              {submitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reset Staff Password */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setResettingStaff(null);
        }}
        title={`Reset Password — ${resettingStaff?.fullName}`}
      >
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Key className="h-3.5 w-3.5" />
            <span>NIC: {resettingStaff?.nic} &bull; Role: {resettingStaff?.role}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Provision a new temporary password for this staff member. You can generate a random strong password or enter custom credentials.
          </p>
        </div>

        {resetError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {resetError}
          </div>
        )}

        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                New Temporary Password *
              </label>
              <button
                type="button"
                onClick={() => setNewPassword(generateRandomPassword())}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>Regenerate Password</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showResetPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-3 pr-20 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/50"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  title="Copy password to clipboard"
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  {copiedPassword ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  title={showResetPassword ? "Hide password" : "Show password"}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  {showResetPassword ? (
                    <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Minimum 6 characters. Copy and share securely with the operator.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowResetModal(false);
                setResettingStaff(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetSubmitting || !newPassword}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {resetSubmitting ? 'Updating...' : 'Set & Save Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}