import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowRight,
  Plus,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  Boxes,
  Send,
  Repeat,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
} from 'recharts';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import {
  formatBDT,
  formatMonthLabel,
  formatNumberBD,
  formatStoreDateTime,
} from '../../lib/storeFormat';
import {
  computeLiveStoreData,
  normalizeItemOperationUnit,
} from '../../lib/storeStockCalc';
import {
  canEditGrn,
  type StoreCategory,
  type StoreGrn,
  type StoreIssue,
  type StoreItem,
  type StoreMonthlyMovementRow,
  type StoreRecentActivityRow,
  type StoreStockStatusRow,
  type StoreStockStatusType,
  type StoreUom,
} from '../../types/store';

const STATUS_COLORS: Record<StoreStockStatusType, { label: string; labelBn: string; color: string }> = {
  in_stock: { label: 'In Stock', labelBn: 'মজুদ আছে', color: '#16A34A' },
  low: { label: 'Low', labelBn: 'স্বল্প মজুদ', color: '#F59E0B' },
  out: { label: 'Out', labelBn: 'মজুদ শূন্য', color: '#EF4444' },
  inactive: { label: 'Inactive', labelBn: 'নিষ্ক্রিয়', color: '#64748B' },
};

const CATEGORY_COLORS = ['#0F8B8D', '#2BA5B5', '#38BDF8', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

interface ComputedStockRow extends StoreStockStatusRow {
  unitQty: number;
  unitValue: number;
  unitStatus: StoreStockStatusType;
}

export const StoreDashboard: React.FC = () => {
  const { isDark } = useTheme();
  const { profile } = useAuth();
  const { activeUnit } = useUnit();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthsRange, setMonthsRange] = useState<6 | 12>(6);

  const [rawItems, setRawItems] = useState<StoreItem[]>([]);
  const [rawGrns, setRawGrns] = useState<StoreGrn[]>([]);
  const [stockRows, setStockRows] = useState<StoreStockStatusRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<StoreMonthlyMovementRow[]>([]);
  const [recentRows, setRecentRows] = useState<StoreRecentActivityRow[]>([]);
  const [pendingGrnCount, setPendingGrnCount] = useState(0);

  const unitScope: 'all' | 'knit' | 'woven' =
    activeUnit === 'knit' ? 'knit' : activeUnit === 'woven' ? 'woven' : 'all';

  const allowCreateGrn = canEditGrn(profile?.role, profile?.is_active);

  const loadDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [itemsRes, catRes, uomRes, grnRes, issueRes, viewRes] = await Promise.all([
        supabase.from('store_items').select('*').order('sku', { ascending: true }),
        supabase.from('store_categories').select('*'),
        supabase.from('store_uoms').select('*'),
        supabase
          .from('store_grn')
          .select('*, store_grn_items(*)')
          .order('grn_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('store_issues')
          .select('*, store_issue_items(*)')
          .order('issue_date', { ascending: false }),
        supabase.from('store_v_stock_status').select('*'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (catRes.error) throw catRes.error;
      if (uomRes.error) throw uomRes.error;
      if (grnRes.error) throw grnRes.error;

      const items = (itemsRes.data || []) as StoreItem[];
      const categories = (catRes.data || []) as StoreCategory[];
      const uoms = (uomRes.data || []) as StoreUom[];
      const grns = (grnRes.data || []) as StoreGrn[];
      const issues = issueRes.error ? [] : ((issueRes.data || []) as unknown as StoreIssue[]);
      const fallbackViewRows = viewRes.error
        ? []
        : ((viewRes.data || []) as StoreStockStatusRow[]);

      const computed = computeLiveStoreData({
        items,
        categories,
        uoms,
        grns,
        issues,
        fallbackViewRows,
      });

      setRawItems(items);
      setRawGrns(grns);
      setStockRows(computed.statusRows);
      setMonthlyRows(computed.monthlyRows);
      setRecentRows(computed.recentActivities);
      setPendingGrnCount(computed.pendingGrnCount);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load store dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const itemOpUnitMap = useMemo(() => {
    const map = new Map<string, 'knit' | 'woven' | 'both'>();
    rawItems.forEach((it) => map.set(it.id, normalizeItemOperationUnit(it.extra_fields?.unit)));
    return map;
  }, [rawItems]);

  // Unit-aware stock computation
  const computedStock: ComputedStockRow[] = useMemo(() => {
    return stockRows
      .filter((row) => {
        if (unitScope === 'all') return true;
        const opUnit = itemOpUnitMap.get(row.item_id) || 'both';
        const unitQty = unitScope === 'knit' ? Number(row.knit_qty || 0) : Number(row.woven_qty || 0);
        return opUnit === 'both' || opUnit === unitScope || unitQty > 0;
      })
      .map((row) => {
        const totalQty = Number(row.current_stock || 0);
        const totalVal = Number(row.stock_value || 0);
        const minStock = Number(row.minimum_stock || 0);

        if (unitScope === 'all') {
          return {
            ...row,
            unitQty: totalQty,
            unitValue: totalVal,
            unitStatus: row.status,
          };
        }

        const unitQty = unitScope === 'knit' ? Number(row.knit_qty || 0) : Number(row.woven_qty || 0);
        const unitValue = totalQty > 0 ? totalVal * (unitQty / totalQty) : 0;
        let unitStatus: StoreStockStatusType = row.status;
        if (row.status !== 'inactive') {
          if (unitQty <= 0) unitStatus = 'out';
          else if (minStock > 0 && unitQty <= minStock) unitStatus = 'low';
          else unitStatus = 'in_stock';
        }

        return {
          ...row,
          unitQty,
          unitValue,
          unitStatus,
        };
      });
  }, [stockRows, unitScope, itemOpUnitMap]);

  // KPI metrics
  const kpis = useMemo(() => {
    const totalValue = computedStock.reduce((acc, r) => acc + r.unitValue, 0);
    const totalQty = computedStock.reduce((acc, r) => acc + r.unitQty, 0);
    const totalItems = computedStock.length;
    const lowStock = computedStock.filter((r) => r.unitStatus === 'low').length;
    const outOfStock = computedStock.filter((r) => r.unitStatus === 'out').length;
    const inStock = computedStock.filter((r) => r.unitStatus === 'in_stock').length;
    const inactive = computedStock.filter((r) => r.unitStatus === 'inactive').length;

    const todayDhaka = getDhakaDateString(); // YYYY-MM-DD
    const currentMonthPrefix = todayDhaka.slice(0, 7); // YYYY-MM

    const filteredMonthly = monthlyRows.filter((m) =>
      unitScope === 'all' ? true : String(m.unit || '').toLowerCase() === unitScope
    );

    const stockInThisMonth = filteredMonthly
      .filter((m) => String(m.month || '').startsWith(currentMonthPrefix))
      .reduce((acc, m) => acc + Number(m.value_in || 0), 0);

    let todayGrnQty = 0;
    rawGrns
      .filter((g) => g.status === 'approved')
      .filter((g) => (unitScope === 'all' ? true : String(g.unit || '').toLowerCase() === unitScope))
      .forEach((g) => {
        const grnDay =
          g.grn_date ||
          (g.approved_at ? getDhakaDateString(new Date(g.approved_at)) : '') ||
          (g.created_at ? getDhakaDateString(new Date(g.created_at)) : '');
        if (grnDay !== todayDhaka) return;
        (g.store_grn_items || []).forEach((line) => {
          todayGrnQty += Math.max(0, Number(line.accepted_qty ?? line.qty ?? 0));
        });
      });

    const filteredActivities = recentRows.filter((a) =>
      unitScope === 'all' ? true : String(a.unit || '').toLowerCase() === unitScope
    );

    let todayIssueQty = 0;
    filteredActivities.forEach((act) => {
      if (!act.created_at) return;
      const actDate = getDhakaDateString(new Date(act.created_at));
      if (actDate !== todayDhaka) return;
      const mType = String(act.movement_type || '').toLowerCase();
      if (mType === 'issue') {
        todayIssueQty += Math.abs(Number(act.qty_delta || 0));
      }
    });

    return {
      totalValue,
      totalQty,
      totalItems,
      lowStock,
      outOfStock,
      inStock,
      inactive,
      stockInThisMonth,
      todayGrnQty,
      todayIssueQty,
    };
  }, [computedStock, monthlyRows, recentRows, rawGrns, unitScope]);

  // Chart data: Monthly movement aggregated across units (or selected unit)
  const monthlyChartData = useMemo(() => {
    const map = new Map<
      string,
      { monthKey: string; label: string; value_in: number; value_out: number; qty_in: number }
    >();

    monthlyRows
      .filter((m) => (unitScope === 'all' ? true : String(m.unit || '').toLowerCase() === unitScope))
      .forEach((m) => {
        const key = String(m.month || '').slice(0, 7);
        if (!key) return;
        const existing = map.get(key) || {
          monthKey: key,
          label: formatMonthLabel(key),
          value_in: 0,
          value_out: 0,
          qty_in: 0,
        };
        existing.value_in += Number(m.value_in || 0);
        existing.value_out += Number(m.value_out || 0);
        existing.qty_in += Number(m.qty_in || 0);
        map.set(key, existing);
      });

    const sorted = Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return sorted.slice(-monthsRange);
  }, [monthlyRows, unitScope, monthsRange]);

  // Donut: Stock Status
  const statusDonutData = useMemo(() => {
    const counts: Record<StoreStockStatusType, number> = {
      in_stock: kpis.inStock,
      low: kpis.lowStock,
      out: kpis.outOfStock,
      inactive: kpis.inactive,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return (Object.keys(STATUS_COLORS) as StoreStockStatusType[]).map((key) => ({
      key,
      name: STATUS_COLORS[key].label,
      nameBn: STATUS_COLORS[key].labelBn,
      value: counts[key],
      percent: total > 0 ? Math.round((counts[key] / total) * 100) : 0,
      color: STATUS_COLORS[key].color,
    }));
  }, [kpis]);

  // Category Stock Chart Data (computed directly from live item balances)
  const categoryChartData = useMemo(() => {
    const catMap = new Map<string, { name: string; itemCount: number; value: number }>();
    computedStock.forEach((row) => {
      const cat = row.category_name || 'Uncategorized';
      const entry = catMap.get(cat) || { name: cat, itemCount: 0, value: 0 };
      entry.itemCount += 1;
      entry.value += row.unitValue;
      catMap.set(cat, entry);
    });
    return Array.from(catMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [computedStock]);

  // Top Low / Out Stock Items
  const topLowStockItems = useMemo(() => {
    return computedStock
      .filter((r) => r.unitStatus === 'low' || r.unitStatus === 'out')
      .sort((a, b) => {
        if (a.unitStatus === 'out' && b.unitStatus !== 'out') return -1;
        if (a.unitStatus !== 'out' && b.unitStatus === 'out') return 1;
        return a.unitQty - b.unitQty;
      })
      .slice(0, 8);
  }, [computedStock]);

  // Recent activities filtered by unit
  const recentActivities = useMemo(() => {
    return recentRows
      .filter((a) => (unitScope === 'all' ? true : String(a.unit || '').toLowerCase() === unitScope))
      .slice(0, 10);
  }, [recentRows, unitScope]);

  const cardClass = `rounded-2xl border p-5 transition-all ${
    isDark ? 'bg-[#103A40]/85 border-white/10 text-slate-100' : 'glass-card bg-white/80 border-slate-200/80 text-slate-900'
  }`;

  const renderActivityMeta = (act: StoreRecentActivityRow) => {
    const type = String(act.movement_type || '').toLowerCase();
    const delta = Number(act.qty_delta || 0);

    if (type === 'grn') {
      return {
        icon: <ArrowDownLeft className="w-4 h-4 text-emerald-500" />,
        bg: isDark ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200',
        deltaText: `+${formatNumberBD(Math.abs(delta), 2)}`,
        deltaClass: 'text-emerald-600 dark:text-emerald-400',
        label: 'GRN',
      };
    }
    if (type === 'issue') {
      return {
        icon: <ArrowUpRight className="w-4 h-4 text-rose-500" />,
        bg: isDark ? 'bg-rose-500/15 border-rose-500/30' : 'bg-rose-50 border-rose-200',
        deltaText: `-${formatNumberBD(Math.abs(delta), 2)}`,
        deltaClass: 'text-rose-600 dark:text-rose-400',
        label: 'Issue',
      };
    }
    if (type === 'transfer_in' || type === 'transfer_out') {
      return {
        icon: <ArrowLeftRight className="w-4 h-4 text-purple-500" />,
        bg: isDark ? 'bg-purple-500/15 border-purple-500/30' : 'bg-purple-50 border-purple-200',
        deltaText: `${delta >= 0 ? '+' : '-'}${formatNumberBD(Math.abs(delta), 2)}`,
        deltaClass: 'text-purple-600 dark:text-purple-400',
        label: type === 'transfer_in' ? 'Transfer In' : 'Transfer Out',
      };
    }
    return {
      icon: <SlidersHorizontal className="w-4 h-4 text-amber-500" />,
      bg: isDark ? 'bg-amber-500/15 border-amber-500/30' : 'bg-amber-50 border-amber-200',
      deltaText: `${delta >= 0 ? '+' : '-'}${formatNumberBD(Math.abs(delta), 2)}`,
      deltaClass: 'text-amber-600 dark:text-amber-400',
      label: type.replace('_', ' ').toUpperCase(),
    };
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header + Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight">
                Store &amp; Inventory Dashboard
              </h1>
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30">
                {unitScope === 'all' ? 'All Units' : unitScope === 'knit' ? 'Knit Unit' : 'Woven Unit'}
              </span>
            </div>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              স্টোর ও ইনভেন্টরি ড্যাশবোর্ড — রিয়েল-টাইম মজুদ ও লেনদেন সারসংক্ষেপ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {allowCreateGrn && (
              <button
                type="button"
                onClick={() => navigate('/store/grn?new=1')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0c7476] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <span className="block leading-tight">New GRN</span>
                  <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                    নতুন জিআরএন
                  </span>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/store/issue')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-[#2BA5B5] shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">New Issue</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  নতুন ইস্যু
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/store/transfer')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Repeat className="w-3.5 h-3.5 text-[#2BA5B5] shrink-0" />
              <div className="text-left">
                <span className="block leading-tight">New Transfer</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  নতুন স্থানান্তর
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <div className="text-left">
                <span className="block leading-tight">Refresh</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  রিফ্রেশ
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ROW 1: Hero Card + 2x2 KPIs + 2 Small Today Cards */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={`lg:col-span-5 h-52 animate-pulse ${cardClass}`} />
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={`h-24 animate-pulse ${cardClass}`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Hero Card */}
            <div
              className={`lg:col-span-5 rounded-2xl border p-6 relative overflow-hidden flex flex-col justify-between ${
                isDark
                  ? 'bg-gradient-to-br from-[#0F8B8D]/25 via-[#103A40] to-[#0B2E33] border-[#2BA5B5]/30'
                  : 'bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/70 border-teal-200/80 shadow-soft-md'
              }`}
            >
              <Package className="w-32 h-32 text-[#0F8B8D]/15 dark:text-[#2BA5B5]/15 absolute -right-4 -bottom-4 pointer-events-none" />
              <div className="relative z-10">
                <p className="text-sm font-bold uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">
                  Store Overview
                </p>
                <p className="text-xs font-bangla opacity-70">স্টোর ওভারভিউ</p>

                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Stock Value <span className="font-bangla opacity-70">(মোট মজুদের মূল্য)</span>
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-slate-900 dark:text-white">
                    {formatBDT(kpis.totalValue)}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] font-bold">
                      Total Qty: {formatNumberBD(kpis.totalQty, 2)}
                    </span>
                    {pendingGrnCount > 0 && (
                      <Link
                        to="/store/grn"
                        className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-bold hover:underline"
                      >
                        {pendingGrnCount} Pending GRN{pendingGrnCount > 1 ? 's' : ''}
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-6">
                <Link
                  to="/store/items"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm transition-all"
                >
                  <div className="text-left">
                    <span className="block leading-tight">View Inventory Details</span>
                    <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                      ইনভেন্টরি বিস্তারিত দেখুন
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>
            </div>

            {/* Right KPIs: 2x2 + 2 small Today cards */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* KPI 1: Total Items */}
              <div className={cardClass}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Total Items
                    </p>
                    <p className="text-[11px] font-bangla opacity-70">মোট পণ্য</p>
                  </div>
                  <div className="p-2 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                    <Boxes className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-3">{formatNumberBD(kpis.totalItems)}</p>
              </div>

              {/* KPI 2: Low Stock */}
              <div className={cardClass}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Low Stock
                    </p>
                    <p className="text-[11px] font-bangla opacity-70">স্বল্প মজুদ</p>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-3 text-amber-600 dark:text-amber-400">
                  {formatNumberBD(kpis.lowStock)}
                </p>
              </div>

              {/* KPI 3: Out of Stock */}
              <div className={cardClass}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Out of Stock
                    </p>
                    <p className="text-[11px] font-bangla opacity-70">মজুদ শূন্য</p>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-3 text-rose-600 dark:text-rose-400">
                  {formatNumberBD(kpis.outOfStock)}
                </p>
              </div>

              {/* KPI 4: Stock In This Month */}
              <div className={cardClass}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Stock In This Month
                    </p>
                    <p className="text-[11px] font-bangla opacity-70">এই মাসে স্টক ইন</p>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl font-extrabold mt-3 truncate" title={formatBDT(kpis.stockInThisMonth)}>
                  {formatBDT(kpis.stockInThisMonth)}
                </p>
              </div>

              {/* Small Card 1: Today GRN Qty */}
              <div className={cardClass}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Today GRN Qty
                    </p>
                    <p className="text-[11px] font-bangla opacity-70">আজকের জিআরএন</p>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-3 text-emerald-600 dark:text-emerald-400">
                  {formatNumberBD(kpis.todayGrnQty, 2)}
                </p>
              </div>

              {/* Small Card 2: Today Issue Qty */}
              <div className={cardClass}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Today Issue Qty
                    </p>
                    <p className="text-[11px] font-bangla opacity-70">আজকের ইস্যু</p>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-2xl font-extrabold mt-3 text-rose-600 dark:text-rose-400">
                  {formatNumberBD(kpis.todayIssueQty, 2)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ROW 2: Monthly Movement ComposedChart + Stock Status Donut + Stock by Category */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left: Monthly Movement Chart */}
          <div className={`xl:col-span-7 ${cardClass}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold">Monthly Stock Movement</h2>
                <p className="text-xs font-bangla opacity-70">
                  মাসিক স্টক ইন ও স্টক আউট মূল্য (৳) এবং পরিমাণ
                </p>
              </div>

              <select
                value={monthsRange}
                onChange={(e) => setMonthsRange(Number(e.target.value) as 6 | 12)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
                  isDark
                    ? 'bg-[#0B2E33] border-white/15 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value={6}>Last 6 Months (গত ৬ মাস)</option>
                <option value={12}>Last 12 Months (গত ১২ মাস)</option>
              </select>
            </div>

            {loading ? (
              <div className="h-72 rounded-xl bg-slate-200/40 dark:bg-white/5 animate-pulse" />
            ) : monthlyChartData.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-center">
                <TrendingUp className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm font-semibold">No monthly movement records yet</p>
                <p className="text-xs font-bangla opacity-70 mt-0.5">
                  এখনও কোনো মাসিক লেনদেনের তথ্য পাওয়া যায়নি
                </p>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }}
                    />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(v) => `৳${formatNumberBD(v)}`}
                      tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#475569' }}
                      width={68}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: isDark ? '#38bdf8' : '#0284c7' }}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#103A40' : '#ffffff',
                        borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
                        borderRadius: '12px',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, name?: string | number) => {
                        const label = String(name || '');
                        if (label === 'Qty In') return [formatNumberBD(Number(val), 2), label];
                        return [formatBDT(Number(val)), label];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="value_in"
                      name="Value In (৳)"
                      fill="#0F8B8D"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="value_out"
                      name="Value Out (৳)"
                      fill="#F59E0B"
                      radius={[6, 6, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="qty_in"
                      name="Qty In"
                      stroke="#2BA5B5"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Right: Stock Status Donut + Stock by Category */}
          <div className="xl:col-span-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5">
            {/* Donut 1: Stock Status */}
            <div className={cardClass}>
              <div className="mb-3">
                <h2 className="text-base font-bold">Stock Status</h2>
                <p className="text-xs font-bangla opacity-70">মজুদ অবস্থা অনুযায়ী পণ্য</p>
              </div>

              {loading ? (
                <div className="h-44 rounded-xl bg-slate-200/40 dark:bg-white/5 animate-pulse" />
              ) : kpis.totalItems === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400">
                  <Package className="w-7 h-7 mb-1.5 opacity-40" />
                  <p className="text-xs font-semibold">No items available</p>
                  <p className="text-[11px] font-bangla opacity-70">কোনো পণ্য পাওয়া যায়নি</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-40 h-40 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDonutData.filter((d) => d.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={68}
                          paddingAngle={2}
                        >
                          {statusDonutData
                            .filter((d) => d.value > 0)
                            .map((entry) => (
                              <Cell key={entry.key} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, name?: string | number) => [`${v} items`, String(name || '')]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xl font-extrabold">{kpis.totalItems}</span>
                      <span className="text-[10px] opacity-70 font-bangla">মোট</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    {statusDonutData.map((item) => (
                      <div key={item.key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold truncate">{item.name}</span>
                          <span className="text-[10px] font-bangla opacity-70 truncate">
                            ({item.nameBn})
                          </span>
                        </div>
                        <span className="font-bold shrink-0 ml-2">
                          {item.value} ({item.percent}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chart 2: Stock by Category */}
            <div className={cardClass}>
              <div className="mb-3">
                <h2 className="text-base font-bold">Stock by Category</h2>
                <p className="text-xs font-bangla opacity-70">ক্যাটাগরি অনুযায়ী মজুদের মূল্য (৳)</p>
              </div>

              {loading ? (
                <div className="h-44 rounded-xl bg-slate-200/40 dark:bg-white/5 animate-pulse" />
              ) : categoryChartData.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400">
                  <Boxes className="w-7 h-7 mb-1.5 opacity-40" />
                  <p className="text-xs font-semibold">No category valuation data</p>
                  <p className="text-[11px] font-bangla opacity-70">ক্যাটাগরি তথ্য নেই</p>
                </div>
              ) : (
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}
                      />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `৳${formatNumberBD(v)}`}
                        tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#475569' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={92}
                        tick={{ fontSize: 10.5, fill: isDark ? '#cbd5e1' : '#334155' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#103A40' : '#ffffff',
                          borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [formatBDT(Number(val)), 'Stock Value']}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {categoryChartData.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: Top Low Stock Items + Recent Stock Activities */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left: Top Low Stock Items */}
          <div className={`xl:col-span-6 ${cardClass}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">Top Low Stock Items</h2>
                <p className="text-xs font-bangla opacity-70">
                  স্বল্প ও শূন্য মজুদ পণ্যের তালিকা
                </p>
              </div>
              <Link
                to="/store/items"
                className="text-xs font-bold text-[#0F8B8D] dark:text-[#2BA5B5] hover:underline"
              >
                View All <span className="font-bangla opacity-70">(সব দেখুন)</span>
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-slate-200/40 dark:bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : topLowStockItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No low or out-of-stock items</p>
                <p className="text-xs font-bangla opacity-70 mt-0.5">
                  কোনো স্বল্প বা শূন্য মজুদ পণ্য নেই
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      className={`border-b ${
                        isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <th className="py-2.5 pr-3">
                        <span className="block font-bold">Item</span>
                        <span className="block text-[10px] font-bangla opacity-70 font-normal">পণ্য</span>
                      </th>
                      <th className="py-2.5 px-2">
                        <span className="block font-bold">SKU</span>
                        <span className="block text-[10px] font-bangla opacity-70 font-normal">কোড</span>
                      </th>
                      <th className="py-2.5 px-2 text-right">
                        <span className="block font-bold">Current</span>
                        <span className="block text-[10px] font-bangla opacity-70 font-normal">বর্তমান</span>
                      </th>
                      <th className="py-2.5 px-2 text-right">
                        <span className="block font-bold">Minimum</span>
                        <span className="block text-[10px] font-bangla opacity-70 font-normal">সর্বনিম্ন</span>
                      </th>
                      <th className="py-2.5 pl-2 text-right">
                        <span className="block font-bold">Status</span>
                        <span className="block text-[10px] font-bangla opacity-70 font-normal">অবস্থা</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                    {topLowStockItems.map((row) => (
                      <tr key={row.item_id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                        <td className="py-2.5 pr-3">
                          <span className="font-semibold block">{row.item_name}</span>
                          {row.item_name_bn && (
                            <span className="text-[11px] font-bangla opacity-70 block">
                              {row.item_name_bn}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] opacity-80">{row.sku}</td>
                        <td className="py-2.5 px-2 text-right font-bold">
                          {formatNumberBD(row.unitQty, 2)} {row.uom}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-500 dark:text-slate-400">
                          {formatNumberBD(row.minimum_stock, 2)} {row.uom}
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              row.unitStatus === 'out'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {row.unitStatus === 'out' ? 'Out' : 'Low'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Recent Stock Activities */}
          <div className={`xl:col-span-6 ${cardClass}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">Recent Stock Activities</h2>
                <p className="text-xs font-bangla opacity-70">
                  সাম্প্রতিক স্টক ইন, ইস্যু ও স্থানান্তর কার্যক্রম
                </p>
              </div>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-slate-200/40 dark:bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">No recent stock activities</p>
                <p className="text-xs font-bangla opacity-70 mt-0.5">
                  কোনো সাম্প্রতিক স্টক লেনদেন নেই
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentActivities.map((act, idx) => {
                  const meta = renderActivityMeta(act);
                  return (
                    <div
                      key={`${act.created_at}-${act.sku}-${idx}`}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold truncate">
                              {act.item_name || act.sku || 'Item'}
                            </span>
                            {act.sku && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10">
                                {act.sku}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {meta.label}
                            {act.reference_no ? ` · ${act.reference_no}` : ''}
                            {act.user_name ? ` · ${act.user_name}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs font-extrabold block ${meta.deltaClass}`}>
                          {meta.deltaText}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {formatStoreDateTime(act.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default StoreDashboard;
