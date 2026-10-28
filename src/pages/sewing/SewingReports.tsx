/**
 * Sewing Reports & Export Page
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReports.tsx)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports } from '../../lib/sewingQueries';
import {
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
  TrendingDown,
  TrendingUp,
  Check,
  Layers,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export const SewingReports: React.FC = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'daily' | 'range'>('daily');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSewingReports({
        date: viewMode === 'daily' ? date : undefined,
        unit: unitFilter,
      });
      setReports(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sewing reports.');
    } finally {
      setLoading(false);
    }
  }, [date, unitFilter, viewMode]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredLines = useMemo(() => {
    const list: any[] = [];
    reports.forEach((rep) => {
      if (viewMode === 'range') {
        if (rep.report_date < fromDate || rep.report_date > toDate) return;
      }

      (rep.lines || []).forEach((l: any) => {
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
    } catch {
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
    } catch {
      toast.error('Failed to export PDF.');
    }
  };

  const getCellBg = (val: any, target: any) => {
    if (!target || isNaN(Number(target)) || !val || isNaN(Number(val))) return '';
    const diff = Number(val) - Number(target);
    if (diff < 0) return isDark ? 'bg-red-950/60 text-red-200' : 'bg-[#FEE2E2] text-[#991B1B]';
    if (diff === 0) return isDark ? 'bg-emerald-950/60 text-emerald-200' : 'bg-[#DCFCE7] text-[#166534]';
    return isDark ? 'bg-amber-950/60 text-amber-200' : 'bg-[#FEF9C3] text-[#854D0E]';
  };

  const getCumColor = (cumAct: any, cumTgt: any) => {
    if (cumAct === null || cumTgt === null) return 'text-[#0F8B8D]';
    if (cumAct < cumTgt) return isDark ? 'text-red-400 font-bold' : 'text-red-700 font-bold';
    if (cumAct === cumTgt) return isDark ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold';
    return isDark ? 'text-amber-400 font-bold' : 'text-amber-700 font-bold';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Sewing Reports & Export</h1>
            <p className="text-sm text-[#475569] dark:text-slate-400 font-bangla mt-1">সুইং প্রোডাকশন রিপোর্ট, এক্সেল এবং পিডিএফ</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExcelExport} className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"><FileSpreadsheet className="w-4 h-4" /><span>Excel</span></button>
            <button onClick={handlePdfExport} className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0F8B8D] text-white hover:bg-[#0b686a] transition-colors cursor-pointer"><Download className="w-4 h-4" /><span>PDF</span></button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className={`p-4 rounded-2xl border shadow-soft-sm flex flex-wrap items-center justify-between gap-4 ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
              <button onClick={() => setViewMode('daily')} className={`px-3 py-1 text-xs font-semibold rounded-lg ${viewMode === 'daily' ? 'bg-[#2BA5B5] text-white' : 'text-slate-400'}`}>Daily</button>
              <button onClick={() => setViewMode('range')} className={`px-3 py-1 text-xs font-semibold rounded-lg ${viewMode === 'range' ? 'bg-[#2BA5B5] text-white' : 'text-slate-400'}`}>Range</button>
            </div>
            {viewMode === 'daily' ? (
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`px-3 py-1.5 text-xs rounded-xl border outline-none ${isDark ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`} />
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={`px-3 py-1.5 text-xs rounded-xl border outline-none ${isDark ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`} />
                <span>to</span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={`px-3 py-1.5 text-xs rounded-xl border outline-none ${isDark ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`} />
              </div>
            )}
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className={`px-3 py-1.5 text-xs rounded-xl border outline-none ${isDark ? 'bg-[#0B2E33] border-white/15' : 'bg-slate-50 border-slate-200'}`}>
              <option value="all">All Units</option>
              <option value="knit">Knit</option>
              <option value="woven">Woven</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`px-3 py-1.5 text-xs rounded-xl border outline-none w-48 sm:w-64 ${isDark ? 'bg-white/5 border-white/15' : 'bg-slate-50 border-slate-200'}`} />
          </div>
        </div>

        {/* Management Summary */}
        <div className={`p-6 rounded-3xl border shadow-soft-lg ${isDark ? 'bg-[#0D3137] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-current/15">
            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-[#2BA5B5]" /><h3 className="font-extrabold text-base">Management Summary · সারসংক্ষেপ</h3></div>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-current/20 hover:bg-current/10 cursor-pointer"><Printer className="w-3.5 h-3.5" /><span>Print</span></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['output', 'back', 'front', 'asm'].map((key) => {
              const partData = (daySummary.byPart as any)[key] || {};
              const hasTgt = partData.totalTarget !== null;
              return (
                <div key={key} className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase">{key}</span>
                    {hasTgt && <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${partData.status === 'short' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{partData.achievement}% Achieved</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div><span className="text-[10px] text-slate-400 uppercase">Target:</span><p className="font-extrabold">{partData.totalTarget ?? '-'}</p></div>
                    <div><span className="text-[10px] text-slate-400 uppercase">Actual:</span><p className="font-extrabold text-[#0F8B8D]">{partData.totalActual ?? '-'}</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Grid with Empty State */}
        {viewMode === 'daily' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading reports...</div>
            ) : filteredLines.length === 0 ? (
              <div className="bg-white dark:bg-[#103A40] rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center shadow-soft-sm">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-4 text-slate-400"><FileText className="w-8 h-8" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No reports found</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">There are no sewing production records for {date}. Start by entering production data in the Entry page.</p>
                <Link to="/sewing/report" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#0F8B8D] hover:bg-[#0b686a] rounded-xl transition-all shadow-sm"><ExternalLink className="w-4 h-4" />Go to Entry Page</Link>
              </div>
            ) : (
              filteredLines.map((line, idx) => {
                const parts = ['back', 'front', 'output', 'asm'];
                const breakdowns = parts.map(p => calculatePartHourlyBreakdown(line, p));

                return (
                  <div key={idx} className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#103A40] border-white/20' : 'bg-white border-[#1E293B]'}`}>
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-current/20">
                      <div className="flex items-center gap-3"><h3 className="font-extrabold text-sm text-[#0F8B8D]">Line 0{line.line_no}</h3><span className="text-xs text-slate-500">{line.buyer_name} · {line.style_no}</span></div>
                      <div className="text-xs font-mono font-bold">Working: {line.working_hours} hrs</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs font-mono" style={{ minWidth: '1300px', border: '1px solid #1E293B' }}>
                        <thead>
                          <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                            <th className="p-2 border border-[#1E293B] text-center" style={{ width: '80px' }}>Parts</th>
                            <th className="p-2 border border-[#1E293B] text-center" style={{ width: '80px' }}>Hr Tgt</th>
                            {Array.from({ length: 10 }).map((_, i) => <th key={i} className="p-1 border border-[#1E293B] text-center" style={{ width: '68px' }}>H{String(i + 1).padStart(2, '0')}</th>)}
                            <th className="p-2 border border-[#1E293B] text-center" style={{ width: '85px' }}>Total</th>
                            <th className="p-2 border border-[#1E293B] text-center" style={{ width: '100px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdowns.map((bd, bIdx) => (
                            <tr key={bIdx} className={isDark ? 'bg-[#0B2E33]/40' : 'bg-[#F8FAFC]'}>
                              <td className="p-2 border border-[#1E293B] font-extrabold text-center uppercase">{parts[bIdx]}</td>
                              <td className="p-2 border border-[#1E293B] text-center">{bd.metrics.hourTarget ?? '-'}</td>
                              {bd.hourly.map((hB: any, hIdx: number) => (
                                <td key={hIdx} className={`p-1 border border-[#1E293B] text-center ${getCellBg(hB.hourActual, bd.metrics.hourTarget)}`}>
                                  <div className="font-bold">{hB.hourActual ?? '-'}</div>
                                  <div className={`text-[9px] border-t border-dashed border-[#1E293B]/20 ${getCumColor(hB.cumActual, hB.cumTarget)}`}>{hB.cumActual ?? ''}</div>
                                </td>
                              ))}
                              <td className="p-2 border border-[#1E293B] text-center font-black">{bd.metrics.totalActual ?? '-'}</td>
                              <td className="p-2 border border-[#1E293B] text-center text-[10px] font-bold">{bd.metrics.achievement !== null ? `${bd.metrics.achievement}%` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SewingReports;
