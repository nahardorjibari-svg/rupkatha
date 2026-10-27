/**
 * Sewing Reports & Export Page
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReports.jsx)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports } from '../../lib/sewingQueries';
import { calculateLineHourTotals, calculateAchievement, formatNum } from '../../lib/sewingCalc';
import { exportSewingReportsToExcel } from '../../lib/exportExcel';
import { exportSewingReportsToPdf } from '../../lib/exportPdf';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Factory,
  Search,
  Printer,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SewingReports = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'range'
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSewingReports({
        date: viewMode === 'daily' ? date : undefined,
        unit: unitFilter,
        status: statusFilter,
      });
      setReports(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load sewing reports.');
    } finally {
      setLoading(false);
    }
  }, [date, unitFilter, statusFilter, viewMode]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Flatten and filter lines
  const filteredLines = useMemo(() => {
    const list = [];
    reports.forEach((rep) => {
      // If range mode, check date range
      if (viewMode === 'range') {
        if (rep.report_date < fromDate || rep.report_date > toDate) return;
      }

      (rep.lines || []).forEach((l) => {
        const buyer = (l.buyer_name || '').toLowerCase();
        const style = (l.style_no || '').toLowerCase();
        const lineStr = `line ${l.line_no}`.toLowerCase();
        const term = searchTerm.toLowerCase();

        if (!term || buyer.includes(term) || style.includes(term) || lineStr.includes(term)) {
          list.push({
            ...l,
            report_date: rep.report_date,
            factory_unit: rep.factory_unit,
            status: rep.status,
          });
        }
      });
    });
    return list;
  }, [reports, searchTerm, viewMode, fromDate, toDate]);

  const handleExcelExport = () => {
    try {
      exportSewingReportsToExcel({ reports, date: viewMode === 'daily' ? date : `${fromDate}_to_${toDate}`, unit: unitFilter });
      toast.success('Excel report downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export Excel.');
    }
  };

  const handlePdfExport = () => {
    try {
      exportSewingReportsToPdf({ reports, date: viewMode === 'daily' ? date : `${fromDate}_to_${toDate}`, unit: unitFilter });
      toast.success('PDF report downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export PDF.');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#2BA5B5]/10 text-[#2BA5B5] border border-[#2BA5B5]/30 mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>{companyName} · Production Reports &amp; Export</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sewing Reports &amp; Export
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 font-bangla mt-1">
              সুইং প্রোডাকশন রিপোর্ট, এক্সেল শিট এবং প্রিন্ট-ফ্রেন্ডলি পিডিএফ এক্সপোর্ট
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExcelExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePdfExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0F8B8D] text-white shadow-sm hover:bg-[#0b686a] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div
          className={`p-4 rounded-2xl border shadow-soft-sm flex flex-wrap items-center justify-between gap-4 transition-colors ${
            isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'daily' ? 'bg-[#2BA5B5] text-white shadow-xs' : 'text-[#475569] dark:text-slate-400'
                }`}
              >
                Daily Report
              </button>
              <button
                type="button"
                onClick={() => setViewMode('range')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'range' ? 'bg-[#2BA5B5] text-white shadow-xs' : 'text-[#475569] dark:text-slate-400'
                }`}
              >
                Date Range
              </button>
            </div>

            {viewMode === 'daily' ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2BA5B5]" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none ${
                    isDark ? 'bg-white/5 border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-4 h-4 text-[#2BA5B5]" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none ${
                    isDark ? 'bg-white/5 border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
                <span>to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none ${
                    isDark ? 'bg-white/5 border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            )}

            {/* Unit Filter */}
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-[#2BA5B5]" />
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none cursor-pointer ${
                  isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Units</option>
                <option value="knit">Knit Plant</option>
                <option value="woven">Woven Plant</option>
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#475569] dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search buyer, style, line..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none w-48 sm:w-64 ${
                isDark ? 'bg-white/5 border-white/15 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* EXCEL-STYLE TABLE VIEW */}
        <div className={`p-6 rounded-3xl border shadow-soft-lg overflow-hidden ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <div>
              <h3 className="font-bold text-base tracking-tight">{companyName} - Sewing Line Report Register</h3>
              <p className="text-xs text-[#475569] dark:text-slate-400">
                {viewMode === 'daily' ? `Date: ${date}` : `Range: ${fromDate} to ${toDate}`} · {filteredLines.length} Lines Listed
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/20 hover:bg-white/10 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print View</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-[#334155]'}`}>
                  <th className="py-3 px-3 font-bold">Line</th>
                  <th className="py-3 px-3 font-bold">Buyer</th>
                  <th className="py-3 px-3 font-bold">Style No</th>
                  <th className="py-3 px-3 font-bold text-center">OP / HP</th>
                  <th className="py-3 px-3 font-bold text-center">IR%</th>
                  <th className="py-3 px-3 font-bold text-center">Manpower</th>
                  <th className="py-3 px-3 font-bold text-center">Target</th>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <th key={i} className="py-3 px-2 font-bold text-center">H{i + 1}</th>
                  ))}
                  <th className="py-3 px-3 font-bold text-center">Total Output</th>
                  <th className="py-3 px-3 font-bold text-center">Ach%</th>
                  <th className="py-3 px-3 font-bold">ASM / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={21} className="py-12 text-center text-[#475569] dark:text-slate-400">
                      No matching sewing report records found.
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((l) => {
                    const hoursMap = {};
                    (l.hours || []).forEach((h) => {
                      hoursMap[h.hour_no] = h.output_qty ?? '-';
                    });
                    const { totalOutput } = calculateLineHourTotals(l.hours || []);
                    const ach = calculateAchievement(totalOutput, l.total_target);
                    const asms = Array.from(new Set((l.hours || []).map((h) => h.asm).filter(Boolean))).join(', ');

                    return (
                      <tr key={l.id} className={`hover:bg-white/5 transition-colors ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>
                        <td className="py-3 px-3 font-bold">
                          Line {l.line_no} <span className="text-[10px] text-[#2BA5B5]">({l.factory_unit})</span>
                        </td>
                        <td className="py-3 px-3 font-medium">{l.buyer_name || '-'}</td>
                        <td className="py-3 px-3 font-mono font-medium">{l.style_no || '-'}</td>
                        <td className="py-3 px-3 text-center font-mono">{l.op ?? '-'}/{l.hp ?? '-'}</td>
                        <td className="py-3 px-3 text-center font-mono">{l.ir ? `${l.ir}%` : '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-semibold">{l.manpower_total ?? '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-semibold">{l.total_target ?? '-'}</td>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <td key={i} className="py-3 px-2 text-center font-mono text-[#2BA5B5]">
                            {hoursMap[i + 1] ?? '-'}
                          </td>
                        ))}
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                          {totalOutput ?? '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          {ach !== null ? `${ach}%` : '-'}
                        </td>
                        <td className="py-3 px-3 max-w-xs truncate text-[#475569] dark:text-slate-400">
                          {asms ? <span className="font-semibold text-slate-200 mr-2">ASM: {asms}</span> : null}
                          {l.remarks || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIGNATURE BLOCK */}
        <div className={`p-6 rounded-3xl border shadow-soft-lg grid grid-cols-2 sm:grid-cols-5 gap-4 text-center ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
          {['Prepared By (Reporter)', 'Checked By (APM)', 'Approved By (PM)', 'Verified By (DGM)', 'Authorized By (GM)'].map((role) => (
            <div key={role} className="pt-6 border-t border-slate-400/40">
              <p className="text-xs font-bold text-slate-400">{role}</p>
              <p className="text-[10px] text-slate-400 mt-1">{companyName}</p>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default SewingReports;
