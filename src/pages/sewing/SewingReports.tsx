/**
 * Sewing Reports & Export Page
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingReports.tsx)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports, fetchHourLocks } from '../../lib/sewingQueries';
import { fetchFinishingReports } from '../../lib/finishingQueries';
import {
  calculatePartHourlyBreakdown,
  calculateManagementSummary,
  calculatePartMetrics,
  formatNum,
} from '../../lib/sewingCalc';
import { fetchEditLogs } from '../../lib/sewingQueries';
import { fetchFinishingEditLogs } from '../../lib/finishingQueries';
import {
  History,
  X,
} from 'lucide-react';
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
  Lock,
  Target,
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
  const [finishingReports, setFinishingReports] = useState<any[]>([]);
  const [hourLocks, setHourLocks] = useState<any[]>([]);
  const [editLogs, setEditLogs] = useState<any[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sewingData, finishingData] = await Promise.all([
        fetchSewingReports({
          date: viewMode === 'daily' ? date : undefined,
          unit: unitFilter === 'all' ? undefined : unitFilter,
        }),
        fetchFinishingReports({
          date: viewMode === 'daily' ? date : undefined,
          unit: unitFilter === 'all' ? undefined : unitFilter,
        })
      ]);
      setReports(sewingData || []);
      setFinishingReports(finishingData || []);
      
      // Fetch locks and logs
      const allSewingLocks: any[] = [];
      const allLogs: any[] = [];
      
      for (const r of (sewingData || [])) {
        const [lks, logs] = await Promise.all([fetchHourLocks(r.id), fetchEditLogs(r.id)]);
        allSewingLocks.push(...lks);
        allLogs.push(...logs.map((l: any) => ({ ...l, type: 'Sewing' })));
      }
      
      for (const r of (finishingData || [])) {
        const logs = await fetchFinishingEditLogs(r.id);
        allLogs.push(...logs.map((l: any) => ({ ...l, type: 'Finishing' })));
      }
      
      setHourLocks(allSewingLocks);
      setEditLogs(allLogs.sort((a, b) => new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime()));

    } catch (err: any) {
      setError(err?.message || 'Failed to load reports.');
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

  const filteredFinishingLines = useMemo(() => {
    const list: any[] = [];
    finishingReports.forEach((rep) => {
      if (viewMode === 'range') {
        if (rep.report_date < fromDate || rep.report_date > toDate) return;
      }

      (rep.lines || []).forEach((l: any) => {
        const buyer = (l.buyer_name || '').toLowerCase();
        const style = (l.style_no || '').toLowerCase();
        const term = searchTerm.toLowerCase();

        if (!term || buyer.includes(term) || style.includes(term)) {
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
  }, [finishingReports, searchTerm, viewMode, fromDate, toDate]);

  const daySummary = useMemo(() => {
    return calculateManagementSummary(filteredLines);
  }, [filteredLines]);

  const finishingDaySummary = useMemo(() => {
    return calculateManagementSummary(filteredFinishingLines);
  }, [filteredFinishingLines]);

  const FIELD_LABEL_MAP: Record<string, string> = {
    back_hour_target: 'Back hour target',
    front_hour_target: 'Front hour target',
    output_hour_target: 'Out Put hour target',
    asm_hour_target: 'A.S.M hour target',
    back_qty: 'Back Qty / Inside',
    front_qty: 'Front Qty / Iron',
    output_qty: 'Out Put Qty / Top Side',
    asm: 'A.S.M / Poly',
    buyer_name: 'Buyer Name',
    style_no: 'Style No',
    remarks: 'Remarks',
    order_qty: 'Order Qty',
  };

  const handleExcelExport = () => {
    try {
      exportSewingReportsToExcel({
        reports,
        finishingReports,
        editLogs,
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
        finishingReports,
        editLogs,
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
            <button onClick={() => setShowHistoryDrawer(true)} className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors cursor-pointer"><History className="w-4 h-4" /><span>History</span></button>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {['output', 'back', 'front', 'asm'].map((key) => {
              const partData = (daySummary.byPart as any)[key] || {};
              const hasTgt = partData.totalTarget !== null;
              const labels: Record<string, string> = { output: 'Sewing Output', back: 'Back Part', front: 'Front Part', asm: 'A.S.M' };
              return (
                <div key={key} className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{labels[key]}</span>
                    {hasTgt && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${partData.status === 'short' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{partData.achievement}%</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div><span className="text-[9px] text-slate-500 uppercase">Target:</span><p className="font-extrabold">{partData.totalTarget ?? '-'}</p></div>
                    <div><span className="text-[9px] text-slate-500 uppercase">Actual:</span><p className="font-extrabold text-[#0F8B8D]">{partData.totalActual ?? '-'}</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {['output', 'back', 'front', 'asm'].map((key) => {
              const partData = (finishingDaySummary.byPart as any)[key] || {};
              const hasTgt = partData.totalTarget !== null;
              const labels: Record<string, string> = { output: 'Top Side', back: 'Inside', front: 'Iron', asm: 'Poly' };
              return (
                <div key={`fin-${key}`} className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Finishing: {labels[key]}</span>
                    {hasTgt && <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${partData.status === 'short' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{partData.achievement}%</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div><span className="text-[9px] text-slate-500 uppercase">Target:</span><p className="font-extrabold">{partData.totalTarget ?? '-'}</p></div>
                    <div><span className="text-[9px] text-slate-500 uppercase">Actual:</span><p className="font-extrabold text-[#D97706]">{partData.totalActual ?? '-'}</p></div>
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
            ) : filteredLines.length === 0 && filteredFinishingLines.length === 0 ? (
              <div className="bg-white dark:bg-[#103A40] rounded-2xl border border-slate-200 dark:border-white/10 p-12 text-center shadow-soft-sm">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-4 text-slate-400"><FileText className="w-8 h-8" /></div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No reports found</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">There are no production records for {date}. Start by entering production data in the Entry page.</p>
                <Link to="/sewing/report" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#0F8B8D] hover:bg-[#0b686a] rounded-xl transition-all shadow-sm"><ExternalLink className="w-4 h-4" />Go to Entry Page</Link>
              </div>
            ) : (
              <>
                {/* Legend above line cards */}
                <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 w-fit text-xs font-bold text-emerald-800 dark:text-emerald-300 print:border-[#16A34A] print:text-black">
                  <div className="w-3.5 h-3.5 rounded bg-[#16A34A] border border-[#15803D] shrink-0 print:bg-[#16A34A]" />
                  <span>OUT PUT = final production (চূড়ান্ত উৎপাদন)</span>
                </div>

                {filteredLines.map((line, idx) => {
                  const parts = [
                    { id: 'back', label: 'BACK' },
                    { id: 'front', label: 'FRONT' },
                    { id: 'output', label: 'OUT PUT' },
                    { id: 'asm', label: 'A.S.M' },
                  ];
                  const breakdowns = parts.map(p => calculatePartHourlyBreakdown(line, p.id));
                  const totalManpower = Number(line.op || 0) + Number(line.hp || 0) + Number(line.ir || 0);

                  return (
                    <div key={idx} className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#103A40] border-white/20' : 'bg-white border-[#1E293B]'}`}>
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-current/20">
                        <div className="flex items-center gap-3">
                           <h3 className="font-extrabold text-sm text-[#0F8B8D]">Line 0{line.line_no} (Sewing)</h3>
                           <span className="text-xs text-slate-500">{line.report_date} · {line.factory_unit?.toUpperCase()} · {line.buyer_name} · {line.style_no}</span>
                        </div>
                        <div className="text-xs font-mono font-bold">Working: {line.working_hours} hrs</div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', minWidth: '1300px', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'}` }}>
                          <colgroup>
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '6%' }} />
                            {[...Array(10)].map((_, i) => (
                              <col key={i} style={{ width: '5.2%' }} />
                            ))}
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '10%' }} />
                          </colgroup>
                          <thead>
                            <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#F1F5F9] text-[#0F172A]'}>
                              <th className="p-2 border border-[#1E293B] text-center">Info</th>
                              <th className="p-2 border border-[#1E293B] text-center">Parts</th>
                              <th className="p-2 border border-[#1E293B] text-center leading-tight">Hr<br/>Tgt</th>
                              <th className="p-2 border border-[#1E293B] text-center leading-tight">Tot<br/>Tgt</th>
                              {Array.from({ length: 10 }).map((_, i) => <th key={i} className="p-1 border border-[#1E293B] text-center">H{String(i + 1).padStart(2, '0')}</th>)}
                              <th className="p-2 border border-[#1E293B] text-center">Total</th>
                              <th className="p-2 border border-[#1E293B] text-center">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* MAIN ROWS */}
                            {breakdowns.map((bd, bIdx) => {
                              const isOutput = parts[bIdx].id === 'output';
                              return (
                                <tr 
                                  key={bIdx} 
                                  className={`border-b-[1.5px] ${isOutput ? (isDark ? 'bg-[rgba(34,197,94,0.22)] print:bg-[#DCFCE7]' : 'bg-[#DCFCE7] print:bg-[#DCFCE7]') : ''}`} 
                                  style={{ 
                                    borderColor: isOutput ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'),
                                    borderTop: isOutput ? '3px solid #16A34A' : undefined,
                                    borderBottom: isOutput ? '3px solid #16A34A' : undefined,
                                    height: isOutput ? '56px' : undefined,
                                  }}
                                >
                                  {bIdx === 0 && (
                                    <td rowSpan={4} className="border-r-[1.5px] p-2 text-left bg-slate-50 dark:bg-black/20" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>
                                       <div className="flex flex-col gap-1">
                                          <div><span className="text-[9px] text-slate-400 uppercase">Buyer:</span><div className="font-bold truncate">{line.buyer_name}</div></div>
                                          <div><span className="text-[9px] text-slate-400 uppercase">Style:</span><div className="font-bold truncate">{line.style_no}</div></div>
                                          <div><span className="text-[9px] text-slate-400 uppercase">M.P:</span><div className="font-black text-[#0F8B8D]">Tot: {totalManpower}</div></div>
                                       </div>
                                    </td>
                                  )}
                                  <td 
                                    className={`p-2 border-r-[1.5px] font-extrabold text-center uppercase relative ${isOutput ? 'bg-[#16A34A] text-white border-l-[6px] border-l-[#16A34A] print:bg-[#16A34A] print:text-white' : ''}`} 
                                    style={{ 
                                      borderColor: isOutput ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'),
                                      borderTop: isOutput ? '3px solid #16A34A' : undefined,
                                      borderBottom: isOutput ? '3px solid #16A34A' : undefined,
                                      backgroundColor: isOutput ? '#16A34A' : undefined,
                                    }}
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      {isOutput && <Target className="w-3.5 h-3.5 text-white shrink-0" />}
                                      <span className={isOutput ? 'text-white text-xs font-[900] tracking-wide' : ''}>{parts[bIdx].label}</span>
                                    </div>
                                  </td>
                                  <td 
                                    className={`p-2 border-r-[1.5px] text-center ${isOutput ? 'font-[900] text-sm' : ''}`} 
                                    style={{ 
                                      borderColor: isOutput ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'),
                                      borderTop: isOutput ? '3px solid #16A34A' : undefined,
                                      borderBottom: isOutput ? '3px solid #16A34A' : undefined,
                                    }}
                                  >
                                    {bd.metrics.hourTarget ?? '-'}
                                  </td>
                                  <td 
                                    className={`p-2 border-r-[1.5px] text-center font-black ${isOutput ? 'text-emerald-800 dark:text-emerald-300 text-sm' : 'text-[#0F8B8D]'}`} 
                                    style={{ 
                                      borderColor: isOutput ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'),
                                      borderTop: isOutput ? '3px solid #16A34A' : undefined,
                                      borderBottom: isOutput ? '3px solid #16A34A' : undefined,
                                    }}
                                  >
                                    {bd.metrics.totalTarget ?? '-'}
                                  </td>
                                  {bd.hourly.map((hB: any, hIdx: number) => (
                                    <td 
                                      key={hIdx} 
                                      className={`p-1 border-r-[1.5px] text-center ${getCellBg(hB.hourActual, bd.metrics.hourTarget)}`} 
                                      style={{ 
                                        borderColor: isOutput ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'),
                                        borderTop: isOutput ? '3px solid #16A34A' : undefined,
                                        borderBottom: isOutput ? '3px solid #16A34A' : undefined,
                                      }}
                                    >
                                      <div className={`leading-none ${isOutput ? 'font-[900] text-sm' : 'font-bold'}`}>{hB.hourActual ?? '-'}</div>
                                      <div className={`text-[9px] border-t border-dashed border-current/20 mt-0.5 pt-0.5 ${getCumColor(hB.cumActual, hB.cumTarget)} ${isOutput ? 'font-black' : ''}`}>{hB.cumActual !== null ? `Σ${hB.cumActual}` : ''}</div>
                                    </td>
                                  ))}
                                  <td 
                                    className={`p-2 border-r-[1.5px] text-center font-black ${isOutput ? 'bg-[#15803D] text-white print:bg-[#15803D] print:text-white' : ''}`} 
                                    style={{ 
                                      borderColor: isOutput ? '#16A34A' : (isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'),
                                      borderTop: isOutput ? '3px solid #16A34A' : undefined,
                                      borderBottom: isOutput ? '3px solid #16A34A' : undefined,
                                      backgroundColor: isOutput ? '#15803D' : undefined,
                                    }}
                                  >
                                    {isOutput ? (
                                      <div className="flex flex-col items-center justify-center leading-tight">
                                        <span className="font-[900] text-base text-white">{bd.metrics.totalActual ?? '-'}</span>
                                        {bd.metrics.totalTarget ? (
                                          <span className="text-[10px] text-white/90 font-bold">T:{bd.metrics.totalTarget}</span>
                                        ) : null}
                                      </div>
                                    ) : (
                                      bd.metrics.totalActual ?? '-'
                                    )}
                                  </td>
                                  {bIdx === 0 && (
                                    <td rowSpan={4} className="p-1 italic leading-tight align-middle text-center bg-slate-50/20 dark:bg-black/10">
                                      <div className="text-[10px] font-bold break-words">{line.remarks || '-'}</div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}

                            {/* REMAINING BLOCK */}
                            <tr className="border-t-[2.5px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}><td colSpan={16} className="p-0 h-0" /></tr>
                            {breakdowns.map((bd, bIdx) => (
                              <tr key={`rem-${bIdx}`} className="border-b-[1.5px] bg-blue-500/[0.03]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>
                                {bIdx === 0 && <td rowSpan={4} className="p-2 border-r-[1.5px] border-[#1E293B] font-black text-center text-blue-600 bg-blue-500/5 text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>REMAINING TARGET</td>}
                                <td className="p-2 border-r-[1.5px] font-bold text-center uppercase opacity-60 text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{parts[bIdx].label}</td>
                                <td className="p-2 border-r-[1.5px] text-center opacity-30" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>-</td>
                                <td className="p-2 border-r-[1.5px] text-center opacity-30" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>-</td>
                                {bd.hourly.map((hB: any, hIdx: number) => (
                                  <td key={hIdx} className="p-1 border-r-[1.5px] text-center font-mono text-slate-500 text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{hB.remaining !== null ? hB.remaining : '-'}</td>
                                ))}
                                <td className="p-2 border-r-[1.5px] text-center font-bold text-slate-700" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{bd.metrics.totalTarget !== null ? Math.max(0, bd.metrics.totalTarget - (bd.metrics.totalActual || 0)) : '-'}</td>
                                {bIdx === 0 && <td rowSpan={4} className="bg-slate-50/20 dark:bg-black/10" />}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* FOOTER */}
                      <div className="mt-3 grid grid-cols-2 gap-4 border-t border-current/10 pt-3">
                         <div className="text-xs font-bold flex gap-4">
                           <span className="text-slate-400">Chief: <span className="text-slate-900 dark:text-white">{line.line_chief_name || '-'}</span></span>
                           <span className="text-slate-400">Phone: <span className="text-slate-900 dark:text-white font-mono">{line.line_chief_phone || '-'}</span></span>
                         </div>
                         <div className="text-right text-[10px] text-slate-500 italic">Entered by: {line.entered_by_name || 'System'}</div>
                      </div>
                    </div>
                  );
                })}

                {filteredFinishingLines.map((line, idx) => {
                  const processes = [
                    { id: 'back', label: 'INSIDE' },
                    { id: 'front', label: 'IRON' },
                    { id: 'output', label: 'TOP SIDE' },
                    { id: 'asm', label: 'POLY' },
                  ];
                  const breakdowns = processes.map(p => calculatePartHourlyBreakdown(line, p.id));
                  const totMan = Number(line.op || 0) + Number(line.hp || 0) + Number(line.ir || 0) + 
                                Number(line.quality_man || 0) + Number(line.folding_man || 0) + 
                                Number(line.poly_man || 0) + Number(line.packing_man || 0);

                  return (
                    <div key={`fin-${idx}`} className={`p-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#103A40] border-white/20' : 'bg-white border-[#D97706]'}`}>
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-current/20">
                        <div className="flex items-center gap-3">
                           <h3 className="font-extrabold text-sm text-[#D97706]">Finishing Report</h3>
                           <span className="text-xs text-slate-500">{line.report_date} · {line.factory_unit?.toUpperCase()} · {line.buyer_name} · {line.style_no}</span>
                        </div>
                        <div className="text-xs font-mono font-bold flex gap-4">
                          <span>M.P: {totMan}</span>
                          <span>Working: {line.working_hours} hrs</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs font-mono" style={{ tableLayout: 'fixed', minWidth: '1300px', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.45)' : '#1E293B'}` }}>
                          <colgroup>
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '6%' }} />
                            {[...Array(10)].map((_, i) => (
                              <col key={i} style={{ width: '5.2%' }} />
                            ))}
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '10%' }} />
                          </colgroup>
                          <thead>
                            <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-[#FFFBEB] text-[#92400E]'}>
                              <th className="p-2 border border-[#1E293B] text-center">Info</th>
                              <th className="p-2 border border-[#1E293B] text-center">Process</th>
                              <th className="p-2 border border-[#1E293B] text-center leading-tight">Hr<br/>Tgt</th>
                              <th className="p-2 border border-[#1E293B] text-center leading-tight">Tot<br/>Tgt</th>
                              {Array.from({ length: 10 }).map((_, i) => {
                                const hrNo = i + 1;
                                const isLocked = hourLocks.some(l => l.report_id === line.report_id && l.hour_no === hrNo);
                                return (
                                  <th key={i} className={`p-1 border border-[#1E293B] text-center relative ${isLocked ? 'bg-amber-500/20' : ''}`}>
                                    H{String(hrNo).padStart(2, '0')}
                                    {isLocked && <Lock className="w-3 h-3 text-amber-600 absolute right-1 top-1" />}
                                  </th>
                                );
                              })}
                              <th className="p-2 border border-[#1E293B] text-center">Total</th>
                              <th className="p-2 border border-[#1E293B] text-center">Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdowns.map((bd, bIdx) => (
                              <tr key={bIdx} className="border-b-[1.5px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>
                                {bIdx === 0 && (
                                  <td rowSpan={4} className="border-r-[1.5px] p-2 text-left bg-slate-50 dark:bg-black/20" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>
                                     <div className="flex flex-col gap-1">
                                        <div><span className="text-[9px] text-slate-400 uppercase">Buyer:</span><div className="font-bold truncate">{line.buyer_name}</div></div>
                                        <div><span className="text-[9px] text-slate-400 uppercase">Style:</span><div className="font-bold truncate">{line.style_no}</div></div>
                                        <div><span className="text-[9px] text-slate-400 uppercase">Order:</span><div className="font-black text-emerald-600 dark:text-emerald-400">{line.order_qty}</div></div>
                                     </div>
                                  </td>
                                )}
                                <td className="p-2 border-r-[1.5px] font-extrabold text-center uppercase" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{processes[bIdx].label}</td>
                                <td className="p-2 border-r-[1.5px] text-center" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{bd.metrics.hourTarget ?? '-'}</td>
                                <td className="p-2 border-r-[1.5px] text-center font-bold text-[#D97706]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{bd.metrics.totalTarget ?? '-'}</td>
                                {bd.hourly.map((hB: any, hIdx: number) => (
                                  <td key={hIdx} className={`p-1 border-r-[1.5px] text-center ${getCellBg(hB.hourActual, bd.metrics.hourTarget)}`} style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>
                                    <div className="font-bold">{hB.hourActual ?? '-'}</div>
                                    <div className={`text-[9px] border-t border-dashed border-current/20 ${getCumColor(hB.cumActual, hB.cumTarget)}`}>{hB.cumActual ?? ''}</div>
                                  </td>
                                ))}
                                <td className="p-2 border-r-[1.5px] text-center font-black" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{bd.metrics.totalActual ?? '-'}</td>
                                {bIdx === 0 && (
                                  <td rowSpan={4} className="p-1 italic leading-tight align-middle text-center bg-slate-50/20 dark:bg-black/10">
                                    <div className="text-[10px] font-bold break-words">{line.remarks || '-'}</div>
                                  </td>
                                )}
                              </tr>
                            ))}
                            {/* REMAINING TARGETS */}
                            <tr className="border-t-[2.5px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}><td colSpan={16} className="p-0 h-0" /></tr>
                            {breakdowns.map((bd, bIdx) => (
                              <tr key={`rem-${bIdx}`} className="border-b-[1.5px] bg-blue-500/[0.03]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>
                                {bIdx === 0 && <td rowSpan={4} className="p-2 border-r-[1.5px] border-[#1E293B] font-black text-center text-blue-600 bg-blue-500/5 text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>REMAINING TARGET</td>}
                                <td className="p-2 border-r-[1.5px] font-bold text-center uppercase opacity-60 text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{processes[bIdx].label}</td>
                                <td className="p-2 border-r-[1.5px] text-center opacity-30" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>-</td>
                                <td className="p-2 border-r-[1.5px] text-center opacity-30" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>-</td>
                                {bd.hourly.map((hB: any, hIdx: number) => (
                                  <td key={hIdx} className="p-1 border-r-[1.5px] text-center font-mono text-slate-500 text-[10px]" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{hB.remaining !== null ? hB.remaining : '-'}</td>
                                ))}
                                <td className="p-2 border-r-[1.5px] text-center font-bold text-slate-700" style={{ borderColor: isDark ? 'rgba(255,255,255,0.45)' : '#1E293B' }}>{bd.metrics.totalTarget !== null ? Math.max(0, bd.metrics.totalTarget - (bd.metrics.totalActual || 0)) : '-'}</td>
                                {bIdx === 0 && <td rowSpan={4} className="bg-slate-50/20 dark:bg-black/10" />}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* BOTTOM INFO */}
                      <div className="mt-3 grid grid-cols-2 gap-4 border-t border-current/10 pt-3">
                         <div className="text-xs font-bold flex gap-4">
                           <span className="text-slate-400">Chief: <span className="text-slate-900 dark:text-white">{line.line_chief_name || '-'}</span></span>
                           <span className="text-slate-400">Phone: <span className="text-slate-900 dark:text-white font-mono">{line.line_chief_phone || '-'}</span></span>
                         </div>
                         <div className="text-right text-[10px] text-slate-500 italic">Entered by: {line.entered_by_name || 'System'}</div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Range Mode Table */}
        {viewMode === 'range' && (
          <div className={`p-4 rounded-2xl border shadow-sm overflow-x-auto ${isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200'}`}>
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr className={isDark ? 'bg-[#0B2E33] text-slate-200' : 'bg-slate-50 text-slate-700'}>
                  <th className="p-2 border border-current/10 text-left">Date</th>
                  <th className="p-2 border border-current/10 text-left">Unit</th>
                  <th className="p-2 border border-current/10 text-left">Line/Module</th>
                  <th className="p-2 border border-current/10 text-left">Buyer & Style</th>
                  <th className="p-2 border border-current/10 text-center">Sewing Output (Ach%)</th>
                  <th className="p-2 border border-current/10 text-center">Inside (Ach%)</th>
                  <th className="p-2 border border-current/10 text-center">Iron (Ach%)</th>
                  <th className="p-2 border border-current/10 text-center">Top Side (Ach%)</th>
                  <th className="p-2 border border-current/10 text-center">Poly (Ach%)</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map((l, i) => {
                  const outM = calculatePartMetrics(l, 'output');
                  // Find corresponding finishing line for same date/unit if possible (simplified here)
                  const fin = filteredFinishingLines.find(fl => fl.report_date === l.report_date && fl.factory_unit === l.factory_unit);
                  const inM = fin ? calculatePartMetrics(fin, 'back') : null;
                  const irM = fin ? calculatePartMetrics(fin, 'front') : null;
                  const tsM = fin ? calculatePartMetrics(fin, 'output') : null;
                  const poM = fin ? calculatePartMetrics(fin, 'asm') : null;

                  return (
                    <tr key={i} className="hover:bg-current/5 transition-colors border-b border-current/5">
                      <td className="p-2 border border-current/5">{l.report_date}</td>
                      <td className="p-2 border border-current/5 uppercase font-bold">{l.factory_unit}</td>
                      <td className="p-2 border border-current/5 font-bold">Line 0{l.line_no}</td>
                      <td className="p-2 border border-current/5 text-[10px]"><div className="font-bold">{l.buyer_name}</div><div>{l.style_no}</div></td>
                      <td className="p-2 border border-current/5 text-center font-bold text-[#0F8B8D]">{outM.totalActual ?? '-'} ({outM.achievement}%)</td>
                      <td className="p-2 border border-current/5 text-center">{inM ? `${inM.totalActual ?? '-'} (${inM.achievement}%)` : '-'}</td>
                      <td className="p-2 border border-current/5 text-center">{irM ? `${irM.totalActual ?? '-'} (${irM.achievement}%)` : '-'}</td>
                      <td className="p-2 border border-current/5 text-center font-bold text-[#D97706]">{tsM ? `${tsM.totalActual ?? '-'} (${tsM.achievement}%)` : '-'}</td>
                      <td className="p-2 border border-current/5 text-center">{poM ? `${poM.totalActual ?? '-'} (${poM.achievement}%)` : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* EDIT HISTORY DRAWER */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex justify-end">
          <div className={`w-full max-w-md h-full flex flex-col shadow-2xl ${isDark ? 'bg-[#103A40] text-white border-l border-white/10' : 'bg-white text-[#0F172A]'}`}>
            <div className="p-4 border-b border-current/20 flex items-center justify-between">
              <div><h3 className="font-extrabold text-base flex items-center gap-2"><History className="w-5 h-5 text-[#0F8B8D]" /> Full Edit History</h3></div>
              <button onClick={() => setShowHistoryDrawer(false)} className="p-1 rounded-lg hover:bg-current/10 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {editLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic">No edit logs found for these reports.</div>
              ) : (
                editLogs.map((log) => {
                  const fieldLabel = FIELD_LABEL_MAP[log.field_name] || log.field_name || 'Field';
                  return (
                    <div key={log.id} className="p-3 rounded-xl border border-current/15 bg-white/5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#0F8B8D]">{log.editor_name || 'User'}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${log.type === 'Finishing' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>{log.type}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-300">
                        {log.line_no ? `Line ${log.line_no}` : 'Section'} 
                        {log.hour_no ? ` · Hour ${String(log.hour_no).padStart(2, '0')}` : ''} · 
                        <span className="font-semibold mx-1">{fieldLabel}</span>: 
                        <strong className="text-slate-400 mx-1">{log.old_value ?? '-'}</strong> → 
                        <strong className="text-emerald-400 mx-1">{log.new_value ?? '-'}</strong>
                      </p>
                      <p className="text-[10px] text-slate-400">{new Date(log.edited_at).toLocaleString()}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default SewingReports;
