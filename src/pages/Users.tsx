import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users as UsersIcon,
  Search,
  Filter,
  Edit2,
  CheckCircle,
  XCircle,
  Shield,
  ShieldAlert,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  Building2,
  Sparkles,
  UserCheck,
  UserX,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  Lock,
  Unlock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AdminLayout } from '../components/layout/AdminLayout';
import { supabase } from '../lib/supabaseClient';
import { ROLE_LABELS, UNIT_LABELS } from '../lib/constants';
import { PERMISSION_CATEGORIES, ROLE_PRESETS, ERP_MODULES } from '../config/modules';
import type { UserProfile, UserRole, FactoryUnit } from '../lib/constants';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE = 8;
const ACCENT_TEAL = '#2BA5B5';

const ALL_PERMISSION_KEYS = [
  'attendance',
  'hr_payroll',
  'merchandising',
  'sampling',
  'fabric_yarn',
  'cutting',
  'sewing',
  'washing_print_emb',
  'store_inventory',
  'qc',
  'commercial',
  'accounts',
];

export const Users: React.FC = () => {
  const { profile: currentAdmin } = useAuth();
  const { isDark } = useTheme();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('user');
  const [formUnit, setFormUnit] = useState<FactoryUnit>('all');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPermissions, setFormPermissions] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, unit, is_active, permissions, last_login')
        .order('full_name', { ascending: true });

      if (fetchErr) throw fetchErr;
      
      const normalizedData = (data || []).map((p: any) => {
        let perms: string[] = [];
        if (Array.isArray(p.permissions)) {
          perms = p.permissions;
        } else if (typeof p.permissions === 'object' && p.permissions !== null) {
          perms = Object.keys(p.permissions).filter(k => (p.permissions as any)[k]);
        }
        return { ...p, permissions: perms };
      });

      setProfiles(normalizedData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const searchTarget = `${p.full_name || ''} ${p.email || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || searchTarget.includes(searchQuery.trim().toLowerCase());
      const matchesRole = roleFilter === 'all' || p.role === roleFilter;
      const matchesUnit = unitFilter === 'all' || p.unit === unitFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && p.is_active) ||
        (statusFilter === 'disabled' && !p.is_active);

      return matchesSearch && matchesRole && matchesUnit && matchesStatus;
    });
  }, [profiles, searchQuery, roleFilter, unitFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / ITEMS_PER_PAGE));
  const paginatedProfiles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProfiles.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProfiles, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, unitFilter, statusFilter]);

  const openEditDrawer = (p: UserProfile) => {
    setEditingProfile(p);
    setFormFullName(p.full_name || '');
    setFormRole(p.role as UserRole);
    setFormUnit(p.unit as FactoryUnit);
    setFormIsActive(p.is_active ?? true);
    
    // Transform array permissions to object for checkboxes
    const permObj: Record<string, boolean> = {};
    if (Array.isArray(p.permissions)) {
      p.permissions.forEach(k => { permObj[k] = true; });
    }
    setFormPermissions(permObj);
  };

  const closeEditDrawer = () => {
    if (isSubmitting) return;
    setEditingProfile(null);
  };

  const isEditingSelf = editingProfile?.id === currentAdmin?.id;

  const applyPresetToState = (presetKey: string, isAddMode: boolean) => {
    const preset = ROLE_PRESETS[presetKey as keyof typeof ROLE_PRESETS];
    if (!preset) return;
    setFormPermissions({ ...preset.permissions });
    toast.success(`Applied "${preset.name}"`);
  };

  const togglePermissionKey = (key: string, isAddMode: boolean) => {
    setFormPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllPermissions = (value: boolean, isAddMode: boolean) => {
    const newPerms: Record<string, boolean> = {};
    if (value) {
      ALL_PERMISSION_KEYS.forEach((k) => {
        newPerms[k] = true;
      });
    }
    setFormPermissions(newPerms);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    const trimmedName = formFullName.trim();
    if (!trimmedName) {
      toast.error('Full name is required.');
      return;
    }

    if (isEditingSelf) {
      if (formRole !== 'admin') {
        toast.error('You cannot remove the administrator role from your own account.');
        return;
      }
      if (!formIsActive) {
        toast.error('You cannot disable your own active administrative account.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Always send a real array of strings for permissions
      const permissionsArray = formRole === 'admin'
        ? []
        : Object.entries(formPermissions)
            .filter(([_, enabled]) => enabled)
            .map(([key, _]) => key);

      const { error: rpcErr } = await supabase.rpc('admin_update_user', {
        target_id: editingProfile.id,
        new_role: formRole,
        new_unit: formUnit,
        new_full_name: trimmedName,
        new_is_active: formIsActive,
        new_permissions: permissionsArray,
      });

      if (rpcErr) throw rpcErr;

      toast.success(`Profile for ${trimmedName} updated successfully!`);
      await loadProfiles();
      setEditingProfile(null);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      toast.error(err?.message || 'Database error: Could not execute admin_update_user RPC.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickToggleActive = async (p: UserProfile) => {
    if (p.id === currentAdmin?.id) {
      toast.error('You cannot disable your own account.');
      return;
    }

    const nextState = !p.is_active;
    try {
      const { error: rpcErr } = await supabase.rpc('admin_update_user', {
        target_id: p.id,
        new_role: p.role,
        new_unit: p.unit,
        new_full_name: p.full_name,
        new_is_active: nextState,
        new_permissions: p.permissions || [],
      });

      if (rpcErr) throw new Error(rpcErr.message);

      toast.success(`${p.full_name} is now ${nextState ? 'Active' : 'Disabled'}.`);
      setProfiles((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, is_active: nextState } : item))
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status.');
    }
  };

  const formatLastLogin = (iso?: string | null) => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const allRoles: UserRole[] = [
    'admin',
    'merchandiser',
    'production_manager',
    'store_keeper',
    'accounts',
    'hr',
    'commercial',
    'qc',
    'user',
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Staff &amp; Role Management
              </h1>
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(43, 165, 181, 0.15)', color: ACCENT_TEAL }}
              >
                {profiles.length} Staff
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bangla mt-0.5">
              কারখানার সকল কর্মকর্তা ও কর্মচারীর তালিকা, ইউজার ক্রিয়েশন ও পারমিশন কন্ট্রোল
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadProfiles}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Staff</span>
            </button>
          </div>
        </div>
        
        {/* INFO BANNER */}
        <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-3">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <p>
            To add a new user: create the user in Supabase (Authentication, Users, Add user, Auto Confirm), then click Edit here to set name, role, unit and permissions.
          </p>
        </div>

        {/* Database Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Failed to fetch staff data</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* FILTER & SEARCH BAR CONTAINER */}
        <div
          className={`p-4 sm:p-5 rounded-3xl border shadow-soft-sm space-y-4 transition-colors duration-200 ${
            isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff name or email..."
                className={`w-full pl-9 pr-4 py-2 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                  isDark
                    ? 'bg-[#0B2E33]/70 border-white/10 text-white placeholder:text-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={`w-full px-3.5 py-2 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                  isDark
                    ? 'bg-[#0B2E33]/70 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">All Roles (সকল পদবী)</option>
                {allRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]?.en} ({ROLE_LABELS[r]?.bn})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className={`w-full px-3.5 py-2 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                  isDark
                    ? 'bg-[#0B2E33]/70 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">All Units (সব ইউনিট)</option>
                <option value="knit">Knit Only (নিট)</option>
                <option value="woven">Woven Only (উভেন)</option>
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-3.5 py-2 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                  isDark
                    ? 'bg-[#0B2E33]/70 border-white/10 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="all">All Status (সব স্ট্যাটাস)</option>
                <option value="active">Active Only (সক্রিয়)</option>
                <option value="disabled">Disabled Only (নিষ্ক্রিয়)</option>
              </select>
            </div>
          </div>
        </div>

        {/* STAFF DATA TABLE CONTAINER */}
        <div
          className={`rounded-3xl border shadow-soft-lg overflow-hidden transition-colors duration-200 ${
            isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-slate-400'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <th className="py-3.5 px-4 sm:px-6">Staff Member</th>
                  <th className="py-3.5 px-4">Role &amp; Title</th>
                  <th className="py-3.5 px-4">Factory Unit</th>
                  <th className="py-3.5 px-4">Modules Access</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Last Login</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-white/10" />
                          <div className="space-y-1.5">
                            <div className="w-28 h-3.5 bg-white/10 rounded" />
                            <div className="w-36 h-3 bg-white/5 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4"><div className="w-24 h-4 bg-white/10 rounded" /></td>
                      <td className="py-4 px-4"><div className="w-16 h-4 bg-white/10 rounded" /></td>
                      <td className="py-4 px-4"><div className="w-20 h-4 bg-white/10 rounded" /></td>
                      <td className="py-4 px-4"><div className="w-16 h-4 bg-white/10 rounded-full" /></td>
                      <td className="py-4 px-4 hidden md:table-cell"><div className="w-20 h-3 bg-white/10 rounded" /></td>
                      <td className="py-4 px-4 sm:px-6 text-right"><div className="w-12 h-6 bg-white/10 rounded-xl ml-auto" /></td>
                    </tr>
                  ))
                ) : paginatedProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No staff members found</p>
                      <p className="text-xs mt-1">Try clearing filters or search query.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedProfiles.map((p) => {
                    const isSelf = p.id === currentAdmin?.id;
                    const roleLabel = ROLE_LABELS[p.role as UserRole] || { en: p.role, bn: '' };
                    const unitLabelObj = UNIT_LABELS[p.unit as FactoryUnit] || { en: p.unit, bn: '' };
                    const perms = p.permissions || {};
                    const activePermsCount = Object.values(perms).filter(Boolean).length;

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                              style={{
                                backgroundColor: p.is_active ? ACCENT_TEAL : '#64748B',
                              }}
                            >
                              {(p.full_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-bold truncate">{p.full_name || 'Unnamed Staff'}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#2BA5B5]/20 text-[#2BA5B5] border border-[#2BA5B5]/40">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                                {p.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold">{roleLabel.en}</span>
                            <span className="text-[10px] text-slate-400 font-bangla leading-normal">
                              {roleLabel.bn}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold uppercase tracking-wider border"
                            style={{
                              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0',
                              color: p.unit === 'knit' ? '#38BDF8' : p.unit === 'woven' ? '#FB923C' : ACCENT_TEAL,
                            }}
                          >
                            {unitLabelObj.en}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5" title={p.role === 'admin' ? 'Administrator has full access to all modules' : `${activePermsCount} of 12 modules permitted`}>
                            <span
                              className="px-2.5 py-0.5 rounded-lg text-xs font-bold border"
                              style={{
                                backgroundColor: isDark ? 'rgba(43, 165, 181, 0.1)' : '#E6FFFA',
                                borderColor: isDark ? 'rgba(43, 165, 181, 0.3)' : '#B2F5EA',
                                color: ACCENT_TEAL,
                              }}
                            >
                              {p.role === 'admin' ? 'All (Admin)' : `${activePermsCount}/12 Modules`}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleQuickToggleActive(p)}
                            disabled={isSelf}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-transform hover:scale-105 cursor-pointer ${
                              p.is_active
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                            title={isSelf ? 'Cannot toggle your own status' : 'Click to toggle status'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.is_active ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            {p.is_active ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 hidden md:table-cell text-slate-400">
                          {formatLastLogin(p.last_login)}
                        </td>

                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <button
                            type="button"
                            onClick={() => openEditDrawer(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105 border cursor-pointer"
                            style={{
                              backgroundColor: isDark ? 'rgba(43, 165, 181, 0.15)' : 'rgba(43, 165, 181, 0.1)',
                              borderColor: isDark ? 'rgba(43, 165, 181, 0.3)' : 'rgba(43, 165, 181, 0.2)',
                              color: ACCENT_TEAL,
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            className={`px-4 sm:px-6 py-3.5 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
            }`}
          >
            <span>
              Showing {paginatedProfiles.length} of {filteredProfiles.length} staff
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-xs px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* EDIT DRAWER SLIDE-IN MODAL WITH PERMISSIONS */}
        <AnimatePresence>
          {editingProfile && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeEditDrawer}
                className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs"
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed top-0 bottom-0 right-0 z-50 w-full max-w-lg border-l shadow-2xl flex flex-col transition-colors duration-200 ${
                  isDark
                    ? 'bg-[#103A40] border-white/10 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Edit Staff Profile &amp; Access</h2>
                    <p className="text-xs text-slate-400 font-bangla">
                      স্টাফ তথ্য, পদবী ও মডিউল পারমিশন পরিবর্তন
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditDrawer}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveUser} className="flex-1 p-6 space-y-5 overflow-y-auto scrollbar-custom">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Email Address (Supabase Auth ID)
                    </label>
                    <input
                      type="email"
                      value={editingProfile.email || ''}
                      disabled
                      className={`w-full px-3.5 py-2.5 text-xs rounded-2xl border cursor-not-allowed opacity-75 ${
                        isDark ? 'bg-black/20 border-white/10' : 'bg-slate-100 border-slate-200'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Full Name (সম্পূর্ণ নাম) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                        isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Department Role
                      </label>
                      <select
                        value={formRole}
                        onChange={(e) => setFormRole(e.target.value as UserRole)}
                        disabled={isEditingSelf}
                        className={`w-full px-3 py-2.5 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                          isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        {allRoles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]?.en}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Factory Unit
                      </label>
                      <select
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value as FactoryUnit)}
                        className={`w-full px-3 py-2.5 text-xs rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                          isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="all">All Units (Composite)</option>
                        <option value="knit">Knit Garments Unit</option>
                        <option value="woven">Woven Garments Unit</option>
                      </select>
                    </div>
                  </div>

                  <div
                    className={`p-4 rounded-2xl border ${
                      isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold block">Account Status</span>
                        <span className="text-[11px] text-slate-400 font-bangla">
                          সিস্টেম এক্সেস চালু অথবা বন্ধ করুন
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingSelf) {
                            toast.error('You cannot disable your own active administrative account.');
                            return;
                          }
                          setFormIsActive(!formIsActive);
                        }}
                        disabled={isEditingSelf}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formIsActive ? 'bg-[#2BA5B5]' : 'bg-slate-500'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formIsActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Permissions Section in Edit Drawer */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold block">Module Permissions</span>
                        <span className="text-[11px] text-slate-400 font-bangla">
                          মডিউল পারমিশন ({Object.values(formPermissions).filter(Boolean).length}/12 selected)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAllPermissions(true, false)}
                          className="text-[11px] font-semibold text-[#2BA5B5] hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-slate-500">|</span>
                        <button
                          type="button"
                          onClick={() => setAllPermissions(false, false)}
                          className="text-[11px] font-semibold text-rose-400 hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyPresetToState(key, false)}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all hover:scale-105"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                            color: isDark ? '#38BDF8' : '#0E7490',
                          }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 pt-1">
                      {PERMISSION_CATEGORIES.map((cat) => (
                        <div
                          key={cat.category}
                          className={`p-3 rounded-2xl border ${
                            isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="mb-2">
                            <span className="text-xs font-bold block">{cat.category}</span>
                            <span className="text-[10px] text-slate-400 font-bangla">{cat.categoryBangla}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cat.keys.map((k) => {
                              let modName = k;
                              if (k === 'merchandising') {
                                modName = 'Planning & Production / পরিকল্পনা';
                              } else {
                                for (const g of ERP_MODULES) {
                                  const found = g.items.find((it) => it.id === k);
                                  if (found) {
                                    modName = found.name;
                                    break;
                                  }
                                }
                              }

                              const isChecked = !!formPermissions[k];

                              return (
                                <label
                                  key={k}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                                    isChecked
                                      ? isDark
                                        ? 'bg-[#2BA5B5]/20 border-[#2BA5B5]/40 text-white font-semibold'
                                        : 'bg-teal-50 border-teal-200 text-teal-900 font-semibold'
                                      : isDark
                                      ? 'bg-black/20 border-white/5 text-slate-300'
                                      : 'bg-white border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePermissionKey(k, false)}
                                    className="rounded border-slate-400 text-[#2BA5B5] focus:ring-[#2BA5B5] w-3.5 h-3.5"
                                  />
                                  <span className="truncate">{modName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={closeEditDrawer}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-2xl text-xs font-semibold hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md transition-all cursor-pointer hover:scale-102"
                      style={{ backgroundColor: ACCENT_TEAL }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Save Staff Profile</span>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
};

export default Users;
