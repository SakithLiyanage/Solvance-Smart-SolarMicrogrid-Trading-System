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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck, Radio, Search, Filter, RefreshCw, UserPlus,
  Edit3, CheckCircle2, XCircle, Shield, Mail, Phone, MapPin,
  Hash, Lock, UserX, UserCheck, AlertCircle, Key,
  Clock, ShieldAlert, Cpu, Eye, EyeOff, Copy, Check
} from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import Pagination, { usePagination } from '../components/Pagination';

// Offices for Backoffice staff (Grid Operators are assigned to a solar hub instead)
const BACKOFFICE_OFFICES = [
  'Backoffice Operations HQ, Colombo',
  'Regional Administration Center, Kandy',
  'Executive Governance Desk, Galle'
];
const DEFAULT_OFFICE = BACKOFFICE_OFFICES[0];

const ROLE_LABELS = { GridOperator: 'Grid Operator', Backoffice: 'Backoffice Admin' };

// Same rule the backend enforces on password reset: 8+ characters with letters and numbers
const meetsPasswordPolicy = (pwd) => pwd.length >= 8 && /[a-zA-Z]/.test(pwd) && /[0-9]/.test(pwd);

// Business errors come back as { message }, DTO validation errors as { errors: { Field: [msg] } }
const getApiError = (err, fallback) => {
  const data = err.response?.data;
  if (data?.message) return data.message;
  const firstFieldError = data?.errors && Object.values(data.errors).flat()[0];
  return firstFieldError || fallback;
};

