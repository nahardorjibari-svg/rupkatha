import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CheckCircle2,
  Clock,
  Calculator,
  PackageCheck,
  Scissors,
  ShieldCheck,
  Truck,
  ExternalLink,
  Plus,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import { ColorSizeMatrix } from '../../components/merchandising/ColorSizeMatrix';
import type { MerchOrder, OrderColorSize, OrderCosting } from '../../types/merchandising';
import type { StoreIssue, StoreItem, StoreUom } from '../../types/store';

interface CuttingRow {
  id: string;
  cut_no: string;
  cut_date: string;
  unit: string;
  table_no: string;
  lay_count: number;
  fabric_consumed_yds: number;
  cut_qty: number;
  rejection_qty: number;
  remarks?: string | null;
}

interface QcRow {
  id: string;
  qc_date: string;
  stage: string;
  line_no?: string | null;
  checked_qty: number;
  pass_qty: number;
  defect_qty: number;
  reject_qty: number;
  defect_types?: string[] | null;
  inspector_name?: string | null;
  remarks?: string | null;
}

interface ShipmentRow {
  id: string;
  invoice_no: string;
  ship_date: string;
  shipped_qty: number;
  carton_qty: number;
  destination?: string | null;
  status: string;
  remarks?: string | null;
}

interface OrderDetailsDrawerProps {
  order: MerchOrder | null;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

type ActiveTab = 'summary' | 'costing' | 'materials' | 'cutting' | 'qc';

export const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  order,
  onClose,
  onOrderUpdated,
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ActiveTab>('summary');
  const [loading, setLoading] = useState(false);

