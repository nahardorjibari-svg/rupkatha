import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { CompanyLogo } from '../components/CompanyLogo';
import { ROLE_LABELS, UNIT_LABELS } from '../lib/constants';
import { LogOut, Factory, User, Clock, CheckCircle2, Layers, Scissors, Package, BadgeDollarSign, FileDown, Printer, TrendingDown, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { exportSewingReportsToExcel } from '../lib/exportExcel';
import { exportSewingReportsToPdf } from '../lib/exportPdf';
import { fetchSewingReports, subscribeSewingRealtime } from '../lib/sewingQueries';
import { fetchFinishingReports } from '../lib/finishingQueries';
import { calculatePartMetrics, calculateManagementSummary, formatNum } from '../lib/sewingCalc';

export const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { companyName } = useCompany();
  const [reports, setReports] = useState<any[]>([]);
  const [finishingReports, setFinishingReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const loadData = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const [sewingData, finishingData] = await Promise.all([
      fetchSewingReports({ date: today }),
      fetchFinishingReports({ date: today })
    ]);
    setReports(sewingData || []);
    setFinishingReports(finishingData || []);
    setLoading(false);
  };

  const isAdmin = profile?.role === 'admin';
  const permissions = profile?.permissions || [];
  const hasNoPermissions = permissions.length === 0;

  const navigate = useNavigate();

  useEffect(() => {
    // If not admin and has permissions, redirect to first module
    if (!isAdmin && permissions.length > 0) {
      if (permissions.includes('attendance')) {
        navigate('/attendance', { replace: true });
        return;
      }
      if (permissions.includes('hr_payroll')) {
        navigate('/hr/staff', { replace: true });
        return;
      }
      if (permissions.includes('sewing')) {
        navigate('/sewing/report', { replace: true });
        return;
      }
    }
  }, [isAdmin, permissions, navigate]);

  useEffect(() => {
    loadData();
    const unsub = subscribeSewingRealtime(loadData);
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut();
    toast.success('Successfully signed out.');
  };

  const roleName = profile?.role ? ROLE_LABELS[profile.role]?.en : 'Operator';
  const roleNameBn = profile?.role ? ROLE_LABELS[profile.role]?.bn : 'অপারেটর';
  const unitName = profile?.unit ? UNIT_LABELS[profile.unit]?.en : 'Factory Floor';
  const unitNameBn = profile?.unit ? UNIT_LABELS[profile.unit]?.bn : 'ফ্যাক্টরি ফ্লোর';

  const formatLastLogin = (iso?: string | null) => {
    if (!iso) return 'Recent session';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CompanyLogo size="sm" showName={true} />
            <div className="hidden sm:flex items-center gap-2 pl-4 ml-4 border-l border-slate-200">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-[#0F8B8D] border border-teal-200/70">
                {unitName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 text-right">
              <div>
                <p className="text-sm font-semibold text-slate-900 leading-tight">
                  {profile?.full_name || 'Factory Member'}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {roleName} · {unitName}
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0F8B8D] to-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {(profile?.full_name || 'U').charAt(0)}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-colors border border-slate-200/60"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {!isAdmin && hasNoPermissions ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft-lg p-12 text-center">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-50 text-slate-400 flex items-center justify-center mb-6">
              <Layers className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">No modules assigned</h1>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              Your account has been verified, but you haven't been assigned to any factory modules yet.
              Please contact your system administrator to enable access to specific departments.
            </p>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#0F8B8D] hover:bg-[#0b686a] rounded-xl transition-colors shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out and Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Production Reports Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft-sm p-6 sm:p-8 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Production Sewing Reports & Export
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 font-bangla">
                    সুইং প্রোডাকশন রিপোর্ট, এক্সেল শিট এবং প্রিন্ট-ফ্রেন্ডলি পিডিএফ এক্সপোর্ট
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => exportSewingReportsToExcel({ reports, finishingReports, date: new Date().toISOString().split('T')[0], unit: 'all' })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors border border-teal-200 cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Download Excel</span>
                  </button>
                  <button
                    onClick={() => exportSewingReportsToPdf({ reports, finishingReports, date: new Date().toISOString().split('T')[0], unit: 'all' })}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Shortage & Target Summary Chips */}
              {(() => {
                const allLines = reports.flatMap((r: any) => r.lines || []);
                const summary: any = calculateManagementSummary(allLines);
                const outSum = summary.byPart?.output || {};

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold uppercase">Out Put Target</span>
                      <p className="text-xl font-black text-slate-900 mt-1">{outSum.totalTarget !== null ? formatNum(outSum.totalTarget) : '-'}</p>
                      <p className="text-[11px] text-slate-500">All lines combined</p>
                    </div>
                    <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
                      <span className="text-xs text-teal-700 font-bold uppercase">Actual Output</span>
                      <p className="text-xl font-black text-[#0F8B8D] mt-1">{outSum.totalActual !== null ? formatNum(outSum.totalActual) : '-'}</p>
                      <p className="text-[11px] text-teal-600 font-semibold">{outSum.achievement !== null ? `${outSum.achievement}% Achieved` : 'No Target'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-xs text-rose-700 font-bold uppercase">Shortage Summary</span>
                      <p className="text-xl font-black text-rose-600 mt-1">
                        {outSum.shortQty ? `-${formatNum(outSum.shortQty)} pcs` : '0 pcs'}
                      </p>
                      <p className="text-[11px] text-rose-600 font-semibold">
                        {outSum.shortPct ? `${outSum.shortPct}% Short of target` : 'On Target / Excess'}
                      </p>
                    </div>
                  </div>
                );
              })()}
              
              {loading ? (
                <div className="text-center py-8 text-sm text-slate-500">Loading reports...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500 border border-slate-200 rounded-xl">No reports found for today.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 border-r border-slate-200">Line</th>
                        <th className="p-3 border-r border-slate-200">Buyer</th>
                        <th className="p-3 border-r border-slate-200">Style</th>
                        <th className="p-3 border-r border-slate-200 text-center">Working Hrs</th>
                        <th className="p-3 border-r border-slate-200 text-center">Target</th>
                        <th className="p-3 border-r border-slate-200 text-center">Total Output</th>
                        <th className="p-3 border-r border-slate-200 text-center">Ach%</th>
                        <th className="p-3 border-r border-slate-200 text-center">Short / Excess</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {reports.flatMap((r: any) => r.lines || []).map((line: any, idx: number) => {
                        const m = calculatePartMetrics(line, 'output');
                        const hasTgt = m.totalTarget !== null;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 border-r border-slate-200 font-bold">Line 0{line.line_no}</td>
                            <td className="p-3 border-r border-slate-200">{line.buyer_name || '-'}</td>
                            <td className="p-3 border-r border-slate-200">{line.style_no || '-'}</td>
                            <td className="p-3 border-r border-slate-200 text-center font-mono">{m.workingHours} hrs</td>
                            <td className="p-3 border-r border-slate-200 text-center font-bold font-mono">
                              {m.totalTarget !== null ? formatNum(m.totalTarget) : '-'}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-center font-bold font-mono text-[#0F8B8D]">
                              {m.totalActual !== null ? formatNum(m.totalActual) : '-'}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-center font-bold font-mono">
                              {m.achievement !== null ? `${m.achievement}%` : '-'}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-center font-bold font-mono">
                              {m.shortExcessQty !== null ? (
                                m.shortExcessQty < 0 ? (
                                  <span className="text-rose-600 font-bold">{m.shortExcessQty} pcs</span>
                                ) : m.shortExcessQty === 0 ? (
                                  <span className="text-emerald-600 font-bold">0</span>
                                ) : (
                                  <span className="text-amber-600 font-bold">+{m.shortExcessQty} pcs</span>
                                )
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {hasTgt ? (
                                m.status === 'short' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    SHORT {m.shortPct}%
                                  </span>
                                ) : m.status === 'achieved' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ACHIEVED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    EXCESS +{m.shortExcessQty}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 text-[10px]">No Target</span>
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

            {/* Modular Next Steps Placeholder */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-soft-sm p-6 sm:p-8">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                Factory Operational Suite
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 font-bangla">
                আপনার লগইন তথ্য Supabase ডাটাবেজ দ্বারা ভেরিফাইড। পরবর্তী ধাপে নিচের মডিউলগুলো চালু হবে:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0F8B8D] flex items-center justify-center mb-2">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900">Merchandising</h3>
                  <p className="text-slate-500 mt-1">Order tracking, buyer BOM sheets, style tech-packs, T&amp;A status.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0F8B8D] flex items-center justify-center mb-2">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900">Production Floor</h3>
                  <p className="text-slate-500 mt-1">Cutting table lay sheets, sewing lines, finishing packing lists.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0F8B8D] flex items-center justify-center mb-2">
                    <Package className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900">Store &amp; Inventory</h3>
                  <p className="text-slate-500 mt-1">Yarn inventory, grey fabric inspection, trims issuing, MRR logs.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0F8B8D] flex items-center justify-center mb-2">
                    <BadgeDollarSign className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900">Commercial &amp; Accounts</h3>
                  <p className="text-slate-500 mt-1">Master L/C, Proforma Invoices, bills of exchange, export realization.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