// Random temporary password that always satisfies the policy (letters + at least one digit)
const generateTemporaryPassword = () => {
  const values = new Uint32Array(2);
  window.crypto.getRandomValues(values);
  return `Solvance!${values[0].toString(36)}${values[1] % 10}`;
};

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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [resetError, setResetError] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [resetTab, setResetTab] = useState('manual'); // 'manual' | 'generate'
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Deactivation confirmation
  const [confirmingStatus, setConfirmingStatus] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const notifyTimerRef = useRef(null);

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requireNextLoginChange, setRequireNextLoginChange] = useState(true);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: ''
  });

  // Loads both staff roles once and filters on the client: the summary cards always show totals,
  // changing a filter doesn't refetch, and we never download prosumer records (with KYC images).
  const fetchStaff = async () => {
    try {
      setLoading(true);
      const [backofficeRes, operatorRes] = await Promise.all([
        api.get('/users', { params: { role: 'Backoffice' } }),
        api.get('/users', { params: { role: 'GridOperator' } })
      ]);
      const staffList = [...(backofficeRes.data || []), ...(operatorRes.data || [])].sort(
        (a, b) => a.role.localeCompare(b.role) || (a.fullName || '').localeCompare(b.fullName || '')
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
    return () => clearTimeout(notifyTimerRef.current);
  }, []);

  const notify = (text, type = 'success') => {
    setMessage({ text, type });
    // Restart the auto-dismiss timer so an older timer can't hide a newer message early
    clearTimeout(notifyTimerRef.current);
    notifyTimerRef.current = setTimeout(() => setMessage({ text: '', type: 'success' }), 4000);
  };

  const requestStatusChange = (staff) => {
    if (staff.nic === currentUser?.nic) {
      notify("You can't deactivate your own account.", 'error');
      return;
    }
    if (staff.role === 'Backoffice') {
      notify("You can't change the status of another Backoffice Admin.", 'error');
      return;
    }
    // Deactivation locks the person out, so it needs a confirmation step
    if (staff.status === 'Active') {
      setConfirmingStatus(staff);
      return;
    }
    applyStatusChange(staff, 'Active');
  };

  const applyStatusChange = async (staff, newStatus) => {
    if (statusSubmitting) return;
    setStatusSubmitting(true);
    try {
      await api.put(`/users/${staff.nic}/status`, { status: newStatus });
      notify(`${staff.fullName} (${staff.nic}) is now ${newStatus}.`, 'success');
      setConfirmingStatus(null);
      fetchStaff();
    } catch (err) {
      notify(getApiError(err, 'Failed to update staff account status.'), 'error');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Operators are assigned to a hub and Backoffice staff to an office, so reset the value when the role changes
  const handleCreateRoleChange = (role) => {
    setCreateForm({ ...createForm, role, address: role === 'Backoffice' ? DEFAULT_OFFICE : '' });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    // The backend only enforces this rule on reset, so check it here for new accounts too
    if (!meetsPasswordPolicy(createForm.password)) {
      setModalError('Password must be at least 8 characters and contain both letters and numbers.');
      return;
    }
    setModalError('');
    setSubmitting(true);

    try {
      await api.post('/auth/register-staff', {
        ...createForm,
        nic: createForm.nic.trim().toUpperCase(),
        address: createForm.role === 'Backoffice' ? createForm.address || DEFAULT_OFFICE : createForm.address
      });
      notify(`${ROLE_LABELS[createForm.role]} account created for ${createForm.fullName}.`, 'success');
      setShowCreateModal(false);
      setCreateForm(initialCreateForm);
      fetchStaff();
    } catch (err) {
      setModalError(getApiError(err, 'Failed to create staff account.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (staff) => {
    if (staff.role === 'Backoffice' && staff.nic !== currentUser?.nic) {
      notify("You can't edit another Backoffice Admin's account.", 'error');
      return;
    }

    setEditingStaff(staff);
    setEditForm({
      fullName: staff.fullName || '',
      email: staff.email || '',
      phone: staff.phone || '',
      // Keep the saved value in step with what the dropdown shows
      address: staff.address || (staff.role === 'Backoffice' ? DEFAULT_OFFICE : '')
    });
    setModalError('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setModalError('');
    setSubmitting(true);

    try {
      await api.put(`/users/${editingStaff.nic}`, editForm);
      notify(`Account details for ${editingStaff.fullName} updated.`, 'success');
      setShowEditModal(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err) {
      setModalError(getApiError(err, 'Failed to update staff details.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenResetPassword = (staff) => {
    if (staff.role === 'Backoffice' && staff.nic !== currentUser?.nic) {
      notify("You can't reset another Backoffice Admin's password.", 'error');
      return;
    }

    setResettingStaff(staff);
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setCopiedPassword(false);
    setShowResetPassword(false);
    setShowConfirmPassword(false);
    setRequireNextLoginChange(true);
    setResetTab('manual');
    setGeneratedPassword('');
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResettingStaff(null);
    setGeneratedPassword('');
  };

  // Password policy validation flags
  const isResetLengthValid = newPassword.length >= 8;
  const isResetAlphaNumeric = /[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const isResetMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isResetFormValid = isResetLengthValid && isResetAlphaNumeric && isResetMatch;

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (resetSubmitting) return;
    if (!isResetFormValid) {
      setResetError("The password doesn't meet the requirements below.");
      return;
    }

    setResetError('');
    setResetSubmitting(true);

    try {
      await api.post(`/users/${resettingStaff.nic}/reset-password`, {
        newPassword,
        confirmPassword,
        requirePasswordChange: requireNextLoginChange
      });
      notify(`Password for ${resettingStaff.fullName} (${resettingStaff.nic}) successfully updated.`, 'success');
      closeResetModal();
    } catch (err) {
      setResetError(getApiError(err, 'Failed to reset password.'));
    } finally {
      setResetSubmitting(false);
    }
  };

  // Sets a random temporary password. Nothing is emailed (the backend has no mail service),
  // so the modal stays open and shows the password for the admin to hand over.
  const handleGenerateTemporaryPassword = async () => {
    if (resetSubmitting) return;
    setResetSubmitting(true);
    setResetError('');

    const tempPassword = generateTemporaryPassword();
    try {
      await api.post(`/users/${resettingStaff.nic}/reset-password`, {
        newPassword: tempPassword,
        confirmPassword: tempPassword,
        requirePasswordChange: requireNextLoginChange
      });
      setGeneratedPassword(tempPassword);
      setCopiedPassword(false);
      notify(`Temporary password set for ${resettingStaff.fullName}.`, 'success');
    } catch (err) {
      setResetError(getApiError(err, 'Failed to set a temporary password.'));
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleCopyPassword = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch {
      // Clipboard API is unavailable outside secure contexts (e.g. http://<LAN-IP>)
      notify('Copy failed. Select the password and copy it manually.', 'error');
    }
  };

  // Filter and Search Logic
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !query || [u.nic, u.fullName, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(query));
      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const { pageItems, page, setPage, pageSize, setPageSize, totalPages, totalItems } = usePagination(
    filteredUsers,
    10,
    `${roleFilter}|${statusFilter}|${search}`
  );

  const totalStaffCount = users.length;
  const operatorCount = users.filter((u) => u.role === 'GridOperator').length;
  const backofficeCount = users.filter((u) => u.role === 'Backoffice').length;
  const activeCount = users.filter((u) => u.status === 'Active').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification Alert */}
      {message.text && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 border shadow-lg transition-all animate-in slide-in-from-top-2 ${
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
            className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
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
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
              Staff &amp; Operator Administration
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Create and manage web console accounts. Backoffice Admins have full administration access; Grid Operators use the operational tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchStaff}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setCreateForm(initialCreateForm);
                setModalError('');
                setShowCreatePassword(false);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>New Staff Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Staff</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-bold text-slate-900 dark:text-white">
            {totalStaffCount}
          </div>
          <span className="text-[11px] text-slate-400">All web console accounts</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Grid Operators</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400">
            {operatorCount}
          </div>
          <span className="text-[11px] text-slate-400">Operational tools only</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Backoffice Admins</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-bold text-amber-600 dark:text-amber-400">
            {backofficeCount}
          </div>
          <span className="text-[11px] text-slate-400">Full administration access</span>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Active Accounts</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-display font-bold text-cyan-600 dark:text-cyan-400">
            {activeCount} / {totalStaffCount}
          </div>
          <span className="text-[11px] text-slate-400">Can currently sign in</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 backdrop-blur-xl shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC, name, email, or phone..."
            aria-label="Search staff by NIC, name, email or phone"
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
                aria-pressed={roleFilter === role}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
                aria-pressed={statusFilter === status}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
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
              Staff Accounts
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'account' : 'accounts'}
            </span>
          </div>
        </div>

        {/* Full spinner only on first load; refreshes after actions keep the table on screen */}
        {loading && users.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
            <span className="text-xs font-semibold">Loading staff accounts…</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center gap-2">
            <UserX className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">No staff accounts match your filters</span>
            <span className="text-xs">Try a different search, role or status.</span>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 font-bold text-xs whitespace-nowrap">
                  <th className="py-3.5 px-6">Staff Member</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Assigned Hub / Office</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {pageItems.map((u) => {
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
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
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
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
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
                          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <AlertCircle className="h-3 w-3" />
                            <span>No hub assigned</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
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
                              title="You can't edit another Backoffice Admin's account"
                              aria-label={`Edit ${u.fullName} (not allowed)`}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenEdit(u)}
                              title="Edit account details"
                              aria-label={`Edit ${u.fullName}`}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Password Reset Action: Guarded for other Backoffice Admins */}
                          {isOtherAdmin ? (
                            <button
                              disabled
                              title="You can't reset another Backoffice Admin's password"
                              aria-label={`Reset password for ${u.fullName} (not allowed)`}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenResetPassword(u)}
                              title="Reset password"
                              aria-label={`Reset password for ${u.fullName}`}
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition cursor-pointer"
                            >
                              <Key className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Deactivate/Reactivate Button */}
                          <button
                            onClick={() => requestStatusChange(u)}
                            disabled={isCurrent || isOtherAdmin || statusSubmitting}
                            title={
                              isCurrent
                                ? "You can't deactivate your own account"
                                : isOtherAdmin
                                ? "You can't change the status of another Backoffice Admin"
                                : u.status === 'Active'
                                ? 'Deactivate account'
                                : 'Reactivate account'
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
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

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="staff"
          />
          </>
        )}
      </div>

      {/* Modal: Create New Staff User */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Staff Account"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Grid Operators get the operational tools (reservations, QR verification, battery slots). Backoffice Admins get full administration access.
        </p>

        {modalError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-staff-nic" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NIC or Staff ID *
              </label>
              <input
                id="create-staff-nic"
                type="text"
                required
                placeholder="e.g. 198812345678 or OPERATOR002"
                value={createForm.nic}
                onChange={(e) => setCreateForm({ ...createForm, nic: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/50"
              />
              {/* Mirrors the backend format check (CreateStaffUserDto) */}
              <span className="text-[11px] text-slate-400 mt-1 block">12-digit NIC, 9 digits + V/X, or ADMIN/OPERATOR + 3 digits.</span>
            </div>

            <div>
              <label htmlFor="create-staff-role" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role *
              </label>
              <select
                id="create-staff-role"
                value={createForm.role}
                onChange={(e) => handleCreateRoleChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="GridOperator" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Grid Operator</option>
                <option value="Backoffice" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Backoffice Administrator</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="create-staff-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              id="create-staff-name"
              type="text"
              required
              placeholder="e.g. Priyantha Jayasuriya"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-staff-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email *
              </label>
              <input
                id="create-staff-email"
                type="email"
                required
                placeholder="priyantha@solarmicrogrid.lk"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label htmlFor="create-staff-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone *
              </label>
              <input
                id="create-staff-phone"
                type="tel"
                required
                placeholder="+94 77 987 6543"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="create-staff-base" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {createForm.role === 'GridOperator' ? 'Assigned Hub *' : 'Office'}
            </label>
            {createForm.role === 'GridOperator' ? (
              <select
                id="create-staff-base"
                required
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Select a hub…</option>
                {stations.map((s) => (
                  <option key={s.id} value={`${s.stationCode} — ${s.name}`} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {s.stationCode} — {s.name} ({s.address}){s.isActive === false ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <select
                id="create-staff-base"
                value={createForm.address || DEFAULT_OFFICE}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                {BACKOFFICE_OFFICES.map((office) => (
                  <option key={office} value={office} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{office}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="create-staff-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Initial Password *
            </label>
            <div className="relative">
              <input
                id="create-staff-password"
                type={showCreatePassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters, letters and numbers"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 tabular-nums [&::-ms-reveal]:hidden"
              />
              <button
                type="button"
                onClick={() => setShowCreatePassword(!showCreatePassword)}
                title={showCreatePassword ? "Hide password" : "Show password"}
                aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {showCreatePassword ? (
                  <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <span
              className={`text-[11px] mt-1 flex items-center gap-1 ${
                !createForm.password
                  ? 'text-slate-400'
                  : meetsPasswordPolicy(createForm.password)
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {createForm.password && meetsPasswordPolicy(createForm.password) && <CheckCircle2 className="h-3 w-3" />}
              <span>Minimum 8 characters with letters and numbers.</span>
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'Creating…' : 'Create Account'}
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
        title={`Edit Staff Account — ${editingStaff?.nic || ''}`}
      >
        {modalError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {modalError}
          </div>
        )}

        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label htmlFor="edit-staff-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              id="edit-staff-name"
              type="text"
              required
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-staff-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                id="edit-staff-email"
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div>
              <label htmlFor="edit-staff-phone" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone
              </label>
              <input
                id="edit-staff-phone"
                type="tel"
                required
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-staff-base" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {editingStaff?.role === 'GridOperator' ? 'Assigned Hub *' : 'Office'}
            </label>
            {editingStaff?.role === 'GridOperator' ? (
              <select
                id="edit-staff-base"
                required
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Select a hub…</option>
                {stations.map((s) => (
                  <option key={s.id} value={`${s.stationCode} — ${s.name}`} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {s.stationCode} — {s.name} ({s.address}){s.isActive === false ? ' (inactive)' : ''}
                  </option>
                ))}
                {editForm.address && !stations.some(s => `${s.stationCode} — ${s.name}` === editForm.address) && (
                  <option value={editForm.address} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{editForm.address}</option>
                )}
              </select>
            ) : (
              <select
                id="edit-staff-base"
                value={editForm.address || DEFAULT_OFFICE}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500/50"
              >
                {BACKOFFICE_OFFICES.map((office) => (
                  <option key={office} value={office} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{office}</option>
                ))}
                {/* Keep an office saved before these options existed selectable */}
                {editForm.address && !BACKOFFICE_OFFICES.includes(editForm.address) && (
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
              <span>Reset password for {editingStaff?.fullName}</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingStaff(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reset Staff Password */}
      <Modal
        isOpen={showResetModal}
        onClose={closeResetModal}
        title={`Reset Password — ${resettingStaff?.fullName || ''}`}
      >
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mb-2">
            <Key className="h-3.5 w-3.5 text-amber-500" />
            <span>NIC: {resettingStaff?.nic} &bull; Role: {ROLE_LABELS[resettingStaff?.role] || resettingStaff?.role}</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set a new password yourself, or generate a temporary one to give to this staff member.
          </p>
        </div>

        {resetError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold animate-in fade-in">
            {resetError}
          </div>
        )}

        {/* Two ways to reset: type a password, or generate a temporary one */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={resetTab === 'manual'}
            disabled={!!generatedPassword}
            onClick={() => { setResetTab('manual'); setResetError(''); }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              resetTab === 'manual'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Set Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={resetTab === 'generate'}
            onClick={() => { setResetTab('generate'); setResetError(''); }}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              resetTab === 'generate'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>Generate Temporary Password</span>
          </button>
        </div>

        {resetTab === 'generate' ? (
          generatedPassword ? (
            // Shown once: the backend only stores a hash, so this is the only copy of the password
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Temporary password set for {resettingStaff?.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-sm font-bold text-slate-900 dark:text-white select-all break-all">
                    {generatedPassword}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyPassword(generatedPassword)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    {copiedPassword ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Give this password to the staff member directly. It won't be shown again once you close this window.
                  {requireNextLoginChange ? ' They will be asked to choose a new password when they next sign in.' : ''}
                </p>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  A random password will be set on the account straight away and shown here once, so you can pass it to{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{resettingStaff?.fullName}</strong>. Nothing is emailed.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={requireNextLoginChange}
                  onChange={(e) => setRequireNextLoginChange(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 h-4 w-4"
                />
                <span>Ask them to change it at next sign-in</span>
              </label>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateTemporaryPassword}
                  disabled={resetSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" />
                  <span>{resetSubmitting ? 'Generating…' : 'Generate Password'}</span>
                </button>
              </div>
            </div>
          )
        ) : (
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-staff-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password *
            </label>

            <div className="relative">
              <input
                id="reset-staff-password"
                type={showResetPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters, letters and numbers"
                className="w-full pl-3 pr-20 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white tabular-nums focus:ring-2 focus:ring-amber-500/50 [&::-ms-reveal]:hidden"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={() => handleCopyPassword(newPassword)}
                    title="Copy password to clipboard"
                    aria-label="Copy password to clipboard"
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    {copiedPassword ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  title={showResetPassword ? "Hide password" : "Show password"}
                  aria-label={showResetPassword ? 'Hide password' : 'Show password'}
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
          </div>

          <div>
            <label htmlFor="reset-staff-confirm" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                id="reset-staff-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password to verify"
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white tabular-nums focus:ring-2 focus:ring-amber-500/50 [&::-ms-reveal]:hidden"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? "Hide password" : "Show password"}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Validation Criteria Checklist */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Password requirements:
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {isResetLengthValid ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className={isResetLengthValid ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                At least 8 characters
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {isResetAlphaNumeric ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className={isResetAlphaNumeric ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                Contains both letters and numbers
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {isResetMatch ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              <span className={isResetMatch ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}>
                Passwords match
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={requireNextLoginChange}
              onChange={(e) => setRequireNextLoginChange(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-400 h-4 w-4"
            />
            <span>Ask them to change it at next sign-in</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={closeResetModal}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={resetSubmitting || !isResetFormValid}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {resetSubmitting ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
        )}
      </Modal>

      {/* Modal: Confirm Deactivation */}
      <Modal
        isOpen={confirmingStatus !== null}
        onClose={() => setConfirmingStatus(null)}
        title="Deactivate staff account?"
        maxWidth="max-w-md"
      >
        {confirmingStatus && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-900 dark:text-white">{confirmingStatus.fullName}</strong> (
              {ROLE_LABELS[confirmingStatus.role] || confirmingStatus.role}, {confirmingStatus.nic}) will no longer be able to
              sign in. You can reactivate the account at any time.
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmingStatus(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                disabled={statusSubmitting}
                onClick={() => applyStatusChange(confirmingStatus, 'Deactivated')}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {statusSubmitting ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}