  const [costing, setCosting] = useState<OrderCosting | null>(null);
  const [issues, setIssues] = useState<StoreIssue[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);
  const [cuttingRows, setCuttingRows] = useState<CuttingRow[]>([]);
  const [qcRows, setQcRows] = useState<QcRow[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [colorSizeRows, setColorSizeRows] = useState<OrderColorSize[]>([]);

  // Optional quick Shipment form inside Tab 5
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [savingShipment, setSavingShipment] = useState(false);
  const [invNo, setInvNo] = useState('');
  const [shipDate, setShipDate] = useState(getDhakaDateString());
  const [shippedQty, setShippedQty] = useState('');
  const [cartonQty, setCartonQty] = useState('0');
  const [destination, setDestination] = useState('');

  const loadOrder360 = useCallback(async (orderId: string) => {
    setLoading(true);
    try {
      const [costRes, issRes, itemsRes, uomRes, cutRes, qcRes, shipRes, csRes] =
        await Promise.all([
          supabase
            .from('order_costings')
            .select('*, order_costing_items(*)')
            .eq('order_id', orderId)
            .order('version', { ascending: false })
            .limit(1),
          supabase
            .from('store_issues')
            .select(
              'id, issue_no, issue_date, unit, department, purpose, status, remarks, store_issue_items(id, item_id, qty, remarks)'
            )
            .eq('order_id', orderId)
            .order('issue_date', { ascending: false }),
          supabase.from('store_items').select('id, sku, name, name_bn, uom_id'),
          supabase.from('store_uoms').select('id, code, name'),
          supabase
            .from('production_cutting')
            .select(
              'id, cut_no, cut_date, unit, table_no, lay_count, fabric_consumed_yds, cut_qty, rejection_qty, remarks'
            )
            .eq('order_id', orderId)
            .order('cut_date', { ascending: false }),
          supabase
            .from('production_qc')
            .select(
              'id, qc_date, stage, line_no, checked_qty, pass_qty, defect_qty, reject_qty, defect_types, inspector_name, remarks'
            )
            .eq('order_id', orderId)
            .order('qc_date', { ascending: false }),
          supabase
            .from('order_shipments')
            .select('id, invoice_no, ship_date, shipped_qty, carton_qty, destination, status, remarks')
            .eq('order_id', orderId)
            .order('ship_date', { ascending: false }),
          supabase
            .from('order_color_sizes')
            .select('id, order_id, color_name, size_name, ratio_qty, created_at')
            .eq('order_id', orderId),
        ]);

      setCosting(
        !costRes.error && costRes.data && costRes.data[0]
          ? (costRes.data[0] as OrderCosting)
          : null
      );
      setIssues(issRes.error ? [] : ((issRes.data || []) as unknown as StoreIssue[]));
      setStoreItems(itemsRes.error ? [] : ((itemsRes.data || []) as unknown as StoreItem[]));
      setUoms(uomRes.error ? [] : ((uomRes.data || []) as unknown as StoreUom[]));
      setCuttingRows(cutRes.error ? [] : ((cutRes.data || []) as CuttingRow[]));
      setQcRows(qcRes.error ? [] : ((qcRes.data || []) as QcRow[]));
      setShipments(shipRes.error ? [] : ((shipRes.data || []) as ShipmentRow[]));
      setColorSizeRows(csRes.error ? [] : ((csRes.data || []) as OrderColorSize[]));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load Order 360 details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (order?.id) {
      setActiveTab('summary');
      setShowAddShipment(false);
      loadOrder360(order.id);
    }
  }, [order?.id, loadOrder360]);

  const itemMap = useMemo(() => {
    const map = new Map<string, StoreItem>();
    storeItems.forEach((it) => map.set(it.id, it));
    return map;
  }, [storeItems]);

  const uomMap = useMemo(() => {
    const map = new Map<string, StoreUom>();
    uoms.forEach((u) => map.set(u.id, u));
    return map;
  }, [uoms]);

  // Flatten Store Materials Issued rows
  const issuedMaterialRows = useMemo(() => {
    const list: Array<{
      id: string;
      issueNo: string;
      issueDate: string;
      department: string;
      purpose?: string | null;
      status: string;
      sku: string;
      itemName: string;
      uom: string;
      qty: number;
    }> = [];

    issues.forEach((iss) => {
      (iss.store_issue_items || []).forEach((li, idx) => {
        const it = itemMap.get(li.item_id);
        const u = it?.uom_id ? uomMap.get(it.uom_id) : undefined;
        list.push({
          id: li.id || `${iss.id}-${idx}`,
          issueNo: iss.issue_no,
          issueDate: iss.issue_date,
          department: iss.department,
          purpose: iss.purpose,
          status: iss.status,
          sku: it?.sku || '-',
          itemName: it?.name || li.item_id,
          uom: u?.code || 'PCS',
          qty: Number(li.qty || 0),
        });
      });
    });

    return list;
  }, [issues, itemMap, uomMap]);

  // Aggregated Progress Metrics
  const metrics = useMemo(() => {
    const orderQty = Math.max(0, Number(order?.order_qty || 0));
    const totalCutQty = cuttingRows.reduce((s, r) => s + Number(r.cut_qty || 0), 0);
    const totalFabricYds = cuttingRows.reduce((s, r) => s + Number(r.fabric_consumed_yds || 0), 0);
    const totalCutReject = cuttingRows.reduce((s, r) => s + Number(r.rejection_qty || 0), 0);
    const cutPct = orderQty > 0 ? Math.min(100, (totalCutQty / orderQty) * 100) : 0;

    const qcChecked = qcRows.reduce((s, r) => s + Number(r.checked_qty || 0), 0);
    const qcPass = qcRows.reduce((s, r) => s + Number(r.pass_qty || 0), 0);
    const qcDefect = qcRows.reduce((s, r) => s + Number(r.defect_qty || 0), 0);
    const qcReject = qcRows.reduce((s, r) => s + Number(r.reject_qty || 0), 0);
    const qcPassRate = qcChecked > 0 ? (qcPass / qcChecked) * 100 : 0;

    const totalShipped = shipments.reduce((s, r) => s + Number(r.shipped_qty || 0), 0);
    const approvedIssuesCount = issues.filter((i) => i.status === 'approved').length;

    const hasCosting = Boolean(costing);
    const hasMaterials = issuedMaterialRows.length > 0;
    const hasCuttingDone = orderQty > 0 ? totalCutQty >= orderQty : totalCutQty > 0;
    const hasCuttingStarted = totalCutQty > 0;
    const hasQcPassed = qcPass > 0;
    const hasShipped = totalShipped > 0;

    let overallStatus = 'Order Confirmed';
    let overallColor =
      'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30';

    if (hasShipped && orderQty > 0 && totalShipped >= orderQty) {
      overallStatus = 'Shipped (Complete)';
      overallColor =
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    } else if (hasShipped) {
      overallStatus = 'Partially Shipped';
      overallColor =
        'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
    } else if (hasQcPassed) {
      overallStatus = 'QC Passed';
      overallColor =
        'bg-teal-500/15 text-[#0F8B8D] dark:text-[#2BA5B5] border-[#2BA5B5]/30';
    } else if (hasCuttingDone) {
      overallStatus = 'Cutting Done';
      overallColor =
        'bg-teal-500/15 text-[#0F8B8D] dark:text-[#2BA5B5] border-[#2BA5B5]/30';
    } else if (hasCuttingStarted) {
      overallStatus = 'Cutting In Progress';
      overallColor =
        'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
    } else if (hasMaterials) {
      overallStatus = 'Materials Issued';
      overallColor =
        'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
    } else if (hasCosting) {
      overallStatus = 'Costing Prepared';
      overallColor =
        'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30';
    }

    return {
      orderQty,
      totalCutQty,
      totalFabricYds,
      totalCutReject,
      cutPct,
      qcChecked,
      qcPass,
      qcDefect,
      qcReject,
      qcPassRate,
      totalShipped,
      approvedIssuesCount,
      hasCosting,
      hasMaterials,
      hasCuttingDone,
      hasCuttingStarted,
      hasQcPassed,
      hasShipped,
      overallStatus,
      overallColor,
    };
  }, [order, cuttingRows, qcRows, shipments, issues, costing, issuedMaterialRows.length]);

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!invNo.trim()) {
      toast.error('Invoice # is required.');
      return;
    }
    const qtyNum = Math.round(Number(shippedQty || 0));
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      toast.error('Shipped Qty must be greater than 0.');
      return;
    }

