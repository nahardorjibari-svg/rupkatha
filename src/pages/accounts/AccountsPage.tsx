import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Calculator,
  Plus,
  Search,
  RefreshCw,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Edit2,
  Printer,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { formatBDT, formatNumberBD, formatStoreCurrency, formatStoreDate } from '../../lib/storeFormat';
import type { MerchOrder, OrderCosting } from '../../types/merchandising';
import type { StoreGrn, StoreIssue, StoreItem } from '../../types/store';

type VoucherType = 'receipt' | 'payment';
type ActiveTab = 'profitability' | 'vouchers';

interface AccountVoucher {
  id: string;
  voucher_no: string;
  voucher_date: string;
  voucher_type: VoucherType | string;
  order_id?: string | null;
  party_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  reference_no?: string | null;
  remarks?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  orders?: {
    id: string;
    order_no: string;
    po_no?: string | null;
    style_no: string;
    item_name: string;
    unit?: string | null;
    buyers?: { name?: string | null; code?: string | null } | null;
  } | null;
}

interface OrderWithCosting extends MerchOrder {
  order_costings?: OrderCosting[];
}

const PAYMENT_METHODS = [
  'Bank Transfer / TT',
  'L/C Settlement',
  'Cheque',
  'Cash',
  'bKash / MFS',
] as const;

const DEFAULT_EXCHANGE_RATE = 122;

