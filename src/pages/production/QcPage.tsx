import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Edit2,
  ClipboardCheck,
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

interface QcOrderRef
  extends Pick<
    MerchOrder,
    'id' | 'order_no' | 'po_no' | 'style_no' | 'item_name' | 'unit' | 'order_qty' | 'status' | 'buyers'
  > {}

interface ProductionQcRecord {
  id: string;
  qc_date: string;
  order_id: string;
  stage: string;
  line_no?: string | null;
  checked_qty: number;
  pass_qty: number;
  defect_qty: number;
  reject_qty: number;
  defect_types?: string[] | null;
  inspector_name?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  orders?: QcOrderRef | null;
}

const QC_STAGES = ['Sewing', 'Finishing', 'Packing'] as const;

const LINE_OR_SECTION_OPTIONS = [
  'Line 1',
  'Line 2',
  'Line 3',
  'Line 4',
  'Finishing Floor',
  'Packing Section',
] as const;

const COMMON_DEFECTS = [
  'Skip Stitch',
  'Stain / Spot',
  'Shade Variation',
  'Measurement',
  'Broken Stitch',
  'Open Seam',
  'Puckering',
  'Uncut Thread',
] as const;

export const QcPage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const { activeUnit } = useUnit();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProductionQcRecord[]>([]);
  const [orders, setOrders] = useState<QcOrderRef[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'woven' | 'knit'>('all');

  // New / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProductionQcRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [qcDate, setQcDate] = useState(getDhakaDateString());
  const [stage, setStage] = useState<string>('Finishing');
  const [lineNo, setLineNo] = useState<string>('Finishing Floor');
  const [checkedQty, setCheckedQty] = useState('');
  const [passQty, setPassQty] = useState('');
  const [defectQty, setDefectQty] = useState('0');
  const [rejectQty, setRejectQty] = useState('0');
  const [selectedDefects, setSelectedDefects] = useState<string[]>([]);
  const [inspectorName, setInspectorName] = useState('');
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
      const [qcRes, ordersRes] = await Promise.all([
        supabase
          .from('production_qc')
          .select(
            'id, qc_date, order_id, stage, line_no, checked_qty, pass_qty, defect_qty, reject_qty, defect_types, inspector_name, remarks, created_at, orders(id, order_no, po_no, style_no, item_name, unit, order_qty, status, buyers(name, code))'
          )
          .order('qc_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select(
            'id, order_no, po_no, style_no, item_name, unit, order_qty, status, buyers(name, code)'
          )
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
      ]);

      if (qcRes.error) throw qcRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setRecords((qcRes.data || []) as unknown as ProductionQcRecord[]);
      setOrders((ordersRes.data || []) as unknown as QcOrderRef[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load QC inspection records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const orderMap = useMemo(() => {
    const map = new Map<string, QcOrderRef>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      const ord = rec.orders || orderMap.get(rec.order_id);
      if (q) {
        const matchOrder = (ord?.order_no || '').toLowerCase().includes(q);
        const matchPo = (ord?.po_no || '').toLowerCase().includes(q);
        const matchStyle = (ord?.style_no || '').toLowerCase().includes(q);
        const matchBuyer = (ord?.buyers?.name || '').toLowerCase().includes(q);
        const matchInspector = (rec.inspector_name || '').toLowerCase().includes(q);
        const matchStage = (rec.stage || '').toLowerCase().includes(q);
        const matchDefects = Array.isArray(rec.defect_types)
          ? rec.defect_types.join(' ').toLowerCase().includes(q)
          : false;
        if (
          !matchOrder &&
          !matchPo &&
          !matchStyle &&
          !matchBuyer &&
          !matchInspector &&
          !matchStage &&
          !matchDefects
        ) {
          return false;
        }
      }

      if (
        stageFilter !== 'all' &&
        String(rec.stage || '').toLowerCase() !== stageFilter.toLowerCase()
      ) {
        return false;
      }

      if (unitFilter !== 'all') {
        const ordUnit = String(ord?.unit || '').toLowerCase();
        if (ordUnit !== unitFilter) return false;
      }

      return true;
    });
  }, [records, search, stageFilter, unitFilter, orderMap]);

  // KPI Metrics
  const kpis = useMemo(() => {
    let totalInspected = 0;
    let totalPass = 0;
    let totalDefect = 0;
    let totalReject = 0;

    filteredRecords.forEach((r) => {
      totalInspected += Number(r.checked_qty || 0);
      totalPass += Number(r.pass_qty || 0);
      totalDefect += Number(r.defect_qty || 0);
      totalReject += Number(r.reject_qty || 0);
    });

    const passRate = totalInspected > 0 ? (totalPass / totalInspected) * 100 : 0;
    return {
      totalInspected,
      totalPass,
      passRate,
      totalDefect,
      totalReject,
      totalDefectAndReject: totalDefect + totalReject,
    };
  }, [filteredRecords]);

  const openNewModal = () => {
    const defaultOrder = orders[0];
    setEditingRecord(null);
    setSelectedOrderId(defaultOrder?.id || '');
    setQcDate(getDhakaDateString());
    setStage('Finishing');
    setLineNo('Finishing Floor');
    setCheckedQty('');
    setPassQty('');
    setDefectQty('0');
    setRejectQty('0');
    setSelectedDefects([]);
    setInspectorName(profile?.full_name || '');
    setRemarks('');
    setModalOpen(true);
  };

  const openEditModal = (rec: ProductionQcRecord) => {
    setEditingRecord(rec);
    setSelectedOrderId(rec.order_id || '');
    setQcDate(rec.qc_date || getDhakaDateString());
    setStage(rec.stage || 'Finishing');
    setLineNo(rec.line_no || 'Finishing Floor');
    setCheckedQty(String(rec.checked_qty ?? 0));
    setPassQty(String(rec.pass_qty ?? 0));
    setDefectQty(String(rec.defect_qty ?? 0));
    setRejectQty(String(rec.reject_qty ?? 0));
    setSelectedDefects(Array.isArray(rec.defect_types) ? rec.defect_types : []);
    setInspectorName(rec.inspector_name || '');
    setRemarks(rec.remarks || '');
    setModalOpen(true);
  };

  const toggleDefect = (defect: string) => {
    setSelectedDefects((prev) =>
      prev.includes(defect) ? prev.filter((d) => d !== defect) : [...prev, defect]
    );
  };

  const selectedOrderObj = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const previewPassRate = useMemo(() => {
    const c = Number(checkedQty || 0);
    const p = Number(passQty || 0);
    if (!Number.isFinite(c) || c <= 0) return 0;
    return Math.min(100, Math.max(0, (p / c) * 100));
  }, [checkedQty, passQty]);

  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error('Please select a Buyer Order.');
      return;
    }
    const parsedChecked = Number(checkedQty);
    if (!Number.isFinite(parsedChecked) || parsedChecked <= 0) {
      toast.error('Checked Qty must be greater than 0.');
      return;
    }
    const parsedPass = Math.max(0, Math.round(Number(passQty || 0)));
    const parsedDefect = Math.max(0, Math.round(Number(defectQty || 0)));
    const parsedReject = Math.max(0, Math.round(Number(rejectQty || 0)));

    if (parsedPass > parsedChecked) {
      toast.error('Pass Qty cannot exceed Checked Qty.');
      return;
    }
    if (!inspectorName.trim()) {
      toast.error('Inspector Name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        qc_date: qcDate,
        order_id: selectedOrderId,
        stage,
        line_no: lineNo.trim() || null,
        checked_qty: Math.round(parsedChecked),
        pass_qty: parsedPass,
        defect_qty: parsedDefect,
        reject_qty: parsedReject,
        defect_types: selectedDefects,
        inspector_name: inspectorName.trim(),
        remarks: remarks.trim() || null,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('production_qc')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('QC inspection updated.');
      } else {
        const { error } = await supabase.from('production_qc').insert(payload);
        if (error) throw error;
        toast.success('QC inspection saved!');
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save QC inspection.');
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
                Quality Control (QC) Inspection
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30">
                {unitFilter === 'all' ? 'All Units' : `${unitFilter.toUpperCase()} Unit`}
              </span>
            </div>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              কোয়ালিটি কন্ট্রোল (কিউসি) — সুইং, ফিনিশিং ও প্যাকিং পরিদর্শন, পাস রেট এবং ত্রুটি নিবন্ধন
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
                <span className="block leading-tight">New QC Inspection</span>
                <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                  নতুন কিউসি পরিদর্শন
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
                  Total Inspected
                </p>
                <p className="text-[11px] font-bangla opacity-70">মোট পরীক্ষিত</p>
              </div>
              <div className="p-2 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatNumberBD(kpis.totalInspected)}{' '}
              <span className="text-xs font-semibold opacity-70">PCS</span>
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Total Pass Qty
                </p>
                <p className="text-[11px] font-bangla opacity-70">মোট পাস পরিমাণ</p>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-emerald-600 dark:text-emerald-400">
              {formatNumberBD(kpis.totalPass)}{' '}
              <span className="text-xs font-semibold opacity-70">PCS</span>
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                  Pass Rate (%)
                </p>
                <p className="text-[11px] font-bangla opacity-70">গড় পাসের হার</p>
              </div>
              <div className="p-2 rounded-xl bg-sky-500/15 text-sky-500">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-sky-600 dark:text-sky-400">
              {kpis.passRate.toFixed(1)}%
            </p>
          </div>

          <div className={cardClass}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  Total Defect / Rejection
                </p>
                <p className="text-[11px] font-bangla opacity-70">মোট ত্রুটি ও রিজেক্ট</p>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold mt-2.5 text-rose-600 dark:text-rose-400">
              {formatNumberBD(kpis.totalDefectAndReject)}{' '}
              <span className="text-[11px] font-semibold opacity-75">
                ({formatNumberBD(kpis.totalDefect)}D / {formatNumberBD(kpis.totalReject)}R)
              </span>
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
              placeholder="Search Order #, PO #, Style, Inspector, Defect..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Stages (সকল ধাপ)</option>
              {QC_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
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

        {/* QC Inspection Register Table */}
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
                    <span className="block font-bold">Date</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">তারিখ</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Order #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">অর্ডার</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">PO #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পিও নং</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Style</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">স্টাইল</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Stage</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">ধাপ</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Checked Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পরীক্ষিত</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Pass Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পাস</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Defect Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">ত্রুটি</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Reject Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">রিজেক্ট</span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">Pass Rate %</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">হার</span>
                  </th>
                  <th className="py-3 px-4">
                    <span className="block font-bold">Inspector</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পরিদর্শক</span>
                  </th>
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
                      <ShieldCheck className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No QC inspection records found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো কিউসি পরিদর্শনের তথ্য পাওয়া যায়নি — "New QC Inspection" বাটনে ক্লিক করে যুক্ত করুন
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec) => {
                    const ord = rec.orders || orderMap.get(rec.order_id);
                    const checked = Number(rec.checked_qty || 0);
                    const pass = Number(rec.pass_qty || 0);
                    const rate = checked > 0 ? (pass / checked) * 100 : 0;
                    const defects = Array.isArray(rec.defect_types) ? rec.defect_types : [];

                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap font-medium">
                          {formatStoreDate(rec.qc_date)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                            {ord?.order_no || '-'}
                          </span>
                          {ord?.unit && (
                            <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/10 inline-block mt-0.5">
                              {ord.unit}
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                            {rec.stage}
                          </span>
                          {rec.line_no && (
                            <span className="block text-[10px] opacity-65 mt-0.5">{rec.line_no}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {formatNumberBD(rec.checked_qty)}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatNumberBD(rec.pass_qty)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold text-amber-600 dark:text-amber-400 block">
                            {formatNumberBD(rec.defect_qty)}
                          </span>
                          {defects.length > 0 && (
                            <span
                              className="text-[10px] opacity-70 block max-w-[140px] truncate ml-auto"
                              title={defects.join(', ')}
                            >
                              {defects.join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                          {formatNumberBD(rec.reject_qty)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                              rate >= 95
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : rate >= 85
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{rec.inspector_name || '-'}</span>
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              title="Edit inspection"
                              className="p-1 rounded-lg text-slate-400 hover:text-[#0F8B8D] dark:hover:text-[#2BA5B5] hover:bg-[#2BA5B5]/10 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
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

      {/* New / Edit QC Inspection Modal */}
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
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    {editingRecord ? 'Edit QC Inspection' : 'New QC Inspection'}
                  </h2>
                  <p className="text-xs font-bangla opacity-70">
                    {editingRecord
                      ? 'কিউসি পরিদর্শন তথ্য হালনাগাদ করুন'
                      : 'অর্ডার ও ধাপ অনুযায়ী কোয়ালিটি পরিদর্শনের ফলাফল সংরক্ষণ করুন'}
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

            <form onSubmit={handleSaveInspection} className="p-5 space-y-4">
              {/* Order Picker */}
              <div>
                <label className="block text-xs font-bold mb-1">
                  Select Order *{' '}
                  <span className="font-bangla opacity-70 font-normal">(অর্ডার ও পিও)</span>
                </label>
                <select
                  required
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
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

              {selectedOrderObj && (
                <div
                  className={`p-3 rounded-2xl border grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs ${
                    isDark
                      ? 'bg-[#0B2E33]/80 border-[#2BA5B5]/30'
                      : 'bg-teal-50/70 border-teal-200'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold opacity-65 block">Order #</span>
                    <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                      {selectedOrderObj.order_no}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold opacity-65 block">PO #</span>
                    <span className="font-mono font-bold">{selectedOrderObj.po_no || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold opacity-65 block">Style</span>
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
              )}

              {/* Date, Stage, Line/Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Inspection Date *{' '}
                    <span className="font-bangla opacity-70 font-normal">(তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={qcDate}
                    onChange={(e) => setQcDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Stage * <span className="font-bangla opacity-70 font-normal">(ধাপ)</span>
                  </label>
                  <select
                    required
                    value={stage}
                    onChange={(e) => {
                      const nextStage = e.target.value;
                      setStage(nextStage);
                      if (nextStage === 'Finishing') setLineNo('Finishing Floor');
                      else if (nextStage === 'Packing') setLineNo('Packing Section');
                      else if (nextStage === 'Sewing' && !lineNo.startsWith('Line')) {
                        setLineNo('Line 1');
                      }
                    }}
                    className={inputClass}
                  >
                    {QC_STAGES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Line / Section{' '}
                    <span className="font-bangla opacity-70 font-normal">(লাইন / সেকশন)</span>
                  </label>
                  <select
                    value={lineNo}
                    onChange={(e) => setLineNo(e.target.value)}
                    className={inputClass}
                  >
                    {LINE_OR_SECTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantities */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Checked Qty *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={checkedQty}
                    onChange={(e) => setCheckedQty(e.target.value)}
                    placeholder="e.g. 200"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Pass Qty *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={passQty}
                    onChange={(e) => setPassQty(e.target.value)}
                    placeholder="e.g. 192"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Defect Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={defectQty}
                    onChange={(e) => setDefectQty(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Reject Qty</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rejectQty}
                    onChange={(e) => setRejectQty(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Live Pass Rate Bar */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="font-semibold">Live Pass Rate Preview:</span>
                <span
                  className={`font-extrabold text-sm ${
                    previewPassRate >= 95
                      ? 'text-emerald-500'
                      : previewPassRate >= 85
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                >
                  {previewPassRate.toFixed(1)}%
                </span>
              </div>

              {/* Common Defect Checkboxes */}
              <div>
                <label className="block text-xs font-bold mb-2">
                  Common Defects Observed{' '}
                  <span className="font-bangla opacity-70 font-normal">(সাধারণ ত্রুটিসমূহ)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COMMON_DEFECTS.map((defect) => {
                    const checked = selectedDefects.includes(defect);
                    return (
                      <label
                        key={defect}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all select-none ${
                          checked
                            ? 'bg-[#2BA5B5]/15 border-[#2BA5B5] text-[#0F8B8D] dark:text-[#2BA5B5] font-bold'
                            : isDark
                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDefect(defect)}
                          className="rounded accent-[#0F8B8D]"
                        />
                        <span className="truncate">{defect}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Inspector & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Inspector Name *{' '}
                    <span className="font-bangla opacity-70 font-normal">(পরিদর্শকের নাম)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    placeholder="QC Inspector Name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Remarks <span className="font-bangla opacity-70 font-normal">(মন্তব্য)</span>
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="CAPA / AQL notes..."
                    className={inputClass}
                  />
                </div>
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
                      {editingRecord ? 'Update QC Entry' : 'Save QC Inspection'}
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

export default QcPage;
