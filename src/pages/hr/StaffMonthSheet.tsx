/**
 * Individual Staff Job Card & Monthly Attendance Page
 * Rupkatha Apparels Ltd. (/hr/attendance/:id)
 * Features:
 * 1. Authentic Job Card Layout identical in Screen, Print, PDF and Excel
 * 2. Admin Edit Drawer via admin_edit_attendance and admin_clear_override
 * 3. Attendance Edit Audit Log Drawer
 * 4. 1-Page A4 Portrait Print, PDF, and Excel exports
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import {
  getDhakaYearMonth,
  formatDhakaDateDisplay,
  formatDhakaTimeNoSpace,
  formatDhaka24HTime,
  formatDhakaTime12,
  minutesToHhMm,
  calculateServiceLength,
} from '../../lib/dhakaTime';
import {
  getJobCardPeriod,
  formatIsoToDdMmYyyy,
  formatDdMmYyyy,
  transformRawRowsToJobCard,
  exportSingleJobCardToExcel,
  exportSingleJobCardToPdf,
  JobCardRow,
  JobCardSummary,
} from '../../lib/jobCardExport';
import { getSelfieSignedUrl } from '../../lib/attendanceUtils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Printer,
  FileSpreadsheet,
  FileDown,
  Edit3,
  History,
  X,
  MapPin,
  Camera,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const StaffMonthSheet: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isDark } = useTheme();
  const { companyName } = useCompany();

  const isAdmin = profile?.role === 'admin';

  const defaultYm = useMemo(() => getDhakaYearMonth(), []);
  const initialYear = Number(searchParams.get('y')) || defaultYm.year;
  const initialMonth = Number(searchParams.get('m')) || defaultYm.month;

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);

  const [staffProfile, setStaffProfile] = useState<any | null>(null);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signed URLs for selfies
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Admin Edit Drawer state
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editInTime, setEditInTime] = useState<string>('');
  const [editOutTime, setEditOutTime] = useState<string>('');
  const [editOtHours, setEditOtHours] = useState<string>('0');
  const [editStatus, setEditStatus] = useState<string>('Auto');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Audit Log Drawer state
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Sync search parameters
  useEffect(() => {
    setSearchParams({ y: String(selectedYear), m: String(selectedMonth) });
  }, [selectedYear, selectedMonth, setSearchParams]);

  // Load Staff details and Month Sheet via RPC hr_staff_month_sheet
  const loadMonthSheet = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Staff profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, employee_id, designation, department, joining_date, mobile')
        .eq('id', id)
        .single();

      if (profErr) throw profErr;
      setStaffProfile(prof);

      // 2. Call RPC hr_staff_month_sheet({ target: id, y: selectedYear, m: selectedMonth })
      const { data: sheetData, error: rpcErr } = await supabase.rpc('hr_staff_month_sheet', {
        target: id,
        y: selectedYear,
        m: selectedMonth,
      });

      if (rpcErr) throw rpcErr;

      const rows = sheetData || [];
      setRawRows(rows);

      // 3. Load signed URLs for photo previews
      const urlMap: Record<string, string> = {};
      await Promise.all(
        rows.map(async (r: any) => {
          if (r.in_photo) {
            const url = await getSelfieSignedUrl(r.in_photo);
            if (url) urlMap[`${r.d}-in`] = url;
          }
          if (r.out_photo) {
            const url = await getSelfieSignedUrl(r.out_photo);
            if (url) urlMap[`${r.d}-out`] = url;
          }
        })
      );
      setSignedUrls(urlMap);
    } catch (err: any) {
      console.error('Error loading job card:', err);
      setError(err?.message || 'Failed to load job card sheet.');
    } finally {
      setLoading(false);
    }
  }, [id, selectedYear, selectedMonth]);

  useEffect(() => {
    loadMonthSheet();
  }, [loadMonthSheet]);

  // Load Audit Edit Logs for this staff and selected month
  const loadAuditLogs = async () => {
    if (!id) return;
    setShowAuditLogs(true);
    setLoadingAudit(true);
    try {
      const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const { data, error: logErr } = await supabase
        .from('attendance_edit_log')
        .select('*')
        .eq('user_id', id)
        .gte('att_date', `${monthPrefix}-01`)
        .lte('att_date', `${monthPrefix}-31`)
        .order('edited_at', { ascending: false });

      if (logErr) throw logErr;
      setAuditLogs(data || []);
    } catch (err: any) {
      console.error('Error loading audit log:', err);
      toast.error('Could not load edit audit log.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Format job card rows and compute summary counts
  const { rows: jobCardRows, summary } = useMemo(() => {
    return transformRawRowsToJobCard(rawRows, selectedYear, selectedMonth);
  }, [rawRows, selectedYear, selectedMonth]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Open Edit Drawer
  const handleOpenEdit = (raw: any) => {
    setEditingRow(raw);
    setEditInTime(formatDhaka24HTime(raw.check_in_at));
    setEditOutTime(formatDhaka24HTime(raw.check_out_at));
    setEditOtHours(raw.ot_hours ? String(raw.ot_hours) : '0');
    setEditStatus(raw.particular || 'Auto');
    setEditRemarks(raw.remarks || '');
    setEditReason('');
    setShowConfirmSave(false);
  };

  // Perform Save Admin Edit
  const handleSaveAdminEdit = async () => {
    if (!editingRow || !id) return;
    if (!editReason.trim() || editReason.trim().length < 3) {
      toast.error('Reason is required (minimum 3 characters).');
      return;
    }

    setSavingEdit(true);
    try {
      if (editStatus === 'Auto') {
        // Clear override and restore calculation
        const { error: clearErr } = await supabase.rpc('admin_clear_override', {
          target: id,
          d: editingRow.d,
          reason: editReason.trim(),
        });
        if (clearErr) throw clearErr;
        toast.success(`Day ${editingRow.d} override cleared and reset to Auto.`);
      } else {
        // Apply manual override
        const { error: editErr } = await supabase.rpc('admin_edit_attendance', {
          target: id,
          d: editingRow.d,
          in_time: editInTime || null,
          out_time: editOutTime || null,
          new_ot: editOtHours ? Number(editOtHours) : 0,
          new_status: editStatus,
          new_remarks: editRemarks.trim() || null,
          reason: editReason.trim(),
        });
        if (editErr) throw editErr;
        toast.success(`Day ${editingRow.d} attendance updated successfully.`);
      }

      setEditingRow(null);
      setShowConfirmSave(false);
      await loadMonthSheet();
    } catch (err: any) {
      console.error('Error saving admin edit:', err);
      toast.error(err?.message || 'Failed to save attendance change.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Navigation & Action Bar (Hidden when printing) */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/hr/attendance')}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              title="Back to Monthly Summary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#2BA5B5]">
                  Staff Job Card
                </span>
                <span className="text-xs font-bangla text-slate-400">/ জব কার্ড প্রিন্ট ও প্রশাসন</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {staffProfile?.full_name || staffProfile?.email || 'Staff Job Card'}
              </h1>
            </div>
          </div>

          {/* Action Buttons: Print, Excel, PDF, Edit History */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || jobCardRows.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Print 1-Page A4 Portrait Job Card"
            >
              <Printer className="w-4 h-4" />
              <span>Print Job Card</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportSingleJobCardToExcel(staffProfile, jobCardRows, selectedYear, selectedMonth, summary, companyName)
              }
              disabled={loading || jobCardRows.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#0c6e70] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download 1-Page Excel Spreadsheet (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportSingleJobCardToPdf(staffProfile, jobCardRows, selectedYear, selectedMonth, summary, companyName)
              }
              disabled={loading || jobCardRows.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download 1-Page A4 Portrait PDF (.pdf)"
            >
              <FileDown className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={loadAuditLogs}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-white border border-amber-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer"
              title="View admin audit edit history"
            >
              <History className="w-4 h-4" />
              <span>Edit History</span>
            </button>

            <button
              type="button"
              onClick={loadMonthSheet}
              disabled={loading}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refresh job card"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Month Selector Bar (Hidden when printing) */}
        <div
          className={`print:hidden p-4 rounded-3xl border shadow-sm flex items-center justify-between gap-4 ${
            isDark ? 'bg-[#103A40]/80 border-white/5' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-black/30 text-sm font-black text-slate-900 dark:text-white font-mono min-w-[170px] text-center border border-slate-200 dark:border-white/10">
              {monthName}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            {getJobCardPeriod(selectedYear, selectedMonth)}
          </div>
        </div>

        {/* 1. AUTHENTIC JOB CARD CONTAINER (Screen + Exact 1-Page Print) */}
        <div
          id="job-card-printable-area"
          className={`job-card-paper p-6 sm:p-8 rounded-3xl border shadow-xl transition-all ${
            isDark
              ? 'bg-[#103A40]/90 border-white/10 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5] mb-2" />
              <span className="text-xs font-medium">Generating Job Card...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Centered Header */}
              <div className="text-center space-y-0.5">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-white">
                  {companyName}
                </h1>
                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-900 dark:text-slate-100">
                  JOB CARD
                </h2>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                  {getJobCardPeriod(selectedYear, selectedMonth)}
                </p>
              </div>

              {/* Left Info Lines */}
              <div className="pt-2 text-xs font-semibold space-y-1 text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-white/20 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  <div>
                    <span className="font-bold">Card No</span> :{' '}
                    <span className="font-mono font-black">{staffProfile?.employee_id || '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">Name</span> :{' '}
                    <span>{staffProfile?.full_name || staffProfile?.email || '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">Designation</span> :{' '}
                    <span>{staffProfile?.designation || '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">Section</span> :{' '}
                    <span>{staffProfile?.department || '-'}</span>
                  </div>
                  <div>
                    <span className="font-bold">Joining Date</span> :{' '}
                    <span className="font-mono">{formatIsoToDdMmYyyy(staffProfile?.joining_date) || '-'}</span>
                  </div>
                  <div className="italic text-slate-600 dark:text-slate-400">
                    Lunch/Dinner Break 1 Hour
                  </div>
                </div>
              </div>

              {/* Job Card Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse border border-slate-900 dark:border-white text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-200 dark:bg-slate-700 font-black text-slate-900 dark:text-white border-b border-slate-900 dark:border-white">
                      <th className="py-1 px-1.5 border-r border-slate-900 dark:border-white w-10">SL</th>
                      <th className="py-1 px-2 border-r border-slate-900 dark:border-white w-24">Date</th>
                      <th className="py-1 px-2 border-r border-slate-900 dark:border-white w-20">In Time</th>
                      <th className="py-1 px-2 border-r border-slate-900 dark:border-white w-20">Out Time</th>
                      <th className="py-1 px-2 border-r border-slate-900 dark:border-white w-16">OT Hour</th>
                      <th className="py-1 px-2 border-r border-slate-900 dark:border-white w-24">Particular</th>
                      <th className="py-1 px-2 border-r border-slate-900 dark:border-white text-left">Remarks</th>
                      {isAdmin && (
                        <th className="py-1 px-1 print:hidden w-12 text-center">Edit</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {jobCardRows.map((r, idx) => {
                      const raw = rawRows[idx];
                      const inUrl = signedUrls[`${r.d}-in`];
                      const outUrl = signedUrls[`${r.d}-out`];

                      // Row Coloring Rule:
                      // Offday = Bright Green (#00FF00 / #22C55E)
                      // Absent = Orange/Amber (#FFC000 / #F59E0B)
                      // Leave = Light Blue (#BAE6FD / #0284C7)
                      // Present & Upcoming = White
                      let rowStyle = '';
                      if (r.statusType === 'offday') {
                        rowStyle = isDark
                          ? 'bg-[#15803D] text-white font-bold'
                          : 'bg-[#22C55E] text-slate-950 font-bold';
                      } else if (r.statusType === 'absent') {
                        rowStyle = isDark
                          ? 'bg-[#B45309] text-white font-bold'
                          : 'bg-[#FFC000] text-slate-950 font-bold';
                      } else if (r.statusType === 'leave') {
                        rowStyle = isDark
                          ? 'bg-[#0369A1] text-white font-bold'
                          : 'bg-[#BAE6FD] text-slate-950 font-bold';
                      } else {
                        rowStyle = isDark ? 'bg-transparent text-white' : 'bg-white text-slate-900';
                      }

                      return (
                        <tr
                          key={r.d}
                          className={`border-b border-slate-900 dark:border-white transition-colors ${rowStyle}`}
                        >
                          <td className="py-1 px-1.5 border-r border-slate-900 dark:border-white font-mono font-bold">
                            {r.sl}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white font-mono whitespace-nowrap">
                            {r.dateStr}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white font-mono whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>{r.inTime || ''}</span>
                              {inUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhotoUrl(inUrl)}
                                  className="print:hidden p-0.5 rounded hover:bg-black/20 text-slate-800 dark:text-white"
                                  title="View Check-IN selfie"
                                >
                                  <Camera className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />
                                </button>
                              )}
                              {raw?.in_lat && raw?.in_lng && (
                                <a
                                  href={`https://www.google.com/maps?q=${raw.in_lat},${raw.in_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="print:hidden text-teal-600 dark:text-teal-300 hover:scale-110"
                                  title="View GPS location"
                                >
                                  <MapPin className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white font-mono whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>{r.outTime || ''}</span>
                              {outUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhotoUrl(outUrl)}
                                  className="print:hidden p-0.5 rounded hover:bg-black/20 text-slate-800 dark:text-white"
                                  title="View Check-OUT selfie"
                                >
                                  <Camera className="w-3 h-3 text-rose-600 dark:text-rose-300" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white font-mono">
                            {r.otHours !== '' && r.otHours !== 0 ? r.otHours : ''}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white font-bold whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {r.adminEdited && (
                                <span
                                  className="w-2 h-2 rounded-full bg-orange-500 inline-block shrink-0 shadow-xs ring-1 ring-white"
                                  title="Edited by admin"
                                />
                              )}
                              <span>{r.particular || ''}</span>
                            </div>
                          </td>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white text-left font-normal truncate max-w-[150px]">
                            {r.remarks || ''}
                          </td>
                          {isAdmin && (
                            <td className="py-1 px-1 print:hidden text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(raw)}
                                className="p-1 rounded-lg hover:bg-black/15 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                                title="Admin Edit Day Attendance"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* Total Row under the table */}
                    <tr className="bg-slate-200 dark:bg-slate-700 font-black text-slate-900 dark:text-white border-t-2 border-slate-900 dark:border-white">
                      <td colSpan={4} className="py-1.5 px-3 uppercase tracking-wider text-right border-r border-slate-900 dark:border-white">
                        Total
                      </td>
                      <td className="py-1.5 px-2 font-mono text-center border-r border-slate-900 dark:border-white">
                        {summary.totalOtHours > 0 ? summary.totalOtHours : 0}
                      </td>
                      <td colSpan={isAdmin ? 3 : 2} className="py-1.5 px-2 border-slate-900 dark:border-white"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Summary Block (Bottom Left) + Official Signatures (Bottom Right) */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                {/* Summary Table at the bottom-left */}
                <div className="w-full sm:w-64">
                  <table className="w-full text-xs border-collapse border border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold">
                    <thead>
                      <tr className="bg-slate-200 dark:bg-slate-700 border-b border-slate-900 dark:border-white">
                        <th className="py-1 px-2 text-left border-r border-slate-900 dark:border-white">Summary</th>
                        <th className="py-1 px-2 text-center w-20">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 dark:divide-white">
                      <tr>
                        <td className="py-1 px-2 border-r border-slate-900 dark:border-white">Present</td>
                        <td className="py-1 px-2 text-center font-mono">{summary.present}</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border-r border-slate-900 dark:border-white">Absent</td>
                        <td className="py-1 px-2 text-center font-mono">{summary.absent}</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border-r border-slate-900 dark:border-white">Offday</td>
                        <td className="py-1 px-2 text-center font-mono">{summary.offday}</td>
                      </tr>
                      {summary.leave > 0 && (
                        <tr>
                          <td className="py-1 px-2 border-r border-slate-900 dark:border-white">Leave</td>
                          <td className="py-1 px-2 text-center font-mono">{summary.leave}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-1 px-2 border-r border-slate-900 dark:border-white">Late Count</td>
                        <td className="py-1 px-2 text-center font-mono">{summary.late}</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border-r border-slate-900 dark:border-white">Total Working Hours</td>
                        <td className="py-1 px-2 text-center font-mono">{summary.totalWorkingHours}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signature Lines at Bottom Right */}
                <div className="flex-1 grid grid-cols-3 gap-4 text-center text-xs font-bold pt-6 sm:pt-0">
                  <div>
                    <div className="border-t border-slate-900 dark:border-white pt-1">
                      Prepared by HR
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-slate-900 dark:border-white pt-1">
                      Checked by
                    </div>
                  </div>
                  <div>
                    <div className="border-t border-slate-900 dark:border-white pt-1">
                      Approved by
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. ADMIN EDIT DRAWER / MODAL */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 transition-all ${
              isDark ? 'bg-[#103A40] border-teal-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-[#2BA5B5]">Admin Override</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-[#2BA5B5]">
                    Day {editingRow.d} ({formatDdMmYyyy(editingRow.d, selectedMonth, selectedYear)})
                  </span>
                </div>
                <h3 className="text-lg font-black tracking-tight mt-0.5">
                  Edit Attendance for {staffProfile?.full_name || staffProfile?.email}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              {/* In Time & Out Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">
                    IN Time (24h HH:mm)
                  </label>
                  <input
                    type="time"
                    value={editInTime}
                    onChange={(e) => setEditInTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400">Leave blank if no check-in</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">
                    OUT Time (24h HH:mm)
                  </label>
                  <input
                    type="time"
                    value={editOutTime}
                    onChange={(e) => setEditOutTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                  <span className="text-[10px] text-slate-400">Leave blank if no check-out</span>
                </div>
              </div>

              {/* OT Hours & Particular Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">
                    OT Hours (step 0.5)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={editOtHours}
                    onChange={(e) => setEditOtHours(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm font-mono ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">
                    Particular Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-sm font-bold ${
                      isDark
                        ? 'bg-black/30 border-white/10 text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="Auto">Auto (Restore Calculation)</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Offday">Offday</option>
                    <option value="Leave">Leave</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Remarks</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Approved leave / late excused"
                  className={`w-full px-3 py-2 rounded-xl border text-sm ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Required Reason */}
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">
                  Reason for Change <span className="text-rose-500">* (min 3 chars)</span>
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Official gate pass approved by management"
                  className={`w-full px-3 py-2 rounded-xl border text-sm ${
                    isDark
                      ? 'bg-black/30 border-white/10 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Confirmation Prompt */}
              {showConfirmSave ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <span>Confirm Logging</span>
                  </div>
                  <p className="text-xs">
                    This change will be logged in the permanent audit trail with your name and timestamp.
                  </p>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmSave(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAdminEdit}
                      disabled={savingEdit}
                      className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5"
                    >
                      {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm & Save</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {!showConfirmSave && (
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!editReason.trim() || editReason.trim().length < 3) {
                      toast.error('Reason is required (minimum 3 characters).');
                      return;
                    }
                    setShowConfirmSave(true);
                  }}
                  className="px-5 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0c6e70] text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. AUDIT EDIT LOG DRAWER */}
      {showAuditLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border shadow-2xl p-6 transition-all ${
              isDark ? 'bg-[#103A40] border-amber-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  <span>Attendance Edit Audit History</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {staffProfile?.full_name} - {monthName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditLogs(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto flex-1">
              {loadingAudit ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#2BA5B5] mb-2" />
                  <span className="text-xs">Loading audit logs...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <p className="text-sm font-semibold">No admin edits logged for this month.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => {
                    const editedTime = log.edited_at
                      ? formatDhakaDateDisplay(log.edited_at) + ' ' + formatDhakaTime12(log.edited_at)
                      : '-';

                    return (
                      <div
                        key={log.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-mono text-[#0F8B8D] dark:text-[#5EEAD4]">
                            Date: {log.att_date}
                          </span>
                          <span className="text-[11px] text-slate-500">{editedTime}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Field:</span>{' '}
                          <strong className="font-mono">{log.field_name}</strong>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            {log.old_value || 'null'}
                          </span>
                          <span>&rarr;</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            {log.new_value || 'null'}
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400">Reason:</span> {log.reason}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium pt-1">
                          Edited by: <span className="text-slate-800 dark:text-white font-bold">{log.edited_by_name || 'Admin'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAuditLogs(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selfie Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-sm w-full bg-slate-900 p-2 rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
              aria-label="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Selfie snapshot"
              className="w-full h-auto rounded-2xl object-cover max-h-[80vh]"
            />
            <div className="p-3 text-center text-xs text-slate-300 font-medium">
              Punch selfie snapshot
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default StaffMonthSheet;
