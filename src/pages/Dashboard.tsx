import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Layers,
  Scissors,
  Package,
  BadgeDollarSign,
  FileDown,
  Printer,
  RefreshCw,
  ShieldCheck,
  ArrowUpRight,
  Calculator,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AdminLayout } from '../components/layout/AdminLayout';
import { ExecutiveMetricsSection } from '../components/dashboard/ExecutiveMetricsSection';
import { exportSewingReportsToExcel } from '../lib/exportExcel';
import { exportSewingReportsToPdf } from '../lib/exportPdf';
import { fetchSewingReports, subscribeSewingRealtime } from '../lib/sewingQueries';
import { fetchFinishingReports } from '../lib/finishingQueries';
import { calculatePartMetrics, calculateManagementSummary, formatNum } from '../lib/sewingCalc';
import { getDhakaDateString } from '../lib/dhakaTime';

export const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [reports, setReports] = useState<any[]>([]);
  const [finishingReports, setFinishingReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const today = getDhakaDateString();
      const [sewingData, finishingData] = await Promise.all([
        fetchSewingReports({ date: today }),
        fetchFinishingReports({ date: today }),
      ]);
      setReports(sewingData || []);
      setFinishingReports(finishingData || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const isAdmin = profile?.role === 'admin';
  const permissions = profile?.permissions || [];
  const hasNoPermissions = permissions.length === 0;

  useEffect(() => {
    if (!isAdmin && permissions.length > 0) {
      if (permissions.includes('attendance') && permissions.length === 1) {
        navigate('/attendance', { replace: true });
        return;
      }
      if (permissions.includes('hr_payroll') && permissions.length === 1) {
        navigate('/hr/staff', { replace: true });
        return;
      }
      if (permissions.includes('sewing') && permissions.length === 1) {
        navigate('/sewing/report', { replace: true });
        return;
      }
    }
  }, [isAdmin, permissions, navigate]);

  useEffect(() => {
    loadData();
    const unsub = subscribeSewingRealtime(() => {
      loadData();
      setRefreshKey((k) => k + 1);
    });
    return () => unsub();
  }, [loadData]);

  const handleRefreshAll = async () => {
    setRefreshKey((k) => k + 1);
    await loadData();
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Successfully signed out.');
  };

  if (!isAdmin && hasNoPermissions) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-6 ${
          isDark ? 'bg-[#0B2E33] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div
          className={`max-w-md w-full rounded-2xl border p-10 text-center shadow-soft-lg ${
            isDark ? 'bg-[#103A40] border-white/10' : 'bg-white border-slate-200/80'
          }`}
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center mb-5">
            <Layers className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-2">No modules assigned</h1>
          <p className="text-xs opacity-75 mb-6 leading-relaxed font-bangla">
            আপনার অ্যাকাউন্ট ভেরিফাই হয়েছে, তবে এখনো কোনো ফ্যাক্টরি মডিউল যুক্ত করা হয়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0F8B8D] hover:bg-[#0b686a] rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out and Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const allLines = reports.flatMap((r: any) => r.lines || []);
  const summary: any = calculateManagementSummary(allLines);
  const outSum = summary.byPart?.output || {};
  const todayDate = getDhakaDateString();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Executive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Factory Operations Executive Dashboard
            </h1>
            <p className="text-xs font-bangla opacity-75 mt-0.5">
              রূপকথা অ্যাপারেলস লিমিটেড — অর্ডার, স্টোর, কাটিং, সুইং ও অ্যাকাউন্টস লাইভ ড্যাশবোর্ড
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={loading}
            className={`self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Data</span>
          </button>
        </div>

        {/* Quick Actions Bar + 4 Live Supabase KPI Cards */}
        <ExecutiveMetricsSection refreshKey={refreshKey} />

        {/* Management P&L Summary Strip */}
        <div
          className={`p-5 rounded-2xl border shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 ${
            isDark
              ? 'bg-gradient-to-r from-[#103A40] via-[#0B2E33] to-[#103A40] border-white/15 text-white shadow-black/40'
              : 'bg-gradient-to-r from-teal-50 via-sky-50 to-white border-slate-200 text-slate-900 shadow-slate-200/50'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0F8B8D] text-white flex items-center justify-center shadow-md shadow-[#0F8B8D]/30 shrink-0">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">
                  Management P&amp;L &amp; Core Reports Center
                </h3>
                <span className="text-[10px] font-bold font-bangla px-2 py-0.5 rounded-full bg-[#2BA5B5]/20 text-[#2BA5B5] border border-[#2BA5B5]/30">
                  ব্যবস্থাপনা লাভ-ক্ষতি ও রিপোর্ট
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Access 12 key financial P&amp;L metrics, 3 financial views (Estimated, Actual, Realized Cash), and 8 Merchandising Reports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/reports/merchandising')}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isDark ? 'bg-white/5 border-white/15 hover:bg-white/10 text-white' : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <span>Merchandising Reports</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/reports/pnl')}
              className="px-5 py-2.5 rounded-xl bg-[#0F8B8D] hover:bg-[#2BA5B5] text-white text-xs font-bold shadow-lg shadow-[#0F8B8D]/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>View Full P&amp;L &amp; Reports</span>
            </button>
          </div>
        </div>

        {/* Today's Sewing Production Reports & Export */}
        <div
          className={`rounded-2xl border shadow-soft-sm p-5 sm:p-6 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div className="space-y-0.5">
              <h2 className="text-lg font-extrabold tracking-tight">
                Today&apos;s Sewing Production Reports &amp; Export
              </h2>
              <p className="text-xs opacity-75 font-bangla">
                আজকের সুইং প্রোডাকশন রিপোর্ট, এক্সেল শিট এবং প্রিন্ট-ফ্রেন্ডলি পিডিএফ এক্সপোর্ট
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  exportSewingReportsToExcel({
                    reports,
                    finishingReports,
                    date: todayDate,
                    unit: 'all',
                  })
                }
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-teal-500/15 border-teal-400/30 text-teal-300 hover:bg-teal-500/25'
                    : 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
                }`}
              >
                <FileDown className="w-4 h-4" />
                <span>Download Excel</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportSewingReportsToPdf({
                    reports,
                    finishingReports,
                    date: todayDate,
                    unit: 'all',
                  })
                }
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-rose-500/15 border-rose-400/30 text-rose-300 hover:bg-rose-500/25'
                    : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Shortage & Target Summary Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
            <div
              className={`p-4 rounded-xl border ${
                isDark ? 'bg-[#0B2E33] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className="text-[11px] font-bold uppercase opacity-70">Q.C.P Target</span>
              <p className="text-xl font-black mt-1 tabular-nums">
                {outSum.totalTarget !== null ? formatNum(outSum.totalTarget) : '-'}
              </p>
              <p className="text-[11px] opacity-65">All lines combined</p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDark ? 'bg-teal-500/10 border-teal-400/25' : 'bg-teal-50 border-teal-200'
              }`}
            >
              <span className="text-[11px] text-[#0F8B8D] dark:text-[#2BA5B5] font-bold uppercase">
                Actual Q.C.P
              </span>
              <p className="text-xl font-black text-[#0F8B8D] dark:text-[#2BA5B5] mt-1 tabular-nums">
                {outSum.totalActual !== null ? formatNum(outSum.totalActual) : '-'}
              </p>
              <p className="text-[11px] text-[#0F8B8D] dark:text-[#2BA5B5] font-semibold">
                {outSum.achievement !== null ? `${outSum.achievement}% Achieved` : 'No Target'}
              </p>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDark ? 'bg-rose-500/10 border-rose-400/25' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold uppercase">
                Shortage Summary
              </span>
              <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
                {outSum.shortQty ? `-${formatNum(outSum.shortQty)} pcs` : '0 pcs'}
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                {outSum.shortPct ? `${outSum.shortPct}% Short of target` : 'On Target / Excess'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-xs opacity-70">Loading today&apos;s sewing reports...</div>
          ) : reports.length === 0 ? (
            <div
              className={`text-center py-8 text-xs opacity-75 border rounded-xl ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              No sewing reports logged yet for today ({todayDate}).
            </div>
          ) : (
            <div
              className={`overflow-x-auto border rounded-xl ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <table className="w-full text-xs text-left border-collapse">
                <thead
                  className={`border-b ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <tr>
                    <th className="p-3">Line</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Style</th>
                    <th className="p-3 text-center">Working Hrs</th>
                    <th className="p-3 text-right">Target</th>
                    <th className="p-3 text-right">Total Q.C.P</th>
                    <th className="p-3 text-right">Ach%</th>
                    <th className="p-3 text-right">Short / Excess</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-200'}`}>
                  {allLines.map((line: any, idx: number) => {
                    const m = calculatePartMetrics(line, 'output');
                    const hasTgt = m.totalTarget !== null;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                        <td className="p-3 font-bold">Line 0{line.line_no}</td>
                        <td className="p-3">{line.buyer_name || '-'}</td>
                        <td className="p-3">{line.style_no || '-'}</td>
                        <td className="p-3 text-center tabular-nums">{m.workingHours} hrs</td>
                        <td className="p-3 text-right font-bold tabular-nums">
                          {m.totalTarget !== null ? formatNum(m.totalTarget) : '-'}
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {m.totalActual !== null ? formatNum(m.totalActual) : '-'}
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums">
                          {m.achievement !== null ? `${m.achievement}%` : '-'}
                        </td>
                        <td className="p-3 text-right font-bold tabular-nums">
                          {m.shortExcessQty !== null ? (
                            m.shortExcessQty < 0 ? (
                              <span className="text-rose-500">{m.shortExcessQty} pcs</span>
                            ) : m.shortExcessQty === 0 ? (
                              <span className="text-emerald-500">0</span>
                            ) : (
                              <span className="text-amber-500">+{m.shortExcessQty} pcs</span>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {hasTgt ? (
                            m.status === 'short' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                SHORT {m.shortPct}%
                              </span>
                            ) : m.status === 'achieved' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                ACHIEVED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                EXCESS +{m.shortExcessQty}
                              </span>
                            )
                          ) : (
                            <span className="opacity-50 text-[10px]">No Target</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Connected Factory Suite Shortcuts */}
        <div
          className={`rounded-2xl border p-5 sm:p-6 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="mb-4">
            <h2 className="text-base font-extrabold">Connected ERP Modules</h2>
            <p className="text-xs opacity-75 font-bangla">
              সক্রিয় গার্মেন্টস অপারেশন ও অ্যাকাউন্টস মডিউলসমূহ
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            <button
              type="button"
              onClick={() => navigate('/merchandising/orders')}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer group ${
                isDark
                  ? 'bg-[#0B2E33] border-white/10 hover:border-[#2BA5B5]/50'
                  : 'bg-slate-50 border-slate-200 hover:border-[#0F8B8D]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
              </div>
              <h3 className="font-bold">Merchandising &amp; Costing</h3>
              <p className="opacity-70 mt-1">
                Buyer orders, PO tracking, BOM auto costing, and Order 360° view.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/production/cutting')}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer group ${
                isDark
                  ? 'bg-[#0B2E33] border-white/10 hover:border-[#2BA5B5]/50'
                  : 'bg-slate-50 border-slate-200 hover:border-[#0F8B8D]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Scissors className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
              </div>
              <h3 className="font-bold">Cutting &amp; Sewing Floor</h3>
              <p className="opacity-70 mt-1">
                Cutting lay sheets, hourly sewing output, and live TV boards.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/production/qc')}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer group ${
                isDark
                  ? 'bg-[#0B2E33] border-white/10 hover:border-[#2BA5B5]/50'
                  : 'bg-slate-50 border-slate-200 hover:border-[#0F8B8D]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
              </div>
              <h3 className="font-bold">Store &amp; Quality (QC)</h3>
              <p className="opacity-70 mt-1">
                GRN stock-in, order-linked material issues, ledger, and QC audits.
              </p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className={`text-left p-4 rounded-xl border transition-all cursor-pointer group ${
                isDark
                  ? 'bg-[#0B2E33] border-white/10 hover:border-[#2BA5B5]/50'
                  : 'bg-slate-50 border-slate-200 hover:border-[#0F8B8D]/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <BadgeDollarSign className="w-4 h-4" />
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
              </div>
              <h3 className="font-bold">Accounts &amp; Costing</h3>
              <p className="opacity-70 mt-1">
                Buyer receipts, expense vouchers, and live order profitability.
              </p>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
