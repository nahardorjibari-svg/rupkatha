import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertCircle,
  Send,
  CheckCircle2,
  Lock,
  GitBranch,
  Palette,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  FileEdit,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { ColorSizeMatrix } from '../../components/merchandising/ColorSizeMatrix';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { formatBDT, formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import type { StoreCategory, StoreItem, StoreUom } from '../../types/store';
import {
  GARMENT_COST_HEADS,
  type ConsumptionBasis,
  type CostHeadKey,
  type CostingStatus,
  type MerchCurrency,
  type MerchOrder,
  type OrderColorSize,
  type OrderCosting,
  type OrderCostingItem,
} from '../../types/merchandising';

interface DraftCostingLine {
  localId: string;
  cost_head: CostHeadKey;
  store_item_id: string | null;
  itemSearch: string;
  item_name: string;
  category_label: string;
  uom: string;
  consumption: string;
  consumption_basis: ConsumptionBasis;
  wastage_percent: string;
  unit_price: string;
  currency: MerchCurrency;
  default_unit_cost: number | null;
  default_currency: MerchCurrency | null;
  is_overridden: boolean;
}

interface CostingVersionSummary {
  id: string;
  version: number;
  status: CostingStatus;
  total_cost_pc: number;
  offered_fob_price: number;
  approved_at?: string | null;
  created_at?: string | null;
}

const HEAD_TAG_PREFIXES: Record<CostHeadKey, string> = {
  fabric: '[Fabric] ',
  sewing_thread: '[Sewing Thread] ',
  labels: '[Labels] ',
  accessories: '[Accessories] ',
  embellishment: '[Embellishment] ',
  commercial: '[Commercial] ',
  overhead: '[Overhead] ',
};

const createEmptyLine = (costHead: CostHeadKey = 'fabric'): DraftCostingLine => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  cost_head: costHead,
  store_item_id: null,
  itemSearch: '',
  item_name: '',
  category_label: '',
  uom: costHead === 'fabric' ? 'KG' : costHead === 'commercial' || costHead === 'overhead' ? 'PCS' : 'PCS',
  consumption: '1',
  consumption_basis: costHead === 'sewing_thread' || costHead === 'labels' || costHead === 'accessories' ? 'per_pc' : 'per_pc',
  wastage_percent: costHead === 'commercial' || costHead === 'overhead' ? '0' : '5',
  unit_price: '0',
  currency: 'USD',
  default_unit_cost: null,
  default_currency: null,
  is_overridden: false,
});

function toUsd(amount: number, curr: string, exchangeRate: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (curr === 'BDT') {
    return exchangeRate > 0 ? amount / exchangeRate : 0;
  }
  return amount;
}

function normalizeStatus(raw?: string | null): CostingStatus {
  const s = String(raw || 'draft').toLowerCase().trim();
  if (s === 'approved') return 'approved';
  if (s === 'submitted') return 'submitted';
  return 'draft';
}

function inferCostHeadFromStoreItem(item: StoreItem, categoryName?: string): CostHeadKey {
  const hay = `${item.item_type || ''} ${item.name || ''} ${categoryName || ''}`.toLowerCase();
  if (hay.includes('thread') || hay.includes('yarn') && hay.includes('sewing')) {
    return 'sewing_thread';
  }
  if (
    hay.includes('label') ||
    hay.includes('hangtag') ||
    hay.includes('hang tag') ||
    hay.includes('barcode') ||
    hay.includes('care') ||
    hay.includes('size tab')
  ) {
    return 'labels';
  }
  if (
    hay.includes('print') ||
    hay.includes('embroidery') ||
    hay.includes('wash') ||
    hay.includes('dye') ||
    hay.includes('chemical')
  ) {
    return 'embellishment';
  }
  if (
    (item.item_type || '').toLowerCase() === 'fabric' ||
    hay.includes('fabric') ||
    hay.includes('jersey') ||
    hay.includes('fleece') ||
    hay.includes('twill') ||
    hay.includes('denim') ||
    hay.includes('rib') ||
    hay.includes('collar') ||
    hay.includes('yarn')
  ) {
    return 'fabric';
  }
  return 'accessories';
}

function parseSavedLineCostHead(rawItemType?: string | null, rawItemName?: string | null): {
  costHead: CostHeadKey;
  cleanName: string;
} {
  const name = String(rawItemName || '');
  for (const [key, prefix] of Object.entries(HEAD_TAG_PREFIXES) as [CostHeadKey, string][]) {
    if (name.startsWith(prefix)) {
      return { costHead: key, cleanName: name.slice(prefix.length) };
    }
  }

  const t = String(rawItemType || '').toLowerCase().trim();
  if (t === 'fabric') return { costHead: 'fabric', cleanName: name };
  if (t === 'sewing_thread') return { costHead: 'sewing_thread', cleanName: name };
  if (t === 'labels') return { costHead: 'labels', cleanName: name };
  if (t === 'accessories' || t === 'trims' || t === 'packing') {
    const lower = name.toLowerCase();
    if (lower.includes('thread')) return { costHead: 'sewing_thread', cleanName: name };
    if (lower.includes('label') || lower.includes('hangtag')) {
      return { costHead: 'labels', cleanName: name };
    }
    return { costHead: 'accessories', cleanName: name };
  }
  if (t === 'embellishment') return { costHead: 'embellishment', cleanName: name };
  if (t === 'commercial') return { costHead: 'commercial', cleanName: name };
  if (t === 'overhead' || t === 'other') {
    const lower = name.toLowerCase();
    if (lower.includes('freight') || lower.includes('commercial') || lower.includes('bank')) {
      return { costHead: 'commercial', cleanName: name };
    }
    return { costHead: 'overhead', cleanName: name };
  }
  return { costHead: 'accessories', cleanName: name };
}

