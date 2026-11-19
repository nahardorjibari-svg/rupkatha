import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  X,
  Loader2,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import {
  exportStoreLedgerExcel,
  formatNumberBD,
  formatStoreDate,
  type LedgerExportRow,
} from '../../lib/storeFormat';
import { normalizeItemOperationUnit } from '../../lib/storeStockCalc';
import type {
  StoreCategory,
  StoreGrn,
  StoreIssue,
  StoreItem,
  StoreStockStatusRow,
  StoreUom,
} from '../../types/store';

interface ViewLedgerRow {
  id: string;
  reference_no?: string | null;
  reference_id?: string | null;
  item_id: string;
  item_name?: string | null;
  sku?: string | null;
  unit?: string | null;
  movement_type?: string | null;
  qty_in?: number | null;
  qty_out?: number | null;
  user_name?: string | null;
  created_at?: string | null;
}

interface LedgerTransaction {
  id: string;
  date: string;
  sortTime: number;
  referenceNo: string;
  type: 'grn' | 'issue' | 'opening' | 'other';
  unit: string;
  context: string;
  inQty: number;
  outQty: number;
  runningBalance: number;
}

interface ItemLedgerRow {
  item: StoreItem;
  sku: string;
  itemName: string;
  itemNameBn?: string | null;
  categoryId?: string | null;
  categoryName: string;
  operationUnit: 'knit' | 'woven' | 'both';
  unitLabel: string;
  uom: string;
  openingStock: number;
  totalIn: number;
  totalOut: number;
  currentBalance: number;
  minimumStock: number;
  transactions: LedgerTransaction[];
}

