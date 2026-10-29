/**
 * Sewing Live Paper-Style Sheet Board
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingDashboard.tsx)
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports, subscribeSewingRealtime, fetchHourLocks } from '../../lib/sewingQueries';
import { fetchFinishingReports } from '../../lib/finishingQueries';
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
  Lock,
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
  const [finishingReports, setFinishingReports] = useState<any[]>([]);
  const [hourLocks, setHourLocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishingError, setFinishingError] = useState<string | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const queryUnit = unitFilter === 'both' ? 'all' : unitFilter;
      
      // Fetch Sewing Data
      try {
        const sewingData = await fetchSewingReports({ date, unit: queryUnit });
        setReports(sewingData || []);
        
        let allLocks: any[] = [];
        if (sewingData && sewingData.length > 0) {
          for (const r of sewingData) {
            const locks = await fetchHourLocks(r.id);
            allLocks = [...allLocks, ...locks];
          }
        }
        setHourLocks(allLocks);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to load sewing data.');
      }

      // Fetch Finishing Data
      try {
        const finishingData = await fetchFinishingReports({ date, unit: queryUnit });
        setFinishingReports(finishingData || []);
        setFinishingError(null);
      } catch (err: any) {
        setFinishingError(err?.message || 'Failed to load finishing data.');
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Dashboard load error:', err);
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
      knit: { lines: [], finishing: [], summary: null, finishingSummary: null },
      woven: { lines: [], finishing: [], summary: null, finishingSummary: null },
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

      // Finishing
      const unitFinReports = finishingReports.filter(r => r.factory_unit === u);
      let allFinLines: any[] = [];
      unitFinReports.forEach(r => {
        (r.lines || []).forEach((l: any) => {
          allFinLines.push({ ...l, report_id: r.id, unit: u });
        });
      });
      map[u].finishing = allFinLines;
      map[u].finishingSummary = calculateManagementSummary(allFinLines);
    });

    return map;
  }, [reports, finishingReports, unitsToShow]);

  const combinedSummary = useMemo(() => {
    const allVisibleLines: any[] = [];
    unitsToShow.forEach(u => {
      allVisibleLines.push(...unitData[u].lines);
    });
    return calculateManagementSummary(allVisibleLines) as any;
  }, [unitData, unitsToShow]);

  const combinedFinishingSummary = useMemo(() => {
    const allVisibleFinLines: any[] = [];
    unitsToShow.forEach(u => {
      allVisibleFinLines.push(...unitData[u].finishing);
    });
    return calculateManagementSummary(allVisibleFinLines) as any;
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

  const finishingChartData = useMemo(() => {
    const hours: any[] = [];
    const allVisibleFinLines: any[] = [];
    unitsToShow.forEach(u => allVisibleFinLines.push(...unitData[u].finishing));

    for (let h = 1; h <= 10; h++) {
      let hTarget = 0;
      let hActual = 0;
      let count = 0;

      allVisibleFinLines.forEach(l => {
        const bd = calculatePartHourlyBreakdown(l, 'output'); // Top Side
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

  const FinishingSheetTable = ({ line }: { line: any }) => {
    const lineColor = '#D97706'; // Amber/Gold for Finishing
    const processes = [
      { id: 'back', label: 'INSIDE', color: 'bg-[#FF5722]', stripe: '#FF5722' },
      { id: 'front', label: 'IRON', color: 'bg-[#2196F3]', stripe: '#2196F3' },
      { id: 'output', label: 'TOP SIDE', color: 'bg-[#4CAF50]', stripe: '#4CAF50' },
      { id: 'asm', label: 'POLY', color: 'bg-[#9C27B0]', stripe: '#9C27B0' },
    ];

    const breakdownByProc = useMemo(() => ({
      back: calculatePartHourlyBreakdown(line, 'back'),
      front: calculatePartHourlyBreakdown(line, 'front'),
      output: calculatePartHourlyBreakdown(line, 'output'),
      asm: calculatePartHourlyBreakdown(line, 'asm'),
    }), [line]);

    const cellBorderColor = isDark ? 'rgba(255,255,255,0.45)' : '#1E293B';
    const headerBg = isDark ? 'rgba(0,0,0,0.4)' : '#F1F5F9';

    const hourFs = `clamp(13px, 2.2cqw, ${24 * fsScale}px)`;
    const sigmaFs = `clamp(9px, 1.35cqw, ${14 * fsScale}px)`;
    const totalFs = `clamp(15px, 2.6cqw, ${28 * fsScale}px)`;
    const labelFs = `clamp(10px, 1.2cqw, ${16 * fsScale}px)`;
    const smallFs = `clamp(8px, 1cqw, ${12 * fsScale}px)`;

    const totalManpower = Number(line.op || 0) + Number(line.hp || 0) + Number(line.ir || 0) + 
                          Number(line.quality_man || 0) + Number(line.folding_man || 0) + 
                          Number(line.poly_man || 0) + Number(line.packing_man || 0);

    return (
      <div className="relative pt-6 col-span-1 min-[1100px]:col-span-2" style={{ containerType: 'inline-size' } as any}>
        <div 
          className="absolute top-0 left-6 z-10 px-6 py-1 text-sm font-black text-white rounded-t-xl shadow-lg"
          style={{ backgroundColor: lineColor, fontSize: `calc(14px * ${fsScale})` }}
        >
          FINISHING PROCESS-WISE REPORT ({line.unit?.toUpperCase()})
        </div>

        <div 
          className={`overflow-hidden border-[3px] rounded-2xl shadow-xl ${isDark ? 'bg-[#0A262B]' : 'bg-white'}`}
          style={{ borderColor: lineColor }}
        >
          <table className="w-full table-fixed border-collapse" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr 
                className="font-black border-b-[2.5px]"
                style={{ backgroundColor: headerBg, borderColor: cellBorderColor, height: `calc(44px * ${fsScale})` }}
              >
                <th className="w-[12%] border-r-[1.5px] px-2 text-left uppercase tracking-tighter" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>Info</th>
                <th className="w-[8%] border-r-[1.5px] px-1 text-center uppercase tracking-widest" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>Process</th>
                <th className="w-[5.5%] border-r-[1.5px] px-1 text-center uppercase leading-none" style={{ borderColor: cellBorderColor, fontSize: `calc(${labelFs} * 0.8)` }}>Hr.<br/>Tgt</th>
                <th className="w-[6.5%] border-r-[1.5px] px-1 text-center uppercase leading-none" style={{ borderColor: cellBorderColor, fontSize: `calc(${labelFs} * 0.8)` }}>Tot.<br/>Tgt</th>
                {[...Array(10)].map((_, i) => {
                  const hrNo = i + 1;
                  const isLocked = hourLocks.some((l) => l.hour_no === hrNo);
                  return (
                    <th key={i} className={`w-[5.1%] border-r-[1.5px] px-1 text-center relative ${isLocked ? 'bg-amber-500/20' : ''}`} style={{ borderColor: cellBorderColor, fontSize: labelFs }}>
                      <div className="flex flex-col items-center justify-center">
                        <span>H{hrNo}</span>
                        {isLocked && <Lock className="w-2.5 h-2.5 text-amber-600 mt-0.5" />}
                      </div>
                    </th>
                  );
                })}
                <th className="w-[7%] border-r-[1.5px] px-1 text-center uppercase tracking-widest" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>Total</th>
                <th className="w-[9%] px-1 text-center uppercase tracking-widest" style={{ fontSize: labelFs }}>Remarks</th>
              </tr>
            </thead>
            <tbody className="text-center font-black">
              {processes.map((p, pIdx) => {
                const bd = breakdownByProc[p.id as keyof typeof breakdownByProc];
                return (
                  <tr 
                    key={p.id} 
                    className="border-b-[1.5px]"
                    style={{ borderColor: cellBorderColor, height: `calc(64px * ${fsScale})` }}
                  >
                    {pIdx === 0 && (
                      <td rowSpan={4} className="border-r-[1.5px] p-0 text-left bg-slate-50 dark:bg-black/20" style={{ borderColor: cellBorderColor }}>
                        <div className="flex flex-col h-full">
                           <div className="p-2 border-b-[1.5px]" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>Buyer</span>
                              <span className="font-black truncate block leading-tight" style={{ fontSize: labelFs }}>{line.buyer_name || '-'}</span>
                           </div>
                           <div className="p-2 border-b-[1.5px]" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>Style</span>
                              <span className="font-black truncate block leading-tight" style={{ fontSize: labelFs }}>{line.style_no || '-'}</span>
                           </div>
                           <div className="p-2 border-b-[1.5px] bg-emerald-50 dark:bg-emerald-950/20" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>Order Qty</span>
                              <span className="font-black block leading-none text-emerald-600 dark:text-emerald-400" style={{ fontSize: `calc(${labelFs} * 1.3)` }}>{line.order_qty || '-'}</span>
                           </div>
                           <div className="p-2 border-b-[1.5px] bg-slate-100 dark:bg-black/30" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>M.P (Total)</span>
                              <div className="font-black flex flex-col gap-0.5" style={{ fontSize: labelFs }}>
                                 <div className="text-[#D97706] font-black">Tot: {totalManpower}</div>
                              </div>
                           </div>
                           <div className="p-2 flex-1 flex flex-col justify-center items-center bg-slate-200 dark:bg-black/50">
                              <span className="block uppercase font-black text-slate-500" style={{ fontSize: smallFs }}>Finishing Target</span>
                              <span className="font-black leading-none text-[#D97706]" style={{ fontSize: `clamp(16px, 2.2cqw, ${24 * fsScale}px)` }}>
                                {breakdownByProc.output.metrics.totalTarget || '-'}
                              </span>
                           </div>
                        </div>
                      </td>
                    )}
                    <td 
                      className="border-r-[1.5px] px-1 text-center relative"
                      style={{ borderColor: cellBorderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC' }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: p.stripe }} />
                      <span className="pl-0.5 uppercase font-black whitespace-nowrap" style={{ fontSize: `calc(${labelFs} * 0.9)` }}>{p.label}</span>
                    </td>
                    <td className="border-r-[1.5px] bg-slate-50/30 dark:bg-black/10" style={{ borderColor: cellBorderColor }}>
                       <span className="font-black" style={{ fontSize: labelFs }}>{bd.metrics.hourTarget ?? '-'}</span>
                    </td>
                    <td className="border-r-[1.5px] bg-slate-50/50 dark:bg-black/20" style={{ borderColor: cellBorderColor }}>
                       <span className="font-black text-[#D97706]" style={{ fontSize: labelFs }}>{bd.metrics.totalTarget ?? '-'}</span>
                    </td>
                    {[...Array(10)].map((_, i) => {
                      const hr = bd.hourly[i];
                      let cellColor = isDark ? 'text-white' : 'text-slate-900';
                      if (hr.hourDiff !== null) {
                        if (hr.hourDiff < 0) cellColor = 'text-[#DC2626]';
                        else if (hr.hourDiff === 0) cellColor = 'text-[#15803D]';
                        else cellColor = 'text-[#B45309]';
                      }
                      return (
                        <td key={i} className="border-r-[1.5px] relative align-middle" style={{ borderColor: cellBorderColor }}>
                          <div className="flex flex-col items-center justify-center h-full">
                            {hr.hourActual !== null ? (
                              <>
                                <span className={`leading-none ${cellColor} whitespace-nowrap`} style={{ fontSize: hourFs }}>{hr.hourActual}</span>
                                <span className="font-black text-[#0E7490] dark:text-[#5EEAD4] leading-none whitespace-nowrap" style={{ fontSize: sigmaFs }}>Σ{hr.cumActual}</span>
                              </>
                            ) : (
                              <span className="text-slate-300 dark:text-white/10">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="align-middle bg-slate-50/50 dark:bg-black/20">
                      <div className="flex flex-col items-center justify-center">
                        {bd.metrics.totalActual !== null ? (
                          <span className="text-[#D97706] leading-none whitespace-nowrap" style={{ fontSize: totalFs }}>{bd.metrics.totalActual}</span>
                        ) : (
                          <span className="text-slate-300 dark:text-white/10">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* REMAINING / SHORT / EXCESS GROUP */}
              {processes.map((p, pIdx) => {
                const bd = breakdownByProc[p.id as keyof typeof breakdownByProc];
                return (
                  <tr key={`frem_${p.id}`} className={isDark ? 'bg-white/[0.01]' : 'bg-slate-50/50'} style={{ height: `calc(32px * ${fsScale})` }}>
                    {pIdx === 0 && <td rowSpan={4} colSpan={4} className="border-r-[1.5px] p-1 text-center align-middle font-black text-blue-600 bg-blue-500/5" style={{ borderColor: cellBorderColor, fontSize: smallFs }}><div>REMAINING TARGET</div><div className="text-[0.8em] font-bangla">বাকি লক্ষ্য</div></td>}
                    <td className="border-r-[1.5px] p-1 text-center font-bold" style={{ borderColor: cellBorderColor, fontSize: `calc(${smallFs} * 0.9)` }}>{p.label}</td>
                    <td className="border-r-[1.5px] p-1 text-center font-mono text-slate-400" style={{ borderColor: cellBorderColor }}>-</td>
                    <td className="border-r-[1.5px] p-1 text-center font-mono text-slate-400" style={{ borderColor: cellBorderColor }}>-</td>
                    {bd.hourly.map((hB: any, hIdx: number) => {
                      const r = hB.remaining;
                      return <td key={hIdx} className="border-r-[1.5px] p-1 text-center align-middle font-mono font-semibold text-slate-500" style={{ borderColor: cellBorderColor, fontSize: `calc(${smallFs} * 0.9)` }}>{r !== null ? r : '-'}</td>;
                    })}
                    <td className="p-1 text-center font-black font-mono text-slate-700" style={{ fontSize: `calc(${smallFs} * 0.9)` }}>{bd.metrics.totalTarget !== null ? Math.max(0, bd.metrics.totalTarget - (bd.metrics.totalActual || 0)) : '-'}</td>
                  </tr>
                );
              })}
              <tr style={{ height: `calc(48px * ${fsScale})` }}>
                <td colSpan={13} className="border-r-[1.5px] p-0" style={{ borderColor: cellBorderColor }}>
                  <div className="flex h-full">
                    <div className="bg-slate-200 dark:bg-black/20 px-2 py-1 flex items-center justify-center border-r-[1.5px] shrink-0" style={{ borderColor: cellBorderColor, width: '11%' }}>
                      <span className="font-black uppercase text-center leading-none" style={{ fontSize: smallFs }}>Remarks<br/><span className="text-[0.8em] font-bangla">মন্তব্য</span></span>
                    </div>
                    <div className="flex-1 p-2 flex items-center italic truncate" style={{ fontSize: labelFs }}>{line.remarks || '-'}</div>
                  </div>
                </td>
                <td colSpan={14} className="border-r-[1.5px] p-0" style={{ borderColor: cellBorderColor }}>
                  <div className="flex h-full">
                    <div className="flex-1 border-r-[1.5px] flex flex-col" style={{ borderColor: cellBorderColor }}>
                       <div className="bg-slate-100 dark:bg-black/10 px-2 py-0.5 border-b-[1.5px] text-center" style={{ borderColor: cellBorderColor, fontSize: smallFs }}>Line Chief <span className="font-bangla ml-0.5">লাইন চিফ</span></div>
                       <div className="flex-1 flex items-center justify-center font-black truncate px-2" style={{ fontSize: `calc(${labelFs} * 1.35)` }}>{line.line_chief_name || '-'}</div>
                    </div>
                    <div className="flex-1 flex flex-col">
                       <div className="bg-slate-100 dark:bg-black/10 px-2 py-0.5 border-b-[1.5px] text-center" style={{ borderColor: cellBorderColor, fontSize: smallFs }}>Mobile No <span className="font-bangla ml-0.5">মোবাইল নম্বর</span></div>
                       <div className="flex-1 flex items-center justify-center font-black font-mono truncate px-2" style={{ fontSize: `calc(${labelFs} * 1.35)` }}>{line.line_chief_phone || '-'}</div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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

    // Font Clamps based on Request 10
    const hourFs = `clamp(13px, 2.2cqw, ${24 * fsScale}px)`;
    const sigmaFs = `clamp(9px, 1.35cqw, ${14 * fsScale}px)`;
    const totalFs = `clamp(15px, 2.6cqw, ${28 * fsScale}px)`;
    const labelFs = `clamp(10px, 1.2cqw, ${16 * fsScale}px)`;
    const smallFs = `clamp(8px, 1cqw, ${12 * fsScale}px)`;

    return (
      <div className="relative pt-6" style={{ containerType: 'inline-size' } as any}>
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
          <table className="w-full table-fixed border-collapse" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr 
                className="font-black border-b-[2.5px]"
                style={{ backgroundColor: headerBg, borderColor: cellBorderColor, height: `calc(44px * ${fsScale})` }}
              >
                <th className="w-[12%] border-r-[1.5px] px-2 text-left uppercase tracking-tighter" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>Info</th>
                <th className="w-[8%] border-r-[1.5px] px-1 text-center uppercase tracking-widest" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>Parts</th>
                <th className="w-[5.5%] border-r-[1.5px] px-1 text-center uppercase leading-none" style={{ borderColor: cellBorderColor, fontSize: `calc(${labelFs} * 0.8)` }}>Hr.<br/>Tgt</th>
                <th className="w-[6.5%] border-r-[1.5px] px-1 text-center uppercase leading-none" style={{ borderColor: cellBorderColor, fontSize: `calc(${labelFs} * 0.8)` }}>Tot.<br/>Tgt</th>
                {[...Array(10)].map((_, i) => (
                  <th key={i} className="w-[5.1%] border-r-[1.5px] px-1 text-center" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>H{i + 1}</th>
                ))}
                <th className="w-[7%] border-r-[1.5px] px-1 text-center uppercase tracking-widest" style={{ borderColor: cellBorderColor, fontSize: labelFs }}>Total</th>
                <th className="w-[9%] px-1 text-center uppercase tracking-widest" style={{ fontSize: labelFs }}>Remarks</th>
              </tr>
            </thead>
            <tbody className="text-center font-black">
              {parts.map((p, pIdx) => {
                const bd = breakdownByPart[p.id as keyof typeof breakdownByPart];
                const isLast = pIdx === parts.length - 1;
                
                return (
                  <tr 
                    key={p.id} 
                    className="border-b-[1.5px]"
                    style={{ borderColor: cellBorderColor, height: `calc(64px * ${fsScale})` }}
                  >
                    {/* Left Info Block (Buyer, Style, Order Qty, M.P, Target) */}
                    {pIdx === 0 && (
                      <td rowSpan={4} className="border-r-[1.5px] p-0 text-left bg-slate-50 dark:bg-black/20" style={{ borderColor: cellBorderColor }}>
                        <div className="flex flex-col h-full">
                           <div className="p-2 border-b-[1.5px]" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>Buyer</span>
                              <span className="font-black truncate block leading-tight" style={{ fontSize: labelFs }}>{line.buyer_name || '-'}</span>
                           </div>
                           <div className="p-2 border-b-[1.5px]" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>Style</span>
                              <span className="font-black truncate block leading-tight" style={{ fontSize: labelFs }}>{line.style_no || '-'}</span>
                           </div>
                           <div className="p-2 border-b-[1.5px] bg-emerald-50 dark:bg-emerald-950/20" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>Order Qty</span>
                              <span className="font-black block leading-none text-emerald-600 dark:text-emerald-400" style={{ fontSize: `calc(${labelFs} * 1.3)` }}>{line.order_qty || '-'}</span>
                           </div>
                           <div className="p-2 border-b-[1.5px] bg-slate-100 dark:bg-black/30" style={{ borderColor: cellBorderColor }}>
                              <span className="text-slate-400 uppercase font-black tracking-tighter block" style={{ fontSize: smallFs }}>M.P (O/H/I)</span>
                              <div className="font-black flex flex-col gap-0.5" style={{ fontSize: `calc(${smallFs} * 1.1)` }}>
                                 <div className="flex gap-0.5 opacity-60"><span>{line.op || '0'}</span>/<span>{line.hp || '0'}</span>/<span>{line.ir || '0'}</span></div>
                                 <div className="text-[#0F8B8D] font-black" style={{ fontSize: labelFs }}>Tot: {Number(line.op || 0) + Number(line.hp || 0) + Number(line.ir || 0)}</div>
                              </div>
                           </div>
                           <div className="p-2 flex-1 flex flex-col justify-center items-center bg-slate-200 dark:bg-black/50">
                              <span className="block uppercase font-black text-slate-500" style={{ fontSize: smallFs }}>Prod. Target</span>
                              <span className="font-black leading-none text-[#0F8B8D]" style={{ fontSize: `clamp(16px, 2.2cqw, ${24 * fsScale}px)` }}>
                                {breakdownByPart.output.metrics.totalTarget || '-'}
                              </span>
                           </div>
                        </div>
                      </td>
                    )}

                    <td 
                      className="border-r-[1.5px] px-1 text-center relative"
                      style={{ borderColor: cellBorderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC' }}
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: p.stripe }} />
                      <span className="pl-0.5 uppercase font-black whitespace-nowrap" style={{ fontSize: `calc(${labelFs} * 0.9)` }}>{p.label}</span>
                    </td>

                    {/* Hour Target & Total Target Columns */}
                    <td className="border-r-[1.5px] bg-slate-50/30 dark:bg-black/10" style={{ borderColor: cellBorderColor }}>
                       <span className="font-black" style={{ fontSize: labelFs }}>{bd.metrics.hourTarget ?? '-'}</span>
                    </td>
                    <td className="border-r-[1.5px] bg-slate-50/50 dark:bg-black/20" style={{ borderColor: cellBorderColor }}>
                       <span className="font-black text-[#0F8B8D]" style={{ fontSize: labelFs }}>{bd.metrics.totalTarget ?? '-'}</span>
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
                      
                      const isLargeCum = String(hr.cumActual || '').length >= 4;
                      
                      return (
                        <td 
                          key={i} 
                          className="border-r-[1.5px] relative align-middle"
                          style={{ borderColor: cellBorderColor }}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            {hr.hourActual !== null ? (
                              <>
                                <span 
                                  className={`leading-none ${cellColor} whitespace-nowrap`}
                                  style={{ fontSize: hourFs }}
                                >
                                  {hr.hourActual}
                                </span>
                                {p.id !== 'asm' ? (
                                  <span 
                                    className="font-black text-[#0E7490] dark:text-[#5EEAD4] leading-none whitespace-nowrap"
                                    style={{ fontSize: isLargeCum ? `calc(${sigmaFs} * 0.85)` : sigmaFs }}
                                  >
                                    Σ{hr.cumActual}
                                  </span>
                                ) : (
                                  <div style={{ height: sigmaFs }} />
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
                      className="align-middle bg-slate-50/50 dark:bg-black/20"
                    >
                      <div className="flex flex-col items-center justify-center">
                        {bd.metrics.totalActual !== null ? (
                          <>
                            <span 
                              className="text-[#0F8B8D] leading-none whitespace-nowrap"
                              style={{ fontSize: totalFs }}
                            >
                              {bd.metrics.totalActual}
                            </span>
                            {p.id === 'output' && bd.metrics.totalTarget ? (
                              <span 
                                className="font-black text-slate-500 leading-none whitespace-nowrap"
                                style={{ fontSize: smallFs }}
                              >
                                T:{bd.metrics.totalTarget}
                              </span>
                            ) : (
                              <div style={{ height: smallFs }} />
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
                        className="p-1 italic leading-tight align-middle text-center bg-slate-50/20 dark:bg-black/10"
                      >
                        <div 
                          className="max-h-full overflow-y-auto custom-scrollbar break-words font-bold"
                          style={{ fontSize: `calc(${smallFs} * 0.85)` }}
                        >
                          {line.remarks || '-'}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {/* BOTTOM INFO ROW */}
              <tr style={{ height: `calc(48px * ${fsScale})` }}>
                <td colSpan={13} className="border-r-[1.5px] p-0" style={{ borderColor: cellBorderColor }}>
                  <div className="flex h-full">
                    <div className="bg-slate-200 dark:bg-black/20 px-2 py-1 flex items-center justify-center border-r-[1.5px] shrink-0" style={{ borderColor: cellBorderColor, width: '11%' }}>
                      <span className="font-black uppercase text-center leading-none" style={{ fontSize: smallFs }}>Remarks<br/><span className="text-[0.8em] font-bangla">মন্তব্য</span></span>
                    </div>
                    <div className="flex-1 p-2 flex items-center italic truncate" style={{ fontSize: labelFs }}>
                      {line.remarks || '-'}
                    </div>
                  </div>
                </td>
                <td colSpan={14} className="border-r-[1.5px] p-0" style={{ borderColor: cellBorderColor }}>
                  <div className="flex h-full">
                    <div className="flex-1 border-r-[1.5px] flex flex-col" style={{ borderColor: cellBorderColor }}>
                       <div className="bg-slate-100 dark:bg-black/10 px-2 py-0.5 border-b-[1.5px] text-center" style={{ borderColor: cellBorderColor, fontSize: smallFs }}>
                          Line Chief <span className="font-bangla ml-0.5">লাইন চিফ</span>
                       </div>
                       <div className="flex-1 flex items-center justify-center font-black truncate px-2" style={{ fontSize: `calc(${labelFs} * 1.35)` }}>
                          {line.line_chief_name || '-'}
                       </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                       <div className="bg-slate-100 dark:bg-black/10 px-2 py-0.5 border-b-[1.5px] text-center" style={{ borderColor: cellBorderColor, fontSize: smallFs }}>
                          Mobile No <span className="font-bangla ml-0.5">মোবাইল নম্বর</span>
                       </div>
                       <div className="flex-1 flex items-center justify-center font-black font-mono truncate px-2" style={{ fontSize: `calc(${labelFs} * 1.35)` }}>
                          {line.line_chief_phone ? (
                             <a href={`tel:${line.line_chief_phone}`} className="hover:text-[#0F8B8D] transition-colors">{line.line_chief_phone}</a>
                          ) : '-'}
                       </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
        {status === 'excess' && actual !== null && target !== null && (
          <div className="flex items-center gap-1 mt-2 font-black">
            <TrendingUp className="w-4 h-4" />
            <span style={{ fontSize: `calc(11px * ${fsScale})` }}>+{formatNum(actual - target)}</span>
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
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[#0F8B8D]" />
                <h3 className="text-xs font-black uppercase tracking-widest">Sewing Performance</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SummaryChip label="Back" target={combinedSummary.byPart.back.totalTarget} actual={combinedSummary.byPart.back.totalActual} achievement={combinedSummary.byPart.back.achievement} status={combinedSummary.byPart.back.status} />
                <SummaryChip label="Front" target={combinedSummary.byPart.front.totalTarget} actual={combinedSummary.byPart.front.totalActual} achievement={combinedSummary.byPart.front.achievement} status={combinedSummary.byPart.front.status} />
                <SummaryChip label="Out Put" target={combinedSummary.byPart.output.totalTarget} actual={combinedSummary.byPart.output.totalActual} achievement={combinedSummary.byPart.output.achievement} status={combinedSummary.byPart.output.status} />
                <SummaryChip label="A.S.M" target={combinedSummary.byPart.asm.totalTarget} actual={combinedSummary.byPart.asm.totalActual} achievement={combinedSummary.byPart.asm.achievement} status={combinedSummary.byPart.asm.status} />
              </div>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-xs font-black uppercase tracking-widest">Finishing Performance</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SummaryChip label="Inside" target={combinedFinishingSummary.byPart.back.totalTarget} actual={combinedFinishingSummary.byPart.back.totalActual} achievement={combinedFinishingSummary.byPart.back.achievement} status={combinedFinishingSummary.byPart.back.status} />
                <SummaryChip label="Iron" target={combinedFinishingSummary.byPart.front.totalTarget} actual={combinedFinishingSummary.byPart.front.totalActual} achievement={combinedFinishingSummary.byPart.front.achievement} status={combinedFinishingSummary.byPart.front.status} />
                <SummaryChip label="Top Side" target={combinedFinishingSummary.byPart.output.totalTarget} actual={combinedFinishingSummary.byPart.output.totalActual} achievement={combinedFinishingSummary.byPart.output.achievement} status={combinedFinishingSummary.byPart.output.status} />
                <SummaryChip label="Poly" target={combinedFinishingSummary.byPart.asm.totalTarget} actual={combinedFinishingSummary.byPart.asm.totalActual} achievement={combinedFinishingSummary.byPart.asm.achievement} status={combinedFinishingSummary.byPart.asm.status} />
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-6">
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
            
            {finishingChartData.some(d => d.Actual !== null) && (
              <div className={`p-4 h-full rounded-2xl border shadow-sm ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#D97706]" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Finishing Hourly Target vs Actual</h3>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#D97706]" /><span>Target</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /><span>Actual</span></div>
                  </div>
                </div>
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={finishingChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#ffffff10' : '#00000010'} />
                      <XAxis dataKey="name" fontSize={9} fontStyle="bold" axisLine={false} tickLine={false} />
                      <YAxis fontSize={9} fontStyle="bold" axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#0B2E33' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                      <Bar dataKey="Actual" fill="#F59E0B" radius={[2, 2, 0, 0]} barSize={16}>
                        {finishingChartData.map((entry, index) => (
                          <RechartsCell key={index} fill={(entry.Actual || 0) < (entry.Target || 0) ? '#EF4444' : '#F59E0B'} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="Target" stroke="#D97706" strokeWidth={2} dot={{ r: 3, fill: '#D97706', strokeWidth: 1.5, stroke: '#fff' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
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
                <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 gap-6">
                  {unitData[u].lines.map((l: any) => (
                    <LineSheetTable key={l.id} line={l} />
                  ))}
                  {unitData[u].finishing.map((l: any) => (
                    <FinishingSheetTable key={`fin-${l.id}`} line={l} />
                  ))}
                </div>
              </div>
            );
          })}

          {reports.length === 0 && finishingReports.length === 0 && !loading && (
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
