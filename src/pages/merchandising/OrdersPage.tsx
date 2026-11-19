import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Calculator,
  Edit2,
  RefreshCw,
  X,
  Loader2,
  ClipboardList,
  Package,
  Calendar,
  Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import { ColorSizeMatrix } from '../../components/merchandising/ColorSizeMatrix';
import type {
  Buyer,
  MerchCurrency,
  MerchOrder,
  MerchUnit,
  OrderColorSize,
  OrderCosting,
} from '../../types/merchandising';
import { OrderDetailsDrawer } from './OrderDetailsDrawer';

interface OrderWithMeta extends MerchOrder {
  order_costings?: Pick<
    OrderCosting,
    'id' | 'offered_fob_price' | 'total_cost_pc' | 'profit_margin_percent' | 'status'
  >[];
}

export const OrdersPage: React.FC = () => {
  const { isDark } = useTheme();
  const { activeUnit } = useUnit();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithMeta[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | MerchUnit>('all');
  const [buyerFilter, setBuyerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New / Edit Order Modal & Breakdown Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderWithMeta | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<OrderWithMeta | null>(null);
  const [breakdownOrder, setBreakdownOrder] = useState<OrderWithMeta | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [orderNo, setOrderNo] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [styleNo, setStyleNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [itemName, setItemName] = useState('');
  const [unit, setUnit] = useState<MerchUnit>('woven');
  const [orderQty, setOrderQty] = useState('1000');
  const [colorSizeRows, setColorSizeRows] = useState<OrderColorSize[]>([]);
  const [targetShipDate, setTargetShipDate] = useState(getDhakaDateString());
  const [smv, setSmv] = useState('12');
  const [currency, setCurrency] = useState<MerchCurrency>('USD');
  const [exchangeRate, setExchangeRate] = useState('122');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (activeUnit === 'woven' || activeUnit === 'knit') {
      setUnitFilter(activeUnit);
    } else {
      setUnitFilter('all');
    }
  }, [activeUnit]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, buyersRes] = await Promise.all([
        supabase
          .from('orders')
          .select(
            '*, buyers(*), order_costings(id, offered_fob_price, total_cost_pc, profit_margin_percent, status), order_color_sizes(id, order_id, color_name, size_name, ratio_qty)'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('buyers')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (buyersRes.error) throw buyersRes.error;

      setOrders((ordersRes.data || []) as OrderWithMeta[]);
      setBuyers((buyersRes.data || []) as Buyer[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load buyer orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buyerMap = useMemo(() => {
    const map = new Map<string, Buyer>();
    buyers.forEach((b) => map.set(b.id, b));
    return map;
  }, [buyers]);

  const suggestNextOrderNo = useCallback(() => {
    const year = getDhakaDateString().slice(0, 4);
    let maxSeq = 1000;
    orders.forEach((o) => {
      const m = String(o.order_no || '').match(/(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    });
    return `ORD-${year}-${maxSeq + 1}`;
  }, [orders]);

  const openNewModal = () => {
    const defaultBuyer = buyers[0];
    const defaultCurr: MerchCurrency =
      defaultBuyer?.default_currency === 'BDT' ? 'BDT' : 'USD';
    setEditingOrder(null);
    setOrderNo(suggestNextOrderNo());
    setBuyerId(defaultBuyer?.id || '');
    setStyleNo('');
    setPoNo('');
    setItemName('');
    setUnit(activeUnit === 'knit' ? 'knit' : 'woven');
    setOrderQty('1000');
    setColorSizeRows([]);
    setTargetShipDate(getDhakaDateString());
    setSmv('12');
    setCurrency(defaultCurr);
    setExchangeRate(defaultCurr === 'USD' ? '122' : '1');
    setRemarks('');
    setModalOpen(true);
  };

  const openEditModal = (order: OrderWithMeta) => {
    const orderCurr: MerchCurrency = order.currency === 'BDT' ? 'BDT' : 'USD';
    setEditingOrder(order);
    setOrderNo(order.order_no || '');
    setBuyerId(order.buyer_id || '');
    setStyleNo(order.style_no || '');
    setPoNo(order.po_no || '');
    setItemName(order.item_name || '');
    setUnit(order.unit === 'knit' ? 'knit' : 'woven');
    setOrderQty(String(order.order_qty ?? 0));
    setColorSizeRows(order.order_color_sizes || []);
    setTargetShipDate(order.target_ship_date || getDhakaDateString());
    setSmv(String(order.smv ?? 0));
    setCurrency(orderCurr);
    setExchangeRate(String(order.exchange_rate ?? (orderCurr === 'USD' ? 122 : 1)));
    setRemarks(order.remarks || '');
    setModalOpen(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNo.trim()) {
      toast.error('Order # is required.');
      return;
    }
    if (!buyerId) {
      toast.error('Please select a Buyer.');
      return;
    }
    if (!styleNo.trim() || !itemName.trim()) {
      toast.error('Style No and Item Name are required.');
      return;
    }
    const parsedQty = Number(orderQty);
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      toast.error('Order Qty must be greater than 0.');
      return;
    }
    const parsedSmv = Number(smv || 0);
    if (!Number.isFinite(parsedSmv) || parsedSmv < 0) {
      toast.error('SMV must be 0 or greater.');
      return;
    }
    const parsedRate = currency === 'USD' ? Number(exchangeRate || 122) : 1;
    if (currency === 'USD' && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
      toast.error('Exchange rate must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order_no: orderNo.trim().toUpperCase(),
        buyer_id: buyerId,
        style_no: styleNo.trim(),
        po_no: poNo.trim() || null,
        item_name: itemName.trim(),
        unit,
        order_qty: Math.round(parsedQty),
        target_ship_date: targetShipDate || null,
        smv: parsedSmv,
        currency,
        exchange_rate: parsedRate,
        remarks: remarks.trim() || null,
      };

      let savedOrderId = editingOrder?.id || '';

      if (editingOrder) {
        const { error } = await supabase
          .from('orders')
          .update(payload)
          .eq('id', editingOrder.id);
        if (error) throw error;
      } else {
        const { data: insertedOrder, error } = await supabase
          .from('orders')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        savedOrderId = insertedOrder.id;
      }

      if (savedOrderId) {
        if (editingOrder) {
          const { error: delErr } = await supabase
            .from('order_color_sizes')
            .delete()
            .eq('order_id', savedOrderId);
          if (delErr) throw delErr;
        }

        const validMatrixRows = colorSizeRows
          .filter(
            (r) =>
              r.color_name.trim() &&
              r.size_name.trim() &&
              Number(r.ratio_qty) > 0
          )
          .map((r) => ({
            order_id: savedOrderId,
            color_name: r.color_name.trim().toUpperCase(),
            size_name: r.size_name.trim().toUpperCase(),
            ratio_qty: Math.round(Number(r.ratio_qty)),
          }));

        if (validMatrixRows.length > 0) {
          const { error: csErr } = await supabase
            .from('order_color_sizes')
            .insert(validMatrixRows);
          if (csErr) throw csErr;
        }
      }

      toast.success(
        editingOrder
          ? `Order ${payload.order_no} & colour/size breakdown updated.`
          : `Order ${payload.order_no} created.`
      );

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save order.');
    } finally {
      setSaving(false);
    }
  };

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.status) set.add(String(o.status).toLowerCase());
    });
    return Array.from(set).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const buyer = o.buyers || buyerMap.get(o.buyer_id);
      if (q) {
        const matchOrder = (o.order_no || '').toLowerCase().includes(q);
        const matchPo = (o.po_no || '').toLowerCase().includes(q);
        const matchStyle = (o.style_no || '').toLowerCase().includes(q);
        const matchItem = (o.item_name || '').toLowerCase().includes(q);
        const matchBuyer = (buyer?.name || '').toLowerCase().includes(q);
        if (!matchOrder && !matchPo && !matchStyle && !matchItem && !matchBuyer) return false;
      }
      if (unitFilter !== 'all' && String(o.unit || '').toLowerCase() !== unitFilter) {
        return false;
      }
      if (buyerFilter !== 'all' && o.buyer_id !== buyerFilter) {
        return false;
      }
      if (statusFilter !== 'all' && String(o.status || '').toLowerCase() !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [orders, search, unitFilter, buyerFilter, statusFilter, buyerMap]);

  const summaryStats = useMemo(() => {
    const total = orders.length;
    const wovenCount = orders.filter((o) => String(o.unit || '').toLowerCase() === 'woven').length;
    const knitCount = orders.filter((o) => String(o.unit || '').toLowerCase() === 'knit').length;
    const totalQty = filteredOrders.reduce((acc, o) => acc + Number(o.order_qty || 0), 0);
    return { total, wovenCount, knitCount, totalQty };
  }, [orders, filteredOrders]);

  const renderStatusBadge = (status?: string | null) => {
    const s = (status || 'draft').toLowerCase();
    if (s === 'confirmed' || s === 'approved' || s === 'shipped' || s === 'completed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          {s.replace('_', ' ')}
        </span>
      );
    }
    if (s === 'costed' || s === 'in_production' || s === 'submitted') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          {s.replace('_', ' ')}
        </span>
      );
    }
    if (s === 'cancelled' || s === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
          {s.replace('_', ' ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30">
        {s.replace('_', ' ')}
      </span>
    );
  };

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Buyer Orders &amp; Style Register
            </h1>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              বায়ার অর্ডার, স্টাইল নম্বর, এসএমভি ও কস্টিং শিট ব্যবস্থাপনা
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <div className="text-left">
                <span className="block leading-tight">Refresh</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  রিফ্রেশ
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">New Order</span>
                <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                  নতুন অর্ডার
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Total Orders <span className="font-bangla opacity-70">(মোট অর্ডার)</span>
            </p>
            <p className="text-xl font-extrabold mt-1">{formatNumberBD(summaryStats.total)}</p>
          </div>

          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-[#0F8B8D] dark:text-[#2BA5B5]">
              Woven Orders <span className="font-bangla opacity-70">(উভেন)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatNumberBD(summaryStats.wovenCount)}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              Knit Orders <span className="font-bangla opacity-70">(নিট)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-sky-600 dark:text-sky-400">
              {formatNumberBD(summaryStats.knitCount)}
            </p>
          </div>

          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Filtered Qty (PCS) <span className="font-bangla opacity-70">(মোট পরিমাণ)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
              {formatNumberBD(summaryStats.totalQty)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order #, PO #, Buyer, Style No, Item..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Buyers (সকল বায়ার)</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value as 'all' | MerchUnit)}
              className={inputClass}
            >
              <option value="all">All Units (সব ইউনিট)</option>
              <option value="woven">Woven (উভেন)</option>
              <option value="knit">Knit (নিট)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Status (সব অবস্থা)</option>
              {uniqueStatuses.map((st) => (
                <option key={st} value={st}>
                  {st.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div
          className={`rounded-2xl border overflow-hidden shadow-soft-md ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className={`border-b ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-slate-300'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <th className="py-3 px-4">
                    <span className="block font-bold">Order #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">অর্ডার নং</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Buyer</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">বায়ার</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Style No</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">স্টাইল</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">PO #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পিও নং</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Item</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">আইটেম</span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">Unit</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">ইউনিট</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Order Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পরিমাণ</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Ship Date</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">শিপমেন্ট</span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">Status</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">অবস্থা</span>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <span className="block font-bold">Action</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">কস্টিং / সম্পাদনা</span>
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={10} className="py-4 px-4">
                        <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-slate-400">
                      <ClipboardList className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No buyer orders found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো বায়ার অর্ডার পাওয়া যায়নি — উপরের "New Order" বাটনে ক্লিক করে নতুন অর্ডার যোগ করুন
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const buyer = order.buyers || buyerMap.get(order.buyer_id);
                    const latestCosting = order.order_costings?.[0];

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setInspectingOrder(order)}
                            title="Open Order 360° Master View"
                            className="group text-left cursor-pointer"
                          >
                            <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] group-hover:underline block">
                              {order.order_no}
                            </span>
                            <span className="text-[10px] text-[#0F8B8D]/80 dark:text-[#2BA5B5]/80 group-hover:opacity-100 opacity-75 block">
                              View 360° · SMV {Number(order.smv || 0).toFixed(1)} · {order.currency}
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold block">{buyer?.name || '-'}</span>
                          {buyer?.code && (
                            <span className="text-[10px] font-mono opacity-65 block">
                              {buyer.code}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold">{order.style_no}</td>
                        <td className="py-3 px-3">
                          {order.po_no ? (
                            <span className="font-mono font-semibold text-[#0F8B8D] dark:text-[#2BA5B5]">
                              {order.po_no}
                            </span>
                          ) : (
                            <span className="opacity-50">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium block">{order.item_name}</span>
                          {latestCosting && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                              FOB: $ {Number(latestCosting.offered_fob_price || 0).toFixed(2)} (Margin:{' '}
                              {Number(latestCosting.profit_margin_percent || 0).toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`uppercase text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                              String(order.unit).toLowerCase() === 'woven'
                                ? 'bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5]'
                                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                            }`}
                          >
                            {order.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setBreakdownOrder(order)}
                            title="View Colour & Size Breakdown"
                            className="group text-right cursor-pointer inline-flex flex-col items-end"
                          >
                            <span className="font-extrabold tabular-nums group-hover:text-[#0F8B8D] dark:group-hover:text-[#2BA5B5] group-hover:underline">
                              {formatNumberBD(order.order_qty)}{' '}
                              <span className="text-[10px] font-normal opacity-70">PCS</span>
                            </span>
                            {(() => {
                              const csRows = order.order_color_sizes || [];
                              const cCount = new Set(csRows.map((r) => r.color_name)).size;
                              const sCount = new Set(csRows.map((r) => r.size_name)).size;
                              return (
                                <span className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#2BA5B5]/12 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/25">
                                  <Palette className="w-2.5 h-2.5" />
                                  {csRows.length > 0
                                    ? `${cCount}C · ${sCount}S Breakdown`
                                    : 'Breakdown'}
                                </span>
                              );
                            })()}
                          </button>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 opacity-60" />
                            {formatStoreDate(order.target_ship_date)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderStatusBadge(order.status)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/merchandising/costing?orderId=${order.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#0F8B8D] hover:bg-[#0b6f71] text-white shadow-xs transition-colors cursor-pointer"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>View Costing</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(order)}
                              title="Edit Order"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-[#2BA5B5]/30 bg-[#2BA5B5]/10 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/20 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
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

      {/* New / Edit Order Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !saving && setModalOpen(false)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-5 border-b border-slate-200/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    {editingOrder ? `Edit Order — ${editingOrder.order_no}` : 'Create New Buyer Order'}
                  </h2>
                  <p className="text-xs font-bangla opacity-70">
                    {editingOrder ? 'অর্ডারের তথ্য হালনাগাদ করুন' : 'নতুন বায়ার অর্ডার তৈরি করুন'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Order # * <span className="font-bangla opacity-70 font-normal">(অর্ডার নম্বর)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="e.g. ORD-2026-1001"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Buyer * <span className="font-bangla opacity-70 font-normal">(বায়ার)</span>
                  </label>
                  <select
                    required
                    value={buyerId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setBuyerId(nextId);
                      if (!editingOrder) {
                        const b = buyers.find((item) => item.id === nextId);
                        if (b) {
                          const c: MerchCurrency = b.default_currency === 'BDT' ? 'BDT' : 'USD';
                          setCurrency(c);
                          setExchangeRate(c === 'USD' ? '122' : '1');
                        }
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">Select Buyer</option>
                    {buyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Style No * <span className="font-bangla opacity-70 font-normal">(স্টাইল নং)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={styleNo}
                    onChange={(e) => setStyleNo(e.target.value)}
                    placeholder="e.g. ST-HM-2026"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Buyer PO # <span className="font-bangla opacity-70 font-normal">(বায়ার পিও নং)</span>
                  </label>
                  <input
                    type="text"
                    value={poNo}
                    onChange={(e) => setPoNo(e.target.value)}
                    placeholder="e.g. PO-88412"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Item Name * <span className="font-bangla opacity-70 font-normal">(আইটেমের নাম)</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Men's Woven Chino Pant"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Unit * <span className="font-bangla opacity-70 font-normal">(উভেন / নিট)</span>
                  </label>
                  <select
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as MerchUnit)}
                    className={inputClass}
                  >
                    <option value="woven">Woven (উভেন)</option>
                    <option value="knit">Knit (নিট)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Order Qty (PCS) *{' '}
                    <span className="font-bangla opacity-70 font-normal">(পরিমাণ)</span>
                    {colorSizeRows.length > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        · Auto-summed
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={orderQty}
                    onChange={(e) => setOrderQty(e.target.value)}
                    className={`${inputClass} tabular-nums font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Target Ship Date * <span className="font-bangla opacity-70 font-normal">(তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={targetShipDate}
                    onChange={(e) => setTargetShipDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    SMV (Minutes) * <span className="font-bangla opacity-70 font-normal">(এসএমভি)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={smv}
                    onChange={(e) => setSmv(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Currency * <span className="font-bangla opacity-70 font-normal">(মুদ্রা)</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      const next = e.target.value as MerchCurrency;
                      setCurrency(next);
                      setExchangeRate(next === 'USD' ? '122' : '1');
                    }}
                    className={inputClass}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="BDT">BDT (৳)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Exchange Rate (1 USD = ৳)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    disabled={currency === 'BDT'}
                    className={`${inputClass} ${currency === 'BDT' ? 'opacity-60' : ''}`}
                  />
                </div>
              </div>

              {/* Dynamic Colour & Size Breakdown Matrix */}
              <ColorSizeMatrix
                key={editingOrder?.id || 'new-order-matrix'}
                rows={colorSizeRows}
                onChange={(nextRows, totalQty) => {
                  setColorSizeRows(nextRows);
                  if (totalQty > 0) {
                    setOrderQty(String(totalQty));
                  }
                }}
              />

              <div>
                <label className="block text-xs font-bold mb-1">
                  Remarks <span className="font-bangla opacity-70 font-normal">(মন্তব্য)</span>
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional buyer instructions, wash notes, packing details..."
                  className={inputClass}
                />
              </div>

              <div className="pt-3 border-t border-slate-200/20 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-2xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
                >
                  <span>Cancel</span>
                  <span className="block text-[10px] font-bangla opacity-70">বাতিল</span>
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <div className="text-left">
                    <span className="block leading-tight">
                      {editingOrder ? 'Update Order' : 'Create Order'}
                    </span>
                    <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                      সংরক্ষণ করুন
                    </span>
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Colour & Size Breakdown Modal */}
      {breakdownOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setBreakdownOrder(null)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-5 border-b border-slate-200/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold">
                    Colour &amp; Size Breakdown — {breakdownOrder.order_no}
                  </h2>
                  <p className="text-xs opacity-75">
                    {breakdownOrder.buyers?.name || '-'} · Style {breakdownOrder.style_no}
                    {breakdownOrder.po_no ? ` · PO ${breakdownOrder.po_no}` : ''} · Order Qty:{' '}
                    <strong className="tabular-nums">
                      {formatNumberBD(breakdownOrder.order_qty)} PCS
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBreakdownOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <ColorSizeMatrix rows={breakdownOrder.order_color_sizes || []} readOnly />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setBreakdownOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = breakdownOrder;
                    setBreakdownOrder(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Matrix</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order 360° Connected Master Drawer */}
      <OrderDetailsDrawer
        order={inspectingOrder}
        onClose={() => setInspectingOrder(null)}
        onOrderUpdated={loadData}
      />
    </AdminLayout>
  );
};

export default OrdersPage;
