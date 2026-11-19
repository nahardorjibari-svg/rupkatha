import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Edit2,
  FileSpreadsheet,
  FileText,
  X,
  Loader2,
  Package,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import {
  exportStoreItemsExcel,
  exportStoreItemsPdf,
  formatNumberBD,
  formatStoreCurrency,
} from '../../lib/storeFormat';
import {
  computeLiveStoreData,
  normalizeItemOperationUnit,
} from '../../lib/storeStockCalc';
import {
  canEditItems,
  type StoreCategory,
  type StoreGrn,
  type StoreIssue,
  type StoreItem,
  type StoreItemExtraFields,
  type StoreStockStatusRow,
  type StoreStockStatusType,
  type StoreUom,
} from '../../types/store';

const PAGE_SIZE = 15;

const STORE_ITEM_TYPE_OPTIONS = [
  { value: 'fabric', label: 'Fabric (কাপড়)' },
  { value: 'yarn', label: 'Yarn (সুতা)' },
  { value: 'accessories', label: 'Accessories (এক্সেসরিজ)' },
  { value: 'trims', label: 'Trims (ট্রিমস)' },
  { value: 'packing', label: 'Packing (প্যাকিং)' },
  { value: 'spare', label: 'Spare Parts (যন্ত্রাংশ)' },
  { value: 'chemical', label: 'Chemical (রাসায়নিক)' },
  { value: 'other', label: 'Other (অন্যান্য)' },
] as const;

type StoreItemTypeValue = (typeof STORE_ITEM_TYPE_OPTIONS)[number]['value'];

const VALID_ITEM_TYPES = new Set<string>(STORE_ITEM_TYPE_OPTIONS.map((o) => o.value));

function normalizeItemType(val?: string | null): StoreItemTypeValue {
  const lower = (val || '').trim().toLowerCase();
  return VALID_ITEM_TYPES.has(lower) ? (lower as StoreItemTypeValue) : 'other';
}

function suggestItemTypeFromCategory(categoryName?: string | null): StoreItemTypeValue {
  const n = (categoryName || '').trim().toLowerCase();
  if (n.includes('fabric')) return 'fabric';
  if (n.includes('yarn')) return 'yarn';
  if (n.includes('accessor')) return 'accessories';
  if (n.includes('trim')) return 'trims';
  if (n.includes('packing')) return 'packing';
  if (n.includes('spare')) return 'spare';
  if (n.includes('chemical')) return 'chemical';
  return 'other';
}

