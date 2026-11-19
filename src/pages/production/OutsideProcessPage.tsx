import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Palette,
  Plus,
  Search,
  RefreshCw,
  X,
  Loader2,
  Truck,
  CheckCircle2,
  Trash2,
  Edit2,
  Building2,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { formatBDT, formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import type { MerchOrder } from '../../types/merchandising';

interface OutsideOrderRef
  extends Pick<
    MerchOrder,
    'id' | 'order_no' | 'po_no' | 'style_no' | 'item_name' | 'unit' | 'order_qty' | 'status' | 'buyers'
  > {}

interface OutsideProcessRecord {
  id: string;
  work_order_no: string;
  process_type: 'Washing' | 'Printing' | 'Embroidery' | string;
  supplier_name: string;
  order_id: string;
  challan_no?: string | null;
  sent_date: string;
  sent_qty: number;
  received_qty: number;
  rejected_qty: number;
  rate: number;
  total_bill: number;
  payment_status: 'Unpaid' | 'Partial' | 'Paid' | string;
  status: 'Sent' | 'Partial' | 'Completed' | string;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  orders?: OutsideOrderRef | null;
}

const PROCESS_TYPES = ['Washing', 'Printing', 'Embroidery'] as const;

export const OutsideProcessPage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const { activeUnit } = useUnit();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<OutsideProcessRecord[]>([]);
  const [orders, setOrders] = useState<OutsideOrderRef[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'woven' | 'knit'>('all');

  // New Work Order Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OutsideProcessRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Receive Challan Modal
  const [receivingRecord, setReceivingRecord] = useState<OutsideProcessRecord | null>(null);
  const [recQtyInput, setRecQtyInput] = useState('');
  const [rejQtyInput, setRejQtyInput] = useState('0');
  const [processingReceive, setProcessingReceive] = useState(false);

  // Delete Confirmation Modal
  const [deletingRecord, setDeletingRecord] = useState<OutsideProcessRecord | null>(null);
  const [processingDelete, setProcessingDelete] = useState(false);

  // Form Fields for New Work Order
  const [processType, setProcessType] = useState<string>('Washing');
  const [supplierName, setSupplierName] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [sentDate, setSentDate] = useState(getDhakaDateString());
  const [sentQty, setSentQty] = useState('');
  const [rate, setRate] = useState('0');
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
      const [procRes, ordersRes] = await Promise.all([
        supabase
          .from('production_outside_processes')
          .select(
            'id, work_order_no, process_type, supplier_name, order_id, challan_no, sent_date, sent_qty, received_qty, rejected_qty, rate, total_bill, payment_status, status, remarks, created_by, created_at, orders(id, order_no, po_no, style_no, item_name, unit, order_qty, status, buyers(name, code))'
          )
          .order('sent_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, order_no, po_no, style_no, item_name, unit, order_qty, status, buyers(name, code)')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
      ]);

      if (procRes.error) {
        console.warn('production_outside_processes error:', procRes.error.message);
      }

      setRecords(procRes.error ? [] : ((procRes.data || []) as unknown as OutsideProcessRecord[]));
      setOrders(ordersRes.error ? [] : ((ordersRes.data || []) as unknown as OutsideOrderRef[]));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load outside process records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orderMap = useMemo(() => {
    const map = new Map<string, OutsideOrderRef>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      const ord = rec.orders || orderMap.get(rec.order_id);
      if (q) {
        const matchWo = (rec.work_order_no || '').toLowerCase().includes(q);
        const matchSup = (rec.supplier_name || '').toLowerCase().includes(q);
        const matchChallan = (rec.challan_no || '').toLowerCase().includes(q);
        const matchOrder = (ord?.order_no || '').toLowerCase().includes(q);
        const matchPo = (ord?.po_no || '').toLowerCase().includes(q);
        const matchStyle = (ord?.style_no || '').toLowerCase().includes(q);
        if (!matchWo && !matchSup && !matchChallan && !matchOrder && !matchPo && !matchStyle) {
          return false;
        }
      }

      if (typeFilter !== 'all' && String(rec.process_type || '').toLowerCase() !== typeFilter.toLowerCase()) {
        return false;
      }

      if (statusFilter !== 'all' && String(rec.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (unitFilter !== 'all' && ord && String(ord.unit || '').toLowerCase() !== unitFilter) {
        return false;
      }

      return true;
    });
  }, [records, search, typeFilter, statusFilter, unitFilter, orderMap]);

  // KPI Metrics
  const kpis = useMemo(() => {
    let totalSent = 0;
    let totalReceived = 0;
    let totalRejection = 0;

    filteredRecords.forEach((r) => {
      totalSent += Number(r.sent_qty || 0);
      totalReceived += Number(r.received_qty || 0);
      totalRejection += Number(r.rejected_qty || 0);
    });

    const currentWip = Math.max(0, totalSent - totalReceived - totalRejection);

    return {
      totalSent,
      totalReceived,
      currentWip,
      totalRejection,
    };
  }, [filteredRecords]);

  const generateFallbackWoNo = useCallback(() => {
    const year = new Date().getFullYear().toString().slice(-2);
    let maxSeq = 1000;
    records.forEach((r) => {
      const m = String(r.work_order_no || '').match(/(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    });
    return `RAL-OP-${year}-${maxSeq + 1}`;
  }, [records]);

  const openNewModal = () => {
    setEditingRecord(null);
    setProcessType('Washing');
    setSupplierName('');
    setSelectedOrderId('');
    setChallanNo('');
    setSentDate(getDhakaDateString());
    setSentQty('');
    setRate('0');
    setRemarks('');
    setModalOpen(true);
  };

  const openEditModal = (rec: OutsideProcessRecord) => {
    setEditingRecord(rec);
    setProcessType(rec.process_type || 'Washing');
    setSupplierName(rec.supplier_name || '');
    setSelectedOrderId(rec.order_id || '');
    setChallanNo(rec.challan_no || '');
    setSentDate(rec.sent_date || getDhakaDateString());
    setSentQty(String(rec.sent_qty ?? 0));
    setRate(String(rec.rate ?? 0));
    setRemarks(rec.remarks || '');
    setModalOpen(true);
  };

  const handleSaveWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error('Supplier / Subcontractor factory name is required.');
      return;
    }
    if (!selectedOrderId) {
      toast.error('Please select a Buyer Order.');
      return;
    }
    const sentQNum = Math.round(Number(sentQty || 0));
    if (!Number.isFinite(sentQNum) || sentQNum <= 0) {
      toast.error('Sent Quantity must be greater than 0.');
      return;
    }
    const rateNum = Number(rate || 0);
    const totalBill = sentQNum * rateNum;

    setSaving(true);
    try {
      if (!editingRecord) {
        const woNo = generateFallbackWoNo();
        const { error } = await supabase.from('production_outside_processes').insert({
          work_order_no: woNo,
          process_type: processType,
          supplier_name: supplierName.trim(),
          order_id: selectedOrderId,
          challan_no: challanNo.trim() || null,
          sent_date: sentDate,
          sent_qty: sentQNum,
          received_qty: 0,
          rejected_qty: 0,
          rate: rateNum,
          total_bill: totalBill,
          payment_status: 'Unpaid',
          status: 'Sent',
          remarks: remarks.trim() || null,
          ...(profile?.id ? { created_by: profile.id } : {}),
        });
        if (error) throw error;
        toast.success(`Work Order ${woNo} created successfully!`);
      } else {
        const existingRec = editingRecord;
        const recQty = Number(existingRec.received_qty || 0);
        const rejQty = Number(existingRec.rejected_qty || 0);
        let status = existingRec.status;
        if (recQty + rejQty >= sentQNum) status = 'Completed';
        else if (recQty > 0) status = 'Partial';
        else status = 'Sent';

        const { error } = await supabase
          .from('production_outside_processes')
          .update({
            process_type: processType,
            supplier_name: supplierName.trim(),
            order_id: selectedOrderId,
            challan_no: challanNo.trim() || null,
            sent_date: sentDate,
            sent_qty: sentQNum,
            rate: rateNum,
            total_bill: totalBill,
            status,
            remarks: remarks.trim() || null,
          })
          .eq('id', existingRec.id);

        if (error) throw error;
        toast.success(`Work Order ${existingRec.work_order_no} updated!`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save outside process work order.');
    } finally {
      setSaving(false);
    }
  };

  const openReceiveModal = (rec: OutsideProcessRecord) => {
    setReceivingRecord(rec);
    const pending = Math.max(
      0,
      Number(rec.sent_qty || 0) - Number(rec.received_qty || 0) - Number(rec.rejected_qty || 0)
    );
    setRecQtyInput(String(pending > 0 ? pending : 0));
    setRejQtyInput('0');
  };

  const handleReceiveGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingRecord) return;

    const addRec = Math.round(Number(recQtyInput || 0));
    const addRej = Math.round(Number(rejQtyInput || 0));
    if (addRec < 0 || addRej < 0) {
      toast.error('Quantities cannot be negative.');
      return;
    }

    const newRecTotal = Number(receivingRecord.received_qty || 0) + addRec;
    const newRejTotal = Number(receivingRecord.rejected_qty || 0) + addRej;
    const sentQ = Number(receivingRecord.sent_qty || 0);

    if (newRecTotal + newRejTotal > sentQ + 1e-6) {
      toast.error('Total Received + Rejected cannot exceed Sent Quantity.');
      return;
    }

    let status = 'Sent';
    if (newRecTotal + newRejTotal >= sentQ) {
      status = 'Completed';
    } else if (newRecTotal > 0 || newRejTotal > 0) {
      status = 'Partial';
    }

    setProcessingReceive(true);
    try {
      const { error } = await supabase
        .from('production_outside_processes')
        .update({
          received_qty: newRecTotal,
          rejected_qty: newRejTotal,
          status,
        })
        .eq('id', receivingRecord.id);

      if (error) throw error;
      toast.success(`Recorded incoming challan for ${receivingRecord.work_order_no}`);
      setReceivingRecord(null);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to receive goods.');
    } finally {
      setProcessingReceive(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    setProcessingDelete(true);
    try {
      const { error } = await supabase
        .from('production_outside_processes')
        .delete()
        .eq('id', deletingRecord.id);
      if (error) throw error;
      toast.success('Work order deleted.');
      setDeletingRecord(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete record.');
    } finally {
      setProcessingDelete(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          Completed
        </span>
      );
    }
    if (s === 'partial') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          Partial WIP
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
        Sent
      </span>
    );
  };

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Outside Process Management
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30">
                Washing · Printing · Embroidery
              </span>
            </div>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              বাইরের সাবকন্ট্রাক্ট ওয়াশিং, প্রিন্টিং ও এমব্রয়ডারি ওয়ার্ক অর্ডার, চালান ও WIP ট্র্যাকিং
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">New Work Order</span>
                <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                  নতুন ওয়ার্ক অর্ডার
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10 text-slate-100' : 'glass-card bg-white border-slate-200 text-slate-900'
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              Total Sent for Process <span className="font-bangla opacity-70">(মোট প্রেরিত)</span>
            </span>
            <span className="text-2xl font-extrabold mt-1 block text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatNumberBD(kpis.totalSent)} PCS
            </span>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10 text-slate-100' : 'glass-card bg-white border-slate-200 text-slate-900'
            }`}
          >
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
              Total Received Back <span className="font-bangla opacity-70">(প্রাপ্ত)</span>
            </span>
            <span className="text-2xl font-extrabold mt-1 block text-emerald-600 dark:text-emerald-400">
              {formatNumberBD(kpis.totalReceived)} PCS
            </span>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10 text-slate-100' : 'glass-card bg-white border-slate-200 text-slate-900'
            }`}
          >
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">
              Current Pending WIP <span className="font-bangla opacity-70">(চলমান WIP)</span>
            </span>
            <span className="text-2xl font-extrabold mt-1 block text-amber-600 dark:text-amber-400">
              {formatNumberBD(kpis.currentWip)} PCS
            </span>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10 text-slate-100' : 'glass-card bg-white border-slate-200 text-slate-900'
            }`}
          >
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">
              Process Rejection Pcs <span className="font-bangla opacity-70">(রিজেক্ট)</span>
            </span>
            <span className="text-2xl font-extrabold mt-1 block text-rose-600 dark:text-rose-400">
              {formatNumberBD(kpis.totalRejection)} PCS
            </span>
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
              placeholder="Search WO #, Supplier, Order No, Style..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Processes (সকল প্রসেস)</option>
              <option value="Washing">Washing (ওয়াশিং)</option>
              <option value="Printing">Printing (প্রিন্টিং)</option>
              <option value="Embroidery">Embroidery (এমব্রয়ডারি)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Status (সব অবস্থা)</option>
              <option value="Sent">Sent (প্রেরিত)</option>
              <option value="Partial">Partial (আংশিক)</option>
              <option value="Completed">Completed (সম্পন্ন)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value as any)}
              className={inputClass}
            >
              <option value="all">All Units (সব ইউনিট)</option>
              <option value="woven">Woven (উভেন)</option>
              <option value="knit">Knit (নিট)</option>
            </select>
          </div>
        </div>

        {/* Register Table */}
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
                  <th className="py-3 px-4 font-bold">Work Order #</th>
                  <th className="py-3 px-3 font-bold">Process &amp; Supplier</th>
                  <th className="py-3 px-3 font-bold">Order / PO / Style</th>
                  <th className="py-3 px-3 font-bold">Sent Date</th>
                  <th className="py-3 px-3 text-right font-bold">Sent</th>
                  <th className="py-3 px-3 text-right font-bold text-emerald-600">Received</th>
                  <th className="py-3 px-3 text-right font-bold text-rose-500">Rejected</th>
                  <th className="py-3 px-3 text-right font-bold text-amber-600">Pending WIP</th>
                  <th className="py-3 px-3 text-right font-bold">Total Bill (৳)</th>
                  <th className="py-3 px-3 text-center font-bold">Status</th>
                  <th className="py-3 px-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={11} className="py-4 px-4">
                        <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-14 text-center text-slate-400">
                      <Palette className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No outside process records found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো ওয়াশিং বা প্রিন্টিং ওয়ার্ক অর্ডার পাওয়া যায়নি
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const ord = rec.orders || orderMap.get(rec.order_id);
                    const sentQ = Number(rec.sent_qty || 0);
                    const recQ = Number(rec.received_qty || 0);
                    const rejQ = Number(rec.rejected_qty || 0);
                    const pendingWip = Math.max(0, sentQ - recQ - rejQ);

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {rec.work_order_no}
                          {rec.challan_no && (
                            <span className="block text-[10px] opacity-70 font-sans">
                              Challan: {rec.challan_no}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold block">{rec.supplier_name}</span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/15 text-purple-600 dark:text-purple-300">
                            {rec.process_type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {ord ? (
                            <div>
                              <span className="font-mono font-bold block">{ord.order_no}</span>
                              <span className="text-[11px] opacity-75">
                                Style: {ord.style_no} {ord.po_no ? `· PO: ${ord.po_no}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs opacity-60">Order ID: {rec.order_id}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">{formatStoreDate(rec.sent_date)}</td>
                        <td className="py-3 px-3 text-right font-extrabold">{formatNumberBD(sentQ)}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNumberBD(recQ)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-500">
                          {rejQ > 0 ? formatNumberBD(rejQ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-amber-600 dark:text-amber-400">
                          {formatNumberBD(pendingWip)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold block">{formatBDT(rec.total_bill, 2)}</span>
                          <span className="text-[10px] opacity-70 block">
                            Rate: ৳{Number(rec.rate || 0).toFixed(2)}/pc
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">{renderStatusBadge(rec.status)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {pendingWip > 0 && rec.status !== 'Completed' && (
                              <button
                                type="button"
                                onClick={() => openReceiveModal(rec)}
                                title="Receive Challan Goods"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>Receive</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              title="Edit Work Order"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-[#2BA5B5]/30 bg-[#2BA5B5]/10 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/20 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingRecord(rec)}
                              title="Delete Record"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* NEW / EDIT WORK ORDER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div
            className={`max-w-xl w-full rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/20 mb-4">
              <div>
                <h3 className="text-lg font-extrabold">
                  {editingRecord ? `Edit Work Order — ${editingRecord.work_order_no}` : 'New Subcontract Work Order'}
                </h3>
                <p className="text-xs font-bangla opacity-70">
                  {editingRecord ? 'ওয়ার্ক অর্ডার তথ্য সংশোধন করুন' : 'বাইরের ওয়াশিং, প্রিন্টিং বা এমব্রয়ডারি ওয়ার্ক অর্ডার তৈরি করুন'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Process Type * <span className="font-bangla opacity-70 font-normal">(প্রসেস)</span>
                  </label>
                  <select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value)}
                    className={inputClass}
                  >
                    {PROCESS_TYPES.map((pt) => (
                      <option key={pt} value={pt}>
                        {pt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Sent Date * <span className="font-bangla opacity-70 font-normal">(প্রেরণের তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={sentDate}
                    onChange={(e) => setSentDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Subcontractor Factory Name * <span className="font-bangla opacity-70 font-normal">(সাবকন্ট্রাক্টর কারখানা)</span>
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Modern Washing Ltd, Star Printing"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Select Buyer Order * <span className="font-bangla opacity-70 font-normal">(বায়ার অর্ডার নির্বাচন করুন)</span>
                </label>
                <select
                  required
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select Order —</option>
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_no} — Style: {ord.style_no} ({ord.buyers?.name || 'Buyer'}) — Qty: {formatNumberBD(ord.order_qty)} PCS
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Delivery Challan # <span className="font-bangla opacity-70 font-normal">(চালান নং)</span>
                  </label>
                  <input
                    type="text"
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    placeholder="CH-9821"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Sent Qty (Pcs) * <span className="font-bangla opacity-70 font-normal">(প্রেরিত পিস)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sentQty}
                    onChange={(e) => setSentQty(e.target.value)}
                    placeholder="1000"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Rate per Pc (৳) <span className="font-bangla opacity-70 font-normal">(প্রতি পিস রেট)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="12.50"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Bill Calculation Preview */}
              <div className="p-3 rounded-xl bg-[#2BA5B5]/10 border border-[#2BA5B5]/30 flex items-center justify-between text-xs">
                <span className="font-bold">Calculated Total Bill:</span>
                <span className="text-base font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                  {formatBDT((Number(sentQty || 0) * Number(rate || 0)), 2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Remarks <span className="font-bangla opacity-70 font-normal">(মন্তব্য)</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional process specifications or color instructions..."
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#0F8B8D] hover:bg-[#0b6f71] text-white cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingRecord ? 'Update Work Order' : 'Save Work Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE SUBCONTRACT GOODS MODAL */}
      {receivingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/20 mb-4">
              <div>
                <h3 className="text-lg font-extrabold">Receive Subcontract Delivery</h3>
                <p className="text-xs font-bangla opacity-70">
                  WO: {receivingRecord.work_order_no} ({receivingRecord.supplier_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceivingRecord(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
                <span className="opacity-70 block text-[10px]">Sent Qty</span>
                <span className="font-extrabold">{formatNumberBD(receivingRecord.sent_qty)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center text-emerald-600 dark:text-emerald-400">
                <span className="opacity-75 block text-[10px]">Already Received</span>
                <span className="font-extrabold">{formatNumberBD(receivingRecord.received_qty)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-amber-600 dark:text-amber-400">
                <span className="opacity-75 block text-[10px]">Pending WIP</span>
                <span className="font-extrabold">
                  {formatNumberBD(
                    Math.max(
                      0,
                      Number(receivingRecord.sent_qty || 0) -
                        Number(receivingRecord.received_qty || 0) -
                        Number(receivingRecord.rejected_qty || 0)
                    )
                  )}
                </span>
              </div>
            </div>

            <form onSubmit={handleReceiveGoods} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-emerald-600 dark:text-emerald-400">
                  Incoming Received Qty (Pcs) * <span className="font-bangla opacity-70 font-normal">(গৃহীত পিস)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={recQtyInput}
                  onChange={(e) => setRecQtyInput(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-rose-600 dark:text-rose-400">
                  Incoming Rejected Qty (Pcs) <span className="font-bangla opacity-70 font-normal">(বাতিল পিস)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={rejQtyInput}
                  onChange={(e) => setRejQtyInput(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setReceivingRecord(null)}
                  disabled={processingReceive}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingReceive}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {processingReceive && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Goods Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
              Delete Work Order? <span className="font-bangla opacity-80">(ওয়ার্ক অর্ডার মুছবেন?)</span>
            </h3>
            <p className="text-xs mt-3 leading-relaxed opacity-90">
              Work Order <strong>{deletingRecord.work_order_no}</strong> ({deletingRecord.supplier_name}) will be permanently deleted.{' '}
              <span className="font-bangla opacity-75">(এটি স্থায়ীভাবে মুছে যাবে)</span>
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                disabled={processingDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                disabled={processingDelete}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
              >
                {processingDelete && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default OutsideProcessPage;
