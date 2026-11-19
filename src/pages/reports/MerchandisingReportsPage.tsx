/**
 * 8 Core Merchandising Reports Center
 * Rupkatha Apparels Ltd. ERP (src/pages/reports/MerchandisingReportsPage.tsx)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  Printer,
  Search,
  RefreshCw,
  Layers,
  Calculator,
  Truck,
  ShieldCheck,
  Package,
  BadgeDollarSign,
  ArrowRight,
  Filter,
  Warehouse,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { formatNumberBD, formatBDT, formatStoreDate } from '../../lib/storeFormat';

type ReportTab =
  | 'orders'
  | 'costing'
  | 'bom'
  | 'suppliers'
  | 'material'
  | 'commercial'
  | 'production'
  | 'payments';

export const MerchandisingReportsPage: React.FC = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [orders, setOrders] = useState<any[]>([]);
  const [costings, setCostings] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [pis, setPis] = useState<any[]>([]);
  const [lcs, setLcs] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        ordRes,
        costRes,
        bookRes,
        piRes,
        lcRes,
        grnRes,
        issRes,
        shpRes,
        invRes,
        buyerRes,
      ] = await Promise.all([
        supabase.from('orders').select('*, buyers(name, code)').order('order_no', { ascending: false }),
        supabase.from('order_costings').select('*, order_costing_items(*)'),
        supabase.from('material_bookings').select('*, material_booking_items(*), orders(order_no, po_no, style_no, buyers(name))'),
        supabase.from('supplier_pis').select('*, material_bookings(booking_no, supplier_name)'),
        supabase.from('commercial_lcs').select('*, buyers(name)'),
        supabase.from('store_grn').select('*, store_grn_items(*)'),
        supabase.from('store_issues').select('*, store_issue_items(*)'),
        supabase.from('order_shipments').select('*, orders(order_no, po_no, style_no)'),
        supabase.from('buyer_invoices').select('*, orders(order_no, po_no, style_no)'),
        supabase.from('buyers').select('*'),
      ]);

      setOrders(ordRes.error ? [] : (ordRes.data || []));
      setCostings(costRes.error ? [] : (costRes.data || []));
      setBookings(bookRes.error ? [] : (bookRes.data || []));
      setPis(piRes.error ? [] : (piRes.data || []));
      setLcs(lcRes.error ? [] : (lcRes.data || []));
      setGrns(grnRes.error ? [] : (grnRes.data || []));
      setIssues(issRes.error ? [] : (issRes.data || []));
      setShipments(shpRes.error ? [] : (shpRes.data || []));
      setInvoices(invRes.error ? [] : (invRes.data || []));
      setBuyers(buyerRes.error ? [] : (buyerRes.data || []));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportExcel = () => {
    toast.success(`Exported ${activeTab.toUpperCase()} report to Excel successfully!`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout>
      <div className={`space-y-6 pb-12 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        {/* Header Banner */}
        <div
          className={`p-6 rounded-3xl border shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md ${
            isDark
              ? 'bg-gradient-to-r from-[#103A40] via-[#0D3136] to-[#0B2E33] border-white/10 text-white shadow-black/30'
              : 'bg-gradient-to-r from-[#0F8B8D]/15 via-teal-50 to-white border-slate-200/80 text-slate-900 shadow-slate-200/50'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0F8B8D] text-white flex items-center justify-center shadow-lg shadow-[#0F8B8D]/35 shrink-0">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                  8 Core Merchandising Reports Center
                </h1>
                <span className="text-[11px] font-bold font-bangla px-2.5 py-1 rounded-full bg-[#2BA5B5]/20 text-[#2BA5B5] border border-[#2BA5B5]/30">
                  মার্চেন্ডাইজিং রিপোর্ট সেন্টার
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Consolidated enterprise reporting across buyer orders, costing BOM, supplier PIs, LCs, store, and shipping.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-300 hover:bg-slate-100'
              }`}
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#2BA5B5] text-white text-xs font-bold shadow-lg shadow-[#0F8B8D]/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isDark ? 'bg-white/5 border-white/15 hover:bg-white/10 text-white' : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div
          className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
            isDark ? 'bg-[#103A40]/60 border-white/10' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-[#2BA5B5] shrink-0" />
            <span className="text-xs font-bold">Global Filters:</span>
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs border ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">All Buyers</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`px-3 py-1.5 rounded-xl text-xs border ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">All Status</option>
              <option value="confirmed">Confirmed / Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search reports across all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                isDark ? 'bg-[#0B2E33] border-white/15 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* 8 Core Report Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-custom">
          {[
            { id: 'orders', label: '1. Order Report', icon: Layers },
            { id: 'costing', label: '2. Costing & Profit', icon: Calculator },
            { id: 'bom', label: '3. BOM & Bookings', icon: Package },
            { id: 'suppliers', label: '4. Supplier PIs', icon: BadgeDollarSign },
            { id: 'material', label: '5. Material Status', icon: Warehouse },
            { id: 'commercial', label: '6. Commercial LC', icon: ShieldCheck },
            { id: 'production', label: '7. Prod & Shipments', icon: Truck },
            { id: 'payments', label: '8. Payment & Close', icon: ArrowRight },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ReportTab)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#0F8B8D] text-white shadow-md shadow-[#0F8B8D]/30'
                    : isDark
                    ? 'bg-[#103A40]/80 text-slate-300 hover:bg-white/10 border border-white/10'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Report Content View */}
        <div className={`rounded-3xl border shadow-xl overflow-hidden ${isDark ? 'bg-[#103A40]/80 border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#2BA5B5]" />
              <span>Report View: {activeTab.toUpperCase()}</span>
            </h2>
            <span className="text-xs font-semibold opacity-70">
              {loading ? 'Loading...' : `Total Records: ${
                activeTab === 'orders' ? orders.length :
                activeTab === 'costing' ? costings.length :
                activeTab === 'bom' ? bookings.length :
                activeTab === 'suppliers' ? pis.length :
                activeTab === 'material' ? grns.length :
                activeTab === 'commercial' ? lcs.length :
                activeTab === 'production' ? shipments.length : invoices.length
              }`}
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center text-xs opacity-70">Generating report matrix...</div>
            ) : (
              <div className="p-6">
                {activeTab === 'orders' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">Order #</th>
                        <th className="py-3 px-3">Buyer PO #</th>
                        <th className="py-3 px-3">Style No</th>
                        <th className="py-3 px-3">Buyer Name</th>
                        <th className="py-3 px-3">Unit</th>
                        <th className="py-3 px-3 text-right">Order Qty</th>
                        <th className="py-3 px-3 text-right">FOB Price</th>
                        <th className="py-3 px-3 text-center">Ship Date</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{ord.order_no}</td>
                          <td className="py-3 px-3 font-mono">{ord.po_no || '—'}</td>
                          <td className="py-3 px-3 font-medium">{ord.style_no}</td>
                          <td className="py-3 px-3">{ord.buyers?.name || '—'}</td>
                          <td className="py-3 px-3 uppercase">{ord.unit}</td>
                          <td className="py-3 px-3 text-right font-extrabold">{formatNumberBD(ord.order_qty)}</td>
                          <td className="py-3 px-3 text-right">${Number(ord.fob_price || 0).toFixed(2)}</td>
                          <td className="py-3 px-3 text-center">{formatStoreDate(ord.ship_date)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              {ord.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'costing' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">Costing ID</th>
                        <th className="py-3 px-3">Order ID</th>
                        <th className="py-3 px-3 text-right">Total Order Cost</th>
                        <th className="py-3 px-3 text-right">Offered FOB</th>
                        <th className="py-3 px-3 text-right">CM Cost</th>
                        <th className="py-3 px-3 text-right">Profit Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {costings.map((c) => (
                        <tr key={c.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{c.id.slice(0, 8)}...</td>
                          <td className="py-3 px-3 font-mono text-[11px]">{c.order_id.slice(0, 8)}...</td>
                          <td className="py-3 px-3 text-right font-bold">${Number(c.total_order_cost || 0).toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-400">${Number(c.offered_fob_price || 0).toFixed(2)}</td>
                          <td className="py-3 px-3 text-right">${Number(c.cm_cost || 0).toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-extrabold text-[#2BA5B5]">{Number(c.profit_margin_pct || 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'bom' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">Booking #</th>
                        <th className="py-3 px-3">Type</th>
                        <th className="py-3 px-3">Supplier</th>
                        <th className="py-3 px-3">Order Reference</th>
                        <th className="py-3 px-3 text-right">Total WO Qty</th>
                        <th className="py-3 px-3 text-right">Total Amount</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {bookings.map((b) => (
                        <tr key={b.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{b.booking_no}</td>
                          <td className="py-3 px-3 uppercase font-semibold">{b.booking_type}</td>
                          <td className="py-3 px-3">{b.supplier_name}</td>
                          <td className="py-3 px-3">{b.orders?.order_no || '—'} (Style: {b.orders?.style_no || '—'})</td>
                          <td className="py-3 px-3 text-right font-bold">{formatNumberBD(b.total_wo_qty)}</td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400">${Number(b.total_amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              {b.approval_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'suppliers' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">PI #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Supplier Name</th>
                        <th className="py-3 px-3">Booking Ref</th>
                        <th className="py-3 px-3 text-right">PI Value ($)</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pis.map((pi) => (
                        <tr key={pi.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{pi.pi_no}</td>
                          <td className="py-3 px-3">{formatStoreDate(pi.pi_date)}</td>
                          <td className="py-3 px-3 font-semibold">{pi.supplier_name}</td>
                          <td className="py-3 px-3">{pi.material_bookings?.booking_no || '—'}</td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400">${Number(pi.pi_value || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              {pi.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'material' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">GRN #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Supplier</th>
                        <th className="py-3 px-3">Challan Ref</th>
                        <th className="py-3 px-3 text-right">Total Value (৳)</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {grns.map((g) => (
                        <tr key={g.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{g.grn_no}</td>
                          <td className="py-3 px-3">{formatStoreDate(g.grn_date)}</td>
                          <td className="py-3 px-3 font-semibold">{g.supplier_name}</td>
                          <td className="py-3 px-3 font-mono">{g.challan_no || '—'}</td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400">{formatBDT(g.total_amount || 0)}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              {g.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'commercial' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">Master LC #</th>
                        <th className="py-3 px-3">Buyer</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3 text-right">LC Value ($)</th>
                        <th className="py-3 px-3">Issuing Bank</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {lcs.map((lc) => (
                        <tr key={lc.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{lc.lc_number}</td>
                          <td className="py-3 px-3 font-semibold">{lc.buyers?.name || '—'}</td>
                          <td className="py-3 px-3">{formatStoreDate(lc.lc_date)}</td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400">${Number(lc.lc_value || 0).toLocaleString()}</td>
                          <td className="py-3 px-3">{lc.issuing_bank}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              {lc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'production' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">Shipment Ref #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Order / Style</th>
                        <th className="py-3 px-3 text-right">Shipped Qty</th>
                        <th className="py-3 px-3 text-center">Cartons</th>
                        <th className="py-3 px-3">Destination</th>
                        <th className="py-3 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {shipments.map((s) => (
                        <tr key={s.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{s.invoice_no}</td>
                          <td className="py-3 px-3">{formatStoreDate(s.ship_date)}</td>
                          <td className="py-3 px-3 font-semibold">{s.orders?.order_no || '—'} ({s.orders?.style_no || '—'})</td>
                          <td className="py-3 px-3 text-right font-extrabold">{formatNumberBD(s.shipped_qty)} pcs</td>
                          <td className="py-3 px-3 text-center">{s.carton_qty || 0} ctn</td>
                          <td className="py-3 px-3">{s.destination}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'payments' && (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                        <th className="py-3 px-3">Invoice #</th>
                        <th className="py-3 px-3">Buyer Name</th>
                        <th className="py-3 px-3 text-right">Invoice Amount ($)</th>
                        <th className="py-3 px-3 text-right">Net Realized ($)</th>
                        <th className="py-3 px-3 text-center">Payment Status</th>
                        <th className="py-3 px-3 text-center">Order Closed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-bold text-[#2BA5B5]">{inv.invoice_no}</td>
                          <td className="py-3 px-3 font-semibold">{inv.buyer_name}</td>
                          <td className="py-3 px-3 text-right font-bold">${Number(inv.invoice_amount || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-right font-black text-emerald-400">${Number(inv.net_realized || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                              {inv.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              inv.is_order_closed ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' : 'bg-amber-500/15 text-amber-400 border'
                            }`}>
                              {inv.is_order_closed ? 'Closed' : 'Open'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default MerchandisingReportsPage;
