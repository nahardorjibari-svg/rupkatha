/**
 * Sewing Live Paper-Style Sheet Board
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingDashboard.tsx)
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports, subscribeSewingRealtime, fetchHourLocks } from '../../lib/sewingQueries';
import {
  calculatePartMetrics,
  calculatePartHourlyBreakdown,
  calculateManagementSummary,
  formatNum,
} from '../../lib/sewingCalc';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ComposedChart,
  Line,
  Cell as RechartsCell,
} from 'recharts';
import {
  Calendar,
  Maximize2,
  Minimize2,
  Camera,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

export const SewingDashboard: React.FC = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState<'knit' | 'woven' | 'both'>('both');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  const [reports, setReports] = useState<any[]>([]);
  const [hourLocks, setHourLocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const queryUnit = unitFilter === 'both' ? 'all' : unitFilter;
      const data = await fetchSewingReports({ date, unit: queryUnit });
      
      let allLocks: any[] = [];
      if (data && data.length > 0) {
        for (const r of data) {
          const locks = await fetchHourLocks(r.id);
          allLocks = [...allLocks, ...locks];
        }
      }
      
      setReports(data || []);
      setHourLocks(allLocks);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sewing dashboard data.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [date, unitFilter]);

  useEffect(() => {
    loadData();
    let timeoutId: any = null;
    const unsubscribe = subscribeSewingRealtime(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData(true);
      }, 400);
    });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handlePrevDate = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleNextDate = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleExportSnapshot = async () => {
    if (!dashboardRef.current) return;
    const toastId = toast.loading('Capturing production sheet...');
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#081C20' : '#FFFFFF',
      });
      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `sewing-report-${unitFilter}-${date}.png`;
      a.click();
      toast.success('Snapshot saved!', { id: toastId });
    } catch {
      toast.error('Snapshot failed.', { id: toastId });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const unitsToShow = useMemo(() => {
    if (unitFilter === 'knit') return ['knit'];
    if (unitFilter === 'woven') return ['woven'];
    return ['knit', 'woven'];
  }, [unitFilter]);

  const unitData = useMemo(() => {
    const map: Record<string, any> = {
      knit: { lines: [], summary: null },
      woven: { lines: [], summary: null },
    };

    unitsToShow.forEach(u => {
      const unitReports = reports.filter(r => r.factory_unit === u);
      let allLines: any[] = [];
      unitReports.forEach(r => {
        (r.lines || []).forEach((l: any) => {
          allLines.push({ ...l, report_id: r.id, unit: u });
        });
      });
      allLines.sort((a, b) => a.line_no - b.line_no);
      map[u].lines = allLines;
      map[u].summary = calculateManagementSummary(allLines);
    });

    return map;
  }, [reports, unitsToShow]);

  const combinedSummary = useMemo(() => {
    const allVisibleLines: any[] = [];
    unitsToShow.forEach(u => {
      allVisibleLines.push(...unitData[u].lines);
    });
    return calculateManagementSummary(allVisibleLines) as any;
  }, [unitData, unitsToShow]);

  const chartData = useMemo(() => {
    const hours: any[] = [];
    const allVisibleLines: any[] = [];
    unitsToShow.forEach(u => allVisibleLines.push(...unitData[u].lines));

    for (let h = 1; h <= 10; h++) {
      let hTarget = 0;
      let hActual = 0;
      let count = 0;

      allVisibleLines.forEach(l => {
        const bd = calculatePartHourlyBreakdown(l, 'output');
        const hourObj = bd.hourly.find(x => x.hourNo === h);
        if (bd.metrics.hourTarget !== null && h <= bd.metrics.workingHours) {
          hTarget += bd.metrics.hourTarget;
        }
        if (hourObj && hourObj.hourActual !== null) {
          hActual += hourObj.hourActual;
          count++;
        }
      });

      hours.push({
        name: `H${h}`,
        Target: hTarget > 0 ? hTarget : null,
        Actual: count > 0 ? hActual : null,
      });
    }
    return hours;
  }, [unitData, unitsToShow]);

  const LineSheetTable = ({ line }: { line: any }) => {
    const parts = [
      { id: 'back', label: 'Back', color: 'bg-[#FF5722]' },
      { id: 'front', label: 'Front', color: 'bg-[#2196F3]' },
      { id: 'output', label: 'Out Put', color: 'bg-[#4CAF50]' },
      { id: 'asm', label: 'A.S.M', color: 'bg-[#9C27B0]' },
    ];

    const breakdownByPart = useMemo(() => ({
      back: calculatePartHourlyBreakdown(line, 'back'),
      front: calculatePartHourlyBreakdown(line, 'front'),
      output: calculatePartHourlyBreakdown(line, 'output'),
      asm: calculatePartHourlyBreakdown(line, 'asm'),
    }), [line]);

    return (
      <div className={`overflow-hidden border border-slate-300 dark:border-white/10 rounded-sm shadow-sm ${isDark ? 'bg-[#0A262B]' : 'bg-white'}`}>
        <div className="flex h-full">
          <div className="w-[180px] shrink-0 border-r border-slate-300 dark:border-white/10 flex flex-col text-[10px]">
            <div className="p-1.5 border-b border-slate-300 dark:border-white/10 h-[25%] flex flex-col justify-center">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Buyer Name</span>
              <span className="font-black text-[11px] truncate">{line.buyer_name || '-'}</span>
            </div>
            <div className="p-1.5 border-b border-slate-300 dark:border-white/10 h-[25%] flex flex-col justify-center">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Style No</span>
              <span className="font-black text-[11px] truncate">{line.style_no || '-'}</span>
            </div>
            <div className="p-1.5 border-b border-slate-300 dark:border-white/10 h-[25%] flex flex-col justify-center bg-slate-50 dark:bg-black/20">
              <span className="text-slate-400 uppercase font-bold tracking-tighter">Order Qty (OP/HP/IR)</span>
              <div className="flex gap-1 font-mono font-bold">
                <span>{line.op || '-'}</span>/<span>{line.hp || '-'}</span>/<span>{line.ir || '-'}</span>
              </div>
            </div>
            <div className="p-2 h-[25%] flex items-center justify-center bg-slate-100 dark:bg-black/40">
              <div className="text-center">
                <span className="block text-[8px] uppercase font-bold text-slate-500">Line No</span>
                <span className="text-3xl font-black leading-none text-[#0F8B8D]">0{line.line_no}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex bg-slate-50 dark:bg-black/20 border-b border-slate-300 dark:border-white/10">
              <div className="w-[60px] border-r border-slate-300 dark:border-white/10 p-1 text-center font-bold text-[10px]">Parts</div>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex-1 border-r border-slate-300 dark:border-white/10 p-1 text-center font-bold text-[10px]">H{i + 1}</div>
              ))}
              <div className="w-[70px] border-r border-slate-300 dark:border-white/10 p-1 text-center font-bold text-[10px]">Total</div>
              <div className="flex-1 p-1 text-center font-bold text-[10px]">Remarks</div>
            </div>

            {parts.map((p) => {
              const bd = breakdownByPart[p.id as keyof typeof breakdownByPart];
              return (
                <div key={p.id} className="flex border-b last:border-0 border-slate-200 dark:border-white/5 h-[36px]">
                  <div className={`w-[60px] border-r border-slate-300 dark:border-white/10 flex items-center gap-1.5 px-1 ${isDark ? 'bg-black/10' : 'bg-slate-50/50'}`}>
                    <div className={`w-1 h-5 rounded-full ${p.color}`} />
                    <span className="text-[9px] font-bold uppercase truncate">{p.label}</span>
                  </div>
                  {[...Array(10)].map((_, i) => {
                    const hr = bd.hourly[i];
                    const isLocked = hourLocks.some(lock => lock.report_id === line.report_id && lock.hour_no === (i + 1));
                    let cellColor = '';
                    if (hr.hourDiff !== null) {
                      if (hr.hourDiff < 0) cellColor = 'text-red-600 dark:text-red-400';
                      else if (hr.hourDiff === 0) cellColor = 'text-green-600 dark:text-green-400';
                      else cellColor = 'text-amber-600 dark:text-amber-400';
                    }
                    return (
                      <div key={i} className="flex-1 border-r border-slate-200 dark:border-white/5 flex flex-col justify-center items-center relative">
                        {isLocked && <div className="absolute top-0 right-0 w-2 h-2 bg-slate-400/20 rounded-bl-sm" />}
                        {hr.hourActual !== null ? (
                          <>
                            <span className={`text-[11px] font-black leading-tight ${cellColor}`}>{hr.hourActual}</span>
                            {p.id !== 'asm' && <span className="text-[7px] font-mono font-bold text-slate-400">Σ{hr.cumActual}</span>}
                          </>
                        ) : <span className="text-[10px] text-slate-300 dark:text-white/10">-</span>}
                      </div>
                    );
                  })}
                  <div className="w-[70px] border-r border-slate-300 dark:border-white/10 flex flex-col justify-center items-center bg-slate-50/30 dark:bg-black/10">
                    {bd.metrics.totalActual !== null ? (
                      <>
                        <span className="text-[11px] font-black text-[#0F8B8D]">{bd.metrics.totalActual}</span>
                        {p.id === 'output' && bd.metrics.hourTarget && <span className="text-[7px] font-bold text-slate-400">T: {bd.metrics.totalTarget}</span>}
                      </>
                    ) : <span className="text-[10px] text-slate-300 dark:text-white/10">-</span>}
                  </div>
                  {p.id === 'back' && (
                    <div className="flex-1 p-1.5 flex items-center text-[9px] text-slate-500 italic leading-tight overflow-hidden">
                      {line.remarks || '-'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const SummaryChip = ({ label, target, actual, achievement, status }: any) => {
    const colors = {
      short: 'bg-red-500/10 text-red-600 border-red-500/20',
      achieved: 'bg-green-500/10 text-green-600 border-green-500/20',
      excess: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      no_target: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    };
    return (
      <div className={`flex flex-col p-2.5 rounded-xl border ${colors[status as keyof typeof colors] || colors.no_target}`}>
        <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>{achievement !== null && <span className="text-[10px] font-black">{achievement}%</span>}</div>
        <div className="flex items-baseline gap-2"><span className="text-xl font-black font-mono">{formatNum(actual)}</span>{target !== null && <span className="text-[9px] font-bold opacity-60">/ {formatNum(target)}</span>}</div>
        {status === 'short' && actual !== null && target !== null && <div className="flex items-center gap-1 mt-1 text-[9px] font-bold"><TrendingDown className="w-3 h-3" /><span>-{formatNum(target - actual)} units</span></div>}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div ref={dashboardRef} className={`flex flex-col min-h-[calc(100vh-4rem)] p-4 transition-colors ${isDark ? 'bg-[#06171A] text-white' : 'bg-slate-50 text-slate-900'}`} style={{ height: isFullscreen ? '100vh' : 'auto' }}>
        <div className={`flex items-center justify-between gap-4 mb-4 p-2 px-4 rounded-2xl border shadow-sm ${isDark ? 'bg-[#0B2E33] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></div>
              <div className="flex flex-col -space-y-1"><span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">LIVE</span><span className="text-[8px] text-slate-400 font-mono">{lastUpdated.toLocaleTimeString()}</span></div>
            </div>
            <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-lg border border-current/10 overflow-hidden h-9">
              <button onClick={handlePrevDate} className="h-full px-2 hover:bg-current/10 border-r border-current/10"><ChevronLeft className="w-4 h-4" /></button>
              <div className="flex items-center gap-2 px-3"><Calendar className="w-4 h-4 text-[#0F8B8D]" /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent border-none outline-none text-xs font-bold cursor-pointer w-24" /></div>
              <button onClick={handleNextDate} className="h-full px-2 hover:bg-current/10 border-l border-current/10"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-lg border border-current/10 p-1 h-9">
              {(['knit', 'woven', 'both'] as const).map(u => <button key={u} onClick={() => setUnitFilter(u)} className={`px-3 h-full text-[10px] font-black rounded-md uppercase transition-all ${unitFilter === u ? 'bg-[#0F8B8D] text-white' : 'text-slate-400 hover:text-slate-200'}`}>{u}</button>)}
            </div>
          </div>
          <div className="hidden lg:flex flex-col items-center">
            <h1 className="text-sm font-black tracking-widest text-[#0F8B8D]">RUPKATHA APPARELS LTD.</h1>
            <div className="flex items-center gap-3"><span className="text-[10px] font-bold text-slate-400 uppercase">Hourly Production Report</span><div className="h-1 w-1 rounded-full bg-slate-300" /><span className="text-[10px] font-bold text-slate-400 uppercase">Unit: Sewing</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAutoRefresh(!autoRefresh)} className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-[10px] font-bold transition-all ${autoRefresh ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}><Clock className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />{autoRefresh ? 'Auto' : 'Manual'}</button>
            <button onClick={handleExportSnapshot} className="flex items-center gap-2 px-3 h-9 rounded-lg bg-[#0F8B8D]/10 text-[#0F8B8D] border border-[#0F8B8D]/20 hover:bg-[#0F8B8D]/20 transition-all text-[10px] font-bold"><Camera className="w-3.5 h-3.5" />Snapshot</button>
            <button onClick={toggleFullscreen} className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/5 dark:bg-white/5 border border-current/10 hover:bg-current/10 transition-all">{isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {unitsToShow.map(u => (
            <div key={u} className="mb-8 last:mb-0">
              <div className="flex items-center gap-3 mb-3"><h2 className="text-xs font-black uppercase tracking-widest text-[#0F8B8D] flex items-center gap-2"><div className="w-4 h-[2px] bg-[#0F8B8D]" />{u} PRODUCTION SHEET</h2><div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/5" /></div>
              {unitData[u].lines.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{unitData[u].lines.map((l: any) => <LineSheetTable key={l.id} line={l} />)}</div>
              ) : <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/5"><p className="text-sm text-slate-400 font-bold">No production data found for {u} on this date.</p></div>}
            </div>
          ))}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-[#0F8B8D]" /><h3 className="text-xs font-black uppercase tracking-widest">Day Performance</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <SummaryChip label="Back" target={combinedSummary.byPart.back.totalTarget} actual={combinedSummary.byPart.back.totalActual} achievement={combinedSummary.byPart.back.achievement} status={combinedSummary.byPart.back.status} />
                <SummaryChip label="Front" target={combinedSummary.byPart.front.totalTarget} actual={combinedSummary.byPart.front.totalActual} achievement={combinedSummary.byPart.front.achievement} status={combinedSummary.byPart.front.status} />
                <SummaryChip label="Out Put" target={combinedSummary.byPart.output.totalTarget} actual={combinedSummary.byPart.output.totalActual} achievement={combinedSummary.byPart.output.achievement} status={combinedSummary.byPart.output.status} />
                <SummaryChip label="A.S.M" target={combinedSummary.byPart.asm.totalTarget} actual={combinedSummary.byPart.asm.totalActual} achievement={combinedSummary.byPart.asm.achievement} status={combinedSummary.byPart.asm.status} />
              </div>
              <div className={`mt-2 p-4 rounded-2xl border ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black uppercase text-slate-400">Production Health</span><div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-[10px] font-bold text-emerald-500">Live Status</span></div></div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold">Total Target</span><span className="text-sm font-black font-mono">{formatNum(combinedSummary.byPart.output.totalTarget)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-xs font-bold">Total Actual</span><span className="text-sm font-black font-mono text-emerald-500">{formatNum(combinedSummary.byPart.output.totalActual)}</span></div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, combinedSummary.byPart.output.achievement || 0)}%` }} /></div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className={`p-6 rounded-2xl border shadow-sm ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#0F8B8D]" /><h3 className="text-xs font-black uppercase tracking-widest">Hourly Target vs Actual</h3></div>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter"><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#0F8B8D]" /><span>Target</span></div><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>Actual</span></div></div>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#ffffff10' : '#00000010'} />
                      <XAxis dataKey="name" fontSize={10} fontStyle="bold" axisLine={false} tickLine={false} dy={10} />
                      <YAxis fontSize={10} fontStyle="bold" axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#0B2E33' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                      <Bar dataKey="Actual" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24}>{chartData.map((entry, index) => <RechartsCell key={index} fill={(entry.Actual || 0) < (entry.Target || 0) ? '#EF4444' : '#10B981'} />)}</Bar>
                      <Line type="monotone" dataKey="Target" stroke="#0F8B8D" strokeWidth={3} dot={{ r: 4, fill: '#0F8B8D', strokeWidth: 2, stroke: '#fff' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
        {loading && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-3xl"><div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#0B2E33] rounded-3xl shadow-2xl border border-current/10"><div className="w-10 h-10 border-4 border-[#0F8B8D] border-t-transparent rounded-full animate-spin" /><span className="text-xs font-black uppercase tracking-widest text-[#0F8B8D] animate-pulse">Syncing Production...</span></div></div>}
        {error && <div className="absolute bottom-8 right-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 z-[60] animate-bounce-in"><AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /><span>{error}</span></div>}
      </div>
    </AdminLayout>
  );
};

export default SewingDashboard;