    setSavingShipment(true);
    try {
      const { error } = await supabase.from('order_shipments').insert({
        order_id: order.id,
        invoice_no: invNo.trim().toUpperCase(),
        ship_date: shipDate,
        shipped_qty: qtyNum,
        carton_qty: Math.max(0, Math.round(Number(cartonQty || 0))),
        destination: destination.trim() || null,
        status: 'shipped',
      });
      if (error) throw error;
      toast.success('Shipment record saved!');
      setShowAddShipment(false);
      setInvNo('');
      setShippedQty('');
      setCartonQty('0');
      setDestination('');
      await loadOrder360(order.id);
      onOrderUpdated?.();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save shipment.');
    } finally {
      setSavingShipment(false);
    }
  };

  if (!order) return null;

  const steps = [
    {
      key: 'order',
      label: 'Order Confirmed',
      labelBn: 'অর্ডার নিশ্চিত',
      done: true,
      detail: `${formatNumberBD(order.order_qty)} PCS`,
    },
    {
      key: 'costing',
      label: 'Costing Approved',
      labelBn: 'কস্টিং অনুমোদিত',
      done: metrics.hasCosting,
      detail: costing ? `FOB $${Number(costing.offered_fob_price || 0).toFixed(2)}` : 'Pending',
    },
    {
      key: 'materials',
      label: 'Materials Issued',
      labelBn: 'মালামাল ইস্যু',
      done: metrics.hasMaterials,
      detail: `${issuedMaterialRows.length} item(s)`,
    },
    {
      key: 'cutting',
      label: 'Cutting Done',
      labelBn: 'কাটিং সম্পন্ন',
      done: metrics.hasCuttingDone,
      active: !metrics.hasCuttingDone && metrics.hasCuttingStarted,
      detail: `${formatNumberBD(metrics.totalCutQty)} / ${formatNumberBD(metrics.orderQty)}`,
    },
    {
      key: 'qc',
      label: 'QC Passed',
      labelBn: 'কিউসি পাস',
      done: metrics.hasQcPassed,
      detail: metrics.qcChecked > 0 ? `${formatNumberBD(metrics.qcPass)} PCS` : 'Pending',
    },
    {
      key: 'shipped',
      label: 'Shipped',
      labelBn: 'শিপমেন্ট সম্পন্ন',
      done: metrics.hasShipped,
      detail: metrics.totalShipped > 0 ? `${formatNumberBD(metrics.totalShipped)} PCS` : 'Pending',
    },
  ];

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const tabs: Array<{ id: ActiveTab; label: string; labelBn: string; icon: React.ReactNode }> = [
    {
      id: 'summary',
      label: 'Summary & Progress',
      labelBn: 'সারসংক্ষেপ',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
    },
    {
      id: 'costing',
      label: 'Auto Costing',
      labelBn: 'অটো কস্টিং',
      icon: <Calculator className="w-3.5 h-3.5" />,
    },
    {
      id: 'materials',
      label: 'Store Materials Issued',
      labelBn: 'স্টোর ইস্যু',
      icon: <PackageCheck className="w-3.5 h-3.5" />,
    },
    {
      id: 'cutting',
      label: 'Cutting Output',
      labelBn: 'কাটিং',
      icon: <Scissors className="w-3.5 h-3.5" />,
    },
    {
      id: 'qc',
      label: 'QC & Finishing',
      labelBn: 'কিউসি ও শিপমেন্ট',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
      />
      <div
        className={`relative z-10 w-full max-w-5xl h-full overflow-y-auto shadow-2xl border-l flex flex-col ${
          isDark
            ? 'bg-[#0B2E33] border-white/15 text-white'
            : 'bg-slate-50 border-slate-200 text-slate-900'
        }`}
      >
        {/* Drawer Header */}
        <div
          className={`p-5 border-b sticky top-0 z-20 ${
            isDark
              ? 'bg-[#103A40]/95 border-white/10 backdrop-blur-md'
              : 'bg-white/95 border-slate-200 backdrop-blur-md'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xl font-extrabold font-mono text-[#0F8B8D] dark:text-[#2BA5B5]">
                  {order.order_no}
                </span>
                {order.po_no && (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30">
                    PO: {order.po_no}
                  </span>
                )}
                <span className="uppercase text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-white/10">
                  {order.unit}
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${metrics.overallColor}`}
                >
                  {metrics.overallStatus}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-85">
                <span>
                  <strong>Buyer:</strong> {order.buyers?.name || '-'}
                </span>
                <span>
                  <strong>Style:</strong> {order.style_no}
                </span>
                <span>
                  <strong>Item:</strong> {order.item_name}
                </span>
                <span>
                  <strong>Qty:</strong> {formatNumberBD(order.order_qty)} PCS
                </span>
                <span>
                  <strong>Ship Date:</strong> {formatStoreDate(order.target_ship_date)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/10 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Connected Tabs */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-[#0F8B8D] text-white shadow-sm'
                      : isDark
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-5 flex-1 space-y-5">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#0F8B8D] mb-2" />
              <p className="text-xs font-semibold">Loading Order 360° live data...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: Summary & Progress */}
              {activeTab === 'summary' && (
                <div className="space-y-5">
                  {/* Visual Step Progression */}
                  <div
                    className={`rounded-2xl border p-5 ${
                      isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    <h3 className="text-sm font-bold mb-1">
                      Order Fulfillment Pipeline{' '}
                      <span className="text-xs font-bangla opacity-70 font-normal">
                        (অর্ডার অগ্রগতি ধাপসমূহ)
                      </span>
                    </h3>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {steps.map((step, idx) => (
                        <div
                          key={step.key}
                          className={`relative p-3 rounded-2xl border transition-all ${
                            step.done
                              ? isDark
                                ? 'bg-emerald-500/10 border-emerald-500/35'
                                : 'bg-emerald-50 border-emerald-200'
                              : step.active
                              ? isDark
                                ? 'bg-amber-500/10 border-amber-500/35'
                                : 'bg-amber-50 border-amber-200'
                              : isDark
                              ? 'bg-white/5 border-white/10 opacity-70'
                              : 'bg-slate-50 border-slate-200 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-extrabold opacity-60">
                              STEP {idx + 1}
                            </span>
                            {step.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Clock
                                className={`w-4 h-4 ${
                                  step.active ? 'text-amber-500' : 'text-slate-400'
                                }`}
                              />
                            )}
                          </div>
                          <p className="text-xs font-bold leading-tight">{step.label}</p>
                          <p className="text-[10px] font-bangla opacity-70 leading-tight mt-0.5">
                            {step.labelBn}
                          </p>
                          <p className="text-[11px] font-extrabold mt-2 text-[#0F8B8D] dark:text-[#2BA5B5]">
                            {step.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Connected Snapshot Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                      className={`rounded-2xl border p-4 ${
                        isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[11px] font-semibold opacity-70 block">
                        Offered FOB &amp; Margin
                      </span>
                      <span className="text-xl font-extrabold block mt-1 text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {costing
                          ? `$ ${Number(costing.offered_fob_price || 0).toFixed(2)}`
                          : 'No Costing'}
                      </span>
                      <span className="text-[11px] opacity-75 block mt-0.5">
                        {costing
                          ? `Margin: ${Number(costing.profit_margin_percent || 0).toFixed(1)}%`
                          : 'Create costing sheet'}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl border p-4 ${
                        isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[11px] font-semibold opacity-70 block">
                        Materials Issued
                      </span>
                      <span className="text-xl font-extrabold block mt-1">
                        {issuedMaterialRows.length}{' '}
                        <span className="text-xs font-semibold opacity-70">Line Items</span>
                      </span>
                      <span className="text-[11px] opacity-75 block mt-0.5">
                        {issues.length} Store Issue Slip(s)
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl border p-4 ${
                        isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[11px] font-semibold opacity-70 block">
                        Cutting Output
                      </span>
                      <span className="text-xl font-extrabold block mt-1 text-emerald-600 dark:text-emerald-400">
                        {metrics.cutPct.toFixed(1)}%
                      </span>
                      <span className="text-[11px] opacity-75 block mt-0.5">
                        {formatNumberBD(metrics.totalCutQty)} / {formatNumberBD(metrics.orderQty)}{' '}
                        PCS
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl border p-4 ${
                        isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <span className="text-[11px] font-semibold opacity-70 block">
                        QC Pass Rate &amp; Shipped
                      </span>
                      <span className="text-xl font-extrabold block mt-1 text-sky-600 dark:text-sky-400">
                        {metrics.qcChecked > 0 ? `${metrics.qcPassRate.toFixed(1)}%` : '-'}
                      </span>
                      <span className="text-[11px] opacity-75 block mt-0.5">
                        Shipped: {formatNumberBD(metrics.totalShipped)} PCS
                      </span>
                    </div>
                  </div>

                  {/* Colour & Size Distribution Sub-section */}
                  <div
                    className={`rounded-2xl border p-5 space-y-3 ${
                      isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold">
                          Colour &amp; Size Distribution{' '}
                          <span className="text-xs font-bangla opacity-70 font-normal">
                            (কালার ও সাইজ অনুপাত)
                          </span>
                        </h3>
                        <p className="text-[11px] opacity-70">
                          Order Quantity: {formatNumberBD(order.order_qty)} PCS
                        </p>
                      </div>
                      {colorSizeRows.length > 0 && (
                        <span className="text-xs font-bold text-[#0F8B8D] dark:text-[#2BA5B5] tabular-nums">
                          {new Set(colorSizeRows.map((r) => r.color_name)).size} Colours ·{' '}
                          {new Set(colorSizeRows.map((r) => r.size_name)).size} Sizes ·{' '}
                          {formatNumberBD(
                            colorSizeRows.reduce((s, r) => s + Number(r.ratio_qty || 0), 0)
                          )}{' '}
                          PCS
                        </span>
                      )}
                    </div>

                    <ColorSizeMatrix rows={colorSizeRows} readOnly />
                  </div>
                </div>
              )}

              {/* TAB 2: Auto Costing */}
              {activeTab === 'costing' && (
                <div
                  className={`rounded-2xl border p-5 space-y-4 ${
                    isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold">Auto Costing Summary</h3>
                        {costing && (
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                              String(costing.status || 'draft').toLowerCase() === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                : String(costing.status || 'draft').toLowerCase() === 'submitted'
                                ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                            }`}
                          >
                            v{costing.version || 1} · {String(costing.status || 'draft').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bangla opacity-70">
                        ফেব্রিক, এক্সেসরিজ, সিএম ও এফওবি লাভের বিবরণ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(`/merchandising/costing?orderId=${order.id}`);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Full Costing Sheet</span>
                    </button>
                  </div>

                  {!costing ? (
                    <div className="py-12 text-center text-slate-400">
                      <Calculator className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold">No costing saved for this order yet</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        এই অর্ডারের কস্টিং তৈরি করতে উপরের "Open Full Costing Sheet" বাটনে ক্লিক করুন
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="p-3 rounded-xl border border-slate-200/70 dark:border-white/10">
                          <span className="text-[10px] uppercase opacity-65 block">Fabric / PC</span>
                          <span className="text-sm font-extrabold">
                            $ {Number(costing.fabric_cost_pc || 0).toFixed(3)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl border border-slate-200/70 dark:border-white/10">
                          <span className="text-[10px] uppercase opacity-65 block">Trims / PC</span>
                          <span className="text-sm font-extrabold">
                            $ {Number(costing.accessories_cost_pc || 0).toFixed(3)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl border border-slate-200/70 dark:border-white/10">
                          <span className="text-[10px] uppercase opacity-65 block">CM / PC</span>
                          <span className="text-sm font-extrabold">
                            $ {Number(costing.cm_cost_pc || 0).toFixed(3)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl border border-slate-200/70 dark:border-white/10">
                          <span className="text-[10px] uppercase opacity-65 block">Total Cost / PC</span>
                          <span className="text-sm font-extrabold">
                            $ {Number(costing.total_cost_pc || 0).toFixed(3)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl border border-[#2BA5B5]/30 bg-[#2BA5B5]/10">
                          <span className="text-[10px] uppercase opacity-75 block">FOB Price</span>
                          <span className="text-sm font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                            $ {Number(costing.offered_fob_price || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                          <span className="text-[10px] uppercase opacity-75 block">
                            Profit / Margin
                          </span>
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            ${Number(costing.total_profit || 0).toFixed(0)} (
                            {Number(costing.profit_margin_percent || 0).toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {(costing.order_costing_items || []).length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr
                                className={`border-b ${
                                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                                }`}
                              >
                                <th className="py-2.5 px-3 font-bold">Material</th>
                                <th className="py-2.5 px-3 font-bold">Type</th>
                                <th className="py-2.5 px-3 font-bold">UOM</th>
                                <th className="py-2.5 px-3 text-right font-bold">Req. Qty</th>
                                <th className="py-2.5 px-3 text-right font-bold">Cost / PC</th>
                                <th className="py-2.5 px-3 text-right font-bold">Total Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                              {(costing.order_costing_items || []).map((ci, idx) => (
                                <tr key={ci.id || idx}>
                                  <td className="py-2 px-3 font-semibold">{ci.item_name}</td>
                                  <td className="py-2 px-3 uppercase text-[10px] font-bold">
                                    {ci.item_type}
                                  </td>
                                  <td className="py-2 px-3">{ci.uom}</td>
                                  <td className="py-2 px-3 text-right">
                                    {formatNumberBD(ci.total_required_qty, 2)}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {ci.currency === 'USD' ? '$' : '৳'}{' '}
                                    {Number(ci.cost_per_pc || 0).toFixed(3)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold">
                                    {ci.currency === 'USD' ? '$' : '৳'}{' '}
                                    {formatNumberBD(ci.total_cost, 2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: Store Materials Issued */}
              {activeTab === 'materials' && (
                <div
                  className={`rounded-2xl border p-5 space-y-4 ${
                    isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                  }`}
                >
                  <div>
                    <h3 className="text-base font-bold">Store Materials Issued for this Order</h3>
                    <p className="text-xs font-bangla opacity-70">
                      স্টোর থেকে এই অর্ডারের বিপরীতে ইস্যুকৃত ফেব্রিক ও এক্সেসরিজ তালিকা
                    </p>
                  </div>

                  {issuedMaterialRows.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold">No materials issued yet</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        এই অর্ডারের জন্য এখনও কোনো স্টোর মালামাল ইস্যু করা হয়নি
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr
                            className={`border-b ${
                              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <th className="py-2.5 px-3 font-bold">Issue #</th>
                            <th className="py-2.5 px-3 font-bold">Issue Date</th>
                            <th className="py-2.5 px-3 font-bold">Dept / Line</th>
                            <th className="py-2.5 px-3 font-bold">Item Name</th>
                            <th className="py-2.5 px-3 text-right font-bold">Issued Qty</th>
                            <th className="py-2.5 px-3 font-bold">UOM</th>
                            <th className="py-2.5 px-3 text-center font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {issuedMaterialRows.map((row) => (
                            <tr key={row.id}>
                              <td className="py-2.5 px-3 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {row.issueNo}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {formatStoreDate(row.issueDate)}
                              </td>
                              <td className="py-2.5 px-3">
                                {row.department}
                                {row.purpose ? ` · ${row.purpose}` : ''}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold block">{row.itemName}</span>
                                <span className="text-[10px] font-mono opacity-65">{row.sku}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold">
                                {formatNumberBD(row.qty, 2)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">{row.uom}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Cutting Output */}
              {activeTab === 'cutting' && (
                <div
                  className={`rounded-2xl border p-5 space-y-4 ${
                    isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold">Cutting Output &amp; Progress</h3>
                      <p className="text-xs font-bangla opacity-70">
                        অর্ডার পরিমাণের তুলনায় কাটিং উৎপাদন অগ্রগতি
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {formatNumberBD(metrics.totalCutQty)} / {formatNumberBD(metrics.orderQty)}{' '}
                        PCS ({metrics.cutPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Cut Qty vs Order Qty Progress Bar */}
                  <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metrics.cutPct >= 100
                          ? 'bg-emerald-500'
                          : 'bg-[#0F8B8D] dark:bg-[#2BA5B5]'
                      }`}
                      style={{ width: `${metrics.cutPct}%` }}
                    />
                  </div>

                  {cuttingRows.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <Scissors className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold">No cutting entries recorded yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr
                            className={`border-b ${
                              isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <th className="py-2.5 px-3 font-bold">Cut #</th>
                            <th className="py-2.5 px-3 font-bold">Date</th>
                            <th className="py-2.5 px-3 font-bold">Table #</th>
                            <th className="py-2.5 px-3 text-right font-bold">Lay</th>
                            <th className="py-2.5 px-3 text-right font-bold">Fabric (Yds)</th>
                            <th className="py-2.5 px-3 text-right font-bold">Cut Qty</th>
                            <th className="py-2.5 px-3 text-right font-bold">Rejection</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {cuttingRows.map((c) => (
                            <tr key={c.id}>
                              <td className="py-2.5 px-3 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {c.cut_no}
                              </td>
                              <td className="py-2.5 px-3">{formatStoreDate(c.cut_date)}</td>
                              <td className="py-2.5 px-3 font-semibold">{c.table_no}</td>
                              <td className="py-2.5 px-3 text-right">
                                {formatNumberBD(c.lay_count)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {formatNumberBD(c.fabric_consumed_yds, 2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-extrabold">
                                {formatNumberBD(c.cut_qty)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-rose-500 font-bold">
                                {formatNumberBD(c.rejection_qty)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: QC & Finishing + Shipments */}
              {activeTab === 'qc' && (
                <div className="space-y-5">
                  {/* QC Section */}
                  <div
                    className={`rounded-2xl border p-5 space-y-4 ${
                      isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold">QC Inspection Summary</h3>
                        <p className="text-xs font-bangla opacity-70">
                          পাস পরিমাণ, ত্রুটি ও রিজেকশন বিশ্লেষণ
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                          Pass: {formatNumberBD(metrics.qcPass)} PCS (
                          {metrics.qcPassRate.toFixed(1)}%)
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold">
                          Defect: {formatNumberBD(metrics.qcDefect)} · Reject:{' '}
                          {formatNumberBD(metrics.qcReject)}
                        </span>
                      </div>
                    </div>

                    {qcRows.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <ShieldCheck className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
                        <p className="text-xs font-semibold">No QC inspections recorded yet</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr
                              className={`border-b ${
                                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <th className="py-2.5 px-3 font-bold">Date</th>
                              <th className="py-2.5 px-3 font-bold">Stage</th>
                              <th className="py-2.5 px-3 text-right font-bold">Checked</th>
                              <th className="py-2.5 px-3 text-right font-bold">Pass</th>
                              <th className="py-2.5 px-3 text-right font-bold">Defect</th>
                              <th className="py-2.5 px-3 text-right font-bold">Reject</th>
                              <th className="py-2.5 px-3 font-bold">Defects / Inspector</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {qcRows.map((q) => (
                              <tr key={q.id}>
                                <td className="py-2 px-3">{formatStoreDate(q.qc_date)}</td>
                                <td className="py-2 px-3 font-bold">{q.stage}</td>
                                <td className="py-2 px-3 text-right">
                                  {formatNumberBD(q.checked_qty)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatNumberBD(q.pass_qty)}
                                </td>
                                <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 font-bold">
                                  {formatNumberBD(q.defect_qty)}
                                </td>
                                <td className="py-2 px-3 text-right text-rose-500 font-bold">
                                  {formatNumberBD(q.reject_qty)}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-semibold block">
                                    {q.inspector_name || '-'}
                                  </span>
                                  {Array.isArray(q.defect_types) && q.defect_types.length > 0 && (
                                    <span className="text-[10px] opacity-70 block">
                                      {q.defect_types.join(', ')}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Shipment Records Section */}
                  <div
                    className={`rounded-2xl border p-5 space-y-4 ${
                      isDark ? 'bg-[#103A40]/85 border-white/10' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#0F8B8D] dark:text-[#2BA5B5]" />
                          <span>Shipment Records</span>
                        </h3>
                        <p className="text-xs font-bangla opacity-70">
                          ইনভয়েস ও শিপমেন্ট বিবরণ ({formatNumberBD(metrics.totalShipped)} PCS shipped)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddShipment((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30 text-xs font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record Shipment</span>
                      </button>
                    </div>

                    {showAddShipment && (
                      <form
                        onSubmit={handleSaveShipment}
                        className={`p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end ${
                          isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <label className="block text-[10px] font-bold mb-1">Invoice # *</label>
                          <input
                            type="text"
                            required
                            value={invNo}
                            onChange={(e) => setInvNo(e.target.value)}
                            placeholder="INV-2026-01"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold mb-1">Ship Date *</label>
                          <input
                            type="date"
                            required
                            value={shipDate}
                            onChange={(e) => setShipDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold mb-1">Shipped Qty *</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={shippedQty}
                            onChange={(e) => setShippedQty(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold mb-1">Cartons</label>
                          <input
                            type="number"
                            min="0"
                            value={cartonQty}
                            onChange={(e) => setCartonQty(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={destination}
                            onChange={(e) => setDestination(e.target.value)}
                            placeholder="Destination"
                            className={inputClass}
                          />
                          <button
                            type="submit"
                            disabled={savingShipment}
                            className="px-3 py-2 rounded-xl bg-[#0F8B8D] text-white text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {savingShipment ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      </form>
                    )}

                    {shipments.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <Truck className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
                        <p className="text-xs font-semibold">No shipments recorded yet</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-white/10">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr
                              className={`border-b ${
                                isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <th className="py-2.5 px-3 font-bold">Invoice #</th>
                              <th className="py-2.5 px-3 font-bold">Ship Date</th>
                              <th className="py-2.5 px-3 text-right font-bold">Shipped Qty</th>
                              <th className="py-2.5 px-3 text-right font-bold">Cartons</th>
                              <th className="py-2.5 px-3 font-bold">Destination</th>
                              <th className="py-2.5 px-3 text-center font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {shipments.map((s) => (
                              <tr key={s.id}>
                                <td className="py-2 px-3 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                  {s.invoice_no}
                                </td>
                                <td className="py-2 px-3">{formatStoreDate(s.ship_date)}</td>
                                <td className="py-2 px-3 text-right font-extrabold">
                                  {formatNumberBD(s.shipped_qty)} PCS
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {formatNumberBD(s.carton_qty)}
                                </td>
                                <td className="py-2 px-3">{s.destination || '-'}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                    {s.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsDrawer;
