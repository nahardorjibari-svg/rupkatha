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

  const fsScale = isFullscreen ? 1.2 : 1;

  const LineSheetTable = ({ line }: { line: any }) => {
    const lineColors: Record<number, string> = {
      1: '#2563EB', // Blue
      2: '#7C3AED', // Purple
      3: '#EA580C', // Orange
      4: '#0D9488', // Teal
    };
    const lineColor = lineColors[line.line_no] || '#0F8B8D';

    const parts = [
      { id: 'back', label: 'BACK', color: 'bg-[#FF5722]', stripe: '#FF5722' },
      { id: 'front', label: 'FRONT', color: 'bg-[#2196F3]', stripe: '#2196F3' },
      { id: 'output', label: 'OUT PUT', color: 'bg-[#4CAF50]', stripe: '#4CAF50' },
      { id: 'asm', label: 'A.S.M', color: 'bg-[#9C27B0]', stripe: '#9C27B0' },
    ];

    const breakdownByPart = useMemo(() => ({
      back: calculatePartHourlyBreakdown(line, 'back'),
      front: calculatePartHourlyBreakdown(line, 'front'),
      output: calculatePartHourlyBreakdown(line, 'output'),
      asm: calculatePartHourlyBreakdown(line, 'asm'),
    }), [line]);

    const cellBorderColor = isDark ? 'rgba(255,255,255,0.45)' : '#1E293B';
    const headerBg = isDark ? 'rgba(0,0,0,0.4)' : '#F1F5F9';

    return (
      <div className="relative pt-6">
        {/* Line Tab */}
        <div 
          className="absolute top-0 left-6 z-10 px-6 py-1 text-sm font-black text-white rounded-t-xl shadow-lg"
          style={{ backgroundColor: lineColor, fontSize: `calc(14px * ${fsScale})` }}
        >
          LINE 0{line.line_no}
        </div>

        <div 
          className={`overflow-hidden border-[3px] rounded-2xl shadow-xl ${isDark ? 'bg-[#0A262B]' : 'bg-white'}`}
          style={{ borderColor: lineColor }}
        >
          <div className="flex">
            {/* Left Info Block (Compact) */}
            <div 
              className="w-[130px] shrink-0 border-r-[1.5px] flex flex-col"
              style={{ borderColor: cellBorderColor }}
            >
              <div 
                className="p-3 border-b-[1.5px] flex-1 flex flex-col justify-center bg-slate-50 dark:bg-black/20"
                style={{ borderColor: cellBorderColor }}
              >
                <span className="text-slate-400 uppercase font-black tracking-tighter" style={{ fontSize: `calc(9px * ${fsScale})` }}>Buyer</span>
                <span className="font-black truncate" style={{ fontSize: `calc(13px * ${fsScale})` }}>{line.buyer_name || '-'}</span>
              </div>
              <div 
                className="p-3 border-b-[1.5px] flex-1 flex flex-col justify-center"
                style={{ borderColor: cellBorderColor }}
              >
                <span className="text-slate-400 uppercase font-black tracking-tighter" style={{ fontSize: `calc(9px * ${fsScale})` }}>Style</span>
                <span className="font-black truncate" style={{ fontSize: `calc(13px * ${fsScale})` }}>{line.style_no || '-'}</span>
              </div>
              <div 
                className="p-3 border-b-[1.5px] flex-1 flex flex-col justify-center bg-slate-100 dark:bg-black/30"
                style={{ borderColor: cellBorderColor }}
              >
                <span className="text-slate-400 uppercase font-black tracking-tighter" style={{ fontSize: `calc(9px * ${fsScale})` }}>Order Qty</span>
                <div className="flex gap-1 font-mono font-black" style={{ fontSize: `calc(12px * ${fsScale})` }}>
                  <span>{line.op || '-'}</span>/<span>{line.hp || '-'}</span>/<span>{line.ir || '-'}</span>
                </div>
              </div>
              <div className="p-3 flex-1 flex items-center justify-center bg-slate-200 dark:bg-black/50">
                <div className="text-center">
                  <span className="block uppercase font-black text-slate-500" style={{ fontSize: `calc(10px * ${fsScale})` }}>Target</span>
                  <span className="font-black leading-none text-[#0F8B8D]" style={{ fontSize: `calc(28px * ${fsScale})` }}>
                    {breakdownByPart.output.metrics.totalTarget || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Production Grid */}
            <div className="flex-1 min-w-0 overflow-x-auto">
              <table className="w-full table-fixed border-collapse" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr 
                    className="font-black border-b-[2.5px]"
                    style={{ backgroundColor: headerBg, borderColor: cellBorderColor, height: `calc(44px * ${fsScale})` }}
                  >
                    <th 
                      className="w-[85px] border-r-[1.5px] px-2 text-left uppercase tracking-widest"
                      style={{ borderColor: cellBorderColor, fontSize: `calc(12px * ${fsScale})` }}
                    >
                      Parts
                    </th>
                    {[...Array(10)].map((_, i) => (
                      <th 
                        key={i} 
                        className="border-r-[1.5px] px-1"
                        style={{ borderColor: cellBorderColor, fontSize: `calc(14px * ${fsScale})`, minWidth: '64px' }}
                      >
                        H{i + 1}
                      </th>
                    ))}
                    <th 
                      className="w-[85px] border-r-[1.5px] px-1 text-center uppercase tracking-widest"
                      style={{ borderColor: cellBorderColor, fontSize: `calc(12px * ${fsScale})` }}
                    >
                      Total
                    </th>
                    <th 
                      className="w-[150px] px-2 text-center uppercase tracking-widest"
                      style={{ fontSize: `calc(12px * ${fsScale})` }}
                    >
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="text-center font-black">
                  {parts.map((p, pIdx) => {
                    const bd = breakdownByPart[p.id as keyof typeof breakdownByPart];
                    const isLast = pIdx === parts.length - 1;
                    
                    return (
                      <tr 
                        key={p.id} 
                        className={isLast ? '' : 'border-b-[2.5px]'}
                        style={{ borderColor: cellBorderColor, minHeight: '64px' }}
                      >
                        {/* Part Label */}
                        <td 
                          className="border-r-[1.5px] px-2 text-left relative"
                          style={{ borderColor: cellBorderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC', height: `calc(64px * ${fsScale})` }}
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: p.stripe }} />
                          <span className="pl-2 uppercase font-black" style={{ fontSize: `calc(clamp(14px, 1.2vw, 20px) * ${fsScale})` }}>{p.label}</span>
                        </td>

                        {/* Hourly Cells */}
                        {[...Array(10)].map((_, i) => {
                          const hr = bd.hourly[i];
                          let cellColor = isDark ? 'text-white' : 'text-slate-900';
                          
                          if (hr.hourDiff !== null) {
                            if (hr.hourDiff < 0) cellColor = 'text-[#DC2626]'; // Red
                            else if (hr.hourDiff === 0) cellColor = 'text-[#15803D]'; // Green
                            else cellColor = 'text-[#B45309]'; // Amber
                          }
                          
                          return (
                            <td 
                              key={i} 
                              className="border-r-[1.5px] relative align-middle"
                              style={{ borderColor: cellBorderColor, minWidth: '64px' }}
                            >
                              <div className="flex flex-col items-center justify-center h-full gap-0.5">
                                {hr.hourActual !== null ? (
                                  <>
                                    <span 
                                      className={`leading-none ${cellColor}`}
                                      style={{ fontSize: `calc(clamp(22px, 2vw, 34px) * ${fsScale})` }}
                                    >
                                      {hr.hourActual}
                                    </span>
                                    {p.id !== 'asm' ? (
                                      <span 
                                        className="font-black text-[#0E7490] dark:text-[#5EEAD4] leading-none"
                                        style={{ fontSize: `calc(clamp(13px, 1.1vw, 18px) * ${fsScale})` }}
                                      >
                                        Σ{hr.cumActual}
                                      </span>
                                    ) : (
                                      <div style={{ height: `calc(clamp(13px, 1.1vw, 18px) * ${fsScale})` }} />
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-300 dark:text-white/10">-</span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Total Cell */}
                        <td 
                          className="border-r-[1.5px] align-middle bg-slate-50/50 dark:bg-black/20"
                          style={{ borderColor: cellBorderColor }}
                        >
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {bd.metrics.totalActual !== null ? (
                              <>
                                <span 
                                  className="text-[#0F8B8D] leading-none"
                                  style={{ fontSize: `calc(clamp(24px, 2.2vw, 38px) * ${fsScale})` }}
                                >
                                  {bd.metrics.totalActual}
                                </span>
                                {p.id === 'output' && bd.metrics.totalTarget ? (
                                  <span 
                                    className="font-black text-slate-500 leading-none"
                                    style={{ fontSize: `calc(clamp(12px, 1vw, 16px) * ${fsScale})` }}
                                  >
                                    T:{bd.metrics.totalTarget}
                                  </span>
                                ) : (
                                  <div style={{ height: `calc(clamp(12px, 1vw, 16px) * ${fsScale})` }} />
                                )}
                              </>
                            ) : (
                              <span className="text-slate-300 dark:text-white/10">-</span>
                            )}
                          </div>
                        </td>

                        {/* Remarks (rowSpan=4) */}
                        {pIdx === 0 && (
                          <td 
                            rowSpan={4} 
                            className="p-3 italic leading-tight align-middle text-center bg-slate-50/20 dark:bg-black/10"
                            style={{ width: '150px' }}
                          >
                            <div 
                              className="max-h-[220px] overflow-y-auto custom-scrollbar break-words"
                              style={{ fontSize: `calc(13px * ${fsScale})` }}
                            >
                              {line.remarks || '-'}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SummaryChip = ({ label, target, actual, achievement, status }: any) => {
    const colors = {
      short: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30',
      achieved: 'bg-[#15803D]/10 text-[#15803D] border-[#15803D]/30',
      excess: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30',
      no_target: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
    };
    return (
      <div 
        className={`flex flex-col p-4 rounded-2xl border-2 ${colors[status as keyof typeof colors] || colors.no_target}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-black uppercase tracking-widest" style={{ fontSize: `calc(12px * ${fsScale})` }}>{label}</span>
          {achievement !== null && <span className="font-black" style={{ fontSize: `calc(12px * ${fsScale})` }}>{achievement}%</span>}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-black font-mono" style={{ fontSize: `calc(28px * ${fsScale})` }}>{formatNum(actual)}</span>
          {target !== null && <span className="font-black opacity-60" style={{ fontSize: `calc(11px * ${fsScale})` }}>/ {formatNum(target)}</span>}
        </div>
        {status === 'short' && actual !== null && target !== null && (
          <div className="flex items-center gap-1 mt-2 font-black">
            <TrendingDown className="w-4 h-4" />
            <span style={{ fontSize: `calc(11px * ${fsScale})` }}>-{formatNum(target - actual)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div ref={dashboardRef} className={`flex flex-col min-h-[calc(100vh-4rem)] p-6 transition-colors ${isDark ? 'bg-[#06171A] text-white' : 'bg-slate-50 text-slate-900'}`} style={{ height: isFullscreen ? '100vh' : 'auto' }}>
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
        {/* Top Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp className="w-4 h-4 text-[#0F8B8D]" />
              <h3 className="text-xs font-black uppercase tracking-widest">Day Performance</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SummaryChip label="Back" target={combinedSummary.byPart.back.totalTarget} actual={combinedSummary.byPart.back.totalActual} achievement={combinedSummary.byPart.back.achievement} status={combinedSummary.byPart.back.status} />
              <SummaryChip label="Front" target={combinedSummary.byPart.front.totalTarget} actual={combinedSummary.byPart.front.totalActual} achievement={combinedSummary.byPart.front.achievement} status={combinedSummary.byPart.front.status} />
              <SummaryChip label="Out Put" target={combinedSummary.byPart.output.totalTarget} actual={combinedSummary.byPart.output.totalActual} achievement={combinedSummary.byPart.output.achievement} status={combinedSummary.byPart.output.status} />
              <SummaryChip label="A.S.M" target={combinedSummary.byPart.asm.totalTarget} actual={combinedSummary.byPart.asm.totalActual} achievement={combinedSummary.byPart.asm.achievement} status={combinedSummary.byPart.asm.status} />
            </div>
          </div>
          
          <div className="lg:col-span-8">
            <div className={`p-4 h-full rounded-2xl border shadow-sm ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#0F8B8D]" />
                  <h3 className="text-xs font-black uppercase tracking-widest">Hourly Target vs Actual</h3>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#0F8B8D]" /><span>Target</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>Actual</span></div>
                </div>
              </div>
              <div className="h-[150px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#ffffff10' : '#00000010'} />
                    <XAxis dataKey="name" fontSize={9} fontStyle="bold" axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} fontStyle="bold" axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#0B2E33' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                    <Bar dataKey="Actual" fill="#10B981" radius={[2, 2, 0, 0]} barSize={16}>
                      {chartData.map((entry, index) => (
                        <RechartsCell key={index} fill={(entry.Actual || 0) < (entry.Target || 0) ? '#EF4444' : '#10B981'} />
                      ))}
                    </Bar>
                    <Line type="monotone" dataKey="Target" stroke="#0F8B8D" strokeWidth={2} dot={{ r: 3, fill: '#0F8B8D', strokeWidth: 1.5, stroke: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {unitsToShow.map(u => {
            if (unitData[u].lines.length === 0) return null;
            return (
              <div key={u} className="mb-8 last:mb-0">
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#0F8B8D] flex items-center gap-2">
                    <div className="w-4 h-[2px] bg-[#0F8B8D]" />
                    {u} PRODUCTION SHEET
                  </h2>
                  <div className="flex-1 h-[1px] bg-slate-200 dark:bg-white/5" />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {unitData[u].lines.map((l: any) => (
                    <LineSheetTable key={l.id} line={l} />
                  ))}
                </div>
              </div>
            );
          })}

          {reports.length === 0 && !loading && (
            <div className="py-24 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/5">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-2">
                  <AlertTriangle className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 font-bold">No production reports found for this date.</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Select another date or unit</p>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-3xl">
            <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-[#0B2E33] rounded-3xl shadow-2xl border border-current/10">
              <div className="w-10 h-10 border-4 border-[#0F8B8D] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest text-[#0F8B8D] animate-pulse">Syncing Production...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute bottom-8 right-8 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 z-[60] animate-bounce-in">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SewingDashboard;
