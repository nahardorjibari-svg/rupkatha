import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { CompanyLogo } from '../components/CompanyLogo';
import { ROLE_LABELS, UNIT_LABELS } from '../lib/constants';
import { LogOut, Factory, User, Clock, CheckCircle2, Layers, Scissors, Package, BadgeDollarSign, FileDown, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { exportSewingReportsToExcel } from '../lib/exportExcel';
import { fetchSewingReports, subscribeSewingRealtime } from '../lib/sewingQueries';

export const Dashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { companyName } = useCompany();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchSewingReports({ date: new Date().toISOString().split('T')[0] });
    setReports(data);
    setLoading(false);
  };

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
                onClick={() => exportSewingReportsToExcel({ reports, date: new Date().toISOString().split('T')[0], unit: 'all' })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors border border-teal-200"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Excel</span>
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
              >
                <Printer className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
          
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
                    <th className="p-3 border-r border-slate-200">Total Output</th>
                    <th className="p-3">Ach%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reports.flatMap((r: any) => r.lines || []).map((line: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 border-r border-slate-200">{line.line_no}</td>
                      <td className="p-3 border-r border-slate-200">{line.buyer_name || '-'}</td>
                      <td className="p-3 border-r border-slate-200">{line.style_no || '-'}</td>
                      <td className="p-3 border-r border-slate-200 font-semibold">
                        {line.hours?.reduce((sum: number, h: any) => sum + (h.output_qty || 0), 0) || 0}
                      </td>
                      <td className="p-3">
                        {((line.hours?.reduce((sum: number, h: any) => sum + (h.output_qty || 0), 0) || 0) / (line.total_target || 1) * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
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
      </main>
    </div>
  );
};

export default Dashboard;