export const StoreLedgerPage: React.FC = () => {
  const { isDark } = useTheme();
  const { activeUnit } = useUnit();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [items, setItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);
  const [grns, setGrns] = useState<StoreGrn[]>([]);
  const [issues, setIssues] = useState<StoreIssue[]>([]);
  const [viewLedgerRows, setViewLedgerRows] = useState<ViewLedgerRow[]>([]);
  const [fallbackStockRows, setFallbackStockRows] = useState<StoreStockStatusRow[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'woven' | 'knit'>('all');

  // Transaction History Drawer
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
      const [itemRes, catRes, uomRes, grnRes, issueRes, ledgerRes, statusRes] =
        await Promise.all([
          supabase.from('store_items').select('*').order('sku', { ascending: true }),
          supabase.from('store_categories').select('*').order('name', { ascending: true }),
          supabase.from('store_uoms').select('*'),
          supabase
            .from('store_grn')
            .select(
              'id, grn_no, grn_date, unit, supplier_name, challan_no, booking_id, status, created_at, approved_at, store_grn_items(id, grn_id, item_id, booking_item_id, qty, accepted_qty, rejected_qty, unit_price, batch_no, remarks)'
            )
            .eq('status', 'approved'),
          supabase
            .from('store_issues')
            .select(
              'id, issue_no, issue_date, unit, department, purpose, order_id, remarks, status, approved_at, created_at, orders(id, order_no, style_no, item_name, buyers(name, code)), store_issue_items(id, issue_id, item_id, qty, remarks)'
            )
            .eq('status', 'approved'),
          supabase.from('store_v_ledger').select('*'),
          supabase.from('store_v_stock_status').select('*'),
        ]);

      if (itemRes.error) throw itemRes.error;
      if (catRes.error) throw catRes.error;
      if (uomRes.error) throw uomRes.error;
      if (grnRes.error) throw grnRes.error;

      setItems((itemRes.data || []) as StoreItem[]);
      setCategories((catRes.data || []) as StoreCategory[]);
      setUoms((uomRes.data || []) as StoreUom[]);
      setGrns((grnRes.data || []) as unknown as StoreGrn[]);
      setIssues(issueRes.error ? [] : ((issueRes.data || []) as unknown as StoreIssue[]));
      setViewLedgerRows(
        ledgerRes.error ? [] : ((ledgerRes.data || []) as ViewLedgerRow[])
      );
      setFallbackStockRows(
        statusRes.error ? [] : ((statusRes.data || []) as StoreStockStatusRow[])
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load stock ledger.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, StoreCategory>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const uomMap = useMemo(() => {
    const map = new Map<string, StoreUom>();
    uoms.forEach((u) => map.set(u.id, u));
    return map;
  }, [uoms]);

  const fallbackMap = useMemo(() => {
    const map = new Map<string, StoreStockStatusRow>();
    fallbackStockRows.forEach((r) => map.set(r.item_id, r));
    return map;
  }, [fallbackStockRows]);

  // Compute live item-wise ledger rows for current unitFilter
  const ledgerRows: ItemLedgerRow[] = useMemo(() => {
    const txByItem = new Map<string, Omit<LedgerTransaction, 'runningBalance'>[]>();
    const openingByItem = new Map<string, number>();

    const pushTx = (
      itemId: string,
      tx: Omit<LedgerTransaction, 'runningBalance'>
    ) => {
      const arr = txByItem.get(itemId) || [];
      arr.push(tx);
      txByItem.set(itemId, arr);
    };

    const matchesUnitFilter = (u?: string | null) => {
      if (unitFilter === 'all') return true;
      return String(u || '').trim().toLowerCase() === unitFilter;
    };

    // 1. Approved GRNs (In)
    grns.forEach((grn) => {
      if (!matchesUnitFilter(grn.unit)) return;
      const dateStr = grn.grn_date || (grn.created_at ? grn.created_at.slice(0, 10) : '');
      const sortTime = grn.approved_at
        ? new Date(grn.approved_at).getTime()
        : grn.created_at
        ? new Date(grn.created_at).getTime()
        : dateStr
        ? new Date(`${dateStr}T09:00:00+06:00`).getTime()
        : 0;

      (grn.store_grn_items || []).forEach((line, idx) => {
        const qty = Math.max(0, Number(line.accepted_qty ?? line.qty ?? 0));
        if (qty <= 0) return;
        const rejectedQty = Math.max(0, Number(line.rejected_qty || 0));
        pushTx(line.item_id, {
          id: `grn-${grn.id}-${line.id || idx}`,
          date: dateStr,
          sortTime,
          referenceNo: grn.grn_no,
          type: 'grn',
          unit: (grn.unit || 'knit').toUpperCase(),
          context: [
            grn.supplier_name ? `Supplier: ${grn.supplier_name}` : '',
            grn.challan_no ? `Challan: ${grn.challan_no}` : '',
            rejectedQty > 0 ? `Rejected: ${formatNumberBD(rejectedQty, 2)}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          inQty: qty,
          outQty: 0,
        });
      });
    });

    // 2. Approved Issues (Out)
    issues.forEach((iss) => {
      if (!matchesUnitFilter(iss.unit)) return;
      const dateStr = iss.issue_date || (iss.created_at ? iss.created_at.slice(0, 10) : '');
      const sortTime = iss.approved_at
        ? new Date(iss.approved_at).getTime()
        : iss.created_at
        ? new Date(iss.created_at).getTime()
        : dateStr
        ? new Date(`${dateStr}T10:00:00+06:00`).getTime()
        : 0;

      const orderInfo = iss.orders
        ? `${iss.orders.order_no}${iss.orders.style_no ? ` (${iss.orders.style_no})` : ''}`
        : '';

      (iss.store_issue_items || []).forEach((line, idx) => {
        const qty = Math.max(0, Number(line.qty || 0));
        if (qty <= 0) return;
        pushTx(line.item_id, {
          id: `iss-${iss.id}-${line.id || idx}`,
          date: dateStr,
          sortTime,
          referenceNo: iss.issue_no,
          type: 'issue',
          unit: (iss.unit || 'knit').toUpperCase(),
          context: [
            iss.department || '',
            iss.purpose || '',
            orderInfo ? `Order: ${orderInfo}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
          inQty: 0,
          outQty: qty,
        });
      });
    });

    // 3. Non-GRN / Non-Issue entries from store_v_ledger (Opening, Adjustments, Transfers)
    viewLedgerRows.forEach((vr, idx) => {
      const mType = String(vr.movement_type || '').toLowerCase();
      if (mType === 'grn' || mType === 'issue') return;
      if (!matchesUnitFilter(vr.unit)) return;

      const qIn = Math.max(0, Number(vr.qty_in || 0));
      const qOut = Math.max(0, Number(vr.qty_out || 0));
      if (qIn === 0 && qOut === 0) return;

      if (mType === 'opening') {
        openingByItem.set(
          vr.item_id,
          (openingByItem.get(vr.item_id) || 0) + (qIn - qOut)
        );
        return;
      }

      const dateStr = vr.created_at ? vr.created_at.slice(0, 10) : '';
      const sortTime = vr.created_at ? new Date(vr.created_at).getTime() : 0;

      pushTx(vr.item_id, {
        id: `v-${vr.id || idx}`,
        date: dateStr,
        sortTime,
        referenceNo: vr.reference_no || mType.toUpperCase(),
        type: 'other',
        unit: String(vr.unit || '').toUpperCase(),
        context: vr.user_name
          ? `${mType.replace('_', ' ').toUpperCase()} · ${vr.user_name}`
          : mType.replace('_', ' ').toUpperCase(),
        inQty: qIn,
        outQty: qOut,
      });
    });

    return items.map((item) => {
      const cat = item.category_id ? categoryMap.get(item.category_id) : undefined;
      const uom = item.uom_id ? uomMap.get(item.uom_id) : undefined;
      const fb = fallbackMap.get(item.id);
      const opUnit = normalizeItemOperationUnit(item.extra_fields?.unit);
      const unitLabel =
        opUnit === 'both' ? 'Woven & Knit' : opUnit === 'woven' ? 'Woven' : 'Knit';

      const rawTx = [...(txByItem.get(item.id) || [])].sort(
        (a, b) => a.sortTime - b.sortTime
      );

      let openingStock = openingByItem.get(item.id) || 0;

      // Fallback opening balance if no transactions exist in base tables yet
      if (rawTx.length === 0 && openingStock === 0 && fb) {
        const fbUnitStock =
          unitFilter === 'knit'
            ? Number(fb.knit_qty || 0)
            : unitFilter === 'woven'
            ? Number(fb.woven_qty || 0)
            : Number(fb.current_stock || 0);
        if (fbUnitStock > 0) {
          openingStock = fbUnitStock;
        }
      }

      let running = openingStock;
      let totalIn = 0;
      let totalOut = 0;

      const transactions: LedgerTransaction[] = rawTx.map((t) => {
        if (t.type === 'grn') {
          totalIn += t.inQty;
        } else if (t.type === 'issue') {
          totalOut += t.outQty;
        } else {
          totalIn += t.inQty;
          totalOut += t.outQty;
        }
        running = running + t.inQty - t.outQty;
        return {
          ...t,
          runningBalance: running,
        };
      });

      const currentBalance = Math.max(0, openingStock + totalIn - totalOut);

      return {
        item,
        sku: item.sku,
        itemName: item.name,
        itemNameBn: item.name_bn,
        categoryId: item.category_id,
        categoryName: cat?.name || fb?.category_name || 'Uncategorized',
        operationUnit: opUnit,
        unitLabel,
        uom: uom?.code || fb?.uom || '-',
        openingStock,
        totalIn,
        totalOut,
        currentBalance,
        minimumStock: Number(item.minimum_stock || 0),
        transactions,
      };
    });
  }, [items, categories, uoms, grns, issues, viewLedgerRows, fallbackMap, categoryMap, uomMap, unitFilter]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledgerRows.filter((row) => {
      if (q) {
        const matchSku = row.sku.toLowerCase().includes(q);
        const matchName = row.itemName.toLowerCase().includes(q);
        const matchBn = (row.itemNameBn || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchBn) return false;
      }

      if (categoryFilter !== 'all') {
        const selectedCat = categoryMap.get(categoryFilter);
        const matchesId = row.categoryId === categoryFilter;
        const matchesName =
          selectedCat && row.categoryName.toLowerCase() === selectedCat.name.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      if (unitFilter !== 'all') {
        const hasActivity =
          row.openingStock > 0 || row.totalIn > 0 || row.totalOut > 0 || row.currentBalance > 0;
        if (row.operationUnit !== 'both' && row.operationUnit !== unitFilter && !hasActivity) {
          return false;
        }
      }

      return true;
    });
  }, [ledgerRows, search, categoryFilter, unitFilter, categoryMap]);

  const selectedLedgerRow = useMemo(() => {
    if (!selectedItemId) return null;
    return ledgerRows.find((r) => r.item.id === selectedItemId) || null;
  }, [selectedItemId, ledgerRows]);

  const totalsSummary = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.opening += r.openingStock;
        acc.totalIn += r.totalIn;
        acc.totalOut += r.totalOut;
        acc.balance += r.currentBalance;
        return acc;
      },
      { opening: 0, totalIn: 0, totalOut: 0, balance: 0 }
    );
  }, [filteredRows]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const exportRows: LedgerExportRow[] = filteredRows.map((r) => ({
        sku: r.sku,
        item_name: r.itemName,
        category_name: r.categoryName,
        unit_label: r.unitLabel,
        uom: r.uom,
        opening_stock: r.openingStock,
        total_in: r.totalIn,
        total_out: r.totalOut,
        current_balance: r.currentBalance,
      }));
      await exportStoreLedgerExcel(exportRows, getDhakaDateString());
      toast.success('Stock Ledger Excel downloaded.');
    } catch (err: any) {
      toast.error(err?.message || 'Excel export failed.');
    } finally {
      setExporting(false);
    }
  };

  const inputClass = `w-full px-3.5 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Print-only Header */}
        <div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-extrabold !text-slate-900">RUPKATHA APPARELS LTD.</h1>
              <p className="text-xs text-slate-600">
                Live Store Stock Ledger ({unitFilter === 'all' ? 'All Units' : unitFilter.toUpperCase()})
              </p>
            </div>
            <p className="text-xs text-slate-600">Date: {formatStoreDate(getDhakaDateString())}</p>
          </div>
        </div>

        {/* Page Header */}
        <div className="print:hidden flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Live Stock Ledger</h1>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              লাইভ স্টক খতিয়ান — প্রারম্ভিক মজুদ, জিআরএন ইন, ইস্যু আউট ও বর্তমান ব্যালেন্স (বিস্তারিত দেখতে সারিতে ক্লিক করুন)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || filteredRows.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <div className="text-left">
                <span className="block leading-tight">Export to Excel</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  এক্সেল ডাউনলোড
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={filteredRows.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">Print</span>
                <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                  প্রিন্ট করুন
                </span>
              </div>
            </button>

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
              <div className="text-left">
                <span className="block leading-tight">Refresh</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  রিফ্রেশ
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Opening Stock <span className="font-bangla opacity-70">(প্রারম্ভিক)</span>
            </p>
            <p className="text-xl font-extrabold mt-1">
              {formatNumberBD(totalsSummary.opening, 2)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Total Received (GRN In){' '}
              <span className="font-bangla opacity-70">(মোট জমা)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
              +{formatNumberBD(totalsSummary.totalIn, 2)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              Total Issued (Out) <span className="font-bangla opacity-70">(মোট ইস্যু)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-rose-600 dark:text-rose-400">
              -{formatNumberBD(totalsSummary.totalOut, 2)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-[#0F8B8D] dark:text-[#2BA5B5]">
              Current Live Balance{' '}
              <span className="font-bangla opacity-70">(বর্তমান মজুদ)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatNumberBD(totalsSummary.balance, 2)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`print:hidden rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-12 gap-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, item name or Bangla name..."
              className={`${inputClass} pl-10`}
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Categories (সকল ক্যাটাগরি)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat.name_bn ? `(${cat.name_bn})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
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

        {/* Ledger Table */}
        <div
          className={`job-card-paper rounded-2xl border overflow-hidden shadow-soft-md ${
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
                    <span className="block font-bold">SKU</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      কোড
                    </span>
                  </th>
                  <th className="py-3 px-4">
                    <span className="block font-bold">Item Name</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      পণ্যের নাম
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Category</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      ক্যাটাগরি
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Unit</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      ইউনিট
                    </span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">UOM</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      একক
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Opening Stock</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      প্রারম্ভিক মজুদ
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Total Received (GRN In)</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      মোট প্রাপ্তি (ইন)
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Total Issued (Out)</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      মোট ইস্যু (আউট)
                    </span>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <span className="block font-bold">Current Live Balance</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      বর্তমান ব্যালেন্স
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="py-4 px-4">
                        <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-slate-400">
                      <BookOpen className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No stock ledger entries found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো খতিয়ান তথ্য পাওয়া যায়নি
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const isLow =
                      row.currentBalance > 0 &&
                      row.minimumStock > 0 &&
                      row.currentBalance <= row.minimumStock;
                    const isOut = row.currentBalance <= 0;

                    return (
                      <tr
                        key={row.item.id}
                        onClick={() => setSelectedItemId(row.item.id)}
                        className="hover:bg-[#2BA5B5]/10 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {row.sku}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold block group-hover:text-[#0F8B8D] dark:group-hover:text-[#2BA5B5]">
                                {row.itemName}
                              </span>
                              {row.itemNameBn && (
                                <span className="text-[11px] font-bangla opacity-70 block">
                                  {row.itemNameBn}
                                </span>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 transition-opacity print:hidden shrink-0" />
                          </div>
                        </td>
                        <td className="py-3 px-3">{row.categoryName}</td>
                        <td className="py-3 px-3">
                          <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/60 dark:bg-white/10">
                            {row.unitLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold">{row.uom}</td>
                        <td className="py-3 px-3 text-right font-medium">
                          {formatNumberBD(row.openingStock, 2)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {row.totalIn > 0 ? `+${formatNumberBD(row.totalIn, 2)}` : '0.00'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                          {row.totalOut > 0 ? `-${formatNumberBD(row.totalOut, 2)}` : '0.00'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-extrabold ${
                              isOut
                                ? 'text-rose-600 dark:text-rose-400'
                                : isLow
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-[#0F8B8D] dark:text-[#2BA5B5]'
                            }`}
                          >
                            {formatNumberBD(row.currentBalance, 2)} {row.uom}
                          </span>
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

      {/* Item Detailed Transaction History Drawer */}
      {selectedLedgerRow && (
        <div className="fixed inset-0 z-50 flex justify-end print:hidden">
          <div
            onClick={() => setSelectedItemId(null)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-3xl h-full overflow-y-auto shadow-2xl border-l flex flex-col ${
              isDark
                ? 'bg-[#103A40] border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200/20 flex items-start justify-between gap-3 sticky top-0 z-20 bg-inherit">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                    {selectedLedgerRow.sku}
                  </span>
                  <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded bg-slate-200/60 dark:bg-white/10">
                    {unitFilter === 'all' ? selectedLedgerRow.unitLabel : unitFilter}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold mt-1.5">{selectedLedgerRow.itemName}</h2>
                {selectedLedgerRow.itemNameBn && (
                  <p className="text-xs font-bangla opacity-75">{selectedLedgerRow.itemNameBn}</p>
                )}
                <p className="text-[11px] opacity-70 mt-0.5">
                  Category: {selectedLedgerRow.categoryName} · UOM: {selectedLedgerRow.uom}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemId(null)}
                className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Item Ledger Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className={`p-3 rounded-2xl border ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase opacity-70 block">Opening</span>
                  <span className="text-base font-extrabold mt-0.5 block">
                    {formatNumberBD(selectedLedgerRow.openingStock, 2)} {selectedLedgerRow.uom}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-2xl border ${
                    isDark ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                    Total GRN In
                  </span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                    +{formatNumberBD(selectedLedgerRow.totalIn, 2)} {selectedLedgerRow.uom}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-2xl border ${
                    isDark ? 'bg-rose-500/10 border-rose-500/25' : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 block">
                    Total Issued Out
                  </span>
                  <span className="text-base font-extrabold text-rose-600 dark:text-rose-400 mt-0.5 block">
                    -{formatNumberBD(selectedLedgerRow.totalOut, 2)} {selectedLedgerRow.uom}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-2xl border ${
                    isDark ? 'bg-[#0B2E33] border-[#2BA5B5]/40' : 'bg-teal-50 border-teal-200'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-[#0F8B8D] dark:text-[#2BA5B5] block">
                    Live Balance
                  </span>
                  <span className="text-base font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] mt-0.5 block">
                    {formatNumberBD(selectedLedgerRow.currentBalance, 2)} {selectedLedgerRow.uom}
                  </span>
                </div>
              </div>

              {/* Chronological Transaction History */}
              <div>
                <h3 className="text-sm font-bold mb-1">
                  Transaction History{' '}
                  <span className="text-xs font-bangla opacity-70 font-normal">
                    (তারিখ ও রেফারেন্স অনুযায়ী লেনদেনের বিবরণ)
                  </span>
                </h3>

                {selectedLedgerRow.transactions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 border border-dashed border-slate-300/50 dark:border-white/15 rounded-2xl mt-3">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold">No GRN or Issue movements recorded yet</p>
                    <p className="text-[11px] font-bangla opacity-70 mt-0.5">
                      এই পণ্যের কোনো স্টক ইন বা আউট লেনদেন পাওয়া যায়নি
                    </p>
                  </div>
                ) : (
                  <div
                    className={`mt-3 rounded-2xl border overflow-hidden ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                  >
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr
                          className={`border-b ${
                            isDark
                              ? 'bg-white/5 border-white/10 text-slate-300'
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <th className="py-2.5 px-3 font-bold">Date</th>
                          <th className="py-2.5 px-3 font-bold">Reference # [GRN / Issue]</th>
                          <th className="py-2.5 px-3 text-right font-bold">In Qty</th>
                          <th className="py-2.5 px-3 text-right font-bold">Out Qty</th>
                          <th className="py-2.5 px-3 text-right font-bold">Balance</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                        {selectedLedgerRow.openingStock > 0 && (
                          <tr className="opacity-75">
                            <td className="py-2.5 px-3">-</td>
                            <td className="py-2.5 px-3 font-semibold">Opening Balance</td>
                            <td className="py-2.5 px-3 text-right">-</td>
                            <td className="py-2.5 px-3 text-right">-</td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {formatNumberBD(selectedLedgerRow.openingStock, 2)}
                            </td>
                          </tr>
                        )}

                        {selectedLedgerRow.transactions.map((tx) => (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-white/5"
                          >
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {formatStoreDate(tx.date)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {tx.type === 'grn' ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                    <ArrowDownLeft className="w-3 h-3" />
                                    GRN
                                  </span>
                                ) : tx.type === 'issue' ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                                    <ArrowUpRight className="w-3 h-3" />
                                    ISSUE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                                    <ArrowLeftRight className="w-3 h-3" />
                                    MOV
                                  </span>
                                )}
                                <span className="font-mono font-bold">{tx.referenceNo}</span>
                                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/10 font-semibold">
                                  {tx.unit}
                                </span>
                              </div>
                              {tx.context && (
                                <p className="text-[11px] opacity-70 mt-0.5">{tx.context}</p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {tx.inQty > 0 ? `+${formatNumberBD(tx.inQty, 2)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                              {tx.outQty > 0 ? `-${formatNumberBD(tx.outQty, 2)}` : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                              {formatNumberBD(tx.runningBalance, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default StoreLedgerPage;
