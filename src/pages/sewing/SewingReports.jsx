/**
 * Sewing Reports & Export Page
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReports.jsx)
 * Provides read-only grid with per-row Hour/Total targets, color coding,
 * Short/Excess and Remaining rows, line summaries, and Management Summary block.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports } from '../../lib/sewingQueries';
import {
  calculateLineHourTotals,
  calculateAchievement,
  calculatePartMetrics,
  calculatePartHourlyBreakdown,
  calculateManagementSummary,
  formatNum,
} from '../../lib/sewingCalc';
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
  AlertTriangle,
  Award,
  TrendingDown,
  TrendingUp,
  Check,
  Layers,
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

  // Management Summary
  const daySummary = useMemo(() => {
    return calculateManagementSummary(filteredLines);
  }, [filteredLines]);

  const handleExcelExport = () => {
    try {
      exportSewingReportsToExcel({
        reports,
        date: viewMode === 'daily' ? date : `${fromDate}_to_${toDate}`,
        unit: unitFilter,
      });
      toast.success('Excel report downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export Excel.');
    }
  };

  const handlePdfExport = () => {
    try {
      exportSewingReportsToPdf({
        reports,
        date: viewMode === 'daily' ? date : `${fromDate}_to_${toDate}`,
        unit: unitFilter,
      });
      toast.success('PDF report downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export PDF.');
    }
  };

  // Helper for cell colors
  const getCellBg = (val, target) => {
    if (val === null || val === undefined || val === '' || target === null || target === undefined || target === '' || isNaN(Number(target))) {
      return '';
    }
    const act = Number(val);
    const tgt = Number(target);
    const diff = act - tgt;
    if (diff < 0) {
      return isDark ? 'bg-red-950/60 text-red-200' : 'bg-[#FEE2E2] text-[#991B1B]';
    } else if (diff === 0) {
      return isDark ? 'bg-emerald-950/60 text-emerald-200' : 'bg-[#DCFCE7] text-[#166534]';
    } else {
      return isDark ? 'bg-amber-950/60 text-amber-200' : 'bg-[#FEF9C3] text-[#854D0E]';
    }
  };

  const getCumColor = (cumAct, cumTgt) => {
    if (cumAct === null || cumTgt === null) return 'text-[#0F8B8D] dark:text-[#2BA5B5]';
    if (cumAct < cumTgt) return isDark ? 'text-red-400 font-bold' : 'text-red-700 font-bold';
    if (cumAct === cumTgt) return isDark ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold';
    return isDark ? 'text-amber-400 font-bold' : 'text-amber-700 font-bold';
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
              সুইং প্রোডাকশন রিপোর্ট, ঘাটতি ট্র্যাকিং, এক্সেল শিট এবং প্রিন্ট-ফ্রেন্ডলি পিডিএফ
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
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'daily' ? 'bg-[#2BA5B5] text-white shadow-xs font-bold' : 'text-[#475569] dark:text-slate-400'
                }`}
              >
                Daily Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('range')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'range' ? 'bg-[#2BA5B5] text-white shadow-xs font-bold' : 'text-[#475569] dark:text-slate-400'
                }`}
              >
                Date Range Summary
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

          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#475569] dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search buyer, style, line..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none w-48 sm:w-64 ${
                isDark
                  ? 'bg-white/5 border-white/15 text-white placeholder-slate-400'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
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

        {/* MANAGEMENT SUMMARY BLOCK */}
        <div
          className={`p-6 rounded-3xl border shadow-soft-lg ${
            isDark ? 'bg-[#0D3137] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-current/15 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2BA5B5]" />
                <h3 className="font-extrabold text-base tracking-tight text-[#0F8B8D] dark:text-[#2BA5B5]">
                  Management Summary · সারসংক্ষেপ
                </h3>
              </div>
              <p className="text-xs text-[#475569] dark:text-slate-400">
                {viewMode === 'daily' ? `Date: ${date}` : `Date Range: ${fromDate} to ${toDate}`} · Total Targets &amp; Shortages
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-current/20 hover:bg-current/10 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print View</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'output', label: 'Out Put (সর্বমোট পোশাক)' },
              { key: 'back', label: 'Back Part (ব্যাক পার্ট)' },
              { key: 'front', label: 'Front Part (ফ্রন্ট পার্ট)' },
              { key: 'asm', label: 'A.S.M (অ্যাসেম্বলি)' },
            ].map(({ key, label }) => {
              const partData = daySummary.byPart[key] || {};
              const hasTgt = partData.totalTarget !== null;

              return (
                <div
                  key={key}
                  className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
                    {hasTgt ? (
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                          partData.status === 'short'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : partData.status === 'achieved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {partData.achievement !== null ? `${partData.achievement}% Achieved` : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">No Target</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Target:</span>
                      <p className="font-extrabold text-base">{partData.totalTarget !== null ? formatNum(partData.totalTarget) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Actual:</span>
                      <p className="font-extrabold text-base text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {partData.totalActual !== null ? formatNum(partData.totalActual) : '-'}
                      </p>
                    </div>
                  </div>

                  {hasTgt && (
                    <div className="mt-2.5 pt-2 border-t border-current/10 flex items-center justify-between text-xs font-semibold">
                      {partData.status === 'short' && (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                          <TrendingDown className="w-3.5 h-3.5" /> Short {formatNum(partData.shortQty)} pcs ({partData.shortPct}%)
                        </span>
                      )}
                      {partData.status === 'achieved' && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                          <Check className="w-3.5 h-3.5" /> 100% Target Met
                        </span>
                      )}
                      {partData.status === 'excess' && (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                          <TrendingUp className="w-3.5 h-3.5" /> Excess +{formatNum(partData.shortExcessQty)} pcs
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* VIEW MODE 1: DAILY READ-ONLY GRID WITH PER-ROW TARGETS, SHORT/EXCESS & REMAINING */}
        {viewMode === 'daily' ? (
          <div className="space-y-6">
            {filteredLines.map((line, idx) => {
              const backBreakdown = calculatePartHourlyBreakdown(line, 'back');
              const frontBreakdown = calculatePartHourlyBreakdown(line, 'front');
              const outputBreakdown = calculatePartHourlyBreakdown(line, 'output');
              const asmBreakdown = calculatePartHourlyBreakdown(line, 'asm');

              const outMetrics = outputBreakdown.metrics;
              const backMetrics = backBreakdown.metrics;
              const frontMetrics = frontBreakdown.metrics;
              const asmMetrics = asmBreakdown.metrics;

              const op = Number(line.op) || 0;
              const hp = Number(line.hp) || 0;
              const ir = Number(line.ir) || 0;
              const totalMp = op + hp + ir;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border shadow-sm ${
                    isDark ? 'bg-[#103A40] border-white/20 text-white' : 'bg-white border-[#1E293B] text-[#0F172A]'
                  }`}
                >
                  {/* Line Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-current/20 gap-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-extrabold text-sm uppercase text-[#0F8B8D] dark:text-[#2BA5B5]">
                        Line 0{line.line_no} ({line.factory_unit?.toUpperCase()})
                      </h3>
                      <span className="text-xs text-slate-500">
                        {line.buyer_name || '-'} · {line.style_no || '-'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <span>Working: {line.working_hours || 8} hrs</span>
                      <span>·</span>
                      <span>Total MP: {totalMp > 0 ? totalMp : '-'}</span>
                      {outMetrics.totalTarget !== null && (
                        <>
                          <span>·</span>
                          <span
                            className={
                              outMetrics.status === 'short'
                                ? 'text-rose-600 dark:text-rose-400'
                                : outMetrics.status === 'achieved'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            Target: {outMetrics.totalTarget} | Actual: {outMetrics.totalActual ?? 0} |{' '}
                            {outMetrics.status === 'short'
                              ? `Short ${Math.abs(outMetrics.shortExcessQty)} pcs (${outMetrics.shortPct}%)`
                              : outMetrics.status === 'achieved'
                              ? 'Achieved 100%'
                              : `Excess +${outMetrics.shortExcessQty} pcs`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Read-Only Grid */}
                  <div className="overflow-x-auto">
                    <table
                      className="w-full border-collapse text-xs font-mono"
                      style={{ tableLayout: 'fixed', minWidth: '1300px', border: '1px solid #1E293B' }}
                    >
                      <thead>
                        <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                          <th className="p-2 border border-[#1E293B] text-center" style={{ width: '80px' }}>Parts</th>
                          <th className="p-2 border border-[#1E293B] text-center" style={{ width: '80px' }}>Hour Target</th>
                          <th className="p-2 border border-[#1E293B] text-center" style={{ width: '80px' }}>Total Target</th>
                          {Array.from({ length: 10 }).map((_, i) => (
                            <th key={i} className="p-1 border border-[#1E293B] text-center" style={{ width: '68px' }}>
                              <div>H{String(i + 1).padStart(2, '0')}</div>
                            </th>
                          ))}
                          <th className="p-2 border border-[#1E293B] text-center" style={{ width: '85px' }}>Total</th>
                          <th className="p-2 border border-[#1E293B] text-center" style={{ width: '120px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 1. BACK */}
                        <tr className={isDark ? 'bg-[#0B2E33]/40' : 'bg-[#F8FAFC]'}>
                          <td className="p-2 border border-[#1E293B] font-extrabold text-center">Back</td>
                          <td className="p-2 border border-[#1E293B] text-center font-bold">{backMetrics.hourTarget ?? '-'}</td>
                          <td className="p-2 border border-[#1E293B] text-center font-black">{backMetrics.totalTarget ?? '-'}</td>
                          {backBreakdown.hourly.map((hB, hIdx) => {
                            const bg = getCellBg(hB.hourActual, backMetrics.hourTarget);
                            const cumColor = getCumColor(hB.cumActual, hB.cumTarget);
                            return (
                              <td key={hIdx} className={`p-1 border border-[#1E293B] text-center ${bg}`}>
                                <div className="font-bold">{hB.hourActual !== null ? hB.hourActual : '-'}</div>
                                <div className={`text-[9px] mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 ${cumColor}`}>
                                  {hB.cumActual !== null ? `Σ ${hB.cumActual}` : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 border border-[#1E293B] text-center font-black">
                            {backMetrics.totalActual ?? '-'}
                          </td>
                          <td className="p-2 border border-[#1E293B] text-center text-[10px]">
                            {backMetrics.achievement !== null ? `${backMetrics.achievement}%` : '-'}
                          </td>
                        </tr>

                        {/* 2. FRONT */}
                        <tr className={isDark ? 'bg-[#0B2E33]/60' : 'bg-[#F1F5F9]'}>
                          <td className="p-2 border border-[#1E293B] font-extrabold text-center">Front</td>
                          <td className="p-2 border border-[#1E293B] text-center font-bold">{frontMetrics.hourTarget ?? '-'}</td>
                          <td className="p-2 border border-[#1E293B] text-center font-black">{frontMetrics.totalTarget ?? '-'}</td>
                          {frontBreakdown.hourly.map((hB, hIdx) => {
                            const bg = getCellBg(hB.hourActual, frontMetrics.hourTarget);
                            const cumColor = getCumColor(hB.cumActual, hB.cumTarget);
                            return (
                              <td key={hIdx} className={`p-1 border border-[#1E293B] text-center ${bg}`}>
                                <div className="font-bold">{hB.hourActual !== null ? hB.hourActual : '-'}</div>
                                <div className={`text-[9px] mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 ${cumColor}`}>
                                  {hB.cumActual !== null ? `Σ ${hB.cumActual}` : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 border border-[#1E293B] text-center font-black">
                            {frontMetrics.totalActual ?? '-'}
                          </td>
                          <td className="p-2 border border-[#1E293B] text-center text-[10px]">
                            {frontMetrics.achievement !== null ? `${frontMetrics.achievement}%` : '-'}
                          </td>
                        </tr>

                        {/* 3. OUT PUT */}
                        <tr className={isDark ? 'bg-[#103A40]/80' : 'bg-[#ECFEFF]'}>
                          <td className="p-2 border border-[#1E293B] font-extrabold text-center text-[#0F8B8D]">Out Put</td>
                          <td className="p-2 border border-[#1E293B] text-center font-bold text-[#0F8B8D]">{outMetrics.hourTarget ?? '-'}</td>
                          <td className="p-2 border border-[#1E293B] text-center font-black text-[#0F8B8D]">{outMetrics.totalTarget ?? '-'}</td>
                          {outputBreakdown.hourly.map((hB, hIdx) => {
                            const bg = getCellBg(hB.hourActual, outMetrics.hourTarget);
                            const cumColor = getCumColor(hB.cumActual, hB.cumTarget);
                            return (
                              <td key={hIdx} className={`p-1 border border-[#1E293B] text-center ${bg}`}>
                                <div className="font-extrabold">{hB.hourActual !== null ? hB.hourActual : '-'}</div>
                                <div className={`text-[9px] mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 ${cumColor}`}>
                                  {hB.cumActual !== null ? `Σ ${hB.cumActual}` : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 border border-[#1E293B] text-center font-black text-[#0F8B8D]">
                            {outMetrics.totalActual ?? '-'}
                          </td>
                          <td className="p-2 border border-[#1E293B] text-center text-[10px] font-bold">
                            {outMetrics.status === 'short' && (
                              <span className="text-rose-600 dark:text-rose-400">Short {outMetrics.shortPct}%</span>
                            )}
                            {outMetrics.status === 'achieved' && (
                              <span className="text-emerald-600 dark:text-emerald-400">100% Achieved</span>
                            )}
                            {outMetrics.status === 'excess' && (
                              <span className="text-amber-600 dark:text-amber-400">+{outMetrics.shortExcessQty} pcs</span>
                            )}
                            {outMetrics.status === 'no_target' && <span className="text-slate-400">No Target</span>}
                          </td>
                        </tr>

                        {/* 4. A.S.M */}
                        <tr className={isDark ? 'bg-[#2A2415]/60' : 'bg-[#FFFBEB]'}>
                          <td className="p-2 border border-[#1E293B] font-extrabold text-center">A.S.M</td>
                          <td className="p-2 border border-[#1E293B] text-center font-bold">{asmMetrics.hourTarget ?? '-'}</td>
                          <td className="p-2 border border-[#1E293B] text-center font-black">{asmMetrics.totalTarget ?? '-'}</td>
                          {asmBreakdown.hourly.map((hB, hIdx) => {
                            const bg = getCellBg(hB.hourActual, asmMetrics.hourTarget);
                            const cumColor = getCumColor(hB.cumActual, hB.cumTarget);
                            return (
                              <td key={hIdx} className={`p-1 border border-[#1E293B] text-center ${bg}`}>
                                <div className="font-bold">{hB.hourActual !== null ? hB.hourActual : '-'}</div>
                                <div className={`text-[9px] mt-0.5 border-t border-dashed border-[#1E293B]/20 pt-0.5 ${cumColor}`}>
                                  {hB.cumActual !== null ? `Σ ${hB.cumActual}` : ''}
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 border border-[#1E293B] text-center font-black">
                            {asmMetrics.totalActual ?? '-'}
                          </td>
                          <td className="p-2 border border-[#1E293B] text-center text-[10px] font-bold">
                            {asmMetrics.status === 'short' && (
                              <span className="text-rose-600 dark:text-rose-400">Short {asmMetrics.shortPct}%</span>
                            )}
                            {asmMetrics.status === 'achieved' && (
                              <span className="text-emerald-600 dark:text-emerald-400">100% Achieved</span>
                            )}
                            {asmMetrics.status === 'excess' && (
                              <span className="text-amber-600 dark:text-amber-400">+{asmMetrics.shortExcessQty} pcs</span>
                            )}
                            {asmMetrics.status === 'no_target' && <span className="text-slate-400">No Target</span>}
                          </td>
                        </tr>

                        {/* GROUP 1: HOUR SHORT / EXCESS (প্রতি ঘণ্টা) - Main, bold, placed first */}
                        {['back', 'front', 'output', 'asm'].map((pKey, pIdx) => {
                          const breakdown =
                            pKey === 'back'
                              ? backBreakdown
                              : pKey === 'front'
                              ? frontBreakdown
                              : pKey === 'asm'
                              ? asmBreakdown
                              : outputBreakdown;
                          const partLabel =
                            pKey === 'back'
                              ? 'Back'
                              : pKey === 'front'
                              ? 'Front'
                              : pKey === 'asm'
                              ? 'A.S.M'
                              : 'Out Put';
                          const stripeClass =
                            pKey === 'back'
                              ? 'border-l-4 border-blue-500 text-blue-600 dark:text-blue-400'
                              : pKey === 'front'
                              ? 'border-l-4 border-purple-500 text-purple-600 dark:text-purple-400'
                              : pKey === 'asm'
                              ? 'border-l-4 border-amber-500 text-amber-600 dark:text-amber-400'
                              : 'border-l-4 border-[#0F8B8D] text-[#0F8B8D] dark:text-[#2BA5B5]';
                          const m = breakdown.metrics;

                          return (
                            <tr key={`rep_hour_short_${pKey}`} className="bg-rose-500/10 font-mono">
                              <td className={`p-1.5 border border-[#1E293B] text-center font-extrabold text-xs ${stripeClass}`}>
                                {partLabel} Short/Excess (Hr)
                              </td>
                              <td className="p-1 border border-[#1E293B] text-center font-mono text-slate-400 text-xs">-</td>
                              <td className="p-1 border border-[#1E293B] text-center font-mono text-slate-400 text-xs">-</td>
                              {breakdown.hourly.map((hB, hIdx) => {
                                const diff = hB.hourDiff;
                                let color = 'text-slate-400';
                                let text = '-';
                                if (diff !== null) {
                                  if (diff < 0) {
                                    text = `${diff}`;
                                    color = isDark ? 'bg-rose-950/70 text-rose-300 font-black' : 'bg-rose-100 text-rose-700 font-black';
                                  } else if (diff === 0) {
                                    text = '0';
                                    color = isDark ? 'bg-emerald-950/70 text-emerald-300 font-black' : 'bg-emerald-100 text-emerald-700 font-black';
                                  } else {
                                    text = `+${diff}`;
                                    color = isDark ? 'bg-amber-950/70 text-amber-300 font-black' : 'bg-amber-100 text-amber-700 font-black';
                                  }
                                }
                                return (
                                  <td
                                    key={hIdx}
                                    title={hB.tooltip || undefined}
                                    className={`p-1 border border-[#1E293B] text-center font-mono text-xs ${color}`}
                                  >
                                    {text}
                                  </td>
                                );
                              })}
                              <td className="p-1 border border-[#1E293B] text-center font-black text-xs align-middle">
                                {breakdown.sumHourDiff !== null ? (
                                  breakdown.sumHourDiff < 0 ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-black">{breakdown.sumHourDiff}</span>
                                  ) : breakdown.sumHourDiff === 0 ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-black">0</span>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-black">+{breakdown.sumHourDiff}</span>
                                  )
                                ) : (
                                  '-'
                                )}
                                {breakdown.missingHoursCount > 0 && breakdown.enteredHoursCount > 0 && (
                                  <div className="text-[9px] text-slate-400 font-normal leading-tight mt-0.5 font-sans">
                                    {breakdown.missingHoursCount} hrs not entered
                                  </div>
                                )}
                              </td>
                              <td className="p-1 border border-[#1E293B] text-center text-[10px] text-slate-400">
                                {m.shortPct ? `Short ${m.shortPct}%` : m.status === 'achieved' ? '100% Achieved' : ''}
                              </td>
                            </tr>
                          );
                        })}

                        {/* GROUP 2: RUNNING SHORT / EXCESS (জমা) - Smaller, muted text */}
                        {['back', 'front', 'output', 'asm'].map((pKey, pIdx) => {
                          const breakdown =
                            pKey === 'back'
                              ? backBreakdown
                              : pKey === 'front'
                              ? frontBreakdown
                              : pKey === 'asm'
                              ? asmBreakdown
                              : outputBreakdown;
                          const partLabel =
                            pKey === 'back'
                              ? 'Back'
                              : pKey === 'front'
                              ? 'Front'
                              : pKey === 'asm'
                              ? 'A.S.M'
                              : 'Out Put';
                          const stripeClass =
                            pKey === 'back'
                              ? 'border-l-2 border-blue-400 text-blue-500'
                              : pKey === 'front'
                              ? 'border-l-2 border-purple-400 text-purple-500'
                              : pKey === 'asm'
                              ? 'border-l-2 border-amber-400 text-amber-500'
                              : 'border-l-2 border-[#0F8B8D]/80 text-[#0F8B8D]';
                          const m = breakdown.metrics;

                          return (
                            <tr key={`rep_run_short_${pKey}`} className="bg-slate-500/5 font-mono text-[10px] opacity-85">
                              <td className={`p-1 border border-[#1E293B] text-center font-bold ${stripeClass}`}>
                                {partLabel} Running (জমা)
                              </td>
                              <td className="p-1 border border-[#1E293B] text-center font-mono text-slate-400">-</td>
                              <td className="p-1 border border-[#1E293B] text-center font-mono text-slate-400">-</td>
                              {breakdown.hourly.map((hB, hIdx) => {
                                const s = hB.shortExcess;
                                let color = 'text-slate-400';
                                let text = '-';
                                if (s !== null) {
                                  if (s < 0) {
                                    text = `${s}`;
                                    color = 'text-rose-600/80 dark:text-rose-400/80 font-bold';
                                  } else if (s === 0) {
                                    text = '0';
                                    color = 'text-emerald-600/80 dark:text-emerald-400/80 font-bold';
                                  } else {
                                    text = `+${s}`;
                                    color = 'text-amber-600/80 dark:text-amber-400/80 font-bold';
                                  }
                                }
                                return (
                                  <td key={hIdx} className={`p-1 border border-[#1E293B] text-center font-mono ${color}`}>
                                    {text}
                                  </td>
                                );
                              })}
                              <td className="p-1 border border-[#1E293B] text-center font-bold">
                                {m.shortExcessQty !== null ? (
                                  m.shortExcessQty < 0 ? (
                                    <span className="text-rose-600/80 dark:text-rose-400/80">{m.shortExcessQty}</span>
                                  ) : m.shortExcessQty === 0 ? (
                                    <span className="text-emerald-600/80 dark:text-emerald-400/80">0</span>
                                  ) : (
                                    <span className="text-amber-600/80 dark:text-amber-400/80">+{m.shortExcessQty}</span>
                                  )
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="p-1 border border-[#1E293B] text-center text-[9px] text-slate-400">
                                Cumulative
                              </td>
                            </tr>
                          );
                        })}

                        {/* REMAINING ROWS */}
                        {['back', 'front', 'output', 'asm'].map((pKey) => {
                          const breakdown =
                            pKey === 'back'
                              ? backBreakdown
                              : pKey === 'front'
                              ? frontBreakdown
                              : pKey === 'asm'
                              ? asmBreakdown
                              : outputBreakdown;
                          const partLabel =
                            pKey === 'back'
                              ? 'Back'
                              : pKey === 'front'
                              ? 'Front'
                              : pKey === 'asm'
                              ? 'A.S.M'
                              : 'Out Put';
                          const m = breakdown.metrics;

                          return (
                            <tr key={`rep_rem_${pKey}`} className="bg-blue-500/5">
                              <td className="p-1 border border-[#1E293B] text-center font-bold text-[11px] text-blue-600 dark:text-blue-400">
                                {partLabel} Remaining
                              </td>
                              <td className="p-1 border border-[#1E293B] text-center font-mono text-slate-400">-</td>
                              <td className="p-1 border border-[#1E293B] text-center font-mono text-slate-400">-</td>
                              {breakdown.hourly.map((hB, hIdx) => (
                                <td key={hIdx} className="p-1 border border-[#1E293B] text-center font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                  {hB.remaining !== null ? hB.remaining : '-'}
                                </td>
                              ))}
                              <td className="p-1 border border-[#1E293B] text-center font-black font-mono">
                                {m.totalTarget !== null ? Math.max(0, m.totalTarget - (m.totalActual || 0)) : '-'}
                              </td>
                              <td className="p-1 border border-[#1E293B] text-center text-[10px] text-slate-400"></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VIEW MODE 2: DATE-RANGE SUMMARY TABLE */
          <div className={`p-6 rounded-3xl border shadow-soft-lg ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <h3 className="font-bold text-base tracking-tight">Date-Range Performance &amp; Shortage Summary</h3>
              <span className="text-xs font-bold text-[#2BA5B5]">{filteredLines.length} Lines Listed</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-[#334155]'}`}>
                    <th className="py-3 px-3 font-bold">Date / Unit</th>
                    <th className="py-3 px-3 font-bold">Line</th>
                    <th className="py-3 px-3 font-bold">Buyer &amp; Style</th>
                    <th className="py-3 px-3 font-bold text-center">Working Hrs</th>
                    <th className="py-3 px-3 font-bold text-center">Out Put Target</th>
                    <th className="py-3 px-3 font-bold text-center">Actual Output</th>
                    <th className="py-3 px-3 font-bold text-center">Short / Excess</th>
                    <th className="py-3 px-3 font-bold text-center">Achievement %</th>
                    <th className="py-3 px-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[#475569] dark:text-slate-400">
                        No records found for this date range.
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((l, i) => {
                      const m = calculatePartMetrics(l, 'output');
                      return (
                        <tr key={i} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-mono">{l.report_date} ({l.factory_unit})</td>
                          <td className="py-3 px-3 font-bold">Line 0{l.line_no}</td>
                          <td className="py-3 px-3">{l.buyer_name || '-'} · {l.style_no || '-'}</td>
                          <td className="py-3 px-3 text-center font-mono">{m.workingHours} hrs</td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            {m.totalTarget !== null ? formatNum(m.totalTarget) : '-'}
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono text-[#0F8B8D] dark:text-[#2BA5B5]">
                            {m.totalActual !== null ? formatNum(m.totalActual) : '-'}
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            {m.shortExcessQty !== null ? (
                              m.shortExcessQty < 0 ? (
                                <span className="text-rose-600 dark:text-rose-400">{m.shortExcessQty} pcs</span>
                              ) : m.shortExcessQty === 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400">0</span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400">+{m.shortExcessQty} pcs</span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            {m.achievement !== null ? `${m.achievement}%` : '-'}
                          </td>
                          <td className="py-3 px-3">
                            {m.totalTarget !== null ? (
                              m.status === 'short' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300">
                                  SHORT {m.shortPct}%
                                </span>
                              ) : m.status === 'achieved' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                                  ACHIEVED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300">
                                  EXCESS +{m.shortExcessQty}
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400 text-[11px]">No Target</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SewingReports;