export const CostingPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    searchParams.get('orderId') || ''
  );

  // Costing Version & Approval State
  const [existingCostingId, setExistingCostingId] = useState<string | null>(null);
  const [costingVersion, setCostingVersion] = useState<number>(1);
  const [costingStatus, setCostingStatus] = useState<CostingStatus>('draft');
  const [approvedBy, setApprovedBy] = useState<string | null>(null);
  const [approvedByName, setApprovedByName] = useState<string | null>(null);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [versionsList, setVersionsList] = useState<CostingVersionSummary[]>([]);
  const [loadingCosting, setLoadingCosting] = useState(false);

  // Phase 3 Colour-Size Breakdown for selected order
  const [colorSizeRows, setColorSizeRows] = useState<OrderColorSize[]>([]);
  const [showColorMatrix, setShowColorMatrix] = useState(false);

  // Costing Header & Parameters
  const [exchangeRate, setExchangeRate] = useState<string>('122');
  const [cmMode, setCmMode] = useState<'auto' | 'manual'>('auto');
  const [cmPerMinUsd, setCmPerMinUsd] = useState<string>('0.06');
  const [efficiencyPct, setEfficiencyPct] = useState<string>('65');
  const [manualCmUsd, setManualCmUsd] = useState<string>('0');
  const [offeredFobUsd, setOfferedFobUsd] = useState<string>('0');

  // Material Lines
  const [lines, setLines] = useState<DraftCostingLine[]>([createEmptyLine('fabric')]);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [showEmptyHeads, setShowEmptyHeads] = useState<boolean>(true);

  const isLocked = costingStatus === 'approved';

  const canApproveCosting = useMemo(() => {
    const role = profile?.role;
    const perms = Array.isArray(profile?.permissions) ? profile.permissions : [];
    return (
      role === 'admin' ||
      role === 'manager' ||
      role === 'accounts' ||
      role === 'production_manager' ||
      perms.includes('accounts') ||
      perms.includes('costing_approve')
    );
  }, [profile]);

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

  const storeItemMap = useMemo(() => {
    const map = new Map<string, StoreItem>();
    storeItems.forEach((it) => map.set(it.id, it));
    return map;
  }, [storeItems]);

  const loadMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, itemsRes, catRes, uomRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, buyers(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('store_items')
          .select('*')
          .eq('is_active', true)
          .order('sku', { ascending: true }),
        supabase.from('store_categories').select('*'),
        supabase.from('store_uoms').select('*'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (catRes.error) throw catRes.error;
      if (uomRes.error) throw uomRes.error;

      const loadedOrders = (ordersRes.data || []) as MerchOrder[];
      setOrders(loadedOrders);
      setStoreItems((itemsRes.data || []) as StoreItem[]);
      setCategories((catRes.data || []) as StoreCategory[]);
      setUoms((uomRes.data || []) as StoreUom[]);

      const paramOrderId = searchParams.get('orderId');
      if (paramOrderId && loadedOrders.some((o) => o.id === paramOrderId)) {
        setSelectedOrderId(paramOrderId);
      } else if (!selectedOrderId && loadedOrders.length > 0) {
        setSelectedOrderId(loadedOrders[0].id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load merchandising master data.');
    } finally {
      setLoading(false);
    }
  }, [searchParams, selectedOrderId]);

  useEffect(() => {
    loadMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const populateFromCostingRecord = useCallback(
    async (costing: OrderCosting | undefined, orderObj: MerchOrder | undefined) => {
      if (!costing) {
        setExistingCostingId(null);
        setCostingVersion(1);
        setCostingStatus('draft');
        setApprovedBy(null);
        setApprovedByName(null);
        setApprovedAt(null);
        const defaultRate =
          orderObj?.currency === 'USD' && Number(orderObj.exchange_rate) > 1
            ? Number(orderObj.exchange_rate)
            : 122;
        setExchangeRate(String(defaultRate));
        setCmMode('auto');
        setCmPerMinUsd('0.06');
        setEfficiencyPct('65');
        setManualCmUsd('0');
        setOfferedFobUsd('0');
        setLines([createEmptyLine('fabric')]);
        return;
      }

      setExistingCostingId(costing.id);
      setCostingVersion(Number(costing.version || 1));
      setCostingStatus(normalizeStatus(costing.status));
      setApprovedBy(costing.approved_by || null);
      setApprovedAt(costing.approved_at || null);

      if (costing.approved_by) {
        if (profile && costing.approved_by === profile.id) {
          setApprovedByName(profile.full_name);
        } else {
          const { data: approverRow } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', costing.approved_by)
            .maybeSingle();
          setApprovedByName(approverRow?.full_name || null);
        }
      } else {
        setApprovedByName(null);
      }

      setExchangeRate(String(Number(costing.exchange_rate || 122)));
      setOfferedFobUsd(String(Number(costing.offered_fob_price || 0)));

      const smvVal = Number(orderObj?.smv || 0);
      const savedCm = Number(costing.cm_cost_pc || 0);
      setCmMode('manual');
      setManualCmUsd(String(savedCm));
      if (smvVal > 0 && savedCm > 0) {
        const eff = Number(efficiencyPct || 65) / 100;
        setCmPerMinUsd(((savedCm * eff) / smvVal).toFixed(4));
      }

      const rawItems = costing.order_costing_items || [];
      if (rawItems.length > 0) {
        const mapped: DraftCostingLine[] = rawItems.map((li, idx) => {
          const linked = li.store_item_id ? storeItemMap.get(li.store_item_id) : undefined;
          const cat = linked?.category_id ? categoryMap.get(linked.category_id) : undefined;
          const itemCurr: MerchCurrency = li.currency === 'BDT' ? 'BDT' : 'USD';
          const linkedCurr: MerchCurrency | null = linked
            ? linked.default_currency === 'BDT'
              ? 'BDT'
              : 'USD'
            : null;
          const { costHead, cleanName } = parseSavedLineCostHead(li.item_type, li.item_name);

          return {
            localId: li.id || `${Date.now()}-${idx}`,
            cost_head: costHead,
            store_item_id: li.store_item_id || null,
            itemSearch: linked ? `${linked.sku} — ${linked.name}` : cleanName || '',
            item_name: cleanName || linked?.name || '',
            category_label: cat?.name || GARMENT_COST_HEADS.find((h) => h.key === costHead)?.shortLabel || '',
            uom: li.uom || 'PCS',
            consumption: String(li.consumption ?? 0),
            consumption_basis: li.consumption_basis === 'per_dzn' ? 'per_dzn' : 'per_pc',
            wastage_percent: String(li.wastage_percent ?? 0),
            unit_price: String(li.unit_price ?? 0),
            currency: itemCurr,
            default_unit_cost: linked ? Number(linked.default_unit_cost ?? 0) : null,
            default_currency: linkedCurr,
            is_overridden: Boolean(li.is_overridden),
          };
        });
        setLines(mapped);
      } else {
        setLines([createEmptyLine('fabric')]);
      }
    },
    [storeItemMap, categoryMap, efficiencyPct, profile]
  );

  const loadOrderCosting = useCallback(
    async (orderId: string, specificCostingId?: string) => {
      if (!orderId) return;
      const orderObj = orders.find((o) => o.id === orderId);
      setLoadingCosting(true);
      try {
        const [costingsRes, csRes] = await Promise.all([
          supabase
            .from('order_costings')
            .select('*, order_costing_items(*)')
            .eq('order_id', orderId)
            .order('version', { ascending: false }),
          supabase
            .from('order_color_sizes')
            .select('*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true }),
        ]);

        if (costingsRes.error) throw costingsRes.error;
        if (csRes.error) {
          console.warn('Could not load order_color_sizes:', csRes.error.message);
          setColorSizeRows([]);
        } else {
          setColorSizeRows((csRes.data || []) as OrderColorSize[]);
        }

        const allCostings = (costingsRes.data || []) as OrderCosting[];
        setVersionsList(
          allCostings.map((c) => ({
            id: c.id,
            version: Number(c.version || 1),
            status: normalizeStatus(c.status),
            total_cost_pc: Number(c.total_cost_pc || 0),
            offered_fob_price: Number(c.offered_fob_price || 0),
            approved_at: c.approved_at,
            created_at: c.created_at,
          }))
        );

        const targetCosting = specificCostingId
          ? allCostings.find((c) => c.id === specificCostingId) || allCostings[0]
          : allCostings[0];

        await populateFromCostingRecord(targetCosting, orderObj);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load order costing.');
      } finally {
        setLoadingCosting(false);
      }
    },
    [orders, populateFromCostingRecord]
  );

  useEffect(() => {
    if (selectedOrderId && orders.length > 0) {
      loadOrderCosting(selectedOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId, orders.length]);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowColorMatrix(false);
    if (orderId) {
      setSearchParams({ orderId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const parsedExchangeRate = useMemo(() => {
    const r = Number(exchangeRate);
    return Number.isFinite(r) && r > 0 ? r : 122;
  }, [exchangeRate]);

  const orderQty = useMemo(() => {
    return Math.max(0, Number(selectedOrder?.order_qty || 0));
  }, [selectedOrder]);

  // Phase 3 Colour & Size aggregation
  const colorSizeSummary = useMemo(() => {
    const colorTotals = new Map<string, number>();
    const sizeTotals = new Map<string, number>();
    let totalBreakdownQty = 0;

    colorSizeRows.forEach((row) => {
      const qty = Math.max(0, Number(row.ratio_qty || 0));
      if (!row.color_name || !row.size_name) return;
      colorTotals.set(row.color_name, (colorTotals.get(row.color_name) || 0) + qty);
      sizeTotals.set(row.size_name, (sizeTotals.get(row.size_name) || 0) + qty);
      totalBreakdownQty += qty;
    });

    return {
      colors: Array.from(colorTotals.entries()).map(([name, qty]) => ({ name, qty })),
      sizes: Array.from(sizeTotals.entries()).map(([name, qty]) => ({ name, qty })),
      totalBreakdownQty,
    };
  }, [colorSizeRows]);

  const handleAddLineInHead = (costHead: CostHeadKey) => {
    if (isLocked) return;
    setLines((prev) => [...prev, createEmptyLine(costHead)]);
  };

  const handleSelectStoreItem = (localId: string, item: StoreItem) => {
    if (isLocked) return;
    const cat = item.category_id ? categoryMap.get(item.category_id) : undefined;
    const uom = item.uom_id ? uomMap.get(item.uom_id) : undefined;
    const defCurr: MerchCurrency = item.default_currency === 'BDT' ? 'BDT' : 'USD';
    const defCost = Number(item.default_unit_cost || 0);
    const inferredHead = inferCostHeadFromStoreItem(item, cat?.name);

    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;
        return {
          ...line,
          store_item_id: item.id,
          itemSearch: `${item.sku} — ${item.name}`,
          item_name: item.name,
          category_label: cat?.name || item.item_type || '-',
          // Keep user's explicit group if they added inside a specific head like commercial/overhead, otherwise infer intelligently
          cost_head:
            line.cost_head === 'commercial' || line.cost_head === 'overhead'
              ? line.cost_head
              : inferredHead,
          uom: uom?.code || 'PCS',
          unit_price: String(defCost),
          currency: defCurr,
          default_unit_cost: defCost,
          default_currency: defCurr,
          is_overridden: false,
        };
      })
    );
    setOpenPickerId(null);
  };

  const handleResetLineRate = (localId: string) => {
    if (isLocked) return;
    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId || line.default_unit_cost === null) return line;
        return {
          ...line,
          unit_price: String(line.default_unit_cost),
          currency: line.default_currency || 'USD',
          is_overridden: false,
        };
      })
    );
  };

  const handleLineChange = <K extends keyof DraftCostingLine>(
    localId: string,
    field: K,
    value: DraftCostingLine[K]
  ) => {
    if (isLocked) return;
    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;
        const next = { ...line, [field]: value };

        if (field === 'itemSearch') {
          next.item_name = String(value);
          if (line.store_item_id) {
            next.store_item_id = null;
            next.default_unit_cost = null;
            next.default_currency = null;
            next.is_overridden = false;
          }
        }

        if (field === 'unit_price' || field === 'currency') {
          if (next.default_unit_cost !== null) {
            const editedPrice = Number(next.unit_price || 0);
            const priceDiff = Math.abs(editedPrice - next.default_unit_cost) > 0.0001;
            const currDiff = next.default_currency !== null && next.currency !== next.default_currency;
            next.is_overridden = priceDiff || currDiff;
          }
        }

        return next;
      })
    );
  };

  // Accurate BOM Calculation Engine (per PC + per DZN + Order Total)
  const calculatedLines = useMemo(() => {
    return lines.map((line) => {
      const cons = Math.max(0, Number(line.consumption || 0));
      const waste = Math.max(0, Number(line.wastage_percent || 0));
      const perPcBase = line.consumption_basis === 'per_dzn' ? cons / 12 : cons;
      const perPcWithWaste = perPcBase * (1 + waste / 100);
      const totalRequiredQty = orderQty * perPcWithWaste;
      const rate = Math.max(0, Number(line.unit_price || 0));
      const costPerPcOriginal = perPcWithWaste * rate;
      const totalCostOriginal = totalRequiredQty * rate;
      const costPerPcUsd = toUsd(costPerPcOriginal, line.currency, parsedExchangeRate);
      const costPerDznUsd = costPerPcUsd * 12;
      const costPerPcBdt = costPerPcUsd * parsedExchangeRate;
      const costPerDznBdt = costPerDznUsd * parsedExchangeRate;
      const totalCostUsd = toUsd(totalCostOriginal, line.currency, parsedExchangeRate);

      return {
        line,
        perPcWithWaste,
        totalRequiredQty,
        costPerPcOriginal,
        totalCostOriginal,
        costPerPcUsd,
        costPerDznUsd,
        costPerPcBdt,
        costPerDznBdt,
        totalCostUsd,
      };
    });
  }, [lines, orderQty, parsedExchangeRate]);

  // Live Summary across all 8 Standardized Garments Costing Heads
  const summary = useMemo(() => {
    const headTotalsPcUsd: Record<CostHeadKey, number> = {
      fabric: 0,
      sewing_thread: 0,
      labels: 0,
      accessories: 0,
      embellishment: 0,
      commercial: 0,
      overhead: 0,
    };

    calculatedLines.forEach(({ line, costPerPcUsd }) => {
      if (!line.item_name.trim() && !line.store_item_id && costPerPcUsd <= 0) return;
      headTotalsPcUsd[line.cost_head] = (headTotalsPcUsd[line.cost_head] || 0) + costPerPcUsd;
    });

    const smvVal = Math.max(0, Number(selectedOrder?.smv || 0));
    const cpmVal = Math.max(0, Number(cmPerMinUsd || 0));
    const effVal = Math.max(1, Number(efficiencyPct || 65));
    const autoCmUsd = (smvVal * cpmVal) / (effVal / 100);
    const cmCostPcUsd = cmMode === 'auto' ? autoCmUsd : Math.max(0, Number(manualCmUsd || 0));

    // Mapped totals for backward compatibility with Orders & Accounts modules
    const fabricCostPcUsd = headTotalsPcUsd.fabric;
    const accessoriesCostPcUsd =
      headTotalsPcUsd.sewing_thread +
      headTotalsPcUsd.labels +
      headTotalsPcUsd.accessories +
      headTotalsPcUsd.embellishment;
    const commercialAndOverheadPcUsd = headTotalsPcUsd.commercial + headTotalsPcUsd.overhead;

    const totalCostPcUsd =
      fabricCostPcUsd + accessoriesCostPcUsd + cmCostPcUsd + commercialAndOverheadPcUsd;
    const totalCostDznUsd = totalCostPcUsd * 12;
    const totalCostPcBdt = totalCostPcUsd * parsedExchangeRate;
    const totalCostDznBdt = totalCostDznUsd * parsedExchangeRate;

    const totalOrderCostUsd = totalCostPcUsd * orderQty;
    const totalOrderCostBdt = totalOrderCostUsd * parsedExchangeRate;

    const fobUsd = Math.max(0, Number(offeredFobUsd || 0));
    const fobDznUsd = fobUsd * 12;
    const profitPerPcUsd = fobUsd - totalCostPcUsd;
    const profitPerDznUsd = profitPerPcUsd * 12;
    const totalProfitUsd = profitPerPcUsd * orderQty;
    const marginPct = fobUsd > 0 ? (profitPerPcUsd / fobUsd) * 100 : 0;

    return {
      headTotalsPcUsd,
      fabricCostPcUsd,
      accessoriesCostPcUsd,
      cmCostPcUsd,
      autoCmUsd,
      commercialAndOverheadPcUsd,
      totalCostPcUsd,
      totalCostDznUsd,
      totalCostPcBdt,
      totalCostDznBdt,
      totalOrderCostUsd,
      totalOrderCostBdt,
      fobUsd,
      fobDznUsd,
      fobBdt: fobUsd * parsedExchangeRate,
      profitPerPcUsd,
      profitPerDznUsd,
      profitPerPcBdt: profitPerPcUsd * parsedExchangeRate,
      totalProfitUsd,
      totalProfitBdt: totalProfitUsd * parsedExchangeRate,
      marginPct,
    };
  }, [
    calculatedLines,
    selectedOrder,
    cmMode,
    cmPerMinUsd,
    efficiencyPct,
    manualCmUsd,
    offeredFobUsd,
    orderQty,
    parsedExchangeRate,
  ]);

  const persistCostingItems = async (
    targetCostingId: string,
    validMaterialRows: typeof calculatedLines
  ) => {
    if (validMaterialRows.length === 0) return;

    const primaryPayload: Omit<OrderCostingItem, 'id' | 'created_at'>[] = validMaterialRows.map(
      ({ line, totalRequiredQty, costPerPcOriginal, totalCostOriginal }) => ({
        costing_id: targetCostingId,
        store_item_id: line.store_item_id,
        item_name: line.item_name.trim() || 'Material Item',
        item_type: line.cost_head,
        uom: line.uom || 'PCS',
        consumption: Number(line.consumption || 0),
        consumption_basis: line.consumption_basis,
        wastage_percent: Number(line.wastage_percent || 0),
        total_required_qty: Number(totalRequiredQty.toFixed(3)),
        unit_price: Number(line.unit_price || 0),
        is_overridden: line.is_overridden,
        cost_per_pc: Number(costPerPcOriginal.toFixed(4)),
        total_cost: Number(totalCostOriginal.toFixed(2)),
        currency: line.currency,
      })
    );

    const { error: itemsErr } = await supabase
      .from('order_costing_items')
      .insert(primaryPayload);

    if (!itemsErr) return;

    // Fallback if database has a strict CHECK constraint on item_type ('fabric' | 'accessories' | 'trims' | 'packing' | 'other')
    const msg = `${itemsErr.message || ''} ${itemsErr.details || ''}`.toLowerCase();
    if (itemsErr.code === '23514' || msg.includes('item_type') || msg.includes('check constraint')) {
      const fallbackPayload: Omit<OrderCostingItem, 'id' | 'created_at'>[] = validMaterialRows.map(
        ({ line, totalRequiredQty, costPerPcOriginal, totalCostOriginal }) => {
          const headMeta = GARMENT_COST_HEADS.find((h) => h.key === line.cost_head);
          const cleanName = line.item_name.trim() || 'Material Item';
          const needsPrefix =
            line.cost_head !== 'fabric' && line.cost_head !== 'accessories';
          return {
            costing_id: targetCostingId,
            store_item_id: line.store_item_id,
            item_name: needsPrefix ? `${HEAD_TAG_PREFIXES[line.cost_head]}${cleanName}` : cleanName,
            item_type: headMeta?.dbFallbackType || 'other',
            uom: line.uom || 'PCS',
            consumption: Number(line.consumption || 0),
            consumption_basis: line.consumption_basis,
            wastage_percent: Number(line.wastage_percent || 0),
            total_required_qty: Number(totalRequiredQty.toFixed(3)),
            unit_price: Number(line.unit_price || 0),
            is_overridden: line.is_overridden,
            cost_per_pc: Number(costPerPcOriginal.toFixed(4)),
            total_cost: Number(totalCostOriginal.toFixed(2)),
            currency: line.currency,
          };
        }
      );

      const { error: fbErr } = await supabase
        .from('order_costing_items')
        .insert(fallbackPayload);
      if (fbErr) throw fbErr;
      return;
    }

    throw itemsErr;
  };

  const handleSaveWithStatus = async (targetStatus: CostingStatus) => {
    if (!selectedOrder) {
      toast.error('Please select an Order first.');
      return;
    }

    if (isLocked) {
      toast.error('Approved costing is locked. Create a new revision to edit.');
      return;
    }

    if (targetStatus === 'approved' && !canApproveCosting) {
      toast.error('Permission denied: Only Admin, Accounts, or Manager can approve costings.');
      return;
    }

    const validMaterialRows = calculatedLines.filter(
      ({ line }) => line.store_item_id || line.item_name.trim()
    );
    if (validMaterialRows.length === 0 && summary.cmCostPcUsd <= 0) {
      toast.error('Please add at least one BOM material line or CM cost component.');
      return;
    }

    setSaving(true);
    try {
      const isApproving = targetStatus === 'approved';
      const costingPayload: Record<string, any> = {
        order_id: selectedOrder.id,
        version: costingVersion,
        currency: 'USD',
        exchange_rate: parsedExchangeRate,
        fabric_cost_pc: Number(summary.fabricCostPcUsd.toFixed(4)),
        accessories_cost_pc: Number(summary.accessoriesCostPcUsd.toFixed(4)),
        cm_cost_pc: Number(summary.cmCostPcUsd.toFixed(4)),
        total_cost_pc: Number(summary.totalCostPcUsd.toFixed(4)),
        total_order_cost: Number(summary.totalOrderCostUsd.toFixed(2)),
        offered_fob_price: Number(summary.fobUsd.toFixed(4)),
        profit_per_pc: Number(summary.profitPerPcUsd.toFixed(4)),
        profit_margin_percent: Number(summary.marginPct.toFixed(2)),
        total_profit: Number(summary.totalProfitUsd.toFixed(2)),
        status: targetStatus,
        approved_by: isApproving ? user?.id || profile?.id || null : null,
        approved_at: isApproving ? new Date().toISOString() : null,
      };

      let targetCostingId = existingCostingId;

      if (targetCostingId) {
        const { error: updateErr } = await supabase
          .from('order_costings')
          .update(costingPayload)
          .eq('id', targetCostingId);
        if (updateErr) throw updateErr;

        const { error: delErr } = await supabase
          .from('order_costing_items')
          .delete()
          .eq('costing_id', targetCostingId);
        if (delErr) throw delErr;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('order_costings')
          .insert(costingPayload)
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        targetCostingId = inserted.id;
        setExistingCostingId(targetCostingId);
      }

      await persistCostingItems(targetCostingId!, validMaterialRows);

      if (targetStatus === 'approved') {
        toast.success(`Costing v${costingVersion} APPROVED & LOCKED for ${selectedOrder.order_no}!`);
      } else if (targetStatus === 'submitted') {
        toast.success(`Costing v${costingVersion} submitted for approval!`);
      } else {
        toast.success(`Draft costing v${costingVersion} saved for ${selectedOrder.order_no}!`);
      }

      await loadOrderCosting(selectedOrder.id, targetCostingId!);
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save order costing.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewRevision = async () => {
    if (!selectedOrder) return;
    const maxVersion = versionsList.reduce((m, v) => Math.max(m, v.version), costingVersion);
    const nextVersion = maxVersion + 1;
    const validMaterialRows = calculatedLines.filter(
      ({ line }) => line.store_item_id || line.item_name.trim()
    );

    setSaving(true);
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('order_costings')
        .insert({
          order_id: selectedOrder.id,
          version: nextVersion,
          currency: 'USD',
          exchange_rate: parsedExchangeRate,
          fabric_cost_pc: Number(summary.fabricCostPcUsd.toFixed(4)),
          accessories_cost_pc: Number(summary.accessoriesCostPcUsd.toFixed(4)),
          cm_cost_pc: Number(summary.cmCostPcUsd.toFixed(4)),
          total_cost_pc: Number(summary.totalCostPcUsd.toFixed(4)),
          total_order_cost: Number(summary.totalOrderCostUsd.toFixed(2)),
          offered_fob_price: Number(summary.fobUsd.toFixed(4)),
          profit_per_pc: Number(summary.profitPerPcUsd.toFixed(4)),
          profit_margin_percent: Number(summary.marginPct.toFixed(2)),
          total_profit: Number(summary.totalProfitUsd.toFixed(2)),
          status: 'draft',
          approved_by: null,
          approved_at: null,
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      await persistCostingItems(inserted.id, validMaterialRows);

      toast.success(`Created editable Revision v${nextVersion} (Draft)`);
      await loadOrderCosting(selectedOrder.id, inserted.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create costing revision.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] disabled:opacity-60 disabled:cursor-not-allowed ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const cardClass = `rounded-2xl border p-5 transition-all ${
    isDark
      ? 'bg-[#103A40]/85 border-white/10 text-slate-100'
      : 'glass-card bg-white/90 border-slate-200 text-slate-900'
  }`;

  const isPositiveMargin = summary.profitPerPcUsd >= 0;

  const statusBadgeMeta = useMemo(() => {
    if (costingStatus === 'approved') {
      return {
        label: 'Approved (Locked)',
        labelBn: 'অনুমোদিত ও লকড',
        cls: isDark
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        Icon: Lock,
      };
    }
    if (costingStatus === 'submitted') {
      return {
        label: 'Submitted for Approval',
        labelBn: 'অনুমোদনের জন্য জমা',
        cls: isDark
          ? 'bg-sky-500/20 text-sky-300 border-sky-500/35'
          : 'bg-sky-50 text-sky-700 border-sky-200',
        Icon: Send,
      };
    }
    return {
      label: 'Draft',
      labelBn: 'খসড়া',
      cls: isDark
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
        : 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: FileEdit,
    };
  }, [costingStatus, isDark]);

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header & Approval Action Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/merchandising/orders')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  isDark
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Orders</span>
              </button>
              <h1 className="text-2xl font-extrabold tracking-tight">
                Smart Auto Costing &amp; BOM Sheet
              </h1>

              {selectedOrder && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-extrabold ${statusBadgeMeta.cls}`}
                >
                  <statusBadgeMeta.Icon className="w-3.5 h-3.5" />
                  <span>
                    v{costingVersion} · {statusBadgeMeta.label}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs font-bangla opacity-70 mt-1">
              গার্মেন্টস স্ট্যান্ডার্ড ৮-হেড কস্টিং ইঞ্জিন — কনজাম্পশন, অপচয় (%), প্রতি পিস ও প্রতি ডজন খরচ এবং অনুমোদন ওয়ার্কফ্লো
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadMasterData}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            {selectedOrder && !isLocked && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveWithStatus(costingStatus === 'submitted' ? 'submitted' : 'draft')
                  }
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
                      : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 text-[#0F8B8D] dark:text-[#2BA5B5]" />
                  )}
                  <div className="text-left">
                    <span className="block leading-tight">
                      {costingStatus === 'submitted' ? 'Save Changes' : 'Save Draft'}
                    </span>
                    <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                      সংরক্ষণ করুন
                    </span>
                  </div>
                </button>

                {costingStatus === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handleSaveWithStatus('submitted')}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <div className="text-left">
                      <span className="block leading-tight">Submit for Approval</span>
                      <span className="block text-[10px] font-bangla opacity-85 leading-tight">
                        অনুমোদনে পাঠান
                      </span>
                    </div>
                  </button>
                )}

                {costingStatus === 'submitted' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveWithStatus('draft')}
                      disabled={saving}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-bold cursor-pointer disabled:opacity-50 ${
                        isDark
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                          : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return to Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveWithStatus('approved')}
                      disabled={saving || !canApproveCosting}
                      title={
                        canApproveCosting
                          ? 'Approve and lock this costing BOM'
                          : 'Approval restricted to Admin, Accounts, or Manager roles'
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {canApproveCosting ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      <div className="text-left">
                        <span className="block leading-tight">Approve Costing</span>
                        <span className="block text-[10px] font-bangla opacity-85 leading-tight">
                          {canApproveCosting ? 'অনুমোদন ও লক করুন' : 'অ্যাডমিন / একাউন্টস অনুমোদন'}
                        </span>
                      </div>
                    </button>
                  </>
                )}
              </>
            )}

            {selectedOrder && isLocked && (
              <button
                type="button"
                onClick={handleCreateNewRevision}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
                <div className="text-left">
                  <span className="block leading-tight">
                    Create Revision (v{versionsList.reduce((m, v) => Math.max(m, v.version), costingVersion) + 1})
                  </span>
                  <span className="block text-[10px] font-bangla opacity-85 leading-tight">
                    নতুন ভার্সন তৈরি করুন
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Approved Lock Banner */}
        {selectedOrder && isLocked && (
          <div
            className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold">
                  Costing v{costingVersion} is Approved &amp; Locked
                  {approvedByName ? ` by ${approvedByName}` : ''}
                  {approvedAt ? ` on ${formatStoreDate(approvedAt)}` : ''}
                </p>
                <p className="text-[11px] font-bangla opacity-80">
                  অনুমোদিত বিওএম (BOM) সুরক্ষিত ও লক করা হয়েছে। পরিবর্তনের জন্য "Create Revision" বাটনে ক্লিক করে নতুন ভার্সন তৈরি করুন।
                </p>
              </div>
            </div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-600/20 border border-emerald-500/30">
              Read-Only BOM
            </span>
          </div>
        )}

        {/* Order Selector, Version Picker & Exchange Rate Bar */}
        <div className={`${cardClass} grid grid-cols-1 lg:grid-cols-12 gap-4 items-end`}>
          <div className="lg:col-span-5">
            <label className="block text-xs font-bold mb-1">
              Select Buyer Order *{' '}
              <span className="font-bangla opacity-70 font-normal">(অর্ডার নির্বাচন করুন)</span>
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => handleSelectOrder(e.target.value)}
              className={inputClass}
              disabled={loading}
            >
              <option value="">-- Select Order --</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_no}
                  {o.po_no ? ` · PO: ${o.po_no}` : ''} · {o.buyers?.name || 'Buyer'} · {o.style_no} (
                  {formatNumberBD(o.order_qty)} PCS)
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold mb-1">
              Version{' '}
              <span className="font-bangla opacity-70 font-normal">(ভার্সন)</span>
            </label>
            <select
              value={existingCostingId || 'new'}
              onChange={(e) => {
                if (selectedOrder && e.target.value !== 'new') {
                  loadOrderCosting(selectedOrder.id, e.target.value);
                }
              }}
              disabled={versionsList.length === 0 || loadingCosting}
              className={inputClass}
            >
              {versionsList.length === 0 ? (
                <option value="new">v1 (New Draft)</option>
              ) : (
                versionsList.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version} — {v.status.toUpperCase()} (${v.total_cost_pc.toFixed(2)})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-bold mb-1">
              Rate (1 USD = BDT ৳)
            </label>
            <div className="relative">
              <DollarSign className="w-3.5 h-3.5 text-[#0F8B8D] dark:text-[#2BA5B5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min="0.01"
                step="any"
                value={exchangeRate}
                disabled={isLocked}
                onChange={(e) => setExchangeRate(e.target.value)}
                className={`${inputClass} pl-8 font-bold`}
              />
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-wrap items-center justify-between lg:justify-end gap-3 text-xs">
            {selectedOrder ? (
              <div
                className={`w-full px-3.5 py-2 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                  isDark ? 'bg-[#0B2E33] border-white/10' : 'bg-teal-50/70 border-teal-200'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-[10px] uppercase opacity-65 block">Style / Item</span>
                  <span className="font-bold truncate block">
                    {selectedOrder.style_no} — {selectedOrder.item_name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase opacity-65 block">Qty · SMV · Unit</span>
                  <span className="font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] tabular-nums">
                    {formatNumberBD(selectedOrder.order_qty)} PCS · {selectedOrder.smv}m ·{' '}
                    {String(selectedOrder.unit).toUpperCase()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-500 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Select an order to begin costing.</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Metadata Banner + Phase 3 Colour & Size Integration */}
        {selectedOrder && (
          <div
            className={`rounded-2xl border p-4 space-y-3 text-xs ${
              isDark ? 'bg-[#0B2E33]/85 border-white/10' : 'bg-slate-50/90 border-slate-200'
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold opacity-60 block">Buyer</span>
                <span className="font-bold">{selectedOrder.buyers?.name || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-60 block">Buyer PO #</span>
                <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                  {selectedOrder.po_no || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-60 block">Order Qty</span>
                <span className="font-extrabold tabular-nums">
                  {formatNumberBD(selectedOrder.order_qty)} PCS ({(orderQty / 12).toFixed(1)} DZN)
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-60 block">SMV</span>
                <span className="font-bold tabular-nums">
                  {Number(selectedOrder.smv || 0).toFixed(2)} Min
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-60 block">Ship Date</span>
                <span className="font-semibold">
                  {formatStoreDate(selectedOrder.target_ship_date)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold opacity-60 block">Workflow State</span>
                <span className={`font-extrabold ${
                  costingStatus === 'approved'
                    ? 'text-emerald-500'
                    : costingStatus === 'submitted'
                    ? 'text-sky-500'
                    : 'text-amber-500'
                }`}>
                  {existingCostingId
                    ? `v${costingVersion} · ${statusBadgeMeta.label}`
                    : 'v1 · Unsaved Draft'}
                </span>
              </div>
            </div>

            {/* Phase 3 Colour & Size Summary Strip */}
            <div
              className={`pt-3 border-t flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Colours &amp; Sizes:</span>
                </span>

                {colorSizeRows.length === 0 ? (
                  <span className="text-[11px] opacity-70 font-bangla">
                    এই অর্ডারের কালার-সাইজ ব্রেকডাউন এখনো সেট করা হয়নি (Orders পেজ থেকে যোগ করুন)
                  </span>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {colorSizeSummary.colors.map((c) => (
                        <span
                          key={c.name}
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold tabular-nums ${
                            isDark
                              ? 'bg-white/5 border-white/15 text-slate-200'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          {c.name}: <span className="text-[#0F8B8D] dark:text-[#2BA5B5]">{formatNumberBD(c.qty)}</span>
                        </span>
                      ))}
                    </div>

                    <span className="opacity-30 hidden sm:inline">|</span>

                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] uppercase font-bold opacity-60 mr-0.5">
                        Sizes:
                      </span>
                      {colorSizeSummary.sizes.map((s) => (
                        <span
                          key={s.name}
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                            isDark ? 'bg-[#2BA5B5]/15 text-[#2BA5B5]' : 'bg-teal-50 text-[#0F8B8D]'
                          }`}
                        >
                          {s.name} ({formatNumberBD(s.qty)})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {colorSizeRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowColorMatrix((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border text-[11px] font-bold cursor-pointer shrink-0 ${
                    isDark
                      ? 'bg-white/5 border-white/15 hover:bg-white/10 text-slate-200'
                      : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span>{showColorMatrix ? 'Hide Matrix' : 'View Colour-Size Matrix'}</span>
                  {showColorMatrix ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {showColorMatrix && colorSizeRows.length > 0 && (
              <div className="pt-2">
                <ColorSizeMatrix rows={colorSizeRows} readOnly />
              </div>
            )}
          </div>
        )}

        {!selectedOrder && !loading ? (
          <div className={`${cardClass} py-16 text-center`}>
            <Package className="w-10 h-10 mx-auto mb-2 text-slate-400 opacity-50" />
            <p className="text-sm font-bold">No Buyer Order Selected</p>
            <p className="text-xs font-bangla opacity-70 mt-1">
              প্রথমে বায়ার অর্ডার তৈরি করুন বা তালিকা থেকে একটি অর্ডার নির্বাচন করুন
            </p>
            <button
              type="button"
              onClick={() => navigate('/merchandising/orders')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] text-white text-xs font-bold cursor-pointer"
            >
              <span>Go to Buyer Orders</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT: 8-Head Standardized Material & Cost Breakdown (8 cols) */}
            <div className={`xl:col-span-8 ${cardClass} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/15">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#0F8B8D] dark:text-[#2BA5B5]" />
                    <span>Standardized Garments BOM (8 Cost Heads)</span>
                  </h2>
                  <p className="text-xs font-bangla opacity-70">
                    ফর্মুলা: Required Qty = Order Qty × Consumption × (1 + Wastage %) · প্রতি পিস ও প্রতি ডজন খরচ স্বয়ংক্রিয় হিসাব
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEmptyHeads((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                      isDark
                        ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {showEmptyHeads ? 'Hide Empty Heads' : 'Show All 8 Heads'}
                  </button>
                </div>
              </div>

              {loadingCosting ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-24 rounded-2xl bg-slate-200/40 dark:bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {GARMENT_COST_HEADS.map((head) => {
                    // Head 6: CM (Cost of Making / Sewing) inline summary card
                    if (!head.isBomHead) {
                      return (
                        <div
                          key={head.key}
                          className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${
                            isDark
                              ? 'bg-[#0B2E33]/90 border-[#2BA5B5]/25'
                              : 'bg-teal-50/60 border-teal-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {head.label}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {cmMode === 'auto' ? 'Auto SMV Engine' : 'Manual CM'}
                              </span>
                            </div>
                            <p className="text-[11px] font-bangla opacity-70 mt-0.5">
                              {head.labelBn} · {head.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-right tabular-nums">
                            <div>
                              <span className="text-[10px] uppercase opacity-65 block">CM / PC</span>
                              <span className="text-xs font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                ${summary.cmCostPcUsd.toFixed(3)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase opacity-65 block">CM / DZN</span>
                              <span className="text-xs font-extrabold">
                                ${(summary.cmCostPcUsd * 12).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase opacity-65 block">Order CM</span>
                              <span className="text-xs font-bold opacity-85">
                                ${(summary.cmCostPcUsd * orderQty).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const headKey = head.key as CostHeadKey;
                    const headRows = calculatedLines.filter((r) => r.line.cost_head === headKey);
                    const headPcUsd = summary.headTotalsPcUsd[headKey] || 0;
                    const headDznUsd = headPcUsd * 12;

                    if (!showEmptyHeads && headRows.length === 0) {
                      return null;
                    }

                    return (
                      <div
                        key={head.key}
                        className={`rounded-2xl border overflow-hidden ${
                          isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50/70 border-slate-200'
                        }`}
                      >
                        {/* Category Header */}
                        <div
                          className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                            isDark
                              ? 'bg-[#0B2E33]/75 border-white/10'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xs font-extrabold tracking-tight text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {head.label}
                              </h3>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/10 tabular-nums">
                                {headRows.length} {headRows.length === 1 ? 'item' : 'items'}
                              </span>
                            </div>
                            <p className="text-[10px] font-bangla opacity-70 truncate">
                              {head.labelBn} — {head.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {headRows.length > 0 && (
                              <div className="text-right tabular-nums text-[11px]">
                                <span className="font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                  ${headPcUsd.toFixed(3)}/pc
                                </span>
                                <span className="mx-1.5 opacity-35">·</span>
                                <span className="font-bold">
                                  ${headDznUsd.toFixed(2)}/dzn
                                </span>
                              </div>
                            )}

                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => handleAddLineInHead(headKey)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30 text-[11px] font-bold hover:bg-[#2BA5B5]/25 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Category Line Items */}
                        {headRows.length === 0 ? (
                          <div className="px-4 py-2.5 text-[11px] opacity-60 flex items-center justify-between">
                            <span>No items added under {head.shortLabel}.</span>
                          </div>
                        ) : (
                          <div className="p-3 space-y-2.5">
                            {headRows.map(
                              (
                                {
                                  line,
                                  totalRequiredQty,
                                  costPerPcOriginal,
                                  costPerPcUsd,
                                  costPerDznUsd,
                                },
                                idx
                              ) => {
                                const query = line.itemSearch.trim().toLowerCase();
                                const suggestions = storeItems
                                  .filter((it) => {
                                    if (!query) return true;
                                    return (
                                      it.sku.toLowerCase().includes(query) ||
                                      it.name.toLowerCase().includes(query) ||
                                      (it.name_bn || '').toLowerCase().includes(query)
                                    );
                                  })
                                  .slice(0, 12);

                                return (
                                  <div
                                    key={line.localId}
                                    className={`p-3 rounded-xl border space-y-2.5 ${
                                      isDark
                                        ? 'bg-[#0B2E33]/55 border-white/10'
                                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-65">
                                          #{idx + 1}
                                        </span>
                                        {line.category_label && (
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                                            {line.category_label}
                                          </span>
                                        )}
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-white/10">
                                          UOM: {line.uom}
                                        </span>
                                        {line.is_overridden && (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                            <span>Rate Overridden</span>
                                            {!isLocked && line.default_unit_cost !== null && (
                                              <button
                                                type="button"
                                                onClick={() => handleResetLineRate(line.localId)}
                                                title={`Reset to store rate (${line.default_currency} ${line.default_unit_cost})`}
                                                className="hover:text-amber-800 dark:hover:text-white cursor-pointer"
                                              >
                                                <RotateCcw className="w-3 h-3" />
                                              </button>
                                            )}
                                          </span>
                                        )}
                                      </div>

                                      {!isLocked && lines.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setLines((prev) =>
                                              prev.filter((l) => l.localId !== line.localId)
                                            )
                                          }
                                          className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                                          title="Remove row"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Row Controls */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                                      {/* Store Item Searchable Picker */}
                                      <div className="md:col-span-5 relative">
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          Item Description / Store SKU *
                                        </label>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          value={line.itemSearch}
                                          onFocus={() => !isLocked && setOpenPickerId(line.localId)}
                                          onBlur={() =>
                                            setTimeout(
                                              () =>
                                                setOpenPickerId((prev) =>
                                                  prev === line.localId ? null : prev
                                                ),
                                              150
                                            )
                                          }
                                          onChange={(e) => {
                                            handleLineChange(line.localId, 'itemSearch', e.target.value);
                                            setOpenPickerId(line.localId);
                                          }}
                                          placeholder={`Search store or enter ${head.shortLabel}...`}
                                          className={inputClass}
                                        />

                                        {openPickerId === line.localId && !isLocked && (
                                          <div
                                            className={`absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-xl border shadow-xl z-30 ${
                                              isDark
                                                ? 'bg-[#0B2E33] border-white/15 text-white'
                                                : 'bg-white border-slate-200 text-slate-900'
                                            }`}
                                          >
                                            {suggestions.length === 0 ? (
                                              <div className="p-3 text-xs text-slate-400">
                                                No matching store items (custom description will be saved)
                                              </div>
                                            ) : (
                                              suggestions.map((it) => {
                                                const c = it.category_id
                                                  ? categoryMap.get(it.category_id)
                                                  : undefined;
                                                const u = it.uom_id ? uomMap.get(it.uom_id) : undefined;
                                                return (
                                                  <button
                                                    key={it.id}
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() =>
                                                      handleSelectStoreItem(line.localId, it)
                                                    }
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#2BA5B5]/15 flex items-center justify-between gap-2 cursor-pointer"
                                                  >
                                                    <div className="min-w-0">
                                                      <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] mr-1.5">
                                                        {it.sku}
                                                      </span>
                                                      <span className="font-semibold">{it.name}</span>
                                                      {c && (
                                                        <span className="text-[10px] opacity-65 ml-1.5">
                                                          ({c.name})
                                                        </span>
                                                      )}
                                                    </div>
                                                    <span className="text-[10px] font-bold opacity-80 shrink-0 tabular-nums">
                                                      {u?.code || 'PCS'} ·{' '}
                                                      {it.default_currency === 'USD' ? '$' : '৳'}
                                                      {Number(it.default_unit_cost || 0).toFixed(2)}
                                                    </span>
                                                  </button>
                                                );
                                              })
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Cost Head Switcher */}
                                      <div className="md:col-span-3">
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          Cost Head
                                        </label>
                                        <select
                                          disabled={isLocked}
                                          value={line.cost_head}
                                          onChange={(e) =>
                                            handleLineChange(
                                              line.localId,
                                              'cost_head',
                                              e.target.value as CostHeadKey
                                            )
                                          }
                                          className={inputClass}
                                        >
                                          {GARMENT_COST_HEADS.filter((h) => h.isBomHead).map((h) => (
                                            <option key={h.key} value={h.key}>
                                              {h.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Consumption */}
                                      <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          Consumption
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isLocked}
                                          value={line.consumption}
                                          onChange={(e) =>
                                            handleLineChange(line.localId, 'consumption', e.target.value)
                                          }
                                          className={`${inputClass} tabular-nums`}
                                        />
                                      </div>

                                      {/* Basis & Wastage */}
                                      <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          Basis &amp; Waste %
                                        </label>
                                        <div className="grid grid-cols-2 gap-1">
                                          <select
                                            disabled={isLocked}
                                            value={line.consumption_basis}
                                            onChange={(e) =>
                                              handleLineChange(
                                                line.localId,
                                                'consumption_basis',
                                                e.target.value as ConsumptionBasis
                                              )
                                            }
                                            className={`${inputClass} px-1.5`}
                                          >
                                            <option value="per_pc">/PC</option>
                                            <option value="per_dzn">/DZN</option>
                                          </select>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            disabled={isLocked}
                                            value={line.wastage_percent}
                                            onChange={(e) =>
                                              handleLineChange(
                                                line.localId,
                                                'wastage_percent',
                                                e.target.value
                                              )
                                            }
                                            placeholder="%"
                                            title="Wastage %"
                                            className={`${inputClass} px-2 tabular-nums`}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Rate, Currency, UOM & Dual Cost/PC + Cost/Dzn Displays */}
                                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1 items-end">
                                      <div>
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          UOM
                                        </label>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          value={line.uom}
                                          onChange={(e) =>
                                            handleLineChange(
                                              line.localId,
                                              'uom',
                                              e.target.value.toUpperCase()
                                            )
                                          }
                                          className={inputClass}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          Unit Rate
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          disabled={isLocked}
                                          value={line.unit_price}
                                          onChange={(e) =>
                                            handleLineChange(
                                              line.localId,
                                              'unit_price',
                                              e.target.value
                                            )
                                          }
                                          className={`${inputClass} tabular-nums`}
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold mb-1 opacity-75">
                                          Currency
                                        </label>
                                        <select
                                          disabled={isLocked}
                                          value={line.currency}
                                          onChange={(e) =>
                                            handleLineChange(
                                              line.localId,
                                              'currency',
                                              e.target.value as MerchCurrency
                                            )
                                          }
                                          className={inputClass}
                                        >
                                          <option value="USD">USD ($)</option>
                                          <option value="BDT">BDT (৳)</option>
                                        </select>
                                      </div>

                                      <div
                                        className={`px-2.5 py-1.5 rounded-xl border text-right tabular-nums ${
                                          isDark
                                            ? 'bg-[#0B2E33]/70 border-white/10'
                                            : 'bg-slate-50 border-slate-200'
                                        }`}
                                      >
                                        <span className="text-[9px] uppercase opacity-65 block">
                                          Total Req. Qty
                                        </span>
                                        <span className="text-xs font-extrabold">
                                          {formatNumberBD(totalRequiredQty, 2)} {line.uom}
                                        </span>
                                      </div>

                                      <div
                                        className={`px-2.5 py-1.5 rounded-xl border text-right tabular-nums ${
                                          isDark
                                            ? 'bg-[#0B2E33]/70 border-[#2BA5B5]/30'
                                            : 'bg-teal-50/70 border-teal-200'
                                        }`}
                                      >
                                        <span className="text-[9px] uppercase opacity-65 block">
                                          Cost / PC
                                        </span>
                                        <span className="text-xs font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                          ${costPerPcUsd.toFixed(3)}
                                        </span>
                                        {line.currency === 'BDT' && (
                                          <span className="text-[9px] opacity-70 block leading-tight">
                                            ৳{costPerPcOriginal.toFixed(2)}
                                          </span>
                                        )}
                                      </div>

                                      <div
                                        className={`px-2.5 py-1.5 rounded-xl border text-right tabular-nums ${
                                          isDark
                                            ? 'bg-[#0B2E33]/70 border-white/15'
                                            : 'bg-slate-50 border-slate-200'
                                        }`}
                                      >
                                        <span className="text-[9px] uppercase opacity-65 block">
                                          Cost / DZN
                                        </span>
                                        <span className="text-xs font-extrabold">
                                          ${costPerDznUsd.toFixed(2)}
                                        </span>
                                        <span className="text-[9px] opacity-65 block leading-tight">
                                          ৳{(costPerDznUsd * parsedExchangeRate).toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: 8-Head Cost Summary Card (4 cols) */}
            <div className={`xl:col-span-4 ${cardClass} space-y-4 sticky top-20`}>
              <div className="border-b border-slate-200/20 pb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">Cost Summary Card</h2>
                  <p className="text-xs font-bangla opacity-70">
                    ৮টি হেড অনুযায়ী প্রতি পিস ও প্রতি ডজন খরচের সারসংক্ষেপ
                  </p>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                  v{costingVersion}
                </span>
              </div>

              {/* All 8 Heads Breakdown Table */}
              <div className="space-y-1.5 text-xs">
                <div className="grid grid-cols-12 text-[10px] uppercase font-bold opacity-60 pb-1 border-b border-slate-200/20">
                  <span className="col-span-6">Cost Head</span>
                  <span className="col-span-3 text-right">Per PC</span>
                  <span className="col-span-3 text-right">Per DZN</span>
                </div>

                {GARMENT_COST_HEADS.map((head) => {
                  const valPc =
                    head.key === 'cm'
                      ? summary.cmCostPcUsd
                      : summary.headTotalsPcUsd[head.key as CostHeadKey] || 0;
                  const valDzn = valPc * 12;

                  return (
                    <div
                      key={head.key}
                      className="grid grid-cols-12 items-center py-1.5 border-b border-slate-200/10 tabular-nums"
                    >
                      <div className="col-span-6 pr-2">
                        <span className="font-semibold block truncate text-[11px]">
                          {head.order}. {head.shortLabel}
                        </span>
                      </div>
                      <div className="col-span-3 text-right font-bold">
                        ${valPc.toFixed(3)}
                      </div>
                      <div className="col-span-3 text-right font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        ${valDzn.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CM Cost Engine Panel */}
              <div
                className={`p-3 rounded-xl border space-y-2 ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs block">6. CM Cost / PC (USD)</span>
                    <span className="text-[10px] font-bangla opacity-70">মজুরি খরচ</span>
                  </div>
                  <div className="inline-flex rounded-lg overflow-hidden border border-[#2BA5B5]/30 text-[10px] font-bold">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => setCmMode('auto')}
                      className={`px-2 py-1 cursor-pointer disabled:cursor-not-allowed ${
                        cmMode === 'auto'
                          ? 'bg-[#0F8B8D] text-white'
                          : 'bg-transparent opacity-70'
                      }`}
                    >
                      Auto SMV
                    </button>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        if (cmMode === 'auto') {
                          setManualCmUsd(summary.autoCmUsd.toFixed(3));
                        }
                        setCmMode('manual');
                      }}
                      className={`px-2 py-1 cursor-pointer disabled:cursor-not-allowed ${
                        cmMode === 'manual'
                          ? 'bg-[#0F8B8D] text-white'
                          : 'bg-transparent opacity-70'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {cmMode === 'auto' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] opacity-70 mb-0.5">Cost/Min ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.005"
                        disabled={isLocked}
                        value={cmPerMinUsd}
                        onChange={(e) => setCmPerMinUsd(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] opacity-70 mb-0.5">Eff %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        disabled={isLocked}
                        value={efficiencyPct}
                        onChange={(e) => setEfficiencyPct(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between text-[11px] pt-1 tabular-nums">
                      <span className="opacity-70">
                        SMV {Number(selectedOrder?.smv || 0)} × ${cmPerMinUsd} ÷ {efficiencyPct}%
                      </span>
                      <span className="font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                        ${summary.cmCostPcUsd.toFixed(3)} /pc · ${(summary.cmCostPcUsd * 12).toFixed(2)} /dzn
                      </span>
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="any"
                    disabled={isLocked}
                    value={manualCmUsd}
                    onChange={(e) => setManualCmUsd(e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>

              {/* Total Cost Box (Per PC, Per DZN, Total Order) */}
              <div
                className={`p-3.5 rounded-2xl border space-y-2.5 tabular-nums ${
                  isDark
                    ? 'bg-[#0B2E33] border-[#2BA5B5]/30'
                    : 'bg-teal-50/70 border-teal-200'
                }`}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold opacity-65 block">
                      Total Cost / PC
                    </span>
                    <span className="text-base font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                      $ {summary.totalCostPcUsd.toFixed(3)}
                    </span>
                    <span className="text-[11px] font-semibold opacity-75">
                      {formatBDT(summary.totalCostPcBdt, 2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold opacity-65 block">
                      Total Cost / DZN
                    </span>
                    <span className="text-base font-extrabold block">
                      $ {summary.totalCostDznUsd.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-semibold opacity-75">
                      {formatBDT(summary.totalCostDznBdt, 2)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-300/25">
                  <div>
                    <span className="text-xs font-bold block">Total Order Cost</span>
                    <span className="text-[10px] opacity-70">
                      ({formatNumberBD(orderQty)} PCS)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold block">
                      ${' '}
                      {summary.totalOrderCostUsd.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-xs font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                      {formatBDT(summary.totalOrderCostBdt, 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Offered Selling Price (FOB) & Margin */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Offered FOB Price (/ PC in USD $){' '}
                    <span className="font-bangla opacity-70 font-normal">(বিক্রয় মূল্য)</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 text-[#0F8B8D] dark:text-[#2BA5B5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      step="any"
                      disabled={isLocked}
                      value={offeredFobUsd}
                      onChange={(e) => setOfferedFobUsd(e.target.value)}
                      className={`${inputClass} pl-8 font-extrabold text-sm tabular-nums`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] opacity-75 mt-1 tabular-nums">
                    <span>FOB / DZN: ${summary.fobDznUsd.toFixed(2)}</span>
                    <span>{formatBDT(summary.fobBdt, 2)} / PC</span>
                  </div>
                </div>

                {/* Live Net Profit & Margin Badge */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 tabular-nums ${
                    isPositiveMargin
                      ? isDark
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : isDark
                      ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                      Net Profit / PC · / DZN
                    </span>
                    <span className="text-base font-extrabold block">
                      {summary.profitPerPcUsd >= 0 ? '+' : '-'}$
                      {Math.abs(summary.profitPerPcUsd).toFixed(3)}
                      <span className="text-xs font-bold opacity-80 ml-1.5">
                        ({summary.profitPerDznUsd >= 0 ? '+' : '-'}$
                        {Math.abs(summary.profitPerDznUsd).toFixed(2)}/dzn)
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold opacity-80 block">
                      Order Profit: {summary.totalProfitUsd >= 0 ? '+' : '-'}$
                      {Math.abs(summary.totalProfitUsd).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold border ${
                        isPositiveMargin
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-rose-600 text-white border-rose-500'
                      }`}
                    >
                      {isPositiveMargin ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      <span>{summary.marginPct.toFixed(2)}%</span>
                    </span>
                    <span className="text-[10px] font-bangla block mt-1 opacity-80">
                      {isPositiveMargin ? 'লাভজনক' : 'লোকসান'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default CostingPage;
