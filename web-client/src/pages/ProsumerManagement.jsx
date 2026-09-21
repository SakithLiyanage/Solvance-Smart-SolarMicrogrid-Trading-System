// ============================================================================
// File: ProsumerManagement.jsx
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: M.L. Booso (IT23452916)
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Backoffice prosumer lifecycle management interface (NIC primary key, account approval, direct onboarding, profile editing, and deactivation/reactivation).
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
  UserPlus, Edit3, X, Zap, Shield, MapPin
} from 'lucide-react';
import api from '../api/client';

export default function ProsumerManagement({ theme }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [message, setMessage] = useState({ text: '', type: 'success' });

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
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
    password: ''
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
      password: ''
    });
    setShowEditModal(true);
  };

  const handleCreateProsumer = async (e) => {
    e.preventDefault();
    if (!formData.nic || !formData.fullName || !formData.email || !formData.password) {
      notify('Please complete all required fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/auth/register-prosumer', {
        nic: formData.nic.trim().toUpperCase(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        solarCapacityKw: parseFloat(formData.solarCapacityKw) || 15.0,
        inverterSerial: formData.inverterSerial.trim() || `INV-${formData.nic.trim().toUpperCase()}`,
        password: formData.password
      });

      notify(`Prosumer ${formData.nic.toUpperCase()} registered successfully.`, 'success');
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
    if (!editingUser) return;

    try {
      setSubmitting(true);
      await api.put(`/users/${editingUser.nic}`, {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        solarCapacityKw: parseFloat(formData.solarCapacityKw) || 15.0,
        inverterSerial: formData.inverterSerial.trim()
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
      u.nic.toLowerCase().includes(search.toLowerCase()) ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = users.filter(u => u.status === 'Pending').length;
  const activeCount = users.filter(u => u.status === 'Active').length;
  const deactivatedCount = users.filter(u => u.status === 'Deactivated').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Identity Registry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
            Prosumer Account Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage residential rooftop prosumers, verify solar array telemetry, approve KYC requests, and configure hardware profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchProsumers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-500 dark:text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Register Prosumer</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {message.text && (
        <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 animate-in fade-in ${
          message.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
        }`}>
          {message.type === 'error' ? (
            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Search & Status Filter Tabs Bar */}
      <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm dark:shadow-xl transition-colors duration-300">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by NIC, Full Name, or Email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'All', label: 'All Accounts', count: users.length },
            { id: 'Pending', label: 'Pending KYC', count: pendingCount, alert: pendingCount > 0 },
            { id: 'Active', label: 'Active', count: activeCount },
            { id: 'Deactivated', label: 'Deactivated', count: deactivatedCount }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                statusFilter === tab.id
                  ? 'bg-slate-950 text-amber-400'
                  : tab.alert ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-4 px-6">Prosumer Identity (NIC PK)</th>
                <th className="py-4 px-6">Solar Hardware Telemetry</th>
                <th className="py-4 px-6">Contact Channels</th>
                <th className="py-4 px-6">KYC Status</th>
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
                filteredUsers.map((u) => (
                  <tr key={u.nic} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400">
                          {u.fullName?.charAt(0) || 'P'}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{u.fullName}</p>
                          <p className="font-mono text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                            <Hash className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                            <span>NIC: {u.nic}</span>
                          </p>
                          {u.approvedBy && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              Approved by: {u.approvedBy}
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
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
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
                            <span>Approve KYC</span>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Prosumer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500">Backoffice Registry</span>
                <h3 className="text-xl font-display font-black text-slate-900 dark:text-white">Register New Prosumer</h3>
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
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">National ID (NIC) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 199512345678"
                    value={formData.nic}
                    onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ruwan Jayawardena"
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
                    placeholder="prosumer@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+94 77 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Property / Grid Infeed Address *</label>
                <input
                  type="text"
                  required
                  placeholder="No. 124, Kandy Road, Kiribathgoda"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Solar Capacity (kW) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    required
                    placeholder="15.0"
                    value={formData.solarCapacityKw}
                    onChange={(e) => setFormData({ ...formData, solarCapacityKw: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Inverter Serial *</label>
                  <input
                    type="text"
                    required
                    placeholder="INV-SL-2026-889"
                    value={formData.inverterSerial}
                    onChange={(e) => setFormData({ ...formData, inverterSerial: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Prosumer Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500">Edit Prosumer Profile</span>
                <h3 className="text-xl font-display font-black text-slate-900 dark:text-white">{editingUser.fullName}</h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">NIC PK: {editingUser.nic}</p>
              </div>
              <button
                onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProsumer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Full Name</label>
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
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Property Address</label>
                <input
                  type="text"
                  required
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
                    min="1"
                    required
                    value={formData.solarCapacityKw}
                    onChange={(e) => setFormData({ ...formData, solarCapacityKw: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Inverter Serial</label>
                  <input
                    type="text"
                    required
                    value={formData.inverterSerial}
                    onChange={(e) => setFormData({ ...formData, inverterSerial: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
