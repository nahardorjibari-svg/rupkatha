import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ClipboardList,
  Package,
  Scissors,
  BadgeDollarSign,
  ArrowUpRight,
  Layers,
  Warehouse,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import { formatBDT, formatNumberBD } from '../../lib/storeFormat';
import { computeLiveStoreData } from '../../lib/storeStockCalc';
import type {
  StoreCategory,
  StoreGrn,
  StoreIssue,
  StoreItem,
  StoreStockStatusRow,
  StoreUom,
} from '../../types/store';

interface ExecutiveMetricsSectionProps {
  refreshKey?: number;
}

interface DashboardOrderRow {
  id: string;
  order_no: string;
  style_no: string;
  unit: string;
  order_qty: number;
  currency: string;
  exchange_rate: number;
  status?: string | null;
  order_costings?: Array<{
    offered_fob_price?: number;
    currency?: string;
    exchange_rate?: number;
    version?: number;
  }>;
}

interface DashboardCuttingRow {
  id: string;
  cut_date: string;
  unit: string;
  cut_qty: number;
  rejection_qty: number;
}

interface DashboardVoucherRow {
  id: string;
  voucher_type: string;
  amount: number;
  currency: string;
  order_id?: string | null;
}

const DEFAULT_RATE = 122;

export const ExecutiveMetricsSection: React.FC<ExecutiveMetricsSectionProps> = ({
  refreshKey = 0,
}) => {
  const { isDark } = useTheme();
  const { activeUnit } = useUnit();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<DashboardOrderRow[]>([]);
  const [cuttingRows, setCuttingRows] = useState<DashboardCuttingRow[]>([]);
  const [vouchers, setVouchers] = useState<DashboardVoucherRow[]>([]);
  const [storeStockRows, setStoreStockRows] = useState<StoreStockStatusRow[]>([]);

  const loadExecutiveMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const [
        ordersRes,
        cuttingRes,
        vouchersRes,
        itemsRes,
        catRes,
        uomRes,
        grnRes,
        issueRes,
        viewRes,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select(
            'id, order_no, style_no, unit, order_qty, currency, exchange_rate, status, order_costings(offered_fob_price, currency, exchange_rate, version)'
          )
          .neq('status', 'cancelled'),
        supabase.from('production_cutting').select('id, cut_date, unit, cut_qty, rejection_qty'),
        supabase.from('account_vouchers').select('id, voucher_type, amount, currency, order_id'),
        supabase.from('store_items').select('*'),
        supabase.from('store_categories').select('*'),
        supabase.from('store_uoms').select('*'),
        supabase.from('store_grn').select('*, store_grn_items(*)'),
        supabase.from('store_issues').select('*, store_issue_items(*)'),
        supabase.from('store_v_stock_status').select('*'),
      ]);

      if (!ordersRes.error) {
        setOrders((ordersRes.data || []) as unknown as DashboardOrderRow[]);
      }
      if (!cuttingRes.error) {
        setCuttingRows((cuttingRes.data || []) as unknown as DashboardCuttingRow[]);
      }
      if (!vouchersRes.error) {
        setVouchers((vouchersRes.data || []) as unknown as DashboardVoucherRow[]);
      }

      if (!itemsRes.error && !grnRes.error) {
        const computed = computeLiveStoreData({
          items: (itemsRes.data || []) as StoreItem[],
          categories: (catRes.data || []) as StoreCategory[],
          uoms: (uomRes.data || []) as StoreUom[],
          grns: (grnRes.data || []) as StoreGrn[],
          issues: issueRes.error ? [] : ((issueRes.data || []) as unknown as StoreIssue[]),
          fallbackViewRows: viewRes.error ? [] : ((viewRes.data || []) as StoreStockStatusRow[]),
        });
        setStoreStockRows(computed.statusRows);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExecutiveMetrics();
  }, [loadExecutiveMetrics, refreshKey]);

  const metrics = useMemo(() => {
    const unitScope =
      activeUnit === 'knit' || activeUnit === 'woven' ? activeUnit : 'all';

    // 1. Orders & Active Styles
    const scopedOrders =
      unitScope === 'all'
        ? orders
        : orders.filter((o) => String(o.unit || '').toLowerCase() === unitScope);

    const activeStyles = new Set(
      scopedOrders.map((o) => (o.style_no || '').trim()).filter(Boolean)
    ).size;
    const totalOrderQty = scopedOrders.reduce((acc, o) => acc + Number(o.order_qty || 0), 0);

    // 2. Live Store Inventory Value in BDT
    let storeValueBdt = 0;
    let storeAlertCount = 0;
    storeStockRows.forEach((row) => {
      if (row.status === 'inactive') return;
      if (unitScope === 'all') {
        storeValueBdt += Number(row.stock_value || 0);
        if (row.status === 'low' || row.status === 'out') storeAlertCount += 1;
      } else {
        const totalQty = Number(row.current_stock || 0);
        const unitQty = unitScope === 'knit' ? Number(row.knit_qty || 0) : Number(row.woven_qty || 0);
        if (totalQty > 0 && unitQty > 0) {
          storeValueBdt += Number(row.stock_value || 0) * (unitQty / totalQty);
        }
        if (unitQty <= Number(row.minimum_stock || 0)) storeAlertCount += 1;
      }
    });

    // 3. Cutting Output & Progress
    const today = getDhakaDateString();
    const scopedCutting =
      unitScope === 'all'
        ? cuttingRows
        : cuttingRows.filter((c) => String(c.unit || '').toLowerCase() === unitScope);
    const totalCutQty = scopedCutting.reduce((acc, c) => acc + Number(c.cut_qty || 0), 0);
    const todayCutQty = scopedCutting
      .filter((c) => c.cut_date === today)
      .reduce((acc, c) => acc + Number(c.cut_qty || 0), 0);
    const cutProgressPct =
      totalOrderQty > 0 ? Math.min(100, Math.round((totalCutQty / totalOrderQty) * 100)) : 0;

    // 4. Accounts Balance & Receivables
    const orderMap = new Map<string, DashboardOrderRow>();
    orders.forEach((o) => orderMap.set(o.id, o));

    const totalInvoicedBdt = scopedOrders.reduce((acc, ord) => {
      const sortedCostings = [...(ord.order_costings || [])].sort(
        (a, b) => Number(b.version || 0) - Number(a.version || 0)
      );
      const latest = sortedCostings[0];
      if (!latest || !latest.offered_fob_price) return acc;
      const curr = String(latest.currency || ord.currency || 'USD').toUpperCase();
      const rate = Number(latest.exchange_rate || ord.exchange_rate || DEFAULT_RATE);
      const fobBdt =
        curr === 'BDT' ? Number(latest.offered_fob_price) : Number(latest.offered_fob_price) * rate;
      return acc + fobBdt * Number(ord.order_qty || 0);
    }, 0);

    let receivedBdt = 0;
    let paidBdt = 0;
    vouchers.forEach((v) => {
      const linked = v.order_id ? orderMap.get(v.order_id) : undefined;
      if (unitScope !== 'all' && linked && String(linked.unit || '').toLowerCase() !== unitScope) {
        return;
      }
      const rate = Number(linked?.exchange_rate || DEFAULT_RATE);
      const bdt =
        String(v.currency || 'BDT').toUpperCase() === 'USD'
          ? Number(v.amount || 0) * rate
          : Number(v.amount || 0);
      if (String(v.voucher_type).toLowerCase() === 'receipt') receivedBdt += bdt;
      else paidBdt += bdt;
    });

    const receivablesBdt = totalInvoicedBdt - receivedBdt;
    const netBalanceBdt = receivedBdt - paidBdt;

    return {
      orderCount: scopedOrders.length,
      activeStyles,
      totalOrderQty,
      storeValueBdt,
      storeAlertCount,
      storeItemCount: storeStockRows.filter((r) => r.status !== 'inactive').length,
      totalCutQty,
      todayCutQty,
      cutProgressPct,
      receivablesBdt,
      netBalanceBdt,
    };
  }, [activeUnit, orders, cuttingRows, vouchers, storeStockRows]);

  const cardSurface = isDark
    ? 'bg-[#103A40]/90 border-white/10 hover:border-[#2BA5B5]/50 text-white'
    : 'glass-card bg-white/85 border-slate-200/90 hover:border-[#0F8B8D]/45 text-slate-900';

  return (
    <div className="space-y-4">
      {/* Quick Actions Bar */}
      <div
        className={`rounded-2xl border px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
          isDark
            ? 'bg-[#103A40]/85 border-white/10 text-white'
            : 'glass-card bg-white/90 border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-extrabold tracking-tight">Quick Actions</p>
            <p className="text-[10px] font-bangla opacity-70">দ্রুত এন্ট্রি ও দৈনিক কার্যক্রম</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/merchandising/orders')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Order</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/store/grn')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-[#0B2E33] border-[#2BA5B5]/35 text-[#2BA5B5] hover:bg-[#2BA5B5]/15'
                : 'bg-teal-50 border-teal-200 text-[#0F8B8D] hover:bg-teal-100'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            <span>+ Goods Receive (GRN)</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/store/issue')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-[#0B2E33] border-sky-400/30 text-sky-300 hover:bg-sky-500/15'
                : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>+ Material Issue</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/production/cutting')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              isDark
                ? 'bg-[#0B2E33] border-amber-400/30 text-amber-300 hover:bg-amber-500/15'
                : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>+ Record Cutting</span>
          </button>
        </div>
      </div>

      {/* 4 Live Connected Factory KPI Cards (Clickable) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Total Orders & Active Styles */}
        <button
          type="button"
          onClick={() => navigate('/merchandising/orders')}
          className={`text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${cardSurface}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Total Orders &amp; Styles
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#0F8B8D]/15 text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
              {loading ? '—' : formatNumberBD(metrics.orderCount)}
            </span>
            <span className="text-xs font-semibold opacity-70">
              Orders · {loading ? '—' : formatNumberBD(metrics.activeStyles)} Styles
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/30 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="opacity-75 font-bangla">
              মোট অর্ডার: <strong className="tabular-nums">{formatNumberBD(metrics.totalOrderQty)}</strong> PCS
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[#0F8B8D] dark:text-[#2BA5B5] group-hover:translate-x-0.5 transition-transform">
              Open <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* KPI 2: Live Store Inventory Value */}
        <button
          type="button"
          onClick={() => navigate('/store/dashboard')}
          className={`text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${cardSurface}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Live Store Stock Value
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 tabular-nums">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {loading ? '—' : formatBDT(metrics.storeValueBdt)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/30 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="opacity-75 font-bangla">
              {formatNumberBD(metrics.storeItemCount)} আইটেম ·{' '}
              <span className={metrics.storeAlertCount > 0 ? 'text-amber-500 font-bold' : ''}>
                {metrics.storeAlertCount} Low Alert
              </span>
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
              Store <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* KPI 3: Cutting Output & Progress */}
        <button
          type="button"
          onClick={() => navigate('/production/cutting')}
          className={`text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${cardSurface}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Cutting Output &amp; Progress
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Scissors className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {loading ? '—' : formatNumberBD(metrics.totalCutQty)}
            </span>
            <span className="text-xs font-semibold opacity-70">
              PCS ({metrics.cutProgressPct}% of orders)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/30 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="opacity-75 font-bangla">
              আজকের কাটিং: <strong className="tabular-nums">{formatNumberBD(metrics.todayCutQty)}</strong> PCS
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
              Cutting <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* KPI 4: Accounts Balance & Receivables */}
        <button
          type="button"
          onClick={() => navigate('/accounts')}
          className={`text-left rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group ${cardSurface}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
              Accounts &amp; Receivables
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <BadgeDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 tabular-nums">
            <span className="text-2xl font-extrabold text-sky-600 dark:text-sky-400">
              {loading ? '—' : formatBDT(metrics.receivablesBdt)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/30 dark:border-white/10 flex items-center justify-between text-[11px]">
            <span className="opacity-75 font-bangla">
              নগদ ব্যালেন্স: <strong className="tabular-nums">{formatBDT(metrics.netBalanceBdt)}</strong>
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
              Accounts <ArrowUpRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default ExecutiveMetricsSection;