export const StoreItemsPage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile, user } = useAuth();
  const { activeUnit } = useUnit();
  const isAdminEditor = canEditItems(profile?.role, profile?.is_active);
  const currentUserId = user?.id || profile?.id || null;

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const [statusRows, setStatusRows] = useState<StoreStockStatusRow[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'woven' | 'knit'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StoreStockStatusType>('all');
  const [page, setPage] = useState(1);

  // Add/Edit Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [uomId, setUomId] = useState('');
  const [itemType, setItemType] = useState<StoreItemTypeValue>('other');
  const [operationUnit, setOperationUnit] = useState<'both' | 'woven' | 'knit'>('both');
  const [minimumStock, setMinimumStock] = useState('0');
  const [defaultUnitCost, setDefaultUnitCost] = useState('0');
  const [defaultCurrency, setDefaultCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Dynamic extra_fields
  const [gsm, setGsm] = useState('');
  const [width, setWidth] = useState('');
  const [composition, setComposition] = useState('');
  const [yarnCount, setYarnCount] = useState('');
  const [yarnType, setYarnType] = useState('');
  const [yarnLot, setYarnLot] = useState('');

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
      const [itemsRes, catRes, uomRes, grnRes, issueRes, viewRes] = await Promise.all([
        supabase.from('store_items').select('*').order('sku', { ascending: true }),
        supabase.from('store_categories').select('*').order('name', { ascending: true }),
        supabase.from('store_uoms').select('*').order('code', { ascending: true }),
        supabase
          .from('store_grn')
          .select('id, grn_no, grn_date, unit, currency, exchange_rate, status, created_at, approved_at, created_by_name, approved_by_name, supplier_name, store_grn_items(item_id, qty, accepted_qty, rejected_qty, unit_price)'),
        supabase
          .from('store_issues')
          .select('id, issue_no, issue_date, unit, department, purpose, order_id, status, created_at, approved_at, approved_by_name, store_issue_items(id, issue_id, item_id, qty, remarks)'),
        supabase.from('store_v_stock_status').select('*').order('sku', { ascending: true }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (catRes.error) throw catRes.error;
      if (uomRes.error) throw uomRes.error;
      if (grnRes.error) throw grnRes.error;

      const loadedItems = (itemsRes.data || []) as StoreItem[];
      const loadedCats = (catRes.data || []) as StoreCategory[];
      const loadedUoms = (uomRes.data || []) as StoreUom[];
      const loadedGrns = (grnRes.data || []) as unknown as StoreGrn[];
      const loadedIssues = issueRes.error ? [] : ((issueRes.data || []) as unknown as StoreIssue[]);
      const fallbackViewRows = viewRes.error
        ? []
        : ((viewRes.data || []) as StoreStockStatusRow[]);

      const computed = computeLiveStoreData({
        items: loadedItems,
        categories: loadedCats,
        uoms: loadedUoms,
        grns: loadedGrns,
        issues: loadedIssues,
        fallbackViewRows,
      });

      setItems(loadedItems);
      setCategories(loadedCats);
      setUoms(loadedUoms);
      setStatusRows(computed.statusRows);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load item master.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const itemMap = useMemo(() => {
    const map = new Map<string, StoreItem>();
    items.forEach((it) => map.set(it.id, it));
    return map;
  }, [items]);

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

  // Combined rows using store_v_stock_status (with fallback if an item isn't in view)
  const combinedRows = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ statusRow: StoreStockStatusRow; item?: StoreItem }> = statusRows.map((sr) => {
      seen.add(sr.item_id);
      return { statusRow: sr, item: itemMap.get(sr.item_id) };
    });

    items.forEach((it) => {
      if (!seen.has(it.id)) {
        const cat = it.category_id ? categoryMap.get(it.category_id) : undefined;
        const u = it.uom_id ? uomMap.get(it.uom_id) : undefined;
        list.push({
          item: it,
          statusRow: {
            item_id: it.id,
            sku: it.sku,
            item_name: it.name,
            item_name_bn: it.name_bn,
            category_name: cat?.name || '-',
            uom: u?.code || '-',
            minimum_stock: Number(it.minimum_stock || 0),
            knit_qty: 0,
            woven_qty: 0,
            current_stock: 0,
            stock_value: 0,
            status: it.is_active ? 'out' : 'inactive',
          },
        });
      }
    });

    return list;
  }, [statusRows, items, itemMap, categoryMap, uomMap]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return combinedRows.filter(({ statusRow, item }) => {
      if (q) {
        const matchSku = (statusRow.sku || '').toLowerCase().includes(q);
        const matchName = (statusRow.item_name || '').toLowerCase().includes(q);
        const matchBn = (statusRow.item_name_bn || item?.name_bn || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchBn) return false;
      }

      if (categoryFilter !== 'all') {
        const selectedCat = categoryMap.get(categoryFilter);
        const matchesCatId = item?.category_id === categoryFilter;
        const matchesCatName =
          selectedCat &&
          statusRow.category_name.toLowerCase() === selectedCat.name.toLowerCase();
        if (!matchesCatId && !matchesCatName) return false;
      }

      if (unitFilter !== 'all') {
        const itemUnit = normalizeItemOperationUnit(item?.extra_fields?.unit);
        const hasUnitStock =
          unitFilter === 'knit'
            ? Number(statusRow.knit_qty || 0) > 0
            : Number(statusRow.woven_qty || 0) > 0;
        if (itemUnit !== 'both' && itemUnit !== unitFilter && !hasUnitStock) {
          return false;
        }
      }

      if (statusFilter !== 'all' && statusRow.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [combinedRows, search, categoryFilter, unitFilter, statusFilter, categoryMap]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, unitFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Summary counters
  const summaryStats = useMemo(() => {
    const total = combinedRows.length;
    const inStock = combinedRows.filter((r) => r.statusRow.status === 'in_stock').length;
    const lowStock = combinedRows.filter((r) => r.statusRow.status === 'low').length;
    const outOfStock = combinedRows.filter((r) => r.statusRow.status === 'out').length;
    return { total, inStock, lowStock, outOfStock };
  }, [combinedRows]);

  // Selected category type for dynamic extra_fields
  const selectedCategoryKind = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    const n = (cat?.name || '').toLowerCase();
    if (n.includes('fabric')) return 'fabric';
    if (n.includes('yarn')) return 'yarn';
    return 'other';
  }, [categories, categoryId]);

  const openAddDrawer = () => {
    const defaultCat = categories.find((c) => c.is_active) || categories[0];
    setEditingItem(null);
    setSku('');
    setName('');
    setNameBn('');
    setCategoryId(defaultCat?.id || '');
    setUomId(uoms.find((u) => u.is_active)?.id || uoms[0]?.id || '');
    setItemType(suggestItemTypeFromCategory(defaultCat?.name));
    setOperationUnit(
      activeUnit === 'woven' ? 'woven' : activeUnit === 'knit' ? 'knit' : 'both'
    );
    setMinimumStock('0');
    setDefaultUnitCost('0');
    setDefaultCurrency('BDT');
    setDescription('');
    setIsActive(true);
    setGsm('');
    setWidth('');
    setComposition('');
    setYarnCount('');
    setYarnType('');
    setYarnLot('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (item: StoreItem) => {
    setEditingItem(item);
    setSku(item.sku || '');
    setName(item.name || '');
    setNameBn(item.name_bn || '');
    setCategoryId(item.category_id || '');
    setUomId(item.uom_id || '');
    setItemType(normalizeItemType(item.item_type));
    setOperationUnit(normalizeItemOperationUnit(item.extra_fields?.unit));
    setMinimumStock(String(item.minimum_stock ?? 0));
    setDefaultUnitCost(String(item.default_unit_cost ?? 0));
    setDefaultCurrency(item.default_currency === 'USD' ? 'USD' : 'BDT');
    setDescription(item.description || '');
    setIsActive(item.is_active !== false);

    const ef = item.extra_fields || {};
    setGsm(ef.gsm != null ? String(ef.gsm) : '');
    setWidth(ef.width != null ? String(ef.width) : '');
    setComposition(ef.composition != null ? String(ef.composition) : '');
    setYarnCount(ef.count != null ? String(ef.count) : '');
    setYarnType(ef.type != null ? String(ef.type) : '');
    setYarnLot(ef.lot != null ? String(ef.lot) : '');
    setDrawerOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminEditor) {
      toast.error('Only administrators can add or edit items.');
      return;
    }

    if (!sku.trim() || !name.trim()) {
      toast.error('SKU and Item Name are required.');
      return;
    }

    setSaving(true);
    try {
      const extraFields: StoreItemExtraFields = {
        unit: operationUnit,
        ...(selectedCategoryKind === 'fabric'
          ? {
              ...(gsm.trim() ? { gsm: gsm.trim() } : {}),
              ...(width.trim() ? { width: width.trim() } : {}),
              ...(composition.trim() ? { composition: composition.trim() } : {}),
            }
          : {}),
        ...(selectedCategoryKind === 'yarn'
          ? {
              ...(yarnCount.trim() ? { count: yarnCount.trim() } : {}),
              ...(yarnType.trim() ? { type: yarnType.trim() } : {}),
              ...(yarnLot.trim() ? { lot: yarnLot.trim() } : {}),
            }
          : {}),
      };

      const payload = {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        name_bn: nameBn.trim() || null,
        category_id: categoryId || null,
        uom_id: uomId || null,
        item_type: normalizeItemType(itemType),
        minimum_stock: Math.max(0, Number(minimumStock || 0)),
        default_unit_cost: Math.max(0, Number(defaultUnitCost || 0)),
        default_currency: defaultCurrency,
        description: description.trim() || null,
        extra_fields: extraFields,
        is_active: isActive,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('store_items')
          .update(payload)
          .eq('id', editingItem.id);
        if (error) throw error;
        toast.success('Item updated successfully.');
      } else {
        const { error } = await supabase.from('store_items').insert({
          ...payload,
          ...(currentUserId ? { created_by: currentUserId } : {}),
        });
        if (error) throw error;
        toast.success('Item added successfully.');
      }

      setDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      await exportStoreItemsExcel(filteredRows, getDhakaDateString());
      toast.success('Excel downloaded.');
    } catch (err: any) {
      toast.error(err?.message || 'Excel export failed.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      await exportStoreItemsPdf(filteredRows, getDhakaDateString());
      toast.success('PDF downloaded.');
    } catch (err: any) {
      toast.error(err?.message || 'PDF export failed.');
    } finally {
      setExporting(null);
    }
  };

  const renderStatusBadge = (status: StoreStockStatusType) => {
    switch (status) {
      case 'in_stock':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            In Stock
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Low Stock
          </span>
        );
      case 'out':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            Out of Stock
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-500/30">
            Inactive
          </span>
        );
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
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Item Master &amp; Stock Register
            </h1>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              পণ্য তালিকা, ক্যাটাগরি, ইউনিট ভিত্তিক মজুদ ও সর্বনিম্ন সীমা ব্যবস্থাপনা
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting !== null || filteredRows.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {exporting === 'excel' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <div className="text-left">
                <span className="block leading-tight">Export Excel</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  এক্সেল ডাউনলোড
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting !== null || filteredRows.length === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              {exporting === 'pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <div className="text-left">
                <span className="block leading-tight">Export PDF</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  পিডিএফ ডাউনলোড
                </span>
              </div>
            </button>

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

            {isAdminEditor && (
              <button
                type="button"
                onClick={openAddDrawer}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <div className="text-left">
                  <span className="block leading-tight">Add Item</span>
                  <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                    নতুন পণ্য যোগ
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Live Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Total Items <span className="font-bangla opacity-70">(মোট পণ্য)</span>
            </p>
            <p className="text-xl font-extrabold mt-1">{formatNumberBD(summaryStats.total)}</p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              In Stock <span className="font-bangla opacity-70">(মজুদ আছে)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
              {formatNumberBD(summaryStats.inStock)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Low Stock <span className="font-bangla opacity-70">(স্বল্প মজুদ)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">
              {formatNumberBD(summaryStats.lowStock)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              Out of Stock <span className="font-bangla opacity-70">(মজুদ শূন্য)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-rose-600 dark:text-rose-400">
              {formatNumberBD(summaryStats.outOfStock)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 md:grid-cols-12 gap-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="md:col-span-5 relative">
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

          <div className="md:col-span-2">
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

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={inputClass}
            >
              <option value="all">All Status (সকল অবস্থা)</option>
              <option value="in_stock">In Stock (মজুদ আছে)</option>
              <option value="low">Low Stock (স্বল্প মজুদ)</option>
              <option value="out">Out of Stock (মজুদ শূন্য)</option>
              <option value="inactive">Inactive (নিষ্ক্রিয়)</option>
            </select>
          </div>
        </div>

        {/* Table */}
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
                    <span className="block font-bold">SKU</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">এসকেইউ</span>
                  </th>
                  <th className="py-3 px-4">
                    <span className="block font-bold">Name</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">পণ্যের নাম</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Category</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">ক্যাটাগরি</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">UOM</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">একক</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Knit Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">নিট পরিমাণ</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Woven Qty</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">উভেন পরিমাণ</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Total</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">মোট</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Minimum Stock</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">সর্বনিম্ন মজুদ</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Default Cost</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">একক মূল্য</span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">Status</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">অবস্থা</span>
                  </th>
                  {isAdminEditor && (
                    <th className="py-3 px-4 text-right">
                      <span className="block font-bold">Action</span>
                      <span className="block text-[10px] font-bangla opacity-70 font-normal">সম্পাদনা</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={isAdminEditor ? 11 : 10} className="py-4 px-4">
                        <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminEditor ? 11 : 10} className="py-14 text-center text-slate-400">
                      <Package className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No store items found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো পণ্য পাওয়া যায়নি — ফিল্টার পরিবর্তন করুন বা নতুন পণ্য যোগ করুন
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map(({ statusRow, item }) => (
                    <tr
                      key={statusRow.item_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        {statusRow.sku}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold block">{statusRow.item_name}</span>
                        {(statusRow.item_name_bn || item?.name_bn) && (
                          <span className="text-[11px] font-bangla opacity-70 block">
                            {statusRow.item_name_bn || item?.name_bn}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#2BA5B5]/10 text-[#0F8B8D] dark:text-[#2BA5B5]">
                            {normalizeItemOperationUnit(item?.extra_fields?.unit) === 'both'
                              ? 'Woven & Knit'
                              : normalizeItemOperationUnit(item?.extra_fields?.unit)}
                          </span>
                          {item?.item_type && (
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 opacity-80">
                              {item.item_type}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">{statusRow.category_name}</td>
                      <td className="py-3 px-3 font-semibold">{statusRow.uom}</td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatNumberBD(statusRow.knit_qty, 2)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatNumberBD(statusRow.woven_qty, 2)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold">
                        {formatNumberBD(statusRow.current_stock, 2)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400">
                        {formatNumberBD(statusRow.minimum_stock, 2)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold">
                        {item
                          ? formatStoreCurrency(
                              item.default_unit_cost,
                              item.default_currency || 'BDT',
                              2
                            )
                          : '-'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {renderStatusBadge(statusRow.status)}
                      </td>
                      {isAdminEditor && (
                        <td className="py-3 px-4 text-right">
                          {item && (
                            <button
                              type="button"
                              onClick={() => openEditDrawer(item)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-[#2BA5B5]/30 bg-[#2BA5B5]/10 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/20 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            className={`px-4 py-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
            }`}
          >
            <span>
              Showing {paginatedRows.length} of {filteredRows.length} items{' '}
              <span className="font-bangla opacity-70">(মোট {filteredRows.length}টি পণ্য)</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-xl border border-slate-300/60 dark:border-white/15 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-xl border border-slate-300/60 dark:border-white/15 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Admin-only Add/Edit Drawer */}
        {drawerOpen && isAdminEditor && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div
              onClick={() => !saving && setDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <div
              className={`relative z-10 w-full max-w-xl h-full overflow-y-auto shadow-2xl border-l flex flex-col ${
                isDark
                  ? 'bg-[#103A40] border-white/10 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="p-5 border-b border-slate-200/20 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold">
                    {editingItem ? 'Edit Store Item' : 'Add New Store Item'}
                  </h2>
                  <p className="text-xs font-bangla opacity-70">
                    {editingItem ? 'পণ্যের তথ্য হালনাগাদ করুন' : 'স্টোর মাস্টারে নতুন পণ্য যোগ করুন'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !saving && setDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="p-5 space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      SKU * <span className="font-bangla opacity-70 font-normal">(কোড)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="e.g. FAB-SJ-160"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Operation Unit *{' '}
                      <span className="font-bangla opacity-70 font-normal">(উভেন/নিট)</span>
                    </label>
                    <select
                      required
                      value={operationUnit}
                      onChange={(e) =>
                        setOperationUnit(normalizeItemOperationUnit(e.target.value))
                      }
                      className={inputClass}
                    >
                      <option value="both">Shared (Woven &amp; Knit)</option>
                      <option value="woven">Woven (উভেন)</option>
                      <option value="knit">Knit (নিট)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Item Type * <span className="font-bangla opacity-70 font-normal">(ধরণ)</span>
                    </label>
                    <select
                      required
                      value={itemType}
                      onChange={(e) => setItemType(normalizeItemType(e.target.value))}
                      className={inputClass}
                    >
                      {STORE_ITEM_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Item Name * <span className="font-bangla opacity-70 font-normal">(পণ্যের নাম)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Single Jersey 100% Cotton"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Bangla Name <span className="font-bangla opacity-70 font-normal">(বাংলা নাম)</span>
                  </label>
                  <input
                    type="text"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="যেমন: সিঙ্গেল জার্সি কটন ফেব্রিক"
                    className={`${inputClass} font-bangla`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Category <span className="font-bangla opacity-70 font-normal">(ক্যাটাগরি)</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => {
                        const nextCatId = e.target.value;
                        setCategoryId(nextCatId);
                        const matchedCat = categories.find((c) => c.id === nextCatId);
                        setItemType(suggestItemTypeFromCategory(matchedCat?.name));
                      }}
                      className={inputClass}
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} {cat.name_bn ? `(${cat.name_bn})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      UOM <span className="font-bangla opacity-70 font-normal">(একক)</span>
                    </label>
                    <select
                      value={uomId}
                      onChange={(e) => setUomId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select UOM</option>
                      {uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} — {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dynamic extra_fields JSONB by Category */}
                {selectedCategoryKind === 'fabric' && (
                  <div
                    className={`p-3.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-white/5 border-white/10' : 'bg-teal-50/60 border-teal-200'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                      Fabric Specifications{' '}
                      <span className="font-bangla opacity-70 font-normal">(ফেব্রিক তথ্য)</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">GSM</label>
                        <input
                          type="text"
                          value={gsm}
                          onChange={(e) => setGsm(e.target.value)}
                          placeholder="160"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">Width</label>
                        <input
                          type="text"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          placeholder='72"'
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">Composition</label>
                        <input
                          type="text"
                          value={composition}
                          onChange={(e) => setComposition(e.target.value)}
                          placeholder="100% Cotton"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedCategoryKind === 'yarn' && (
                  <div
                    className={`p-3.5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-white/5 border-white/10' : 'bg-teal-50/60 border-teal-200'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                      Yarn Specifications{' '}
                      <span className="font-bangla opacity-70 font-normal">(সুতার তথ্য)</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">Count</label>
                        <input
                          type="text"
                          value={yarnCount}
                          onChange={(e) => setYarnCount(e.target.value)}
                          placeholder="30/1"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">Type</label>
                        <input
                          type="text"
                          value={yarnType}
                          onChange={(e) => setYarnType(e.target.value)}
                          placeholder="Combed"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">Lot</label>
                        <input
                          type="text"
                          value={yarnLot}
                          onChange={(e) => setYarnLot(e.target.value)}
                          placeholder="LOT-42"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Minimum Stock{' '}
                      <span className="font-bangla opacity-70 font-normal">(সর্বনিম্ন)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={minimumStock}
                      onChange={(e) => setMinimumStock(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Default Cost{' '}
                      <span className="font-bangla opacity-70 font-normal">(একক মূল্য)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={defaultUnitCost}
                      onChange={(e) => setDefaultUnitCost(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Currency{' '}
                      <span className="font-bangla opacity-70 font-normal">(মুদ্রা)</span>
                    </label>
                    <select
                      value={defaultCurrency}
                      onChange={(e) => setDefaultCurrency(e.target.value as 'BDT' | 'USD')}
                      className={inputClass}
                    >
                      <option value="BDT">BDT (৳)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Description{' '}
                    <span className="font-bangla opacity-70 font-normal">(বিবরণ)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes or specification details..."
                    className={inputClass}
                  />
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200/60 dark:border-white/10 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold block">Active Item</span>
                    <span className="text-[11px] font-bangla opacity-70 block">
                      পণ্যটি সক্রিয় রাখুন
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-[#0F8B8D]"
                  />
                </label>

                <div className="pt-4 border-t border-slate-200/30 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
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
                        {editingItem ? 'Update Item' : 'Save Item'}
                      </span>
                      <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                        সংরক্ষণ করুন
                      </span>
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default StoreItemsPage;
