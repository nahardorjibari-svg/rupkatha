/**
 * Staff Information Management Page
 * Rupkatha Apparels Ltd. (/hr/staff)
 * Adds Staff via hr_setup_staff RPC, updates via hr_update_staff.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { calculateServiceLength, formatDhakaDateDisplay } from '../../lib/dhakaTime';
import { exportStaffToExcel } from '../../lib/attendanceUtils';
import {
  Users,
  Search,
  FileSpreadsheet,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Phone,
  Briefcase,
  Calendar,
  Building,
  CreditCard,
  AlertCircle,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Check,
  UserPlus,
  Mail,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StaffInfo: React.FC = () => {
  const { profile } = useAuth();
  const { isDark } = useTheme();
  const { companyName } = useCompany();

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // "Add Staff" Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addFullName, setAddFullName] = useState('');
  const [addEmployeeId, setAddEmployeeId] = useState('');
  const [addDepartment, setAddDepartment] = useState('');
  const [addDesignation, setAddDesignation] = useState('');
  const [addJoiningDate, setAddJoiningDate] = useState('');
  const [addMobile, setAddMobile] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // "Edit Staff" Drawer State
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [formFullName, setFormFullName] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // Load all profiles that have an Employee ID or attendance permission or role admin
  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, unit, is_active, permissions, employee_id, designation, department, mobile, joining_date')
        .order('full_name', { ascending: true });

      if (fetchErr) throw fetchErr;

      const normalized = (data || [])
        .map((s: any) => {
          let perms: string[] = [];
          if (Array.isArray(s.permissions)) {
            perms = s.permissions;
          } else if (typeof s.permissions === 'object' && s.permissions !== null) {
            perms = Object.keys(s.permissions).filter((k) => s.permissions[k]);
          }
          const hasAttendance = s.role === 'admin' || perms.includes('attendance');
          const hasEmployeeId = Boolean(s.employee_id && s.employee_id.trim());

          return {
            ...s,
            has_attendance: hasAttendance,
            has_employee_id: hasEmployeeId,
          };
        })
        .filter((s: any) => s.has_employee_id || s.has_attendance || s.role === 'admin');

      setStaffList(normalized);
    } catch (err: any) {
      console.error('Error fetching staff list:', err);
      setError(err?.message || 'Failed to load staff profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => {
      if (s.department && s.department.trim()) {
        set.add(s.department.trim());
      }
    });
    return Array.from(set).sort();
  }, [staffList]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const searchTarget = `${s.full_name || ''} ${s.email || ''} ${s.employee_id || ''} ${s.designation || ''} ${s.mobile || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || searchTarget.includes(searchQuery.trim().toLowerCase());
      const matchesDept = departmentFilter === 'all' || s.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [staffList, searchQuery, departmentFilter]);

  // Open Edit Drawer
  const handleOpenEdit = (s: any) => {
    setEditingStaff(s);
    setFormFullName(s.full_name || '');
    setFormEmployeeId(s.employee_id || '');
    setFormDesignation(s.designation || '');
    setFormDepartment(s.department || '');
    setFormMobile(s.mobile || '');
    setFormJoiningDate(s.joining_date || '');
    setDrawerError(null);
  };

  // Close Edit Drawer
  const handleCloseDrawer = () => {
    if (saving) return;
    setEditingStaff(null);
    setDrawerError(null);
  };

  // Submit Add Staff via RPC hr_setup_staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) {
      setAddError('Login email is required.');
      return;
    }

    setAddingStaff(true);
    setAddError(null);

    try {
      const { data, error: rpcErr } = await supabase.rpc('hr_setup_staff', {
        staff_email: addEmail.trim(),
        new_full_name: addFullName.trim() || null,
        new_employee_id: addEmployeeId.trim() || null,
        new_department: addDepartment.trim() || null,
        new_designation: addDesignation.trim() || null,
        new_joining_date: addJoiningDate || null,
        new_mobile: addMobile.trim() || null,
      });

      if (rpcErr) {
        setAddError(rpcErr.message);
        toast.error(`Error: ${rpcErr.message}`);
        return;
      }

      toast.success(`Staff profile for ${addEmail.trim()} created successfully with attendance permission.`);
      setIsAddModalOpen(false);
      // Reset form
      setAddEmail('');
      setAddFullName('');
      setAddEmployeeId('');
      setAddDepartment('');
      setAddDesignation('');
      setAddJoiningDate('');
      setAddMobile('');
      await loadStaff();
    } catch (err: any) {
      setAddError(err?.message || 'An unexpected error occurred.');
      toast.error(err?.message || 'Add staff failed.');
    } finally {
      setAddingStaff(false);
    }
  };

  // Save changes via RPC hr_update_staff
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff?.id) return;

    if (!formFullName.trim()) {
      setDrawerError('Full Name cannot be empty.');
      return;
    }

    setSaving(true);
    setDrawerError(null);

    try {
      const { data, error: rpcErr } = await supabase.rpc('hr_update_staff', {
        target_id: editingStaff.id,
        new_employee_id: formEmployeeId.trim() || null,
        new_designation: formDesignation.trim() || null,
        new_joining_date: formJoiningDate || null,
        new_department: formDepartment.trim() || null,
        new_mobile: formMobile.trim() || null,
        new_full_name: formFullName.trim(),
      });

      if (rpcErr) {
        setDrawerError(rpcErr.message);
        toast.error(`Failed to update staff: ${rpcErr.message}`);
        return;
      }

      toast.success(`Staff profile for "${formFullName.trim()}" updated successfully.`);
      handleCloseDrawer();
      await loadStaff();
    } catch (err: any) {
      setDrawerError(err?.message || 'An unexpected error occurred while saving.');
      toast.error(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#2BA5B5]">
                HR & Payroll Suite
              </span>
              <span className="text-xs font-bangla text-slate-400">/ স্টাফ তথ্য ও প্রোফাইল</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Users className="w-8 h-8 text-[#0F8B8D]" />
              <span>Staff Information Directory</span>
            </h1>
            <p className="text-xs font-bangla text-slate-500 dark:text-slate-400 mt-0.5">
              সকল কর্মকর্তা-কর্মচারীর আইডি কার্ড, পদবী, ডিপার্টমেন্ট, মোবাইল ও যোগদানের তথ্য
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Add Staff Button */}
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(true);
                setAddError(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#0c6e70] text-white text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer ring-2 ring-teal-500/20"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff / নতুন স্টাফ</span>
            </button>

            <button
              type="button"
              onClick={() => exportStaffToExcel(filteredStaff, companyName)}
              disabled={loading || staffList.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>

            <button
              type="button"
              onClick={loadStaff}
              disabled={loading}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors"
              title="Refresh staff list"
              aria-label="Refresh staff list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          className={`p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-3 ${
            isDark ? 'bg-[#103A40]/80 border-white/5' : 'bg-white border-slate-200'
          }`}
        >
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID card, login email or mobile..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                isDark
                  ? 'bg-black/20 border-white/10 text-white placeholder-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Department:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                isDark
                  ? 'bg-black/30 border-white/10 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Staff Table */}
        <div
          className={`rounded-3xl border shadow-xl overflow-hidden ${
            isDark ? 'bg-[#103A40]/80 border-white/5' : 'bg-white border-slate-200'
          }`}
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5] mb-2" />
              <span className="text-xs font-medium">Loading staff information...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No staff profiles found matching criteria.</p>
              <p className="text-xs font-bangla mt-1">নতুন স্টাফ যুক্ত করতে উপরের "Add Staff" বাটনে ক্লিক করুন।</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 uppercase font-black tracking-wider bg-slate-50/50 dark:bg-black/20">
                    <th className="py-3 px-3">SL</th>
                    <th className="py-3 px-3">Employee ID</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Login Email</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-3">Mobile</th>
                    <th className="py-3 px-3">Joining Date</th>
                    <th className="py-3 px-3">Service Length</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {filteredStaff.map((s, idx) => {
                    const serviceLength = calculateServiceLength(s.joining_date);
                    const displayName = s.full_name?.trim() ? s.full_name : s.email;

                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-3 text-slate-400 font-mono font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                          {s.employee_id ? (
                            <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-[#0F8B8D] dark:text-[#5EEAD4] border border-teal-500/20 font-bold">
                              {s.employee_id}
                            </span>
                          ) : (
                            <span className="text-amber-500 font-sans italic text-[11px]">
                              Not set
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900 dark:text-white whitespace-nowrap">
                          {displayName}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {s.email || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {s.department ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-black/30 font-semibold">
                              {s.department}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {s.designation || '-'}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {s.mobile || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {s.joining_date ? formatDhakaDateDisplay(s.joining_date) : '-'}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-200 whitespace-nowrap">
                          {serviceLength}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(s)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#2BA5B5]/15 hover:bg-[#2BA5B5] text-[#2BA5B5] hover:text-white font-bold transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Primary "Add Staff" Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all ${
              isDark ? 'bg-[#103A40] border-teal-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-[#2BA5B5]">HR Staff Enrollment</span>
                  <span className="text-xs font-bangla text-slate-400">/ নতুন স্টাফ নিবন্ধন</span>
                </div>
                <h3 className="text-xl font-black tracking-tight mt-0.5">Add Staff Details</h3>
              </div>
              <button
                type="button"
                onClick={() => !addingStaff && setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              {/* Notice / Hint */}
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#2BA5B5] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 dark:text-white">Note:</strong> Create this user first in Supabase Authentication &gt; Add user (Auto Confirm), then add the details here. The database automatically grants the "attendance" permission.
                </div>
              </div>

              {addError && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              {/* Login Email (Required) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Login Email / লগইন ইমেইল <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="e.g. employee@rupkathaapparels.com"
                    disabled={addingStaff}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white placeholder-slate-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              {/* Full Name & Employee ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Full Name / নাম
                  </label>
                  <input
                    type="text"
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                    placeholder="e.g. Md. Rafiqul Islam"
                    disabled={addingStaff}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Employee ID (Card No)
                  </label>
                  <input
                    type="text"
                    value={addEmployeeId}
                    onChange={(e) => setAddEmployeeId(e.target.value)}
                    placeholder="e.g. 101020"
                    disabled={addingStaff}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Department & Designation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Department / বিভাগ
                  </label>
                  <input
                    type="text"
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    placeholder="e.g. Sewing, Quality, HR"
                    disabled={addingStaff}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Designation / পদবী
                  </label>
                  <input
                    type="text"
                    value={addDesignation}
                    onChange={(e) => setAddDesignation(e.target.value)}
                    placeholder="e.g. Line Chief, PM, Officer"
                    disabled={addingStaff}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Joining Date & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Joining Date / যোগদানের তারিখ
                  </label>
                  <input
                    type="date"
                    value={addJoiningDate}
                    onChange={(e) => setAddJoiningDate(e.target.value)}
                    disabled={addingStaff}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Mobile / মোবাইল
                  </label>
                  <input
                    type="text"
                    value={addMobile}
                    onChange={(e) => setAddMobile(e.target.value)}
                    placeholder="e.g. 01711000000"
                    disabled={addingStaff}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addingStaff}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingStaff}
                  className="px-6 py-2.5 rounded-xl bg-[#0F8B8D] hover:bg-[#0c6e70] text-white text-xs font-black shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {addingStaff ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enrolling Staff...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Add Staff</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Drawer / Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden transition-all ${
              isDark ? 'bg-[#103A40] border-teal-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Edit Staff Profile</h3>
                <p className="text-xs font-bangla text-slate-400 mt-0.5">
                  স্টাফ তথ্য হালনাগাদ (ডাটাবেজ RPC hr_update_staff দ্বারা সংরক্ষিত)
                </p>
                <p className="text-[11px] font-mono text-teal-400 mt-0.5">
                  Email: {editingStaff.email || 'N/A'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseDrawer}
                disabled={saving}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
              {drawerError && (
                <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{drawerError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Full Name / সম্পূর্ণ নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  disabled={saving}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Employee ID */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Employee ID (Office ID Card No) / অফিস আইডি কার্ড নম্বর
                </label>
                <input
                  type="text"
                  value={formEmployeeId}
                  onChange={(e) => setFormEmployeeId(e.target.value)}
                  placeholder="e.g. 101020"
                  disabled={saving}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Used for biometric & mobile punch attendance. Must be unique.
                </span>
              </div>

              {/* Designation & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Designation / পদবী
                  </label>
                  <input
                    type="text"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. Line Chief, PM"
                    disabled={saving}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Department / বিভাগ
                  </label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="e.g. Sewing, Quality"
                    disabled={saving}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Mobile & Joining Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Mobile Number / মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="e.g. 01711000000"
                    disabled={saving}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Joining Date / যোগদানের তারিখ
                  </label>
                  <input
                    type="date"
                    value={formJoiningDate}
                    onChange={(e) => setFormJoiningDate(e.target.value)}
                    disabled={saving}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Calculated Service Length Preview */}
              {formJoiningDate && (
                <div className="p-3 rounded-xl bg-[#2BA5B5]/10 border border-[#2BA5B5]/20 text-xs">
                  <span className="text-slate-400 block font-bold">Calculated Service Length to Today:</span>
                  <span className="font-black text-[#2BA5B5]">
                    {calculateServiceLength(formJoiningDate)}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-[#0F8B8D] hover:bg-[#0c6e70] text-white text-xs font-black shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating DB...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Staff Info</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default StaffInfo;
