/**
 * Sewing Dashboard Page
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingDashboard.jsx)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports, subscribeSewingRealtime } from '../../lib/sewingQueries';
import { calculateLineHourTotals, calculateAchievement, calculateOutputPerManpower, formatNum } from '../../lib/sewingCalc';
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
  ReferenceLine,
} from 'recharts';
import {
  Cog,
  Factory,
  Calendar,
  Users,
  TrendingUp,
  Award,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Filter,
} from 'lucide-react';

const ACCENT_TEAL = '#2BA5B5';
const CHART_GREEN = '#2F9E44';
const CHART_YELLOW = '#E6D83A';
const CHART_ORANGE = '#F4A62A';

export const SewingDashboard = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [compareYesterday, setCompareYesterday] = useState(false);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSewingReports({ date, unit: unitFilter, status: statusFilter });
      setReports(data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load sewing dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [date, unitFilter, statusFilter]);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeSewingRealtime(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, [loadData]);

  // Flatten lines
  const allLines = useMemo(() => {
    const lines = [];
    reports.forEach((rep) => {
      (rep.lines || []).forEach((l) => {
        lines.push({
          ...l,
          report_date: rep.report_date,
          factory_unit: rep.factory_unit,
          status: rep.status,
        });
      });
    });
    return lines;
  }, [reports]);

  // KPI Calculations (NULL-safe)
  const kpis = useMemo(() => {
    let totalOutput = 0;
    let totalBack = 0;
    let totalFront = 0;
    let totalManpower = 0;
    let totalTarget = 0;
    let hasTarget = false;

    let bestLine = null;
    let lowestLine = null;
    let maxAch = -1;
    let minAch = 999;

    allLines.forEach((l) => {
      const { totalBack: b, totalFront: f, totalOutput: out } = calculateLineHourTotals(l.hours || []);
      if (out !== null) totalOutput += out;
      if (b !== null) totalBack += b;
      if (f !== null) totalFront += f;
      if (l.manpower_total !== null) totalManpower += Number(l.manpower_total);
      if (l.total_target !== null) {
        totalTarget += Number(l.total_target);
        hasTarget = true;
      }

      const ach = calculateAchievement(out, l.total_target);
      if (ach !== null) {
        if (ach > maxAch) {
          maxAch = ach;
          bestLine = `Line ${l.line_no} (${l.factory_unit?.toUpperCase()})`;
        }
        if (ach < minAch) {
          minAch = ach;
          lowestLine = `Line ${l.line_no} (${l.factory_unit?.toUpperCase()})`;
        }
      }
    });

    const overallAch = hasTarget && totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : null;
    const opm = totalManpower > 0 ? Number((totalOutput / totalManpower).toFixed(1)) : null;

    return {
      totalOutput,
      totalBack,
      totalFront,
      totalManpower,
      totalTarget: hasTarget ? totalTarget : null,
      overallAch,
      opm,
      bestLine: bestLine || 'N/A',
      lowestLine: lowestLine || 'N/A',
    };
  }, [allLines]);

  // Hourly Output Grouped Chart Data (Hours 1 to 10)
  const hourlyChartData = useMemo(() => {
    const hourMap = {};
    for (let h = 1; h <= 10; h++) {
      hourMap[h] = { hour: `Hour ${h}`, output: 0, back: 0, front: 0, target: 0 };
    }

    allLines.forEach((l) => {
      const hTarget = l.hour_target || 0;
      (l.hours || []).forEach((h) => {
        if (hourMap[h.hour_no]) {
          if (h.output_qty !== null) hourMap[h.hour_no].output += Number(h.output_qty);
          if (h.back_qty !== null) hourMap[h.hour_no].back += Number(h.back_qty);
          if (h.front_qty !== null) hourMap[h.hour_no].front += Number(h.front_qty);
          hourMap[h.hour_no].target += Number(hTarget);
        }
      });
    });

    return Object.values(hourMap);
  }, [allLines]);

  // Line-wise Total Output Chart Data
  const lineOutputData = useMemo(() => {
    return allLines.map((l) => {
      const { totalOutput } = calculateLineHourTotals(l.hours || []);
      return {
        name: `Line ${l.line_no} (${l.factory_unit?.toUpperCase()})`,
        output: totalOutput || 0,
        target: l.total_target || 0,
        buyer: l.buyer_name || 'Buyer',
      };
    });
  }, [allLines]);

  // Cumulative Output Line Chart Data
  const cumulativeChartData = useMemo(() => {
    let runningOutput = 0;
    const hourMap = {};
    for (let h = 1; h <= 10; h++) {
      hourMap[h] = { hour: `H${h}`, cumulative: 0 };
    }

    for (let h = 1; h <= 10; h++) {
      let sumH = 0;
      allLines.forEach((l) => {
        const hr = (l.hours || []).find((x) => x.hour_no === h);
        if (hr && hr.output_qty !== null) {
          sumH += Number(hr.output_qty);
        }
      });
      runningOutput += sumH;
      hourMap[h].cumulative = runningOutput;
    }

    return Object.values(hourMap);
  }, [allLines]);

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#2BA5B5]/10 text-[#2BA5B5] border border-[#2BA5B5]/30 mb-2">
              <Cog className="w-3.5 h-3.5 animate-spin-slow" />
              <span>{companyName} · Sewing Production Floor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sewing Live Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 font-bangla mt-1">
              সুইং লাইন লাইভ প্রোডাকশন ড্যাশবোর্ড ও রিয়েল-টাইম মনিটরিং
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#475569] dark:text-slate-400 font-medium">
              Last synced: {lastUpdated.toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#2BA5B5] text-white shadow-sm hover:bg-[#238a98] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          className={`p-4 rounded-2xl border shadow-soft-sm flex flex-wrap items-center justify-between gap-4 transition-colors ${
            isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2BA5B5]" />
              <label className="text-xs font-bold text-[#334155] dark:text-slate-300">Date (BDT):</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none transition-colors ${
                  isDark ? 'bg-white/5 border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>

            {/* Factory Unit Filter */}
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-[#2BA5B5]" />
              <label className="text-xs font-bold text-[#334155] dark:text-slate-300">Unit:</label>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none cursor-pointer ${
                  isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Units (Knit &amp; Woven)</option>
                <option value="knit">Knit Plant</option>
                <option value="woven">Woven Plant</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#2BA5B5]" />
              <label className="text-xs font-bold text-[#334155] dark:text-slate-300">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none cursor-pointer ${
                  isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* Compare Yesterday Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-[#475569] dark:text-slate-300">Compare Yesterday:</span>
            <button
              type="button"
              onClick={() => setCompareYesterday(!compareYesterday)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                compareYesterday ? 'bg-[#2BA5B5]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${
                  compareYesterday ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 6 KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className={`p-5 rounded-2xl border shadow-soft-sm ${isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">Total Output</p>
            <p className="text-2xl font-extrabold text-[#0E7490] dark:text-white mt-2 font-mono">
              {formatNum(kpis.totalOutput)}
            </p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-1 font-medium">Pieces produced today</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-soft-sm ${isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">Total Target</p>
            <p className="text-2xl font-extrabold text-[#15803D] dark:text-emerald-400 mt-2 font-mono">
              {formatNum(kpis.totalTarget)}
            </p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-1 font-medium">Scheduled production</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-soft-sm ${isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">Achievement %</p>
            <p className="text-2xl font-extrabold text-[#B45309] dark:text-yellow-400 mt-2 font-mono">
              {kpis.overallAch !== null ? `${kpis.overallAch}%` : '-'}
            </p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-1 font-medium">Output vs Target ratio</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-soft-sm ${isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">Total Manpower</p>
            <p className="text-2xl font-extrabold text-[#C2410C] dark:text-amber-400 mt-2 font-mono">
              {formatNum(kpis.totalManpower)}
            </p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-1 font-medium">Active operators</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-soft-sm ${isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">Output / Manpower</p>
            <p className="text-2xl font-extrabold text-[#0E7490] dark:text-teal-300 mt-2 font-mono">
              {kpis.opm !== null ? kpis.opm : '-'}
            </p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-1 font-medium">Pcs per operator</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-soft-sm ${isDark ? 'bg-[#103A40] border-white/10' : 'glass-card'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-[#334155] dark:text-slate-400">Best Line</p>
            <p className="text-sm font-bold text-[#15803D] dark:text-emerald-400 mt-2 truncate">
              {kpis.bestLine}
            </p>
            <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-1 font-medium">Highest efficiency</p>
          </div>
        </div>

        {/* CHARTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Hourly Output Grouped Bar Chart */}
          <div className={`p-6 rounded-3xl border shadow-soft-lg ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div>
                <h3 className="font-bold text-base tracking-tight">Hourly Output vs Target (Hours 01–10)</h3>
                <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">ঘণ্টাভিত্তিক উৎপাদন তুলনা</p>
              </div>
              <TrendingUp className="w-4 h-4 text-[#2BA5B5]" />
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                  <XAxis dataKey="hour" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className={`p-3 rounded-2xl text-xs shadow-lg border ${isDark ? 'bg-[#0B2E33] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                            <p className="font-bold">{payload[0].payload.hour}</p>
                            <p className="text-[#2BA5B5] mt-1">Output: <strong>{payload[0].value} pcs</strong></p>
                            <p className="text-emerald-400">Back: <strong>{payload[0].payload.back} pcs</strong></p>
                            <p className="text-amber-400">Front: <strong>{payload[0].payload.front} pcs</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="output" fill={ACCENT_TEAL} radius={[6, 6, 0, 0]} maxBarSize={28} name="Output Pcs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2. Line-wise Total Output */}
          <div className={`p-6 rounded-3xl border shadow-soft-lg ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div>
                <h3 className="font-bold text-base tracking-tight">Line-wise Total Output vs Target</h3>
                <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">লাইন অনুযায়ী মোট উৎপাদন</p>
              </div>
              <Award className="w-4 h-4 text-[#2BA5B5]" />
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineOutputData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                  <XAxis dataKey="name" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className={`p-3 rounded-2xl text-xs shadow-lg border ${isDark ? 'bg-[#0B2E33] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                            <p className="font-bold">{payload[0].payload.name} ({payload[0].payload.buyer})</p>
                            <p className="text-[#2BA5B5] mt-1">Output: <strong>{payload[0].value}</strong></p>
                            <p className="text-slate-300">Target: <strong>{payload[0].payload.target}</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="output" fill={CHART_GREEN} radius={[6, 6, 0, 0]} maxBarSize={32} name="Output Pcs" />
                  <Bar dataKey="target" fill={CHART_ORANGE} radius={[6, 6, 0, 0]} maxBarSize={32} name="Target Pcs" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CUMULATIVE OUTPUT LINE CHART */}
        <div className={`p-6 rounded-3xl border shadow-soft-lg ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 className="font-bold text-base tracking-tight">Cumulative Hourly Output Trend</h3>
              <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">সঞ্চয়মূলক উৎপাদন অগ্রগতি</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#2BA5B5]/15 text-[#2BA5B5]">
              Realtime Growth
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                <XAxis dataKey="hour" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`p-3 rounded-2xl text-xs shadow-lg border ${isDark ? 'bg-[#0B2E33] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                          <p className="font-bold">{payload[0].payload.hour}</p>
                          <p className="text-[#2BA5B5] mt-1">Cumulative Output: <strong>{payload[0].value} pcs</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="cumulative" stroke={ACCENT_TEAL} strokeWidth={3} dot={{ fill: ACCENT_TEAL, r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LINE STATUS TABLE */}
        <div className={`p-6 rounded-3xl border shadow-soft-lg ${isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'}`}>
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 className="font-bold text-base tracking-tight">Active Sewing Lines Status &amp; Progress</h3>
              <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">সুইং লাইনের বর্তমান অবস্থা ও অগ্রগতি</p>
            </div>
            <span className="text-xs font-bold text-[#2BA5B5]">{allLines.length} Lines Online</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-[#334155]'}`}>
                  <th className="py-3 px-3 font-bold">Line</th>
                  <th className="py-3 px-3 font-bold">Unit</th>
                  <th className="py-3 px-3 font-bold">Buyer &amp; Style</th>
                  <th className="py-3 px-3 font-bold text-center">Manpower</th>
                  <th className="py-3 px-3 font-bold text-center">Target</th>
                  <th className="py-3 px-3 font-bold text-center">Output</th>
                  <th className="py-3 px-3 font-bold text-center">Achievement</th>
                  <th className="py-3 px-3 font-bold">Progress Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allLines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#475569] dark:text-slate-400">
                      No sewing lines found for the selected date and filters.
                    </td>
                  </tr>
                ) : (
                  allLines.map((l) => {
                    const { totalOutput } = calculateLineHourTotals(l.hours || []);
                    const ach = calculateAchievement(totalOutput, l.total_target);

                    return (
                      <tr key={l.id} className={`hover:bg-white/5 transition-colors ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>
                        <td className="py-3.5 px-3 font-bold">Line {l.line_no}</td>
                        <td className="py-3.5 px-3 uppercase font-semibold text-[#2BA5B5]">{l.factory_unit}</td>
                        <td className="py-3.5 px-3">
                          <p className="font-bold">{l.buyer_name || '-'}</p>
                          <p className="text-[10px] text-[#475569] dark:text-slate-400">{l.style_no || '-'}</p>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold">{l.manpower_total ?? '-'}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-semibold">{l.total_target ?? '-'}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-[#2BA5B5]">{totalOutput ?? '-'}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold">
                          {ach !== null ? `${ach}%` : '-'}
                        </td>
                        <td className="py-3.5 px-3 w-48">
                          <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-2.5 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(ach || 0, 100)}%`,
                                backgroundColor: (ach || 0) >= 90 ? CHART_GREEN : (ach || 0) >= 70 ? CHART_YELLOW : CHART_ORANGE,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SewingDashboard;
