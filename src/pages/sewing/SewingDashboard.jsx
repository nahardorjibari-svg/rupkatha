/**
 * Sewing Executive Management Dashboard
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingDashboard.jsx)
 * Single-screen professional dashboard with real-time sync, KPIs, line cards,
 * heatmap, Recharts 3D-style charts, hourly/cumulative views, and PNG snapshot export.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports, subscribeSewingRealtime } from '../../lib/sewingQueries';
import {
  calculateLineHourTotals,
  calculatePartMetrics,
  calculatePartHourlyBreakdown,
  calculateManagementSummary,
  formatNum,
} from '../../lib/sewingCalc';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  Cog,
  Factory,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Filter,
  Check,
  Layers,
  Maximize2,
  Minimize2,
  Camera,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Activity,
  Zap,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';

const ACCENT_TEAL = '#2BA5B5';
const CHART_GREEN = '#10B981';
const CHART_RED = '#EF4444';
const CHART_YELLOW = '#F59E0B';

export const SewingDashboard = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();
  const dashboardRef = useRef(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('all'); // 'all' | 'knit' | 'woven'
  const [metricPart, setMetricPart] = useState('output'); // 'output' | 'back' | 'front' | 'asm'
  const [chartMode, setChartMode] = useState('hourly'); // 'hourly' | 'cumulative'
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null); // { lineNo, hourNo } for click highlight

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadData = useCallback(async () => {
    try {
      const data = await fetchSewingReports({ date, unit: unitFilter });
      setReports(data || []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to load sewing dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [date, unitFilter]);

  // Initial load & Realtime subscription with 500ms debounce
  useEffect(() => {
    loadData();
    let timeoutId = null;
    const unsubscribe = subscribeSewingRealtime(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadData();
      }, 500);
    });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [loadData]);

  // Auto-refresh timer (30s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Date navigation helpers
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

  // Flatten lines across reports
  const allLines = useMemo(() => {
    const lines = [];
    reports.forEach((rep) => {
      (rep.lines || []).forEach((l) => {
        lines.push({
          ...l,
          report_id: rep.id,
          report_date: rep.report_date,
          factory_unit: rep.factory_unit,
          status: rep.status,
          reporters_name: rep.reporters_name,
        });
      });
    });
    // Sort by line_no
    return lines.sort((a, b) => (a.line_no || 0) - (b.line_no || 0));
  }, [reports]);

  // Management summary for the selected part
  const partSummary = useMemo(() => {
    let totalTarget = 0;
    let totalActual = 0;
    let hasAnyTarget = false;
    let lineMetricsList = [];

    allLines.forEach((l) => {
      const m = calculatePartMetrics(l, metricPart);
      lineMetricsList.push({ ...l, metrics: m });
      if (m.totalTarget !== null) {
        hasAnyTarget = true;
        totalTarget += m.totalTarget;
      }
      if (m.totalActual !== null) {
        totalActual += m.totalActual;
      }
    });

    const shortExcessQty = hasAnyTarget ? totalActual - totalTarget : 0;
    const achievement = (hasAnyTarget && totalTarget > 0) ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : null;
    
    let status = 'no_target';
    let shortQty = 0;
    let shortPct = 0;
    let excessPct = 0;

    if (hasAnyTarget) {
      if (shortExcessQty < 0) {
        status = 'short';
        shortQty = Math.abs(shortExcessQty);
        shortPct = totalTarget > 0 ? Number(((shortQty / totalTarget) * 100).toFixed(1)) : 0;
      } else if (shortExcessQty === 0) {
        status = 'achieved';
      } else {
        status = 'excess';
        excessPct = totalTarget > 0 ? Number(((shortExcessQty / totalTarget) * 100).toFixed(1)) : 0;
      }
    }

    // Best and worst lines
    const validLines = lineMetricsList.filter((l) => l.metrics.achievement !== null);
    validLines.sort((a, b) => (b.metrics.achievement || 0) - (a.metrics.achievement || 0));
    const bestLine = validLines.length > 0 ? validLines[0] : null;
    const worstLine = validLines.length > 0 ? validLines[validLines.length - 1] : null;

    return {
      totalTarget: hasAnyTarget ? totalTarget : null,
      totalActual: totalActual > 0 ? totalActual : null,
      shortExcessQty: hasAnyTarget ? shortExcessQty : null,
      achievement,
      status,
      shortQty,
      shortPct,
      excessPct,
      bestLine,
      worstLine,
      lineMetricsList,
    };
  }, [allLines, metricPart]);

  // Snapshot PNG export using html2canvas
  const handleExportSnapshot = async () => {
    if (!dashboardRef.current) return;
    const toastId = toast.loading('Capturing dashboard snapshot...');
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? '#081C20' : '#F8FAFC',
      });
      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `sewing-dashboard-${metricPart}-${date}.png`;
      a.click();
      toast.success('Snapshot exported successfully!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to export snapshot.', { id: toastId });
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(err);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Chart data 1: Target vs Actual bar chart per line
  const targetVsActualChartData = useMemo(() => {
    return partSummary.lineMetricsList.map((l) => ({
      name: `Line 0${l.line_no}`,
      lineNo: l.line_no,
      buyer: l.buyer_name || 'Buyer',
      Target: l.metrics.totalTarget || 0,
      Actual: l.metrics.totalActual || 0,
      isShort: l.metrics.status === 'short',
    }));
  }, [partSummary.lineMetricsList]);

  // Chart data 2: Hourly Short/Excess or Cumulative Area chart (Hours 1-10)
  const hourlyChartData = useMemo(() => {
    const hoursArr = [];
    let runningActual = 0;
    let runningTarget = 0;

    for (let h = 1; h <= 10; h++) {
      let hActual = 0;
      let hTarget = 0;

      allLines.forEach((l) => {
        const bd = calculatePartHourlyBreakdown(l, metricPart);
        const hrObj = bd.hourly.find((x) => x.hourNo === h);
        if (hrObj && hrObj.hourActual !== null) {
          hActual += hrObj.hourActual;
        }
        if (bd.hourTarget !== null && h <= bd.workingHours) {
          hTarget += bd.hourTarget;
        }
      });

      runningActual += hActual;
      runningTarget += hTarget;
      const hourlyDiff = hActual - hTarget;

      hoursArr.push({
        hour: `H${String(h).padStart(2, '0')}`,
        hourNo: h,
        'Hour Actual': hActual,
        'Hour Target': hTarget > 0 ? Math.round(hTarget / allLines.length || 1) : 0,
        'Hourly Diff': hourlyDiff,
        'Cum Actual': runningActual,
        'Cum Target': runningTarget,
      });
    }
    return hoursArr;
  }, [allLines, metricPart]);

  // Top 5 shortages for bottom ticker
  const topShortages = useMemo(() => {
    const list = [...partSummary.lineMetricsList];
    list.sort((a, b) => (a.metrics.shortExcessQty || 0) - (b.metrics.shortExcessQty || 0));
    return list.filter((l) => l.metrics.status === 'short').slice(0, 5);
  }, [partSummary.lineMetricsList]);

  return (
    <AdminLayout>
      <div
        ref={dashboardRef}
        className={`min-h-[calc(100vh-5rem)] flex flex-col justify-between transition-colors p-2 sm:p-4 rounded-3xl ${
          isDark ? 'bg-[#06171A] text-white' : 'bg-slate-100/70 text-slate-900'
        }`}
      >
        {/* TOP BAR (Compact, One Row) */}
        <div
          className={`px-4 py-3 rounded-2xl border shadow-soft-sm flex flex-wrap items-center justify-between gap-3 mb-4 ${
            isDark ? 'bg-[#0B2E33] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Left: Title & Date Picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-black tracking-wider uppercase text-[#2BA5B5]">LIVE</span>
            </div>

            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-current/10">
              <button
                type="button"
                onClick={handlePrevDate}
                className="p-1 rounded-lg hover:bg-current/10 transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="w-3.5 h-3.5 text-[#2BA5B5]" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={handleNextDate}
                className="p-1 rounded-lg hover:bg-current/10 transition-colors text-slate-500 hover:text-slate-900 dark:hover:text-white"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Knit / Woven / Both selector */}
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-current/10">
              <Factory className="w-3.5 h-3.5 text-[#2BA5B5] ml-1" />
              {['all', 'knit', 'woven'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnitFilter(u)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase transition-all cursor-pointer ${
                    unitFilter === u ? 'bg-[#2BA5B5] text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Center: Metric Selector */}
          <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-current/10">
            <span className="text-[11px] font-bold px-2 text-slate-400">Metric:</span>
            {[
              { id: 'output', label: 'Out Put' },
              { id: 'back', label: 'Back' },
              { id: 'front', label: 'Front' },
              { id: 'asm', label: 'A.S.M' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMetricPart(p.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  metricPart === p.id ? 'bg-[#0F8B8D] text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Right actions: Auto-refresh, Snapshot, Fullscreen, Synced */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
                autoRefresh ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
              }`}
              title="Auto-refresh every 30s"
            >
              <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin-slow' : ''}`} />
              <span>{autoRefresh ? 'Live 30s' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportSnapshot}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-[#2BA5B5]/10 text-[#2BA5B5] border border-[#2BA5B5]/30 hover:bg-[#2BA5B5]/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Export PNG Snapshot"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Snapshot</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl bg-current/5 hover:bg-current/10 border border-current/10 transition-colors cursor-pointer text-slate-600 dark:text-slate-300"
              title="Fullscreen / TV Mode"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CONTENT GRID CONTAINER (Fits viewport on desktop) */}
        <div className="flex flex-col gap-4 flex-1">

          {/* ROW 1: 4 KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Target */}
            <div className={`p-4 rounded-2xl border shadow-soft ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Target (লক্ষ্যমাত্রা)</span>
                <span className="p-1.5 rounded-xl bg-[#2BA5B5]/10 text-[#2BA5B5]">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-black tracking-tight font-mono">
                  {partSummary.totalTarget !== null ? formatNum(partSummary.totalTarget) : '-'}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  {metricPart.toUpperCase()} Part
                </span>
              </div>
            </div>

            {/* KPI 2: Total Actual */}
            <div className={`p-4 rounded-2xl border shadow-soft ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Actual (প্রকৃত)</span>
                <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className="text-2xl font-black tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
                  {partSummary.totalActual !== null ? formatNum(partSummary.totalActual) : '-'}
                </h3>
                {partSummary.achievement !== null && (
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                    {partSummary.achievement}% Ach
                  </span>
                )}
              </div>
            </div>

            {/* KPI 3: Short / Excess Qty */}
            <div className={`p-4 rounded-2xl border shadow-soft ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {partSummary.status === 'short' ? 'Shortage (ঘাটতি)' : partSummary.status === 'excess' ? 'Excess (অতিরিক্ত)' : 'Short / Excess'}
                </span>
                <span className={`p-1.5 rounded-xl ${
                  partSummary.status === 'short' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {partSummary.status === 'short' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <h3 className={`text-2xl font-black tracking-tight font-mono ${
                  partSummary.status === 'short' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {partSummary.shortExcessQty !== null ? (
                    `${partSummary.shortExcessQty > 0 ? '+' : ''}${formatNum(partSummary.shortExcessQty)}`
                  ) : '-'}
                </h3>
                {partSummary.status === 'short' && (
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300">
                    -{partSummary.shortPct}%
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: Best / Worst Line Chips */}
            <div className={`p-4 rounded-2xl border shadow-soft ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Line Performance Status</span>
                <Award className="w-4 h-4 text-[#2BA5B5]" />
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Best Line:</span>
                  <span className="font-bold text-emerald-500">
                    {partSummary.bestLine ? `Line 0${partSummary.bestLine.line_no} (${partSummary.bestLine.metrics.achievement}%)` : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Lowest Line:</span>
                  <span className="font-bold text-rose-500">
                    {partSummary.worstLine ? `Line 0${partSummary.worstLine.line_no} (${partSummary.worstLine.metrics.achievement}%)` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: 4 LINE CARDS (Line 01 to 04 / Active Lines) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {partSummary.lineMetricsList.map((l, idx) => {
              const m = l.metrics;
              const isWorst = partSummary.worstLine && partSummary.worstLine.line_no === l.line_no && m.status === 'short';
              const isBest = partSummary.bestLine && partSummary.bestLine.line_no === l.line_no;
              const bd = calculatePartHourlyBreakdown(l, metricPart);

              return (
                <div
                  key={l.id || l.line_no}
                  className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
                    isWorst
                      ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5'
                      : isBest
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Badges on card */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {isWorst && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500 text-white animate-pulse">
                        WORST
                      </span>
                    )}
                    {isBest && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white">
                        BEST
                      </span>
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      m.status === 'achieved' || m.status === 'excess' ? 'bg-emerald-500' : m.status === 'short' ? 'bg-rose-500' : 'bg-slate-400'
                    }`} />
                  </div>

                  {/* Header */}
                  <div className="mb-3">
                    <div className="text-[11px] font-black uppercase text-[#2BA5B5] tracking-wider">
                      LINE 0{l.line_no} · {l.factory_unit || 'Unit'}
                    </div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate mt-0.5">
                      {l.buyer_name || 'Buyer'} <span className="font-normal text-slate-400">/ {l.style_no || 'Style'}</span>
                    </div>
                  </div>

                  {/* 3 Large Numbers: TARGET, ACTUAL, SHORT */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-current/10 my-2 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-sans">Target</span>
                      <span className="text-sm font-extrabold">{m.totalTarget !== null ? formatNum(m.totalTarget) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-sans">Actual</span>
                      <span className="text-sm font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">{m.totalActual !== null ? formatNum(m.totalActual) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-sans">Short/Exc</span>
                      <span className={`text-sm font-extrabold ${
                        m.shortExcessQty !== null && m.shortExcessQty < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {m.shortExcessQty !== null ? `${m.shortExcessQty > 0 ? '+' : ''}${formatNum(m.shortExcessQty)}` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Achievement Bar & Percentage */}
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-slate-400 font-medium">Achievement:</span>
                    <span className={`font-black ${
                      m.achievement >= 100 ? 'text-emerald-500' : m.achievement >= 90 ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {m.achievement !== null ? `${m.achievement}%` : 'No Target'}
                    </span>
                  </div>

                  {/* Mini Row of 10 Hour Dots / Squares (01-10) */}
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 flex items-center justify-between">
                      <span>Hourly Progress (H1-H10):</span>
                      <span>{m.enteredHoursCount}/{m.workingHours} hrs</span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {bd.hourly.map((hObj) => {
                        const isEntered = hObj.hourActual !== null;
                        const isShortH = hObj.hourDiff !== null && hObj.hourDiff < 0;
                        const isExcessH = hObj.hourDiff !== null && hObj.hourDiff > 0;
                        const isSelected = selectedCell && selectedCell.lineNo === l.line_no && selectedCell.hourNo === hObj.hourNo;

                        return (
                          <div
                            key={hObj.hourNo}
                            onClick={() => setSelectedCell({ lineNo: l.line_no, hourNo: hObj.hourNo })}
                            title={hObj.tooltip || `Hour ${hObj.hourNo}: No entry`}
                            className={`h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold cursor-pointer transition-all ${
                              isSelected
                                ? 'ring-2 ring-cyan-400 scale-110 z-10'
                                : ''
                            } ${
                              !isEntered
                                ? 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                : isShortH
                                ? 'bg-rose-500 text-white shadow-xs'
                                : isExcessH
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-emerald-500 text-white shadow-xs'
                            }`}
                          >
                            {hObj.hourNo}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ROW 3: MAIN VISUALS (3 PANELS) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Panel 1: Heatmap "Line x Hour Shortage" */}
            <div className={`p-5 rounded-2xl border shadow-soft flex flex-col justify-between ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#2BA5B5]" />
                    <h3 className="font-extrabold text-sm tracking-tight text-slate-800 dark:text-white">
                      Line × Hour Shortage Heatmap (প্রতি ঘণ্টা ঘাটতি)
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Click cell to filter</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Red = Short | Green = Met/Excess | Gray = No entry/target
                </p>

                {/* Heatmap Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-current/15 text-slate-400">
                        <th className="py-1.5 px-2 text-left font-bold">Line</th>
                        {[...Array(10)].map((_, i) => (
                          <th key={i} className="py-1.5 px-1 text-center font-bold">H{i + 1}</th>
                        ))}
                        <th className="py-1.5 px-2 text-right font-bold">Total Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partSummary.lineMetricsList.map((l) => {
                        const bd = calculatePartHourlyBreakdown(l, metricPart);
                        const isHighlighted = selectedCell && selectedCell.lineNo === l.line_no;

                        return (
                          <tr
                            key={l.line_no}
                            className={`border-b border-current/10 transition-colors ${
                              isHighlighted ? 'bg-[#2BA5B5]/15' : 'hover:bg-current/5'
                            }`}
                          >
                            <td className="py-2 px-2 font-bold text-[#2BA5B5]">Line 0{l.line_no}</td>
                            {bd.hourly.map((hObj) => {
                              const diff = hObj.hourDiff;
                              const isSelected = selectedCell && selectedCell.lineNo === l.line_no && selectedCell.hourNo === hObj.hourNo;

                              let cellBg = 'bg-slate-200 dark:bg-white/5 text-slate-400';
                              if (diff !== null) {
                                if (diff < 0) cellBg = 'bg-rose-500/80 text-white font-black';
                                else if (diff === 0) cellBg = 'bg-emerald-500/80 text-white font-black';
                                else cellBg = 'bg-amber-500/80 text-white font-black';
                              }

                              return (
                                <td key={hObj.hourNo} className="p-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCell({ lineNo: l.line_no, hourNo: hObj.hourNo })}
                                    className={`w-full py-1 rounded text-[11px] transition-all cursor-pointer ${cellBg} ${
                                      isSelected ? 'ring-2 ring-cyan-300 scale-110' : ''
                                    }`}
                                    title={`Line 0${l.line_no} Hour ${hObj.hourNo}: Diff ${diff !== null ? (diff > 0 ? `+${diff}` : diff) : 'N/A'}`}
                                  >
                                    {diff !== null ? (diff > 0 ? `+${diff}` : diff) : '-'}
                                  </button>
                                </td>
                              );
                            })}
                            <td className={`py-2 px-2 text-right font-black ${
                              (l.metrics.shortExcessQty || 0) < 0 ? 'text-rose-500' : 'text-emerald-500'
                            }`}>
                              {l.metrics.shortExcessQty !== null ? `${l.metrics.shortExcessQty > 0 ? '+' : ''}${l.metrics.shortExcessQty}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Panel 2: Target vs Actual Bar Chart */}
            <div className={`p-5 rounded-2xl border shadow-soft flex flex-col justify-between ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#2BA5B5]" />
                    <h3 className="font-extrabold text-sm tracking-tight text-slate-800 dark:text-white">
                      Target vs Actual per Line ({metricPart.toUpperCase()})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Recharts 3D</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Comparison of total assigned target versus actual output produced.
                </p>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={targetVsActualChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                      <XAxis dataKey="name" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} />
                      <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#0B2E33' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1',
                          borderRadius: '12px',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Target" fill="#2BA5B5" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Actual" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Panel 3: Hourly Short/Excess Chart (Toggle Hourly / Cumulative) */}
            <div className={`p-5 rounded-2xl border shadow-soft flex flex-col justify-between ${isDark ? 'bg-[#0D3137] border-white/10' : 'bg-white border-slate-200'}`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#2BA5B5]" />
                    <h3 className="font-extrabold text-sm tracking-tight text-slate-800 dark:text-white">
                      Hourly Trend ({chartMode === 'hourly' ? 'Hourly Diff' : 'Cumulative Actual'})
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-lg p-0.5 border border-current/10">
                    <button
                      type="button"
                      onClick={() => setChartMode('hourly')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                        chartMode === 'hourly' ? 'bg-[#2BA5B5] text-white' : 'text-slate-400'
                      }`}
                    >
                      Hourly
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode('cumulative')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                        chartMode === 'cumulative' ? 'bg-[#2BA5B5] text-white' : 'text-slate-400'
                      }`}
                    >
                      Cumulative
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  {chartMode === 'hourly' ? 'Positive or negative variance per hour' : 'Running actual vs cumulative target'}
                </p>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartMode === 'hourly' ? (
                      <BarChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                        <XAxis dataKey="hour" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} />
                        <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#0B2E33' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1',
                            borderRadius: '12px',
                            color: isDark ? '#FFFFFF' : '#0F172A',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="Hourly Diff" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : (
                      <AreaChart data={hourlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                        <XAxis dataKey="hour" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} />
                        <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? '#0B2E33' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1',
                            borderRadius: '12px',
                            color: isDark ? '#FFFFFF' : '#0F172A',
                            fontSize: '12px',
                          }}
                        />
                        <Area type="monotone" dataKey="Cum Actual" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
                        <Area type="monotone" dataKey="Cum Target" stroke="#2BA5B5" fill="#2BA5B5" fillOpacity={0.1} />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>

          {/* ROW 4: SLIM STRIP FOOTER */}
          <div
            className={`px-4 py-3 rounded-2xl border shadow-soft-sm flex flex-wrap items-center justify-between gap-4 text-xs ${
              isDark ? 'bg-[#0B2E33] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#2BA5B5] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Top Shortages:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                {topShortages.length > 0 ? (
                  topShortages.map((l) => (
                    <span
                      key={l.line_no}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold flex items-center gap-1.5 shrink-0"
                    >
                      Line 0{l.line_no} ({l.buyer_name}): {l.metrics.shortExcessQty} pcs (-{l.metrics.shortPct}%)
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> No active line shortages on this metric!
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Secure Supabase Realtime Sync
              </span>
              <span>·</span>
              <span>Rupkatha ERP Suite</span>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
};
