/**
 * Sewing Dashboard Page
 * Rupkatha Apparels Ltd. (src/pages/sewing/SewingDashboard.jsx)
 * Provides Top Management View, Day Summary, Target vs Actual Bar Chart,
 * Cumulative Actual vs Target Line Chart, and Short Qty By Line Bar Chart.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useCompany } from '../../context/CompanyContext';
import { fetchSewingReports, subscribeSewingRealtime } from '../../lib/sewingQueries';
import {
  calculateLineHourTotals,
  calculateAchievement,
  calculateOutputPerManpower,
  calculatePartMetrics,
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
} from 'lucide-react';

const ACCENT_TEAL = '#2BA5B5';
const CHART_GREEN = '#10B981';
const CHART_RED = '#EF4444';
const CHART_YELLOW = '#F59E0B';

export const SewingDashboard = () => {
  const { isDark } = useTheme();
  const { companyName } = useCompany();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [chartPart, setChartPart] = useState('output'); // 'output' | 'back' | 'front'

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

  // Management Summary
  const daySummary = useMemo(() => {
    return calculateManagementSummary(allLines);
  }, [allLines]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalOutput = 0;
    let totalManpower = 0;

    allLines.forEach((l) => {
      const { totalOutput: out } = calculateLineHourTotals(l.hours || []);
      if (out !== null) totalOutput += out;
      const op = Number(l.op) || 0;
      const hp = Number(l.hp) || 0;
      const ir = Number(l.ir) || 0;
      totalManpower += op + hp + ir;
    });

    const outData = daySummary.byPart.output || {};
    const opm = totalManpower > 0 ? Number((totalOutput / totalManpower).toFixed(1)) : null;

    return {
      totalOutput,
      totalManpower,
      opm,
      totalTarget: outData.totalTarget,
      overallAch: outData.achievement,
      shortQty: outData.shortQty,
      shortPct: outData.shortPct,
      bestLine: daySummary.bestLine ? `Line 0${daySummary.bestLine.lineNo}` : 'N/A',
      worstLine: daySummary.worstLine ? `Line 0${daySummary.worstLine.lineNo}` : 'N/A',
    };
  }, [allLines, daySummary]);

  const hasAnyTarget = useMemo(() => {
    return allLines.some((l) => {
      const m = calculatePartMetrics(l, chartPart);
      return m.totalTarget !== null && m.totalTarget > 0;
    });
  }, [allLines, chartPart]);

  // 1. Target vs Actual Bar Chart Data per Line
  const lineTargetVsActualData = useMemo(() => {
    return allLines.map((l) => {
      const m = calculatePartMetrics(l, chartPart);
      return {
        line: `Line 0${l.line_no}`,
        buyer: l.buyer_name || 'Buyer',
        target: m.totalTarget || 0,
        actual: m.totalActual || 0,
        hasTarget: m.totalTarget !== null,
      };
    });
  }, [allLines, chartPart]);

  // 2. Cumulative Actual vs Cumulative Target per Hour (Hours 1 to 10)
  const cumulativeHourlyData = useMemo(() => {
    const hours = [];
    let runningActual = 0;
    let runningTarget = 0;

    const qtyKey = chartPart === 'back' ? 'back_qty' : chartPart === 'front' ? 'front_qty' : chartPart === 'asm' ? 'asm' : 'output_qty';
    const targetKey = chartPart === 'back' ? 'back_hour_target' : chartPart === 'front' ? 'front_hour_target' : chartPart === 'asm' ? 'asm_hour_target' : 'output_hour_target';

    for (let h = 1; h <= 10; h++) {
      let hActual = 0;
      let hTarget = 0;

      allLines.forEach((l) => {
        const hr = (l.hours || []).find((x) => x.hour_no === h);
        if (hr && hr[qtyKey] !== null && hr[qtyKey] !== undefined && hr[qtyKey] !== '') {
          hActual += Number(hr[qtyKey]);
        }
        const wHrs = l.working_hours || 8;
        if (h <= wHrs && l[targetKey] !== null && l[targetKey] !== undefined) {
          hTarget += Number(l[targetKey]) || 0;
        }
      });

      runningActual += hActual;
      runningTarget += hTarget;

      hours.push({
        hour: `H${String(h).padStart(2, '0')}`,
        cumActual: runningActual,
        cumTarget: runningTarget,
      });
    }

    return hours;
  }, [allLines, chartPart]);

  // 3. Short Qty by Line Bar Chart Data (Red Bars)
  const lineShortData = useMemo(() => {
    return allLines.map((l) => {
      const m = calculatePartMetrics(l, chartPart);
      const shortQty = m.shortExcessQty !== null && m.shortExcessQty < 0 ? Math.abs(m.shortExcessQty) : 0;
      return {
        line: `Line 0${l.line_no}`,
        buyer: l.buyer_name || '-',
        shortQty,
        hasTarget: m.totalTarget !== null,
        status: m.status,
      };
    });
  }, [allLines, chartPart]);

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#2BA5B5]/10 text-[#2BA5B5] border border-[#2BA5B5]/30 mb-2">
              <Cog className="w-3.5 h-3.5 animate-spin-slow" />
              <span>{companyName} · Sewing Production Floor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sewing Executive Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-400 font-bangla mt-1">
              সুইং লাইন লক্ষ্যমাত্রা, ঘাটতি ট্র্যাকিং এবং লাইভ উৎপাদন পারফরম্যান্স
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#475569] dark:text-slate-400 font-medium">
              Synced: {lastUpdated.toLocaleTimeString()}
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

        {/* Filter Toolbar */}
        <div
          className={`p-4 rounded-2xl border shadow-soft-sm flex flex-wrap items-center justify-between gap-4 transition-colors ${
            isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-center gap-4">
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

            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-[#2BA5B5]" />
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl border outline-none cursor-pointer ${
                  isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="all">All Factory Units</option>
                <option value="knit">Knit Plant</option>
                <option value="woven">Woven Plant</option>
              </select>
            </div>
          </div>

          {/* Toggle for Part selection in charts */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10">
            <span className="text-[11px] font-bold px-2 text-slate-500">Charts Part:</span>
            {[
              { id: 'output', label: 'Out Put' },
              { id: 'back', label: 'Back' },
              { id: 'front', label: 'Front' },
              { id: 'asm', label: 'A.S.M' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setChartPart(p.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  chartPart === p.id ? 'bg-[#2BA5B5] text-white shadow-xs font-bold' : 'text-[#475569] dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TOP MANAGEMENT VIEW: DAY SUMMARY CARD */}
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
                  Top Management Day Summary · উৎপাদন ও ঘাটতি নিরীক্ষা
                </h3>
              </div>
              <p className="text-xs text-[#475569] dark:text-slate-400 mt-0.5">
                Target vs Actual comparisons and Short/Excess calculations across all active lines
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {daySummary.bestLine && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Best: Line 0{daySummary.bestLine.lineNo} ({daySummary.bestLine.output.achievement}%)
                </span>
              )}
              {daySummary.worstLine && daySummary.worstLine.lineNo !== daySummary.bestLine?.lineNo && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Shortest: Line 0{daySummary.worstLine.lineNo} ({daySummary.worstLine.output.achievement}%)
                </span>
              )}
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { key: 'output', label: 'Out Put (সর্বমোট পোশাক)', color: '#0F8B8D' },
              { key: 'back', label: 'Back Part (ব্যাক পার্ট)', color: '#3B82F6' },
              { key: 'front', label: 'Front Part (ফ্রন্ট পার্ট)', color: '#8B5CF6' },
              { key: 'asm', label: 'A.S.M (অ্যাসেম্বলি)', color: '#F59E0B' },
            ].map(({ key, label }) => {
              const partData = daySummary.byPart[key] || {};
              const hasTgt = partData.totalTarget !== null;
              const isShort = partData.status === 'short';
              const isAchieved = partData.status === 'achieved';
              const isExcess = partData.status === 'excess';

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
                          isShort
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : isAchieved
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
                      {isShort && (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                          <TrendingDown className="w-3.5 h-3.5" /> Short {formatNum(partData.shortQty)} pcs ({partData.shortPct}%)
                        </span>
                      )}
                      {isAchieved && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                          <Check className="w-3.5 h-3.5" /> 100% Target Met
                        </span>
                      )}
                      {isExcess && (
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

          {/* Lines Table */}
          <div className="overflow-x-auto border border-current/15 rounded-xl">
            <table className="w-full text-xs font-mono text-left">
              <thead className={isDark ? 'bg-[#0B2E33] text-slate-300' : 'bg-slate-100 text-slate-700'}>
                <tr>
                  <th className="p-2.5 border-r border-current/10 text-center">Line</th>
                  <th className="p-2.5 border-r border-current/10">Buyer / Style</th>
                  <th className="p-2.5 border-r border-current/10 text-center">Target</th>
                  <th className="p-2.5 border-r border-current/10 text-center">Actual</th>
                  <th className="p-2.5 border-r border-current/10 text-center">Ach%</th>
                  <th className="p-2.5 border-r border-current/10 text-center">Short / Excess</th>
                  <th className="p-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-current/10">
                {daySummary.lines.map((lSum) => {
                  const m = lSum.output;
                  const hasTgt = m.totalTarget !== null;

                  return (
                    <tr
                      key={lSum.lineNo}
                      className={`hover:bg-white/5 transition-colors ${
                        daySummary.bestLine?.lineNo === lSum.lineNo ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="p-2.5 border-r border-current/10 text-center font-bold">
                        Line 0{lSum.lineNo}
                      </td>
                      <td className="p-2.5 border-r border-current/10 font-medium">
                        {lSum.buyer} · {lSum.style}
                      </td>
                      <td className="p-2.5 border-r border-current/10 text-center font-bold">
                        {m.totalTarget !== null ? formatNum(m.totalTarget) : <span className="text-slate-400">No target</span>}
                      </td>
                      <td className="p-2.5 border-r border-current/10 text-center font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {m.totalActual !== null ? formatNum(m.totalActual) : '-'}
                      </td>
                      <td className="p-2.5 border-r border-current/10 text-center font-bold">
                        {m.achievement !== null ? `${m.achievement}%` : '-'}
                      </td>
                      <td className="p-2.5 border-r border-current/10 text-center font-bold">
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
                      <td className="p-2.5 text-center">
                        {hasTgt ? (
                          m.status === 'short' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                              SHORT {m.shortPct}%
                            </span>
                          ) : m.status === 'achieved' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                              ACHIEVED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                              EXCESS
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[11px]">No target</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3 DASHBOARD CHARTS */}
        {!hasAnyTarget ? (
          <div className="p-8 rounded-3xl border border-dashed border-slate-300 dark:border-white/20 text-center bg-white/5">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Enter hour targets to see achievement
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Add hour targets in the Sewing Report Entry page to view live comparison charts and shortage analytics.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Target vs Actual Bar Chart per line */}
              <div
                className={`p-6 rounded-3xl border shadow-soft-lg ${
                  isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                  <div>
                    <h3 className="font-bold text-base tracking-tight capitalize">
                      {chartPart} Target vs Actual Output per Line
                    </h3>
                    <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">
                      লাইনভিত্তিক নির্ধারিত লক্ষ্যমাত্রা বনাম প্রকৃত উৎপাদন
                    </p>
                  </div>
                  <Award className="w-4 h-4 text-[#2BA5B5]" />
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lineTargetVsActualData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                      <XAxis dataKey="line" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div
                                className={`p-3 rounded-2xl text-xs shadow-lg border ${
                                  isDark ? 'bg-[#0B2E33] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <p className="font-bold">{payload[0].payload.line} ({payload[0].payload.buyer})</p>
                                <p className="text-emerald-400 mt-1">Actual: <strong>{payload[0].value} pcs</strong></p>
                                <p className="text-amber-400">Target: <strong>{payload[0].payload.target} pcs</strong></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="actual" fill={CHART_GREEN} radius={[6, 6, 0, 0]} maxBarSize={32} name="Actual Pcs" />
                      <Bar dataKey="target" fill={CHART_YELLOW} radius={[6, 6, 0, 0]} maxBarSize={32} name="Target Pcs" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. Cumulative Actual vs Cumulative Target Line Chart per hour */}
              <div
                className={`p-6 rounded-3xl border shadow-soft-lg ${
                  isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                  <div>
                    <h3 className="font-bold text-base tracking-tight capitalize">
                      Cumulative {chartPart} Actual vs Cumulative Target
                    </h3>
                    <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">
                      ঘণ্টাভিত্তিক ক্রমযোজিত উৎপাদন বনাম ক্রমযোজিত লক্ষ্যমাত্রা
                    </p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-[#2BA5B5]" />
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeHourlyData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                      <XAxis dataKey="hour" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div
                                className={`p-3 rounded-2xl text-xs shadow-lg border ${
                                  isDark ? 'bg-[#0B2E33] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <p className="font-bold">{payload[0].payload.hour}</p>
                                <p className="text-[#2BA5B5] mt-1">
                                  Cum Actual: <strong>{payload[0].value} pcs</strong>
                                </p>
                                <p className="text-amber-400">
                                  Cum Target: <strong>{payload[0].payload.cumTarget} pcs</strong>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumActual"
                        stroke={ACCENT_TEAL}
                        strokeWidth={3}
                        dot={{ fill: ACCENT_TEAL, r: 4 }}
                        name="Cum Actual"
                      />
                      <Line
                        type="monotone"
                        dataKey="cumTarget"
                        stroke={CHART_YELLOW}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ fill: CHART_YELLOW, r: 3 }}
                        name="Cum Target"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 3. Short Qty by Line Bar Chart (Red Bars) */}
            <div
              className={`p-6 rounded-3xl border shadow-soft-lg ${
                isDark ? 'bg-[#103A40] border-white/10 text-white' : 'glass-card text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div>
                  <h3 className="font-bold text-base tracking-tight capitalize text-rose-500">
                    Short Qty by Line ({chartPart}) · লাইনভিত্তিক ঘাটতির পরিমাণ
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-slate-400 font-bangla">
                    নির্দিষ্ট লাইনে ঘাটতি (Short pcs) লাল বারে প্রদর্শিত
                  </p>
                </div>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lineShortData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#CBD5E1'} vertical={false} />
                    <XAxis dataKey="line" stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={isDark ? '#94A3B8' : '#334155'} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div
                              className={`p-3 rounded-2xl text-xs shadow-lg border ${
                                isDark ? 'bg-[#0B2E33] border-white/20 text-white' : 'bg-white border-slate-200 text-slate-800'
                              }`}
                            >
                              <p className="font-bold">{payload[0].payload.line} ({payload[0].payload.buyer})</p>
                              <p className="text-rose-500 mt-1">Short Qty: <strong>{payload[0].value} pcs</strong></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="shortQty" fill={CHART_RED} radius={[6, 6, 0, 0]} maxBarSize={36} name="Short Qty (pcs)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default SewingDashboard;
