import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Scissors,
  Plus,
  Search,
  RefreshCw,
  X,
  Loader2,
  Layers,
  Calendar,
  TrendingUp,
  Edit2,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import type { MerchOrder } from '../../types/merchandising';

interface CuttingOrderRef
  extends Pick<
    MerchOrder,
    'id' | 'order_no' | 'po_no' | 'style_no' | 'item_name' | 'unit' | 'order_qty' | 'status' | 'buyers'
  > {}

interface ProductionCuttingRecord {
  id: string;
  cut_no: string;
  cut_date: string;
  order_id: string;
  unit: string;
  table_no: string;
  lay_count: number;
  fabric_consumed_yds: number;
  cut_qty: number;
  rejection_qty: number;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  orders?: CuttingOrderRef | null;
}

const TABLE_OPTIONS = [
  'Table 1',
  'Table 2',
  'Table 3',
  'Table 4',
  'Table 5',
  'Table 6',
] as const;

export const CuttingPage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile, user } = useAuth();
  const { activeUnit } = useUnit();

  const currentUserId = user?.id || profile?.id || null;

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionCuttingRecord[]>([]);
  const [orders, setOrders] = useState<CuttingOrderRef[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | 'woven' | 'knit'>('all');
  const [orderFilter, setOrderFilter] = useState<string>('all');

  // New / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProductionCuttingRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [cutDate, setCutDate] = useState(getDhakaDateString());
  const [unit, setUnit] = useState<'woven' | 'knit'>('woven');
  const [tableNo, setTableNo] = useState<string>('Table 1');
  const [layCount, setLayCount] = useState('10');
  const [fabricConsumed, setFabricConsumed] = useState('0');
  const [cutQty, setCutQty] = useState('');
  const [rejectionQty, setRejectionQty] = useState('0');
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
      const [cuttingRes, ordersRes] = await Promise.all([
        supabase
          .from('production_cutting')
          .select(
            'id, cut_no, cut_date, order_id, unit, table_no, lay_count, fabric_consumed_yds, cut_qty, rejection_qty, remarks, created_by, created_at, orders(id, order_no, po_no, style_no, item_name, unit, order_qty, status, buyers(name, code))'
          )
          .order('cut_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, order_no, po_no, style_no, item_name, unit, order_qty, status, buyers(name, code)')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
      ]);

      if (cuttingRes.error) throw cuttingRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setRecords((cuttingRes.data || []) as unknown as ProductionCuttingRecord[]);
      setOrders((ordersRes.data || []) as unknown as CuttingOrderRef[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load cutting production records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orderMap = useMemo(() => {
    const map = new Map<string, CuttingOrderRef>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  // Cumulative cut quantity per order across all cutting entries
  const totalCutByOrder = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r) => {
      if (!r.order_id) return;
      map.set(r.order_id, (map.get(r.order_id) || 0) + Number(r.cut_qty || 0));
    });
    return map;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      const ord = rec.orders || orderMap.get(rec.order_id);
      if (q) {
        const matchCut = (rec.cut_no || '').toLowerCase().includes(q);
        const matchTable = (rec.table_no || '').toLowerCase().includes(q);
        const matchOrder = (ord?.order_no || '').toLowerCase().includes(q);
        const matchPo = (ord?.po_no || '').toLowerCase().includes(q);
        const matchStyle = (ord?.style_no || '').toLowerCase().includes(q);
        const matchBuyer = (ord?.buyers?.name || '').toLowerCase().includes(q);
        if (
          !matchCut &&
          !matchTable &&
          !matchOrder &&
          !matchPo &&
          !matchStyle &&
          !matchBuyer
        ) {
          return false;
        }
      }

      if (unitFilter !== 'all' && String(rec.unit || '').toLowerCase() !== unitFilter) {
        return false;
      }

      if (orderFilter !== 'all' && rec.order_id !== orderFilter) {
        return false;
      }

      return true;
    });
  }, [records, search, unitFilter, orderFilter, orderMap]);

  // KPI Metrics
  const kpis = useMemo(() => {
    const todayDhaka = getDhakaDateString();
    let totalCutQty = 0;
    let todayCutting = 0;
    let fabricConsumed = 0;
    const activeOrdersSet = new Set<string>();

    filteredRecords.forEach((r) => {
      const cQty = Number(r.cut_qty || 0);
      totalCutQty += cQty;
      if (r.cut_date === todayDhaka) {
        todayCutting += cQty;
      }
      fabricConsumed += Number(r.fabric_consumed_yds || 0);
      if (r.order_id) activeOrdersSet.add(r.order_id);
    });

    return {
      totalCutQty,
      todayCutting,
      fabricConsumed,
      activeCuttingOrders: activeOrdersSet.size,
    };
  }, [filteredRecords]);

  const suggestNextCutNo = useCallback(() => {
    let maxSeq = 1000;
    records.forEach((r) => {
      const m = String(r.cut_no || '').match(/(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    });
    return `CUT-${maxSeq + 1}`;
  }, [records]);

  const openNewModal = () => {
    const defaultOrder = orders[0];
    setEditingRecord(null);
    setSelectedOrderId(defaultOrder?.id || '');
    setCutDate(getDhakaDateString());
    setUnit(
      defaultOrder
        ? String(defaultOrder.unit).toLowerCase() === 'knit'
          ? 'knit'
          : 'woven'
        : activeUnit === 'knit'
        ? 'knit'
        : 'woven'
    );
    setTableNo('Table 1');
    setLayCount('10');
    setFabricConsumed('0');
    setCutQty('');
    setRejectionQty('0');
    setRemarks('');
    setModalOpen(true);
  };

  const openEditModal = (rec: ProductionCuttingRecord) => {
    setEditingRecord(rec);
    setSelectedOrderId(rec.order_id || '');
    setCutDate(rec.cut_date || getDhakaDateString());
    setUnit(String(rec.unit || '').toLowerCase() === 'knit' ? 'knit' : 'woven');
    setTableNo(rec.table_no || 'Table 1');
    setLayCount(String(rec.lay_count ?? 1));
    setFabricConsumed(String(rec.fabric_consumed_yds ?? 0));
    setCutQty(String(rec.cut_qty ?? 0));
    setRejectionQty(String(rec.rejection_qty ?? 0));
    setRemarks(rec.remarks || '');
    setModalOpen(true);
  };

  const selectedOrderObj = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const modalOrderProgress = useMemo(() => {
    if (!selectedOrderObj) return null;
    const orderQty = Math.max(0, Number(selectedOrderObj.order_qty || 0));
    const totalAll = totalCutByOrder.get(selectedOrderObj.id) || 0;
    const priorCut = editingRecord
      ? Math.max(0, totalAll - Number(editingRecord.cut_qty || 0))
      : totalAll;
    const thisCut = Math.max(0, Number(cutQty || 0));
    const projectedTotal = priorCut + thisCut;
    const pct = orderQty > 0 ? Math.min(100, (projectedTotal / orderQty) * 100) : 0;
    return { orderQty, priorCut, projectedTotal, pct };
  }, [selectedOrderObj, totalCutByOrder, editingRecord, cutQty]);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error('Please select a Buyer Order.');
      return;
    }
    const parsedCutQty = Number(cutQty);
    if (!Number.isFinite(parsedCutQty) || parsedCutQty <= 0) {
      toast.error('Total Cut Quantity must be greater than 0.');
      return;
    }
    const parsedLay = Math.max(1, Math.round(Number(layCount || 1)));
    const parsedFabric = Math.max(0, Number(fabricConsumed || 0));
    const parsedRej = Math.max(0, Math.round(Number(rejectionQty || 0)));

    setSaving(true);
    try {
      const payload = {
        cut_date: cutDate,
        order_id: selectedOrderId,
        unit,
        table_no: tableNo,
        lay_count: parsedLay,
        fabric_consumed_yds: parsedFabric,
        cut_qty: Math.round(parsedCutQty),
        rejection_qty: parsedRej,
        remarks: remarks.trim() || null,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('production_cutting')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success(`Cutting entry ${editingRecord.cut_no} updated.`);
      } else {
        const nextCutNo = suggestNextCutNo();
        const { error } = await supabase.from('production_cutting').insert({
          cut_no: nextCutNo,
          ...payload,
          ...(currentUserId ? { created_by: currentUserId } : {}),
        });
        if (error) throw error;
        toast.success(`Cutting entry ${nextCutNo} saved!`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save cutting entry.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const cardClass = `rounded-2xl border p-4 transition-all ${
    isDark
      ? 'bg-[#103A40]/85 border-white/10 text-slate-100'
      : 'glass-card bg-white/85 border-slate-200/80 text-slate-900'
  }`;

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Cutting Production &amp; Lay Sheet
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30">
                {unitFilter === 'all' ? 'All Units' : `${unitFilter.toUpperCase()} Unit`}
              </span>
            </div>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              কাটিং বিভাগ — অর্ডার ও পিও অনুযায়ী দৈনিক কাটিং, ফেব্রিক খরচ, রিজেকশন ও অগ্রগতি ট্র্যাকিং
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
                <span className="block leading-tight">New Cutting Entry</span>
                <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                  নতুন কাটিং এন্ট্রি
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Total Cut Quantity
                </p>
                <p className="text-[11px] font-bangla opacity-70">মোট কাটিং পরিমাণ</p>
              </div>
              <div className="p-2 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                <Scissors className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatNumberBD(kpis.totalCutQty)}{' '}
              <span className="text-xs font-semibold opacity-70">PCS</span>
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Today Cutting
                </p>
                <p className="text-[11px] font-bangla opacity-70">আজকের কাটিং</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-emerald-600 dark:text-emerald-400">
              {formatNumberBD(kpis.todayCutting)}{' '}
              <span className="text-xs font-semibold opacity-70">PCS</span>
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Fabric Consumed
                </p>
                <p className="text-[11px] font-bangla opacity-70">মোট ফেব্রিক খরচ</p>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-amber-600 dark:text-amber-400">
              {formatNumberBD(kpis.fabricConsumed, 2)}{' '}
              <span className="text-xs font-semibold opacity-70">Yds/Kg</span>
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  Active Cutting Orders
                </p>
                <p className="text-[11px] font-bangla opacity-70">সক্রিয় কাটিং অর্ডার</p>
              </div>
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-500">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-sky-600 dark:text-sky-400">
              {formatNumberBD(kpis.activeCuttingOrders)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="lg:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Cut #, Order #, PO #, Style, Table #..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Orders (সকল অর্ডার)</option>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.order_no}
                  {ord.po_no ? ` · PO: ${ord.po_no}` : ''} · {ord.style_no}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value as 'all' | 'woven' | 'knit')}
              className={inputClass}
            >
              <option value="all">All Units (সব ইউনিট)</option>
              <option value="woven">Woven (উভেন)</option>
              <option value="knit">Knit (নিট)</option>
            </select>
          </div>
        </div>

        {/* Cutting Table */}
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
                    <span className="block font-bold">Cut #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      কাট নং
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Date</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      তারিখ
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Order #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      অর্ডার নং
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">PO #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      পিও নং
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Style</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      স্টাইল
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Table #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      টেবিল / লে
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Fabric Consumed</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      ফেব্রিক খরচ
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Cut Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      কাট পরিমাণ
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Rejection</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      রিজেকশন
                    </span>
                  </th>
                  <th className="py-3 px-4">
                    <span className="block font-bold">Status &amp; Progress</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      অবস্থা ও অগ্রগতি
                    </span>
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
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-slate-400">
                      <Scissors className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No cutting records found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো কাটিং এন্ট্রি পাওয়া যায়নি — "New Cutting Entry" বাটনে ক্লিক করে এন্ট্রি যোগ করুন
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const ord = rec.orders || orderMap.get(rec.order_id);
                    const orderQty = Math.max(0, Number(ord?.order_qty || 0));
                    const cumulativeCut = totalCutByOrder.get(rec.order_id) || Number(rec.cut_qty || 0);
                    const rawPct = orderQty > 0 ? (cumulativeCut / orderQty) * 100 : 0;
                    const clampedPct = Math.min(100, Math.max(0, rawPct));
                    const isComplete = orderQty > 0 && cumulativeCut >= orderQty;

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                            {rec.cut_no}
                          </span>
                          <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/10 inline-block mt-0.5">
                            {rec.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {formatStoreDate(rec.cut_date)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold block">
                            {ord?.order_no || '-'}
                          </span>
                          {ord?.buyers?.name && (
                            <span className="text-[10px] opacity-70 block">
                              {ord.buyers.name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {ord?.po_no ? (
                            <span className="font-mono font-semibold text-[#0F8B8D] dark:text-[#2BA5B5]">
                              {ord.po_no}
                            </span>
                          ) : (
                            <span className="opacity-50">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold">{ord?.style_no || '-'}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold block">{rec.table_no}</span>
                          <span className="text-[10px] opacity-70 block">
                            Lay: {formatNumberBD(rec.lay_count)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold">
                          {formatNumberBD(rec.fabric_consumed_yds, 2)}{' '}
                          <span className="text-[10px] opacity-65">Yds/Kg</span>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {formatNumberBD(rec.cut_qty)}{' '}
                          <span className="text-[10px] font-normal opacity-75">PCS</span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                          {formatNumberBD(rec.rejection_qty)}{' '}
                          <span className="text-[10px] font-normal opacity-75">PCS</span>
                        </td>
                        <td className="py-3 px-4 min-w-[180px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                isComplete
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {isComplete ? 'Completed' : 'In Progress'}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-extrabold">
                                {rawPct.toFixed(1)}%
                              </span>
                              <button
                                type="button"
                                onClick={() => openEditModal(rec)}
                                title="Edit cutting entry"
                                className="p-1 rounded-lg text-slate-400 hover:text-[#0F8B8D] dark:hover:text-[#2BA5B5] hover:bg-[#2BA5B5]/10 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isComplete ? 'bg-emerald-500' : 'bg-[#0F8B8D] dark:bg-[#2BA5B5]'
                              }`}
                              style={{ width: `${clampedPct}%` }}
                            />
                          </div>

                          {orderQty > 0 && (
                            <span className="text-[10px] opacity-65 block mt-0.5">
                              {formatNumberBD(cumulativeCut)} / {formatNumberBD(orderQty)} PCS
                            </span>
                          )}
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

      {/* New / Edit Cutting Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !saving && setModalOpen(false)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-5 border-b border-slate-200/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    {editingRecord
                      ? `Edit Cutting Entry — ${editingRecord.cut_no}`
                      : 'New Cutting Entry'}
                  </h2>
                  <p className="text-xs font-bangla opacity-70">
                    {editingRecord
                      ? 'কাটিং এন্ট্রির তথ্য সংশোধন করুন'
                      : 'অর্ডার অনুযায়ী নতুন কাটিং উৎপাদন তথ্য সংরক্ষণ করুন'}
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

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4">
              {/* Order Selector */}
              <div>
                <label className="block text-xs font-bold mb-1">
                  Select Order *{' '}
                  <span className="font-bangla opacity-70 font-normal">
                    (অর্ডার, পিও ও স্টাইল)
                  </span>
                </label>
                <select
                  required
                  value={selectedOrderId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedOrderId(nextId);
                    const ord = orders.find((o) => o.id === nextId);
                    if (ord) {
                      setUnit(String(ord.unit).toLowerCase() === 'knit' ? 'knit' : 'woven');
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">-- Select Buyer Order --</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_no}
                      {ord.po_no ? ` · PO: ${ord.po_no}` : ''} · {ord.style_no} (
                      {formatNumberBD(ord.order_qty)} PCS)
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Order Info Card */}
              {selectedOrderObj && modalOrderProgress && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                    isDark
                      ? 'bg-[#0B2E33]/80 border-[#2BA5B5]/30'
                      : 'bg-teal-50/70 border-teal-200'
                  }`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-65 block">
                        Order #
                      </span>
                      <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {selectedOrderObj.order_no}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-65 block">
                        Buyer PO #
                      </span>
                      <span className="font-mono font-bold">
                        {selectedOrderObj.po_no || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-65 block">
                        Style No
                      </span>
                      <span className="font-bold">{selectedOrderObj.style_no}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-65 block">
                        Order Qty
                      </span>
                      <span className="font-extrabold">
                        {formatNumberBD(selectedOrderObj.order_qty)} PCS
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-300/40 dark:border-white/10">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-[#0F8B8D] dark:text-[#2BA5B5]" />
                        Projected Order Cut Progress:
                      </span>
                      <span className="font-extrabold">
                        {formatNumberBD(modalOrderProgress.projectedTotal)} /{' '}
                        {formatNumberBD(modalOrderProgress.orderQty)} PCS (
                        {modalOrderProgress.pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#0F8B8D] dark:bg-[#2BA5B5] transition-all"
                        style={{ width: `${modalOrderProgress.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Date, Unit, Table #, Lay Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Date * <span className="font-bangla opacity-70 font-normal">(তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={cutDate}
                    onChange={(e) => setCutDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Unit * <span className="font-bangla opacity-70 font-normal">(ইউনিট)</span>
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'woven' | 'knit')}
                    className={inputClass}
                  >
                    <option value="woven">Woven (উভেন)</option>
                    <option value="knit">Knit (নিট)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Table # * <span className="font-bangla opacity-70 font-normal">(টেবিল)</span>
                  </label>
                  <select
                    required
                    value={tableNo}
                    onChange={(e) => setTableNo(e.target.value)}
                    className={inputClass}
                  >
                    {TABLE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Lay Count * <span className="font-bangla opacity-70 font-normal">(লে)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={layCount}
                    onChange={(e) => setLayCount(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Fabric Consumed, Total Cut Qty, Rejection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Fabric Consumed (Yards/Kg) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={fabricConsumed}
                    onChange={(e) => setFabricConsumed(e.target.value)}
                    placeholder="e.g. 245.5"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Total Cut Quantity (Pcs) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={cutQty}
                    onChange={(e) => setCutQty(e.target.value)}
                    placeholder="e.g. 500"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Rejection / Wastage Pcs
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rejectionQty}
                    onChange={(e) => setRejectionQty(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Remarks <span className="font-bangla opacity-70 font-normal">(মন্তব্য)</span>
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Marker notes, shade band, fabric roll ref..."
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
                      {editingRecord ? 'Update Cutting Entry' : 'Save Cutting Entry'}
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
    </AdminLayout>
  );
};

export default CuttingPage;
