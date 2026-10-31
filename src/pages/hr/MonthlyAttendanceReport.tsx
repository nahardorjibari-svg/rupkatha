/**
 * Monthly Attendance Summary Report Page
 * Rupkatha Apparels Ltd. (/hr/attendance)
 * Table from hr_monthly_attendance RPC with SL, Employee ID, Name, Department, Designation,
 * Present, Absent, Late, Missing OUT, Total hours (hh:mm).
 * Clicking an Employee ID opens /hr/attendance/:id
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import {
  getDhakaYearMonth,
  minutesToHhMm,
} from '../../lib/dhakaTime';
import {
  exportMonthlyAttendanceToExcel,
  exportMonthlyAttendanceToPdf,
} from '../../lib/attendanceUtils';
import {
  transformRawRowsToJobCard,
  exportAllStaffJobCardsToPdf,
  exportAllStaffJobCardsToExcel,
  JobCardRow,
  JobCardSummary,
} from '../../lib/jobCardExport';
import {
  Calendar,
  FileSpreadsheet,
  FileDown,
  Printer,
  Trash2,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  FileText,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const MonthlyAttendanceReport: React.FC = () => {
  const { profile } = useAuth();
  const { isDark } = useTheme();
  const { companyName } = useCompany();
  const navigate = useNavigate();

  // Current year & month in Dhaka
  const defaultYm = useMemo(() => getDhakaYearMonth(), []);
  const [selectedYear, setSelectedYear] = useState<number>(defaultYm.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultYm.month);

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Admin purge selfies confirmation modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purging, setPurging] = useState(false);

  const isAdmin = profile?.role === 'admin';

  // Load monthly summary records via RPC hr_monthly_attendance({ y, m })
  const loadMonthlyData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('hr_monthly_attendance', {
        y: selectedYear,
        m: selectedMonth,
      });

      if (rpcErr) throw rpcErr;
      setRecords(data || []);
    } catch (err: any) {
      console.error('Error fetching monthly attendance:', err);
      setError(err?.message || 'Failed to load monthly attendance report.');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadMonthlyData();
  }, [loadMonthlyData]);

  // Admin purge selfies older than 90 days
  const handlePurgeOldSelfies = async () => {
    setPurging(true);
    try {
      const { data, error: purgeErr } = await supabase.rpc('purge_old_selfies', {
        days: 90,
      });

      if (purgeErr) throw purgeErr;

      toast.success('Selfies older than 90 days have been purged successfully.');
      setShowPurgeModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Purge failed.');
    } finally {
      setPurging(false);
    }
  };

  // Bulk export all staff Job Cards
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number; type: 'pdf' | 'excel' } | null>(null);

  const handleBulkJobCards = async (exportType: 'pdf' | 'excel') => {
    const listToExport = filteredRecords.length > 0 ? filteredRecords : records;
    if (listToExport.length === 0) {
      toast.error('No staff records found to generate Job Cards.');
      return;
    }

    setBulkExporting(true);
    setBulkProgress({ current: 0, total: listToExport.length, type: exportType });

    try {
      const staffList: { staff: any; rows: JobCardRow[]; summary: JobCardSummary }[] = [];

      for (let i = 0; i < listToExport.length; i++) {
        const staff = listToExport[i];
        setBulkProgress({ current: i + 1, total: listToExport.length, type: exportType });

        const { data: sheetData, error: sheetErr } = await supabase.rpc('hr_staff_month_sheet', {
          target: staff.user_id,
          y: selectedYear,
          m: selectedMonth,
        });

        if (sheetErr) {
          console.warn(`Failed to fetch sheet for staff ${staff.employee_id}:`, sheetErr);
        }

        const { rows, summary } = transformRawRowsToJobCard(sheetData || [], selectedYear, selectedMonth);

        staffList.push({
          staff,
          rows,
          summary,
        });
      }

      if (exportType === 'pdf') {
        exportAllStaffJobCardsToPdf(staffList, selectedYear, selectedMonth, companyName);
        toast.success(`Exported ${staffList.length} Job Cards into PDF!`);
      } else {
        exportAllStaffJobCardsToExcel(staffList, selectedYear, selectedMonth, companyName);
        toast.success(`Exported ${staffList.length} Job Cards into Excel workbook!`);
      }
    } catch (err: any) {
      console.error('Bulk job card export error:', err);
      toast.error(err?.message || 'Failed to export job cards.');
    } finally {
      setBulkExporting(false);
      setBulkProgress(null);
    }
  };


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

  // Filtered records: Search by employee ID or name
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const target = `${r.full_name || ''} ${r.employee_id || ''}`.toLowerCase();
      return !searchQuery || target.includes(searchQuery.trim().toLowerCase());
    });
  }, [records, searchQuery]);

  // Totals calculations
  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let missingOut = 0;
    let totalMinutes = 0;

    filteredRecords.forEach((r) => {
      present += Number(r.days_present || 0);
      absent += Number(r.days_absent || 0);
      late += Number(r.days_late || 0);
      missingOut += Number(r.missing_out || 0);
      totalMinutes += Number(r.total_minutes || 0);
    });

    return {
      present,
      absent,
      late,
      missingOut,
      totalHours: minutesToHhMm(totalMinutes),
    };
  }, [filteredRecords]);

  // Navigate to person's monthly sheet
  const handleRowClick = (staffUserId: string) => {
    navigate(`/hr/attendance/${staffUserId}?y=${selectedYear}&m=${selectedMonth}`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#2BA5B5]">
                HR & Payroll Suite
              </span>
              <span className="text-xs font-bangla text-slate-400">/ মাসিক হাজিরা সামারি রিপোর্ট</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <Calendar className="w-8 h-8 text-[#0F8B8D]" />
              <span>Monthly Attendance Report</span>
            </h1>
            <p className="text-xs font-bangla text-slate-500 dark:text-slate-400 mt-0.5">
              সকল কর্মকর্তা-কর্মচারীর উপস্থিতি, অনুপস্থিতি, লেট ও মোট কর্মঘণ্টার খতিয়ান
            </p>
          </div>

          {/* Action Buttons: Print, Excel, PDF, All Job Cards, Purge */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || records.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Print A4 Landscape Attendance Report"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => exportMonthlyAttendanceToExcel(filteredRecords, selectedYear, selectedMonth, companyName)}
              disabled={loading || records.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#0c6e70] text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download Monthly Summary Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Summary Excel</span>
            </button>

            <button
              type="button"
              onClick={() => exportMonthlyAttendanceToPdf(filteredRecords, selectedYear, selectedMonth, companyName)}
              disabled={loading || records.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download Monthly Summary PDF (.pdf)"
            >
              <FileDown className="w-4 h-4" />
              <span>Summary PDF</span>
            </button>

            {/* Bulk All Staff Job Cards */}
            <div className="h-6 w-px bg-slate-300 dark:bg-white/20 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={() => handleBulkJobCards('pdf')}
              disabled={loading || bulkExporting || records.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download all staff Job Cards in a single multi-page PDF"
            >
              <FileDown className="w-4 h-4" />
              <span>All Job Cards (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => handleBulkJobCards('excel')}
              disabled={loading || bulkExporting || records.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Download multi-sheet Excel workbook with one sheet per staff member"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>All Job Cards (Excel)</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowPurgeModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="Delete selfie photos older than 90 days to free storage"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Purge Old Selfies (90d)</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadMonthlyData}
              disabled={loading}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Refresh monthly report"
              aria-label="Refresh monthly report"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Month Selector & Search Strip */}
        <div
          className={`p-4 rounded-3xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 ${
            isDark ? 'bg-[#103A40]/80 border-white/5' : 'bg-white border-slate-200'
          }`}
        >
          {/* Month & Year Controls */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-black/30 text-sm font-black text-slate-900 dark:text-white font-mono min-w-[160px] text-center border border-slate-200 dark:border-white/10">
              {monthName}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Employee ID or Name..."
              className={`w-full pl-10 pr-4 py-2 rounded-2xl border text-xs transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                isDark
                  ? 'bg-black/20 border-white/10 text-white placeholder-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Printable Paper View Header (Visible in Print Only) */}
        <div className="hidden print:block text-center mb-6">
          <h1 className="text-2xl font-black uppercase tracking-tight">{companyName}</h1>
          <p className="text-xs text-slate-600">Plot # 12, Road # 03, Sector # 01, Tongi I/A, Gazipur, Bangladesh</p>
          <h2 className="text-base font-extrabold uppercase mt-2 border-y py-1 tracking-wider">
            MONTHLY ATTENDANCE REPORT - {monthName.toUpperCase()}
          </h2>
        </div>

        {/* Main Monthly Attendance Table */}
        <div
          className={`rounded-3xl border shadow-xl overflow-hidden ${
            isDark ? 'bg-[#103A40]/80 border-white/5' : 'bg-white border-slate-200'
          }`}
        >
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#2BA5B5] mb-2" />
              <span className="text-xs font-medium">Calculating monthly attendance registers...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-rose-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No attendance records found for {monthName}.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 uppercase font-black tracking-wider bg-slate-50/50 dark:bg-black/20">
                    <th className="py-3 px-3">SL</th>
                    <th className="py-3 px-3">Employee ID</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Designation</th>
                    <th className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400">Present</th>
                    <th className="py-3 px-3 text-center text-rose-600 dark:text-rose-400">Absent</th>
                    <th className="py-3 px-3 text-center text-amber-600 dark:text-amber-400">Late</th>
                    <th className="py-3 px-3 text-center text-orange-600 dark:text-orange-400">Missing OUT</th>
                    <th className="py-3 px-3 text-center">Total Hours (hh:mm)</th>
                    <th className="py-3 px-3 text-center print:hidden">Job Card</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                  {filteredRecords.map((r, idx) => {
                    const hoursFormatted = minutesToHhMm(r.total_minutes);

                    return (
                      <tr
                        key={r.user_id}
                        onClick={() => handleRowClick(r.user_id)}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                        title="Click to open this person's detailed Monthly Attendance Sheet"
                      >
                        <td className="py-3 px-3 text-slate-400 font-mono font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/10 text-[#0F8B8D] dark:text-[#5EEAD4] border border-teal-500/20 group-hover:border-teal-500 group-hover:bg-teal-500/20 transition-all font-bold">
                            <span>{r.employee_id || '-'}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-slate-900 dark:text-white whitespace-nowrap">
                          {r.full_name || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {r.department || '-'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {r.designation || '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {r.days_present ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {r.days_absent ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                          {r.days_late ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                          {r.missing_out ?? 0}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-black whitespace-nowrap text-[#0F8B8D] dark:text-[#5EEAD4]">
                          {hoursFormatted}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap print:hidden" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleRowClick(r.user_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/10 hover:bg-[#0F8B8D] hover:text-white text-[#0F8B8D] dark:text-[#5EEAD4] border border-teal-500/20 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Open detailed Job Card"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Card</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals Summary Row */}
                  <tr className="bg-slate-100/90 dark:bg-black/40 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-white/20">
                    <td colSpan={5} className="py-3.5 px-4 uppercase tracking-wider text-right">
                      Grand Total ({filteredRecords.length} Staff):
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">
                      {totals.present}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-rose-600 dark:text-rose-400">
                      {totals.absent}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-amber-600 dark:text-amber-400">
                      {totals.late}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-orange-600 dark:text-orange-400">
                      {totals.missingOut}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-[#0F8B8D] dark:text-[#5EEAD4]">
                      {totals.totalHours}
                    </td>
                    <td className="py-3.5 px-3 print:hidden"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Printable Signature Lines (Visible in Print Only) */}
        <div className="hidden print:grid grid-cols-3 gap-8 mt-16 pt-8 text-center text-xs font-bold border-t border-slate-300">
          <div>
            <div className="w-48 mx-auto border-t border-slate-800 pt-1">Prepared by (HR)</div>
          </div>
          <div>
            <div className="w-48 mx-auto border-t border-slate-800 pt-1">Checked by</div>
          </div>
          <div>
            <div className="w-48 mx-auto border-t border-slate-800 pt-1">Approved by</div>
          </div>
        </div>
      </div>

      {/* Bulk Job Cards Export Progress Modal */}
      {bulkExporting && bulkProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 text-center ${
              isDark ? 'bg-[#103A40] border-teal-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-[#0F8B8D] dark:text-[#5EEAD4]">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h3 className="text-lg font-black tracking-tight mb-1">
              Generating All Job Cards
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Exporting {bulkProgress.type.toUpperCase()} ({bulkProgress.current} of {bulkProgress.total} staff)...
            </p>
            <div className="w-full bg-slate-200 dark:bg-black/30 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#0F8B8D] h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-2">
              {Math.round((bulkProgress.current / bulkProgress.total) * 100)}% Complete
            </p>
          </div>
        </div>
      )}


      {/* Admin Purge Old Selfies Confirmation Modal */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl p-6 transition-all ${
              isDark ? 'bg-[#103A40] border-rose-500/30 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3 text-rose-500 mb-3">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Purge Selfies Older Than 90 Days?</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              This action will permanently delete image files in the private bucket stored more than 90 days ago to optimize storage space.
              <strong className="block mt-1 font-bold text-slate-900 dark:text-white">
                All daily check-in timestamps, GPS coordinates, and monthly attendance figures will be safely preserved.
              </strong>
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowPurgeModal(false)}
                disabled={purging}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurgeOldSelfies}
                disabled={purging}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                {purging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default MonthlyAttendanceReport;