export const AccountsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile, user } = useAuth();
  const { activeUnit } = useUnit();

  const currentUserId = user?.id || profile?.id || null;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('profitability');

  const [vouchers, setVouchers] = useState<AccountVoucher[]>([]);
  const [orders, setOrders] = useState<OrderWithCosting[]>([]);
  const [issues, setIssues] = useState<StoreIssue[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [grns, setGrns] = useState<StoreGrn[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | 'woven' | 'knit'>('all');
  const [profitFilter, setProfitFilter] = useState<'all' | 'profit' | 'loss' | 'pending'>('all');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'all' | VoucherType>('all');
  const [voucherOrderFilter, setVoucherOrderFilter] = useState<string>('all');

  // New / Edit Voucher Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<AccountVoucher | null>(null);
  const [saving, setSaving] = useState(false);

  // Voucher Slip View Modal
  const [viewingVoucher, setViewingVoucher] = useState<AccountVoucher | null>(null);

  // Form fields
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherDate, setVoucherDate] = useState(getDhakaDateString());
  const [voucherType, setVoucherType] = useState<VoucherType>('receipt');
  const [orderId, setOrderId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer / TT');
  const [referenceNo, setReferenceNo] = useState('');
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
      const [vouchersRes, ordersRes, issuesRes, itemsRes, grnsRes] = await Promise.all([
        supabase
          .from('account_vouchers')
          .select(
            'id, voucher_no, voucher_date, voucher_type, order_id, party_name, amount, currency, payment_method, reference_no, remarks, created_by, created_at, orders(id, order_no, po_no, style_no, item_name, unit, buyers(name, code))'
          )
          .order('voucher_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select(
            'id, order_no, po_no, buyer_id, style_no, item_name, unit, order_qty, target_ship_date, smv, currency, exchange_rate, status, created_at, buyers(id, name, code), order_costings(id, version, currency, exchange_rate, fabric_cost_pc, accessories_cost_pc, cm_cost_pc, total_cost_pc, total_order_cost, offered_fob_price, profit_per_pc, profit_margin_percent, total_profit, status)'
          )
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        supabase
          .from('store_issues')
          .select('id, issue_no, issue_date, order_id, status, store_issue_items(id, item_id, qty)')
          .neq('status', 'rejected')
          .neq('status', 'draft'),
        supabase
          .from('store_items')
          .select('id, sku, name, default_unit_cost, default_currency'),
        supabase
          .from('store_grn')
          .select('id, currency, exchange_rate, status, store_grn_items(item_id, qty, accepted_qty, unit_price)')
          .eq('status', 'approved'),
      ]);

      if (vouchersRes.error) throw vouchersRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setVouchers((vouchersRes.data || []) as unknown as AccountVoucher[]);
      setOrders((ordersRes.data || []) as unknown as OrderWithCosting[]);
      setIssues(issuesRes.error ? [] : ((issuesRes.data || []) as unknown as StoreIssue[]));
      setStoreItems(itemsRes.error ? [] : ((itemsRes.data || []) as unknown as StoreItem[]));
      setGrns(grnsRes.error ? [] : ((grnsRes.data || []) as unknown as StoreGrn[]));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load accounts & costing data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Weighted average BDT cost per store item from approved GRNs, falling back to default_unit_cost
  const itemCostBdtMap = useMemo(() => {
    const grnAgg = new Map<string, { qty: number; bdt: number }>();
    grns.forEach((grn) => {
      const rate =
        String(grn.currency || 'BDT').toUpperCase() === 'USD'
          ? Math.max(1, Number(grn.exchange_rate || DEFAULT_EXCHANGE_RATE))
          : 1;
      (grn.store_grn_items || []).forEach((line) => {
        const q = Math.max(0, Number(line.accepted_qty ?? line.qty ?? 0));
        const p = Math.max(0, Number(line.unit_price || 0));
        if (q <= 0 || p <= 0) return;
        const curr = grnAgg.get(line.item_id) || { qty: 0, bdt: 0 };
        curr.qty += q;
        curr.bdt += q * p * rate;
        grnAgg.set(line.item_id, curr);
      });
    });

    const costMap = new Map<string, number>();
    storeItems.forEach((it) => {
      const agg = grnAgg.get(it.id);
      if (agg && agg.qty > 0 && agg.bdt > 0) {
        costMap.set(it.id, agg.bdt / agg.qty);
      } else {
        const defCost = Math.max(0, Number(it.default_unit_cost || 0));
        const mult =
          String(it.default_currency || 'BDT').toUpperCase() === 'USD'
            ? DEFAULT_EXCHANGE_RATE
            : 1;
        costMap.set(it.id, defCost * mult);
      }
    });
    return costMap;
  }, [grns, storeItems]);

  // Actual material cost BDT per order from store_issues
  const orderMaterialCostMap = useMemo(() => {
    const map = new Map<string, { totalBdt: number; issueCount: number; itemCount: number }>();
    issues.forEach((iss) => {
      if (!iss.order_id) return;
      const entry = map.get(iss.order_id) || { totalBdt: 0, issueCount: 0, itemCount: 0 };
      entry.issueCount += 1;
      (iss.store_issue_items || []).forEach((line) => {
        const q = Math.max(0, Number(line.qty || 0));
        const unitCostBdt = itemCostBdtMap.get(line.item_id) || 0;
        entry.totalBdt += q * unitCostBdt;
        entry.itemCount += 1;
      });
      map.set(iss.order_id, entry);
    });
    return map;
  }, [issues, itemCostBdtMap]);

  // Voucher aggregates per order (receipts & direct expense payments)
  const orderMap = useMemo(() => {
    const map = new Map<string, OrderWithCosting>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const toBdtAmount = useCallback(
    (rawAmount: number, rawCurrency?: string | null, linkedOrderId?: string | null): number => {
      const amt = Number(rawAmount || 0);
      if (!Number.isFinite(amt)) return 0;
      if (String(rawCurrency || 'BDT').toUpperCase() !== 'USD') return amt;
      const linkedOrder = linkedOrderId ? orderMap.get(linkedOrderId) : undefined;
      const rate = Number(linkedOrder?.exchange_rate || DEFAULT_EXCHANGE_RATE);
      return amt * (rate > 0 ? rate : DEFAULT_EXCHANGE_RATE);
    },
    [orderMap]
  );

  const orderVoucherTotalsMap = useMemo(() => {
    const map = new Map<string, { receiptsBdt: number; paymentsBdt: number }>();
    vouchers.forEach((v) => {
      if (!v.order_id) return;
      const entry = map.get(v.order_id) || { receiptsBdt: 0, paymentsBdt: 0 };
      const bdt = toBdtAmount(v.amount, v.currency, v.order_id);
      if (String(v.voucher_type).toLowerCase() === 'receipt') entry.receiptsBdt += bdt;
      else entry.paymentsBdt += bdt;
      map.set(v.order_id, entry);
    });
    return map;
  }, [vouchers, toBdtAmount]);

  // Computed profitability rows per order
  const profitabilityRows = useMemo(() => {
    return orders.map((order) => {
      const sortedCostings = [...(order.order_costings || [])].sort(
        (a, b) => Number(b.version || 0) - Number(a.version || 0)
      );
      const latestCosting = sortedCostings[0] || null;
      const qty = Math.max(0, Number(order.order_qty || 0));
      const rate = Number(
        latestCosting?.exchange_rate || order.exchange_rate || DEFAULT_EXCHANGE_RATE
      );

      const costingCurr = String(latestCosting?.currency || order.currency || 'USD').toUpperCase();
      const fobOriginal = Number(latestCosting?.offered_fob_price || 0);
      const estCostPcOriginal = Number(latestCosting?.total_cost_pc || 0);
      const cmPcOriginal = Number(latestCosting?.cm_cost_pc || 0);

      const fobBdtPerPc = costingCurr === 'BDT' ? fobOriginal : fobOriginal * rate;
      const estCostBdtPerPc = costingCurr === 'BDT' ? estCostPcOriginal : estCostPcOriginal * rate;
      const cmTotalBdt = (costingCurr === 'BDT' ? cmPcOriginal : cmPcOriginal * rate) * qty;

      const totalRevenueBdt = fobBdtPerPc * qty;
      const matStats = orderMaterialCostMap.get(order.id) || {
        totalBdt: 0,
        issueCount: 0,
        itemCount: 0,
      };
      const voucherStats = orderVoucherTotalsMap.get(order.id) || {
        receiptsBdt: 0,
        paymentsBdt: 0,
      };

      const actualMaterialBdt = matStats.totalBdt;
      const actualMaterialPerPcBdt = qty > 0 ? actualMaterialBdt / qty : 0;
      const actualTotalCostBdt = actualMaterialBdt + cmTotalBdt + voucherStats.paymentsBdt;

      const hasCosting = Boolean(latestCosting && fobBdtPerPc > 0);
      const actualProfitBdt = hasCosting ? totalRevenueBdt - actualTotalCostBdt : 0;
      const actualMarginPct =
        hasCosting && totalRevenueBdt > 0 ? (actualProfitBdt / totalRevenueBdt) * 100 : null;

      return {
        order,
        latestCosting,
        costingCurr,
        rate,
        qty,
        fobOriginal,
        fobBdtPerPc,
        estCostPcOriginal,
        estCostBdtPerPc,
        totalRevenueBdt,
        actualMaterialBdt,
        actualMaterialPerPcBdt,
        cmTotalBdt,
        directPaymentsBdt: voucherStats.paymentsBdt,
        receiptsBdt: voucherStats.receiptsBdt,
        issueCount: matStats.issueCount,
        actualProfitBdt,
        actualMarginPct,
        hasCosting,
      };
    });
  }, [orders, orderMaterialCostMap, orderVoucherTotalsMap]);

  const filteredProfitabilityRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profitabilityRows.filter((row) => {
      const { order, actualMarginPct, hasCosting } = row;
      if (unitFilter !== 'all' && String(order.unit || '').toLowerCase() !== unitFilter) {
        return false;
      }
      if (profitFilter === 'profit' && (!hasCosting || (actualMarginPct ?? -1) < 0)) return false;
      if (profitFilter === 'loss' && (!hasCosting || (actualMarginPct ?? 0) >= 0)) return false;
      if (profitFilter === 'pending' && hasCosting) return false;
      if (q) {
        const matchOrder = (order.order_no || '').toLowerCase().includes(q);
        const matchPo = (order.po_no || '').toLowerCase().includes(q);
        const matchStyle = (order.style_no || '').toLowerCase().includes(q);
        const matchBuyer = (order.buyers?.name || '').toLowerCase().includes(q);
        const matchItem = (order.item_name || '').toLowerCase().includes(q);
        if (!matchOrder && !matchPo && !matchStyle && !matchBuyer && !matchItem) return false;
      }
      return true;
    });
  }, [profitabilityRows, search, unitFilter, profitFilter]);

  const filteredVouchers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vouchers.filter((v) => {
      const linkedOrd = v.orders || (v.order_id ? orderMap.get(v.order_id) : undefined);
      if (
        unitFilter !== 'all' &&
        linkedOrd &&
        String(linkedOrd.unit || '').toLowerCase() !== unitFilter
      ) {
        return false;
      }
      if (
        voucherTypeFilter !== 'all' &&
        String(v.voucher_type || '').toLowerCase() !== voucherTypeFilter
      ) {
        return false;
      }
      if (voucherOrderFilter !== 'all' && v.order_id !== voucherOrderFilter) {
        return false;
      }
      if (q) {
        const matchVno = (v.voucher_no || '').toLowerCase().includes(q);
        const matchParty = (v.party_name || '').toLowerCase().includes(q);
        const matchRef = (v.reference_no || '').toLowerCase().includes(q);
        const matchOrd = (linkedOrd?.order_no || '').toLowerCase().includes(q);
        const matchPo = (linkedOrd?.po_no || '').toLowerCase().includes(q);
        if (!matchVno && !matchParty && !matchRef && !matchOrd && !matchPo) return false;
      }
      return true;
    });
  }, [vouchers, orderMap, unitFilter, voucherTypeFilter, voucherOrderFilter, search]);

  // Top KPIs (respecting active unit filter)
  const kpis = useMemo(() => {
    const scopedRows =
      unitFilter === 'all'
        ? profitabilityRows
        : profitabilityRows.filter(
            (r) => String(r.order.unit || '').toLowerCase() === unitFilter
          );

    const totalInvoicedBdt = scopedRows.reduce((acc, r) => acc + r.totalRevenueBdt, 0);
    const totalIssuedMaterialBdt = scopedRows.reduce((acc, r) => acc + r.actualMaterialBdt, 0);

    const scopedVouchers =
      unitFilter === 'all'
        ? vouchers
        : vouchers.filter((v) => {
            const ord = v.orders || (v.order_id ? orderMap.get(v.order_id) : undefined);
            return !ord || String(ord.unit || '').toLowerCase() === unitFilter;
          });

    let totalReceivedBdt = 0;
    let totalPaidBdt = 0;
    let receiptCount = 0;
    let paymentCount = 0;

    scopedVouchers.forEach((v) => {
      const bdt = toBdtAmount(v.amount, v.currency, v.order_id);
      if (String(v.voucher_type).toLowerCase() === 'receipt') {
        totalReceivedBdt += bdt;
        receiptCount += 1;
      } else {
        totalPaidBdt += bdt;
        paymentCount += 1;
      }
    });

    const outstandingReceivablesBdt = totalInvoicedBdt - totalReceivedBdt;
    const netCashFlowBdt = totalReceivedBdt - totalPaidBdt;

    return {
      totalInvoicedBdt,
      totalReceivedBdt,
      totalPaidBdt,
      outstandingReceivablesBdt,
      netCashFlowBdt,
      totalIssuedMaterialBdt,
      receiptCount,
      paymentCount,
      orderCount: scopedRows.length,
    };
  }, [profitabilityRows, vouchers, unitFilter, orderMap, toBdtAmount]);

  const suggestVoucherNo = useCallback(
    (type: VoucherType) => {
      const year = getDhakaDateString().slice(0, 4);
      const prefix = type === 'receipt' ? 'RV' : 'PV';
      let maxSeq = 1000;
      vouchers.forEach((v) => {
        const m = String(v.voucher_no || '').match(/(\d+)$/);
        if (m) {
          const n = Number(m[1]);
          if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
        }
      });
      return `${prefix}-${year}-${maxSeq + 1}`;
    },
    [vouchers]
  );

  const openNewVoucherModal = (defaultType: VoucherType = 'receipt') => {
    setEditingVoucher(null);
    setVoucherType(defaultType);
    setVoucherNo(suggestVoucherNo(defaultType));
    setVoucherDate(getDhakaDateString());
    setOrderId('');
    setPartyName('');
    setAmount('');
    setCurrency('BDT');
    setPaymentMethod('Bank Transfer / TT');
    setReferenceNo('');
    setRemarks('');
    setModalOpen(true);
  };

  const openEditVoucherModal = (voucher: AccountVoucher) => {
    const vType: VoucherType =
      String(voucher.voucher_type).toLowerCase() === 'payment' ? 'payment' : 'receipt';
    setEditingVoucher(voucher);
    setVoucherType(vType);
    setVoucherNo(voucher.voucher_no || '');
    setVoucherDate(voucher.voucher_date || getDhakaDateString());
    setOrderId(voucher.order_id || '');
    setPartyName(voucher.party_name || '');
    setAmount(String(voucher.amount ?? ''));
    setCurrency(String(voucher.currency || 'BDT').toUpperCase() === 'USD' ? 'USD' : 'BDT');
    setPaymentMethod(voucher.payment_method || 'Bank Transfer / TT');
    setReferenceNo(voucher.reference_no || '');
    setRemarks(voucher.remarks || '');
    setModalOpen(true);
  };

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherNo.trim()) {
      toast.error('Voucher # is required.');
      return;
    }
    if (!voucherDate) {
      toast.error('Voucher date is required.');
      return;
    }
    if (!partyName.trim()) {
      toast.error('Party Name is required.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        voucher_no: voucherNo.trim().toUpperCase(),
        voucher_date: voucherDate,
        voucher_type: voucherType,
        order_id: orderId || null,
        party_name: partyName.trim(),
        amount: parsedAmount,
        currency,
        payment_method: paymentMethod,
        reference_no: referenceNo.trim() || null,
        remarks: remarks.trim() || null,
      };

      if (editingVoucher) {
        const { error } = await supabase
          .from('account_vouchers')
          .update(payload)
          .eq('id', editingVoucher.id);
        if (error) throw error;
        toast.success(`Voucher ${payload.voucher_no} updated.`);
      } else {
        const { error } = await supabase.from('account_vouchers').insert({
          ...payload,
          ...(currentUserId ? { created_by: currentUserId } : {}),
        });
        if (error) throw error;
        toast.success(`Voucher ${payload.voucher_no} recorded.`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMsg = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMsg || 'Failed to save voucher.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const profitabilityTotals = useMemo(() => {
    return filteredProfitabilityRows.reduce(
      (acc, r) => {
        acc.qty += r.qty;
        acc.revBdt += r.totalRevenueBdt;
        acc.matBdt += r.actualMaterialBdt;
        acc.profitBdt += r.hasCosting ? r.actualProfitBdt : 0;
        return acc;
      },
      { qty: 0, revBdt: 0, matBdt: 0, profitBdt: 0 }
    );
  }, [filteredProfitabilityRows]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </span>
              <span>Accounts &amp; Actual Order Costing</span>
            </h1>
            <p className="text-xs font-bangla opacity-75 mt-1">
              হিসাব বিভাগ, বায়ার রিসিপ্ট, পেমেন্ট ভাউচার ও অর্ডারভিত্তিক প্রকৃত লাভ-ক্ষতি বিশ্লেষণ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <div className="text-left">
                <span className="block leading-tight">Refresh</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">রিফ্রেশ</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openNewVoucherModal('receipt')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">New Voucher</span>
                <span className="block text-[10px] font-bangla opacity-80 leading-tight">নতুন ভাউচার</span>
              </div>
            </button>
          </div>
        </div>

        {/* 4 Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                Total Invoiced / Revenue
              </p>
              <div className="w-8 h-8 rounded-xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
                <BadgeDollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold mt-2 tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatBDT(kpis.totalInvoicedBdt)}
            </p>
            <p className="text-[11px] font-bangla opacity-70 mt-0.5">
              মোট অর্ডার মূল্য ({formatNumberBD(kpis.orderCount)} টি অর্ডার)
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Total Received (Buyer)
              </p>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold mt-2 tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatBDT(kpis.totalReceivedBdt)}
            </p>
            <p className="text-[11px] font-bangla opacity-70 mt-0.5">
              বায়ার থেকে প্রাপ্ত ({formatNumberBD(kpis.receiptCount)} টি রিসিপ্ট)
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Total Paid (Expenses)
              </p>
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold mt-2 tabular-nums text-rose-600 dark:text-rose-400">
              {formatBDT(kpis.totalPaidBdt)}
            </p>
            <p className="text-[11px] font-bangla opacity-70 mt-0.5">
              স্টোর ইস্যু: {formatBDT(kpis.totalIssuedMaterialBdt)} · {formatNumberBD(kpis.paymentCount)} পেমেন্ট
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Outstanding Balance (৳)
              </p>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-extrabold mt-2 tabular-nums text-amber-600 dark:text-amber-400">
              {formatBDT(kpis.outstandingReceivablesBdt)}
            </p>
            <p className="text-[11px] font-bangla opacity-70 mt-0.5">
              নগদ ব্যালেন্স (Cash Net): <strong className="tabular-nums">{formatBDT(kpis.netCashFlowBdt)}</strong>
            </p>
          </div>
        </div>

        {/* Navigation Tabs + Filters */}
        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Segmented Tab Control */}
            <div
              className={`inline-flex p-1 rounded-xl border self-start ${
                isDark ? 'bg-[#0B2E33] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTab('profitability')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'profitability'
                    ? 'bg-[#0F8B8D] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Order Profitability &amp; Actual Costing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vouchers')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'vouchers'
                    ? 'bg-[#0F8B8D] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Voucher Register ({vouchers.length})</span>
              </button>
            </div>

            <div className="text-[11px] font-bangla opacity-75">
              {activeTab === 'profitability'
                ? 'স্টোর ইস্যু (Store Issues) ও অটো কস্টিং থেকে লাইভ হিসাবকৃত'
                : 'বায়ার রিসিপ্ট ও সাপ্লায়ার/খরচ পেমেন্ট ভাউচার লেজার'}
            </div>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
            <div className="lg:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'profitability'
                    ? 'Search Order #, PO #, Buyer, Style...'
                    : 'Search Voucher #, Party Name, Order #, Ref #...'
                }
                className={`${inputClass} pl-10`}
              />
            </div>

            <div className="lg:col-span-3">
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value as 'all' | 'woven' | 'knit')}
                className={inputClass}
              >
                <option value="all">All Units (সব ইউনিট)</option>
                <option value="woven">Woven Unit (উভেন)</option>
                <option value="knit">Knit Unit (নিট)</option>
              </select>
            </div>

            {activeTab === 'profitability' ? (
              <div className="lg:col-span-4">
                <select
                  value={profitFilter}
                  onChange={(e) =>
                    setProfitFilter(e.target.value as 'all' | 'profit' | 'loss' | 'pending')
                  }
                  className={inputClass}
                >
                  <option value="all">All Margin Status (সব অবস্থা)</option>
                  <option value="profit">Profitable Orders (লাভজনক)</option>
                  <option value="loss">Loss / Over-Budget (ক্ষতি)</option>
                  <option value="pending">Pending Costing (কস্টিং বাকি)</option>
                </select>
              </div>
            ) : (
              <>
                <div className="lg:col-span-2">
                  <select
                    value={voucherTypeFilter}
                    onChange={(e) =>
                      setVoucherTypeFilter(e.target.value as 'all' | VoucherType)
                    }
                    className={inputClass}
                  >
                    <option value="all">All Types</option>
                    <option value="receipt">Receipt (জমা)</option>
                    <option value="payment">Payment (খরচ)</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <select
                    value={voucherOrderFilter}
                    onChange={(e) => setVoucherOrderFilter(e.target.value)}
                    className={inputClass}
                  >
                    <option value="all">All Orders</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_no}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* TAB 1: ORDER PROFITABILITY & ACTUAL COSTING */}
        {activeTab === 'profitability' && (
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
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">অর্ডার ও বায়ার</span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="block font-bold">Buyer PO #</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">পিও নং</span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="block font-bold">Style</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">স্টাইল</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span className="block font-bold">Order Qty</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">পরিমাণ</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span className="block font-bold">FOB Price</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">বিক্রয় মূল্য</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span className="block font-bold">Est. Cost / PC</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">আনুমানিক ব্যয়</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span className="block font-bold">Actual Material Cost</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">স্টোর ইস্যু ব্যয়</span>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <span className="block font-bold">Actual Profit Margin %</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">প্রকৃত লাভের হার</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={8} className="py-4 px-4">
                          <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredProfitabilityRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-slate-400">
                        <Calculator className="w-9 h-9 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-sm">No matching buyer orders found</p>
                        <p className="text-xs font-bangla opacity-70 mt-0.5">
                          ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredProfitabilityRows.map((row) => {
                      const { order } = row;
                      const isPositive = (row.actualMarginPct ?? 0) >= 0;

                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                              {order.order_no}
                            </span>
                            <span className="text-[10px] opacity-70 block">
                              {order.buyers?.name || '-'} · {String(order.unit).toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold">
                            {order.po_no || <span className="opacity-45">-</span>}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold block">{order.style_no}</span>
                            <span className="text-[10px] opacity-65 block truncate max-w-[160px]">
                              {order.item_name}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums">
                            {formatNumberBD(row.qty)} <span className="text-[10px] opacity-65 font-normal">PCS</span>
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            {row.hasCosting ? (
                              <>
                                <span className="font-bold block">
                                  {formatStoreCurrency(row.fobOriginal, row.costingCurr, 2)}/pc
                                </span>
                                <span className="text-[10px] opacity-70 block">
                                  Total: {formatBDT(row.totalRevenueBdt)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] opacity-55">No Costing</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            {row.hasCosting ? (
                              <>
                                <span className="font-bold block">
                                  {formatBDT(row.estCostBdtPerPc, 2)}
                                </span>
                                <span className="text-[10px] opacity-65 block">
                                  ({formatStoreCurrency(row.estCostPcOriginal, row.costingCurr, 2)})
                                </span>
                              </>
                            ) : (
                              <span className="opacity-50">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            <span className="font-bold block text-[#0F8B8D] dark:text-[#2BA5B5]">
                              {formatBDT(row.actualMaterialBdt)}
                            </span>
                            <span className="text-[10px] opacity-70 block">
                              {row.issueCount > 0
                                ? `${formatBDT(row.actualMaterialPerPcBdt, 2)}/pc · ${row.issueCount} issue(s)`
                                : 'No store issues'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            {row.actualMarginPct === null ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                                Pending Costing
                              </span>
                            ) : (
                              <div className="inline-flex flex-col items-end">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                                    isPositive
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                                  }`}
                                >
                                  {isPositive ? (
                                    <TrendingUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <TrendingDown className="w-3.5 h-3.5" />
                                  )}
                                  {row.actualMarginPct.toFixed(1)}%
                                </span>
                                <span
                                  className={`text-[10px] font-semibold mt-0.5 ${
                                    isPositive
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isPositive ? '+' : ''}
                                  {formatBDT(row.actualProfitBdt)}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && filteredProfitabilityRows.length > 0 && (
                  <tfoot>
                    <tr
                      className={`border-t font-bold ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <td colSpan={3} className="py-3 px-4">
                        Total ({filteredProfitabilityRows.length} Orders)
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {formatNumberBD(profitabilityTotals.qty)} PCS
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {formatBDT(profitabilityTotals.revBdt)}
                      </td>
                      <td className="py-3 px-3 text-right opacity-60">-</td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {formatBDT(profitabilityTotals.matBdt)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums ${
                          profitabilityTotals.profitBdt >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatBDT(profitabilityTotals.profitBdt)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: VOUCHER REGISTER */}
        {activeTab === 'vouchers' && (
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
                      <span className="block font-bold">Voucher #</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">ভাউচার নং</span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="block font-bold">Date</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">তারিখ</span>
                    </th>
                    <th className="py-3 px-3 text-center">
                      <span className="block font-bold">Type</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">ধরন</span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="block font-bold">Order #</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">অর্ডার নং</span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="block font-bold">Party Name</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">পক্ষের নাম</span>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <span className="block font-bold">Amount (৳ / $)</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">টাকার পরিমাণ</span>
                    </th>
                    <th className="py-3 px-3">
                      <span className="block font-bold">Method</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">মাধ্যম</span>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <span className="block font-bold">Actions</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">কার্যক্রম</span>
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={8} className="py-4 px-4">
                          <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-slate-400">
                        <Receipt className="w-9 h-9 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-sm">No vouchers recorded yet</p>
                        <p className="text-xs font-bangla opacity-70 mt-0.5 mb-4">
                          উপরের "New Voucher" বাটনে ক্লিক করে রিসিপ্ট বা পেমেন্ট ভাউচার যোগ করুন
                        </p>
                        <button
                          type="button"
                          onClick={() => openNewVoucherModal('receipt')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F8B8D] text-white text-xs font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Record First Voucher
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => {
                      const isReceipt = String(v.voucher_type).toLowerCase() === 'receipt';
                      const linkedOrd = v.orders || (v.order_id ? orderMap.get(v.order_id) : undefined);
                      const isUsd = String(v.currency || 'BDT').toUpperCase() === 'USD';
                      const bdtVal = toBdtAmount(v.amount, v.currency, v.order_id);

                      return (
                        <tr
                          key={v.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                              {v.voucher_no}
                            </span>
                            {v.reference_no && (
                              <span className="text-[10px] opacity-65 block">Ref: {v.reference_no}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {formatStoreDate(v.voucher_date)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase border ${
                                isReceipt
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {isReceipt ? (
                                <ArrowDownLeft className="w-3 h-3" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3" />
                              )}
                              {isReceipt ? 'Receipt' : 'Payment'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {linkedOrd ? (
                              <>
                                <span className="font-mono font-bold block">
                                  {linkedOrd.order_no}
                                </span>
                                <span className="text-[10px] opacity-65 block">
                                  {linkedOrd.po_no ? `PO: ${linkedOrd.po_no} · ` : ''}
                                  {linkedOrd.style_no}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] opacity-55">General</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold">{v.party_name}</td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            <span
                              className={`font-extrabold block ${
                                isReceipt
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatStoreCurrency(v.amount, v.currency, isUsd ? 2 : 0)}
                            </span>
                            {isUsd && (
                              <span className="text-[10px] opacity-65 block">
                                ≈ {formatBDT(bdtVal)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">{v.payment_method}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingVoucher(v)}
                                title="View Voucher Slip"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300/60 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Slip</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditVoucherModal(v)}
                                title="Edit Voucher"
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
        )}
      </div>

      {/* New / Edit Voucher Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !saving && setModalOpen(false)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-5 border-b border-slate-200/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    {editingVoucher
                      ? `Edit Voucher — ${editingVoucher.voucher_no}`
                      : 'Record New Account Voucher'}
                  </h2>
                  <p className="text-xs font-bangla opacity-70">
                    {editingVoucher
                      ? 'ভাউচারের তথ্য হালনাগাদ করুন'
                      : 'নতুন রিসিপ্ট বা পেমেন্ট ভাউচার এন্ট্রি করুন'}
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

            <form onSubmit={handleSaveVoucher} className="p-5 space-y-4">
              {/* Voucher Type Toggle */}
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Voucher Type * <span className="font-bangla opacity-70 font-normal">(ভাউচারের ধরন)</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('receipt');
                      if (!editingVoucher) setVoucherNo(suggestVoucherNo('receipt'));
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      voucherType === 'receipt'
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : isDark
                        ? 'bg-[#0B2E33] border-white/15 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Receipt (Buyer / জমা)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVoucherType('payment');
                      if (!editingVoucher) setVoucherNo(suggestVoucherNo('payment'));
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      voucherType === 'payment'
                        ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                        : isDark
                        ? 'bg-[#0B2E33] border-white/15 text-slate-300'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Payment (Supplier / খরচ)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Voucher # * <span className="font-bangla opacity-70 font-normal">(নম্বর)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    placeholder="e.g. RV-2026-1001"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Date * <span className="font-bangla opacity-70 font-normal">(তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Link to Order (Optional){' '}
                  <span className="font-bangla opacity-70 font-normal">(সংশ্লিষ্ট অর্ডার)</span>
                </label>
                <select
                  value={orderId}
                  onChange={(e) => {
                    const nextOrdId = e.target.value;
                    setOrderId(nextOrdId);
                    if (nextOrdId && voucherType === 'receipt' && !partyName.trim()) {
                      const ord = orderMap.get(nextOrdId);
                      if (ord?.buyers?.name) setPartyName(ord.buyers.name);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">General / No Specific Order</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_no} {o.po_no ? `· PO: ${o.po_no}` : ''} · {o.style_no} (
                      {o.buyers?.name || 'Buyer'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Party Name *{' '}
                  <span className="font-bangla opacity-70 font-normal">
                    ({voucherType === 'receipt' ? 'বায়ার / দাতার নাম' : 'সাপ্লায়ার / প্রাপকের নাম'})
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder={
                    voucherType === 'receipt'
                      ? 'e.g. H&M Hennes & Mauritz'
                      : 'e.g. Pacific Accessories / Factory Utility'
                  }
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold mb-1">
                    Amount * <span className="font-bangla opacity-70 font-normal">(টাকার পরিমাণ)</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`${inputClass} tabular-nums font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Currency * <span className="font-bangla opacity-70 font-normal">(মুদ্রা)</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'BDT' | 'USD')}
                    className={inputClass}
                  >
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Payment Method * <span className="font-bangla opacity-70 font-normal">(পেমেন্ট মাধ্যম)</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputClass}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Reference # <span className="font-bangla opacity-70 font-normal">(চেক / টিটি নং)</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="TT-88412 / Chq-402"
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
                  placeholder="Optional narration, invoice reference, or bank details..."
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
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingVoucher ? 'Update Voucher' : 'Save Voucher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Voucher Slip Modal */}
      {viewingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setViewingVoucher(null)}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs print:hidden"
          />
          <div className="relative z-10 w-full max-w-xl rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-slate-700">
                Voucher Slip — {viewingVoucher.voucher_no}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0F8B8D] text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setViewingVoucher(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 text-xs">
              <div className="text-center border-b border-slate-200 pb-4">
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                  RUPKATHA APPARELS LTD.
                </h2>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F8B8D] mt-1">
                  {String(viewingVoucher.voucher_type).toLowerCase() === 'receipt'
                    ? 'OFFICIAL RECEIPT VOUCHER'
                    : 'OFFICIAL PAYMENT VOUCHER'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Voucher #</span>
                  <span className="font-mono font-bold text-sm">{viewingVoucher.voucher_no}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Date</span>
                  <span className="font-bold">{formatStoreDate(viewingVoucher.voucher_date)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Party Name</span>
                  <span className="font-bold">{viewingVoucher.party_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Method</span>
                  <span className="font-semibold">{viewingVoucher.payment_method}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    Linked Order / Reference
                  </span>
                  <span className="font-semibold">
                    {viewingVoucher.orders
                      ? `${viewingVoucher.orders.order_no}${
                          viewingVoucher.orders.po_no ? ` (PO: ${viewingVoucher.orders.po_no})` : ''
                        }`
                      : 'General Factory Account'}
                  </span>
                  {viewingVoucher.reference_no && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Ref: {viewingVoucher.reference_no}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Amount</span>
                  <span className="text-xl font-extrabold text-[#0F8B8D] tabular-nums">
                    {formatStoreCurrency(
                      viewingVoucher.amount,
                      viewingVoucher.currency,
                      String(viewingVoucher.currency).toUpperCase() === 'USD' ? 2 : 0
                    )}
                  </span>
                </div>
              </div>

              {viewingVoucher.remarks && (
                <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <strong>Remarks:</strong> {viewingVoucher.remarks}
                </div>
              )}

              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[11px] text-slate-500">
                <div className="border-t border-slate-300 pt-1.5">Prepared By</div>
                <div className="border-t border-slate-300 pt-1.5">Accounts Officer</div>
                <div className="border-t border-slate-300 pt-1.5">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AccountsPage;
