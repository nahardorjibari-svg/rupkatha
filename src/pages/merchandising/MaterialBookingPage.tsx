import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Printer,
  Edit3,
  Trash2,
  CheckCircle2,
  Send,
  Save,
  X,
  Loader2,
  Layers,
  Filter,
  Sparkles,
  Package,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabaseClient';
import { formatNumberBD, formatStoreDate } from '../../lib/storeFormat';
import { BookingPrintView, type SignatoryInfo } from './BookingPrintView';
import type { StoreCategory, StoreItem, StoreUom } from '../../types/store';
import {
  BOOKING_SENSITIVITY_META,
  type BookingSensitivity,
  type BookingStatus,
  type BookingType,
  type Buyer,
  type MaterialBooking,
  type MaterialBookingItem,
  type MerchCurrency,
  type MerchOrder,
  type OrderColorSize,
} from '../../types/merchandising';

interface DraftBookingItem {
  localId: string;
  order_id: string;
  store_item_id: string | null;
  sensitivity: BookingSensitivity;
  item_group: string;
  item_description: string;
  gmts_color: string;
  item_color: string;
  gmts_size: string;
  item_size: string;
  order_qty: string;
  consumption: string;
  wastage_percent: string;
  uom: string;
  cone_length: string;
  cost_per_dzn: string;
  unit_rate: string;
  remarks: string;
}

const BOOKING_TYPES: { value: BookingType; label: string }[] = [
  { value: 'TRIMS', label: 'TRIMS' },
  { value: 'FABRIC', label: 'FABRIC' },
  { value: 'SEWING_THREAD', label: 'SEWING THREAD' },
  { value: 'PACKING', label: 'PACKING' },
];

const UOM_OPTIONS = ['Pcs', 'Box', 'Cones', 'Yds', 'Mtr', 'Kg', 'Dzn', 'Roll', 'Set'];
const FALLBACK_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateBookingNo(existing: MaterialBooking[]): string {
  const year = new Date().getFullYear().toString().slice(-2);
  let maxSeq = 0;
  existing.forEach((b) => {
    const m = String(b.booking_no || '').match(/(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  });
  return `RAL-TB-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

function normalizeBookingStatus(b: MaterialBooking): BookingStatus {
  const s = String(b.approval_status || b.status || 'draft').toLowerCase().trim();
  if (s === 'approved') return 'approved';
  if (s === 'submitted') return 'submitted';
  if (s === 'rejected') return 'rejected';
  return 'draft';
}

function computeLineNumbers(row: DraftBookingItem, currency: MerchCurrency, exchangeRate: number) {
  const orderQty = Math.max(0, Number(row.order_qty || 0));
  const cons = Math.max(0, Number(row.consumption || 0));
  const waste = Math.max(0, Number(row.wastage_percent || 0));
  const rate = Math.max(0, Number(row.unit_rate || 0));

  const requiredQty = orderQty * cons;
  const woQty = requiredQty * (1 + waste / 100);
  const totalAmount = woQty * rate;

  const rateUsd = currency === 'BDT' ? (exchangeRate > 0 ? rate / exchangeRate : 0) : rate;
  const autoCostDzn = cons * (1 + waste / 100) * 12 * rateUsd;
  const manualCostDzn = Number(row.cost_per_dzn || 0);
  const costPerDzn = manualCostDzn > 0 ? manualCostDzn : autoCostDzn;

  return { orderQty, cons, waste, rate, requiredQty, woQty, totalAmount, costPerDzn };
}

export const MaterialBookingPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bookings, setBookings] = useState<MaterialBooking[]>([]);
  const [orders, setOrders] = useState<MerchOrder[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [colorSizes, setColorSizes] = useState<OrderColorSize[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);
  const [signatoriesMap, setSignatoriesMap] = useState<Map<string, SignatoryInfo>>(new Map());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [buyerFilter, setBuyerFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Active Views / Modals
  const [viewingBooking, setViewingBooking] = useState<MaterialBooking | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaterialBooking | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Booking Form Header State
  const [bookingNo, setBookingNo] = useState('');
  const [bookingType, setBookingType] = useState<BookingType>('TRIMS');
  const [supplierName, setSupplierName] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [dealingMerchant, setDealingMerchant] = useState('');
  const [deliveryTo, setDeliveryTo] = useState('Rupkatha Apparels Ltd. Central Store, Hemayetpur');
  const [payMode, setPayMode] = useState('Credit');
  const [sourceType, setSourceType] = useState('Local');
  const [currency, setCurrency] = useState<MerchCurrency>('USD');
  const [exchangeRate, setExchangeRate] = useState('122');
  const [bookingDate, setBookingDate] = useState(getTodayIso());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-Job Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [showAllBuyerOrders, setShowAllBuyerOrders] = useState(false);

  // Sensitivity Item Generator Controls
  const [genSensitivity, setGenSensitivity] = useState<BookingSensitivity>('SIZE');
  const [genStoreItemId, setGenStoreItemId] = useState('');
  const [genItemGroup, setGenItemGroup] = useState('Main Label');
  const [genItemDesc, setGenItemDesc] = useState('');
  const [genItemColor, setGenItemColor] = useState('');
  const [genConsumption, setGenConsumption] = useState('1');
  const [genWastage, setGenWastage] = useState('3');
  const [genUom, setGenUom] = useState('Pcs');
  const [genConeLength, setGenConeLength] = useState('');
  const [genUnitRate, setGenUnitRate] = useState('0.025');

  // Booking Item Lines
  const [draftItems, setDraftItems] = useState<DraftBookingItem[]>([]);

  const canApproveBooking = useMemo(() => {
    const role = profile?.role;
    const perms = Array.isArray(profile?.permissions) ? profile.permissions : [];
    return (
      role === 'admin' ||
      role === 'manager' ||
      role === 'accounts' ||
      role === 'production_manager' ||
      perms.includes('accounts') ||
      perms.includes('merchandising')
    );
  }, [profile]);

  const ordersMap = useMemo(() => {
    const map = new Map<string, MerchOrder>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

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

  const colorSizesByOrder = useMemo(() => {
    const map = new Map<string, OrderColorSize[]>();
    colorSizes.forEach((cs) => {
      if (!cs.order_id) return;
      const list = map.get(cs.order_id) || [];
      list.push(cs);
      map.set(cs.order_id, list);
    });
    return map;
  }, [colorSizes]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingsRes, ordersRes, buyersRes, csRes, itemsRes, catRes, uomRes, profRes] =
        await Promise.all([
          supabase
            .from('material_bookings')
            .select('*, buyers(*), material_booking_items(*)')
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('*, buyers(*)')
            .order('created_at', { ascending: false }),
          supabase.from('buyers').select('*').eq('is_active', true).order('name'),
          supabase.from('order_color_sizes').select('*'),
          supabase
            .from('store_items')
            .select('*')
            .eq('is_active', true)
            .order('sku', { ascending: true }),
          supabase.from('store_categories').select('*'),
          supabase.from('store_uoms').select('*'),
          supabase.from('profiles').select('id, full_name, designation'),
        ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (buyersRes.error) throw buyersRes.error;

      setBookings((bookingsRes.data || []) as MaterialBooking[]);
      setOrders((ordersRes.data || []) as MerchOrder[]);
      setBuyers((buyersRes.data || []) as Buyer[]);
      if (!csRes.error) setColorSizes((csRes.data || []) as OrderColorSize[]);
      if (!itemsRes.error) setStoreItems((itemsRes.data || []) as StoreItem[]);
      if (!catRes.error) setCategories((catRes.data || []) as StoreCategory[]);
      if (!uomRes.error) setUoms((uomRes.data || []) as StoreUom[]);

      if (!profRes.error && profRes.data) {
        const sMap = new Map<string, SignatoryInfo>();
        profRes.data.forEach((p: any) => {
          sMap.set(p.id, { name: p.full_name, designation: p.designation });
        });
        setSignatoriesMap(sMap);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load material bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => {
      if (b.supplier_name?.trim()) set.add(b.supplier_name.trim());
    });
    return Array.from(set).sort();
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return bookings.filter((b) => {
      const st = normalizeBookingStatus(b);
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (supplierFilter !== 'ALL' && (b.supplier_name || '').trim() !== supplierFilter) {
        return false;
      }
      if (buyerFilter !== 'ALL' && b.buyer_id !== buyerFilter) return false;

      if (!q) return true;
      const items = b.material_booking_items || [];
      const orderMatches = items.some((it) => {
        const ord = ordersMap.get(it.order_id);
        return (
          (ord?.order_no || '').toLowerCase().includes(q) ||
          (ord?.po_no || '').toLowerCase().includes(q) ||
          (ord?.style_no || '').toLowerCase().includes(q) ||
          (it.item_description || '').toLowerCase().includes(q)
        );
      });
      return (
        (b.booking_no || '').toLowerCase().includes(q) ||
        (b.supplier_name || '').toLowerCase().includes(q) ||
        (b.buyers?.name || '').toLowerCase().includes(q) ||
        (b.dealing_merchant || '').toLowerCase().includes(q) ||
        orderMatches
      );
    });
  }, [bookings, searchTerm, supplierFilter, buyerFilter, statusFilter, ordersMap]);

  const kpis = useMemo(() => {
    let draftOrSubmitted = 0;
    let approved = 0;
    let totalUsdValue = 0;

    bookings.forEach((b) => {
      const st = normalizeBookingStatus(b);
      if (st === 'approved') approved += 1;
      else draftOrSubmitted += 1;

      const amt = (b.material_booking_items || []).reduce(
        (s, it) => s + Number(it.total_amount || 0),
        0
      );
      const exch = Number(b.exchange_rate || 122);
      totalUsdValue += b.currency === 'BDT' ? (exch > 0 ? amt / exch : 0) : amt;
    });

    return {
      total: bookings.length,
      pending: draftOrSubmitted,
      approved,
      totalUsdValue,
    };
  }, [bookings]);

  const openNewDrawer = () => {
    setEditingBookingId(null);
    setBookingNo(generateBookingNo(bookings));
    setBookingType('TRIMS');
    setSupplierName('');
    setSupplierAddress('');
    setBuyerId(buyers[0]?.id || '');
    setDealingMerchant(profile?.full_name || '');
    setDeliveryTo('Rupkatha Apparels Ltd. Central Store, Hemayetpur');
    setPayMode('Credit');
    setSourceType('Local');
    setCurrency('USD');
    setExchangeRate('122');
    setBookingDate(getTodayIso());
    setDeliveryDate('');
    setShipmentDate('');
    setRemarks('');
    setSelectedOrderIds([]);
    setShowAllBuyerOrders(false);
    setDraftItems([]);
    setDrawerOpen(true);
  };

  const openEditDrawer = (b: MaterialBooking) => {
    setEditingBookingId(b.id);
    setBookingNo(b.booking_no);
    setBookingType((b.booking_type as BookingType) || 'TRIMS');
    setSupplierName(b.supplier_name || '');
    setSupplierAddress(b.supplier_address || '');
    setBuyerId(b.buyer_id || '');
    setDealingMerchant(b.dealing_merchant || '');
    setDeliveryTo(b.delivery_to || '');
    setPayMode(b.pay_mode || 'Credit');
    setSourceType(b.source_type || 'Local');
    setCurrency((b.currency as MerchCurrency) || 'USD');
    setExchangeRate(String(Number(b.exchange_rate || 122)));
    setBookingDate(b.booking_date ? b.booking_date.slice(0, 10) : getTodayIso());
    setDeliveryDate(b.delivery_date ? b.delivery_date.slice(0, 10) : '');
    setShipmentDate(b.shipment_date ? b.shipment_date.slice(0, 10) : '');
    setRemarks(b.remarks || '');

    const existingItems = b.material_booking_items || [];
    const jobSet = new Set<string>();
    const mapped: DraftBookingItem[] = existingItems.map((it, idx) => {
      if (it.order_id) jobSet.add(it.order_id);
      return {
        localId: it.id || `${Date.now()}-${idx}`,
        order_id: it.order_id,
        store_item_id: it.store_item_id || null,
        sensitivity: (String(it.sensitivity || 'NONE').toUpperCase() as BookingSensitivity) || 'NONE',
        item_group: it.item_group || '',
        item_description: it.item_description || '',
        gmts_color: it.gmts_color || '',
        item_color: it.item_color || '',
        gmts_size: it.gmts_size || '',
        item_size: it.item_size || '',
        order_qty: String(it.order_qty ?? 0),
        consumption: String(it.consumption ?? 1),
        wastage_percent: String(it.wastage_percent ?? 0),
        uom: it.uom || 'Pcs',
        cone_length: it.cone_length ? String(it.cone_length) : '',
        cost_per_dzn: it.cost_per_dzn ? String(it.cost_per_dzn) : '',
        unit_rate: String(it.unit_rate ?? 0),
        remarks: it.remarks || '',
      };
    });

    setSelectedOrderIds(Array.from(jobSet));
    setShowAllBuyerOrders(true);
    setDraftItems(mapped);
    setDrawerOpen(true);
  };

  const visibleOrdersForPicker = useMemo(() => {
    if (showAllBuyerOrders || !buyerId) return orders;
    return orders.filter((o) => o.buyer_id === buyerId);
  }, [orders, buyerId, showAllBuyerOrders]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectGeneratorStoreItem = (itemId: string) => {
    setGenStoreItemId(itemId);
    const it = storeItems.find((s) => s.id === itemId);
    if (!it) return;
    const cat = it.category_id ? categoryMap.get(it.category_id) : undefined;
    const uom = it.uom_id ? uomMap.get(it.uom_id) : undefined;
    setGenItemGroup(cat?.name || it.item_type || 'Trims');
    setGenItemDesc(it.name);
    if (uom?.code) setGenUom(uom.code);
    setGenUnitRate(String(Number(it.default_unit_cost || 0)));
  };

  // Core Sensitivity Row Generator across all selected Jobs / POs
  const handleGenerateSensitivityRows = () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Please select at least 1 Job / PO in the Multi-Job Selector first.');
      return;
    }
    if (!genItemGroup.trim() && !genItemDesc.trim()) {
      toast.error('Enter Item Group or Item Description before generating rows.');
      return;
    }

    const groupName = genItemGroup.trim() || 'Trims';
    const descName = genItemDesc.trim() || groupName;
    const newRows: DraftBookingItem[] = [];
    let usedFallbackSizes = false;

    const makeRow = (
      orderId: string,
      gmtsColor: string,
      itemColor: string,
      gmtsSize: string,
      itemSize: string,
      qty: number
    ): DraftBookingItem => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      order_id: orderId,
      store_item_id: genStoreItemId || null,
      sensitivity: genSensitivity,
      item_group: groupName,
      item_description: descName,
      gmts_color: gmtsColor,
      item_color: itemColor,
      gmts_size: gmtsSize,
      item_size: itemSize,
      order_qty: String(qty),
      consumption: genConsumption || '1',
      wastage_percent: genWastage || '0',
      uom: genUom || 'Pcs',
      cone_length: genConeLength,
      cost_per_dzn: '',
      unit_rate: genUnitRate || '0',
      remarks: '',
    });

    selectedOrderIds.forEach((orderId) => {
      const order = ordersMap.get(orderId);
      if (!order) return;
      const csList = (colorSizesByOrder.get(orderId) || []).filter(
        (r) => Number(r.ratio_qty || 0) > 0
      );

      if (genSensitivity === 'SIZE') {
        if (csList.length > 0) {
          const bySize = new Map<string, number>();
          csList.forEach((r) => {
            bySize.set(r.size_name, (bySize.get(r.size_name) || 0) + Number(r.ratio_qty || 0));
          });
          bySize.forEach((qty, sz) => {
            newRows.push(makeRow(orderId, '', '', sz, sz, qty));
          });
        } else {
          usedFallbackSizes = true;
          FALLBACK_SIZES.forEach((sz) => {
            newRows.push(makeRow(orderId, '', '', sz, sz, 0));
          });
        }
      } else if (genSensitivity === 'COLOR_SIZE') {
        if (csList.length > 0) {
          csList.forEach((r) => {
            newRows.push(
              makeRow(
                orderId,
                r.color_name,
                r.color_name,
                r.size_name,
                r.size_name,
                Number(r.ratio_qty || 0)
              )
            );
          });
        } else {
          usedFallbackSizes = true;
          newRows.push(makeRow(orderId, 'ASSORTED', 'ASSORTED', 'ALL', 'ALL', Number(order.order_qty || 0)));
        }
      } else if (genSensitivity === 'GARMENT_COLOR') {
        if (csList.length > 0) {
          const byColor = new Map<string, number>();
          csList.forEach((r) => {
            byColor.set(r.color_name, (byColor.get(r.color_name) || 0) + Number(r.ratio_qty || 0));
          });
          byColor.forEach((qty, col) => {
            newRows.push(makeRow(orderId, col, col, '', '', qty));
          });
        } else {
          newRows.push(makeRow(orderId, 'ASSORTED', 'ASSORTED', '', '', Number(order.order_qty || 0)));
        }
      } else if (genSensitivity === 'CONTRAST_COLOR') {
        const contrastTarget = genItemColor.trim() || 'Contrast';
        if (csList.length > 0) {
          const byColor = new Map<string, number>();
          csList.forEach((r) => {
            byColor.set(r.color_name, (byColor.get(r.color_name) || 0) + Number(r.ratio_qty || 0));
          });
          byColor.forEach((qty, col) => {
            newRows.push(makeRow(orderId, col, contrastTarget, '', '', qty));
          });
        } else {
          newRows.push(makeRow(orderId, 'ASSORTED', contrastTarget, '', '', Number(order.order_qty || 0)));
        }
      } else {
        // NONE
        newRows.push(makeRow(orderId, '', '', '', '', Number(order.order_qty || 0)));
      }
    });

    if (newRows.length === 0) {
      toast.error('Could not generate rows for selected orders.');
      return;
    }

    setDraftItems((prev) => [...prev, ...newRows]);
    toast.success(
      `Added ${newRows.length} ${BOOKING_SENSITIVITY_META.find((m) => m.key === genSensitivity)?.label} row(s)!`
    );
    if (usedFallbackSizes) {
      toast('Some jobs had no Colour-Size matrix saved; default sizes were added for manual entry.', {
        icon: 'ℹ️',
      });
    }
  };

  const handleAddBlankRow = (sensitivity: BookingSensitivity) => {
    const defaultOrderId = selectedOrderIds[0] || orders[0]?.id || '';
    if (!defaultOrderId) {
      toast.error('Please select at least 1 Job / Order first.');
      return;
    }
    const order = ordersMap.get(defaultOrderId);
    setDraftItems((prev) => [
      ...prev,
      {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        order_id: defaultOrderId,
        store_item_id: null,
        sensitivity,
        item_group: genItemGroup || 'Trims',
        item_description: genItemDesc || '',
        gmts_color: '',
        item_color: '',
        gmts_size: '',
        item_size: '',
        order_qty: sensitivity === 'NONE' ? String(order?.order_qty || 0) : '0',
        consumption: '1',
        wastage_percent: '3',
        uom: 'Pcs',
        cone_length: '',
        cost_per_dzn: '',
        unit_rate: '0',
        remarks: '',
      },
    ]);
  };

  const updateDraftItem = <K extends keyof DraftBookingItem>(
    localId: string,
    field: K,
    value: DraftBookingItem[K]
  ) => {
    setDraftItems((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, [field]: value } : row))
    );
  };

  const parsedExchRate = useMemo(() => {
    const r = Number(exchangeRate);
    return Number.isFinite(r) && r > 0 ? r : 122;
  }, [exchangeRate]);

  const draftTotals = useMemo(() => {
    let totalWoQty = 0;
    let totalAmount = 0;
    draftItems.forEach((row) => {
      const calc = computeLineNumbers(row, currency, parsedExchRate);
      totalWoQty += calc.woQty;
      totalAmount += calc.totalAmount;
    });
    return { totalWoQty, totalAmount };
  }, [draftItems, currency, parsedExchRate]);

  const handleSaveBooking = async (targetStatus: BookingStatus) => {
    if (!bookingNo.trim()) {
      toast.error('Booking Number is required.');
      return;
    }
    if (!supplierName.trim()) {
      toast.error('Supplier Name is required.');
      return;
    }
    if (!buyerId) {
      toast.error('Please select a Buyer.');
      return;
    }
    if (draftItems.length === 0) {
      toast.error('Please add at least one booking item row.');
      return;
    }
    if (targetStatus === 'approved' && !canApproveBooking) {
      toast.error('Permission denied to approve bookings.');
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const actorId = user?.id || profile?.id || null;

      const headerPayload: Record<string, any> = {
        booking_no: bookingNo.trim(),
        booking_type: bookingType,
        supplier_name: supplierName.trim(),
        supplier_address: supplierAddress.trim() || null,
        buyer_id: buyerId || null,
        dealing_merchant: dealingMerchant.trim() || null,
        delivery_to: deliveryTo.trim() || null,
        pay_mode: payMode,
        source_type: sourceType,
        currency,
        exchange_rate: parsedExchRate,
        booking_date: bookingDate || getTodayIso(),
        delivery_date: deliveryDate || null,
        shipment_date: shipmentDate || null,
        status: targetStatus,
        approval_status: targetStatus,
        prepared_by: actorId,
        prepared_at: nowIso,
        checked_by: targetStatus === 'submitted' || targetStatus === 'approved' ? actorId : null,
        checked_at: targetStatus === 'submitted' || targetStatus === 'approved' ? nowIso : null,
        approved_by: targetStatus === 'approved' ? actorId : null,
        approved_at: targetStatus === 'approved' ? nowIso : null,
        remarks: remarks.trim() || null,
      };

      let targetBookingId = editingBookingId;

      if (targetBookingId) {
        const { error: updErr } = await supabase
          .from('material_bookings')
          .update(headerPayload)
          .eq('id', targetBookingId);
        if (updErr) throw updErr;

        const { error: delErr } = await supabase
          .from('material_booking_items')
          .delete()
          .eq('booking_id', targetBookingId);
        if (delErr) throw delErr;
      } else {
        const { data: insData, error: insErr } = await supabase
          .from('material_bookings')
          .insert(headerPayload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        targetBookingId = insData.id;
      }

      const itemsPayload: Omit<MaterialBookingItem, 'id' | 'created_at' | 'orders'>[] =
        draftItems.map((row) => {
          const calc = computeLineNumbers(row, currency, parsedExchRate);
          return {
            booking_id: targetBookingId!,
            order_id: row.order_id,
            store_item_id: row.store_item_id || null,
            sensitivity: row.sensitivity,
            item_group: row.item_group.trim() || 'Trims',
            item_description: row.item_description.trim() || row.item_group.trim() || 'Item',
            gmts_color: row.gmts_color.trim() || null,
            item_color: row.item_color.trim() || null,
            gmts_size: row.gmts_size.trim() || null,
            item_size: row.item_size.trim() || null,
            order_qty: calc.orderQty,
            consumption: Number(calc.cons.toFixed(4)),
            wastage_percent: Number(calc.waste.toFixed(2)),
            required_qty: Number(calc.requiredQty.toFixed(3)),
            wo_qty: Number(calc.woQty.toFixed(3)),
            uom: row.uom.trim() || 'Pcs',
            cone_length: row.cone_length ? Number(row.cone_length) : null,
            cost_per_dzn: Number(calc.costPerDzn.toFixed(4)),
            unit_rate: Number(calc.rate.toFixed(4)),
            total_amount: Number(calc.totalAmount.toFixed(2)),
            remarks: row.remarks.trim() || null,
          };
        });

      const { error: itemsErr } = await supabase
        .from('material_booking_items')
        .insert(itemsPayload);
      if (itemsErr) throw itemsErr;

      toast.success(
        targetStatus === 'approved'
          ? `Booking ${bookingNo} approved!`
          : targetStatus === 'submitted'
          ? `Booking ${bookingNo} submitted for approval!`
          : `Booking ${bookingNo} saved as Draft!`
      );
      setDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      const msg = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(msg || 'Failed to save material booking.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickApprove = async (b: MaterialBooking) => {
    if (!canApproveBooking) {
      toast.error('Approval permission required.');
      return;
    }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const actorId = user?.id || profile?.id || null;
      const { error } = await supabase
        .from('material_bookings')
        .update({
          status: 'approved',
          approval_status: 'approved',
          approved_by: actorId,
          approved_at: nowIso,
          checked_by: b.checked_by || actorId,
          checked_at: b.checked_at || nowIso,
        })
        .eq('id', b.id);
      if (error) throw error;

      toast.success(`Booking ${b.booking_no} approved!`);
      await loadData();
      if (viewingBooking && viewingBooking.id === b.id) {
        setViewingBooking((prev) =>
          prev
            ? {
                ...prev,
                status: 'approved',
                approval_status: 'approved',
                approved_by: actorId,
                approved_at: nowIso,
              }
            : null
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve booking.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBooking = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('material_booking_items').delete().eq('booking_id', deleteTarget.id);
      const { error } = await supabase
        .from('material_bookings')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;

      toast.success(`Deleted booking ${deleteTarget.booking_no}`);
      setDeleteTarget(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete booking.');
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  const cardClass = `rounded-2xl border p-5 transition-all ${
    isDark
      ? 'bg-[#103A40]/85 border-white/10 text-slate-100'
      : 'glass-card bg-white/90 border-slate-200 text-slate-900'
  }`;

  // Printable Full-Page Report Mode
  if (viewingBooking) {
    return (
      <AdminLayout>
        <BookingPrintView
          booking={viewingBooking}
          ordersMap={ordersMap}
          signatoriesMap={signatoriesMap}
          onBack={() => setViewingBooking(null)}
          canApprove={canApproveBooking}
          onApprove={handleQuickApprove}
          approving={saving}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
              <Layers className="w-6 h-6 text-[#0F8B8D] dark:text-[#2BA5B5]" />
              <span>Multi-Job Trims &amp; Material Bookings</span>
            </h1>
            <p className="text-xs font-bangla opacity-70 mt-1">
              একাধিক জব / পিও-ভিত্তিক ট্রিমস, সুইং থ্রেড, প্যাকিং ও ফেব্রিক বুকিং ওয়ার্ক-অর্ডার
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold cursor-pointer ${
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
              onClick={openNewDrawer}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">New Multi-Job Booking</span>
                <span className="block text-[10px] font-bangla opacity-85 leading-tight">
                  নতুন বুকিং তৈরি করুন
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">Total Bookings</span>
            <span className="text-2xl font-extrabold mt-1 block tabular-nums">{kpis.total}</span>
            <span className="text-[11px] font-bangla opacity-70">মোট বুকিং সংখ্যা</span>
          </div>
          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">Draft / Pending</span>
            <span className="text-2xl font-extrabold text-amber-500 mt-1 block tabular-nums">
              {kpis.pending}
            </span>
            <span className="text-[11px] font-bangla opacity-70">খসড়া ও অপেক্ষমাণ</span>
          </div>
          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">Approved</span>
            <span className="text-2xl font-extrabold text-emerald-500 mt-1 block tabular-nums">
              {kpis.approved}
            </span>
            <span className="text-[11px] font-bangla opacity-70">অনুমোদিত ওয়ার্ক-অর্ডার</span>
          </div>
          <div className={cardClass}>
            <span className="text-[11px] uppercase font-bold opacity-65 block">
              Total Value (USD Eq.)
            </span>
            <span className="text-2xl font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] mt-1 block tabular-nums">
              ${formatNumberBD(kpis.totalUsdValue, 2)}
            </span>
            <span className="text-[11px] font-bangla opacity-70">মোট বুকিং মূল্য</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className={`${cardClass} grid grid-cols-1 md:grid-cols-12 gap-3 items-end`}>
          <div className="md:col-span-5 relative">
            <label className="block text-[10px] font-bold uppercase opacity-65 mb-1">
              Search Booking / Supplier / PO / Style
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 opacity-50 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Booking #, supplier, style, PO..."
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold uppercase opacity-65 mb-1">
              <Filter className="w-3 h-3 inline mr-1" />
              Supplier
            </label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className={inputClass}
            >
              <option value="ALL">All Suppliers</option>
              {supplierOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase opacity-65 mb-1">Buyer</label>
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className={inputClass}
            >
              <option value="ALL">All Buyers</option>
              {buyers.map((by) => (
                <option key={by.id} value={by.id}>
                  {by.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase opacity-65 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputClass}
            >
              <option value="ALL">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </div>
        </div>

        {/* Register Table */}
        <div className={cardClass}>
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 opacity-70">
              <Loader2 className="w-6 h-6 animate-spin text-[#0F8B8D] dark:text-[#2BA5B5]" />
              <span className="text-xs font-semibold">Loading bookings...</span>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Package className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-bold">No Material Bookings Found</p>
              <p className="text-xs font-bangla opacity-70">
                নতুন মাল্টি-জব ট্রিমস বা ফেব্রিক বুকিং তৈরি করতে উপরের বাটনে ক্লিক করুন
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
                    <th className="py-3 px-3 font-bold">Booking #</th>
                    <th className="py-3 px-3 font-bold">Type</th>
                    <th className="py-3 px-3 font-bold">Supplier</th>
                    <th className="py-3 px-3 font-bold">Buyer</th>
                    <th className="py-3 px-3 font-bold text-center">Currency</th>
                    <th className="py-3 px-3 font-bold text-right">Total WO Qty</th>
                    <th className="py-3 px-3 font-bold text-right">Total Amount</th>
                    <th className="py-3 px-3 font-bold">Dealing Merchant</th>
                    <th className="py-3 px-3 font-bold text-center">Approval Status</th>
                    <th className="py-3 px-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/20">
                  {filteredBookings.map((b) => {
                    const items = b.material_booking_items || [];
                    const totalWo = items.reduce((s, i) => s + Number(i.wo_qty || 0), 0);
                    const totalAmt = items.reduce((s, i) => s + Number(i.total_amount || 0), 0);
                    const st = normalizeBookingStatus(b);
                    const currSym = b.currency === 'BDT' ? '৳' : '$';
                    const uniqueJobs = new Set(items.map((i) => i.order_id)).size;

                    return (
                      <tr
                        key={b.id}
                        className={`transition-colors ${
                          isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <span className="font-mono font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                            {b.booking_no}
                          </span>
                          <span className="text-[10px] opacity-65">
                            {formatStoreDate(b.booking_date)} · {uniqueJobs}{' '}
                            {uniqueJobs === 1 ? 'Job' : 'Jobs'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5]">
                            {b.booking_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold">{b.supplier_name}</td>
                        <td className="py-3 px-3">{b.buyers?.name || '-'}</td>
                        <td className="py-3 px-3 text-center font-bold">{b.currency}</td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums">
                          {formatNumberBD(totalWo, 2)}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold tabular-nums">
                          {currSym}
                          {formatNumberBD(totalAmt, 2)}
                        </td>
                        <td className="py-3 px-3">{b.dealing_merchant || '-'}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${
                              st === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                                : st === 'submitted'
                                ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                                : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                            }`}
                          >
                            {st}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingBooking(b)}
                              title="View / Print Booking Slip"
                              className="p-1.5 rounded-lg bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/25 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditDrawer(b)}
                              title="Edit Booking"
                              className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-white/10 hover:opacity-80 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {st !== 'approved' && canApproveBooking && (
                              <button
                                type="button"
                                onClick={() => handleQuickApprove(b)}
                                title="Approve Booking"
                                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(b)}
                              title="Delete Booking"
                              className="p-1.5 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* NEW / EDIT MULTI-JOB BOOKING MODAL DRAWER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
          <div
            className={`w-full max-w-[1320px] max-h-[94vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
              isDark
                ? 'bg-[#0B2E33] border-white/15 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Modal Header */}
            <div
              className={`px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0 ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">
                  {editingBookingId ? `Edit Booking — ${bookingNo}` : 'New Multi-Job Material Booking'}
                </h2>
                <p className="text-xs font-bangla opacity-70">
                  একাধিক পিও নির্বাচন করে সাইজ, কালার ও সেন্সিটিভিটি অনুযায়ী ট্রিমস ও ফেব্রিক বুকিং তৈরি করুন
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* 1. Header Metadata */}
              <div
                className={`p-4 rounded-2xl border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${
                  isDark ? 'bg-[#103A40]/60 border-white/10' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Booking # *
                  </label>
                  <input
                    type="text"
                    value={bookingNo}
                    onChange={(e) => setBookingNo(e.target.value)}
                    className={`${inputClass} font-mono font-bold`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Booking Type *
                  </label>
                  <select
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value as BookingType)}
                    className={inputClass}
                  >
                    {BOOKING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Buyer *
                  </label>
                  <select
                    value={buyerId}
                    onChange={(e) => setBuyerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">-- Select Buyer --</option>
                    {buyers.map((by) => (
                      <option key={by.id} value={by.id}>
                        {by.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Dealing Merchant
                  </label>
                  <input
                    type="text"
                    value={dealingMerchant}
                    onChange={(e) => setDealingMerchant(e.target.value)}
                    placeholder="Merchant name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Dhaka Trims & Labels Ltd."
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Supplier Address
                  </label>
                  <input
                    type="text"
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="Factory / Office address"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Delivery To
                  </label>
                  <input
                    type="text"
                    value={deliveryTo}
                    onChange={(e) => setDeliveryTo(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Pay Mode
                    </label>
                    <select
                      value={payMode}
                      onChange={(e) => setPayMode(e.target.value)}
                      className={inputClass}
                    >
                      <option value="Credit">Credit</option>
                      <option value="LC">LC</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Source
                    </label>
                    <select
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value)}
                      className={inputClass}
                    >
                      <option value="Import Local">Import Local</option>
                      <option value="Local">Local</option>
                      <option value="Direct Import">Direct Import</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as MerchCurrency)}
                      className={inputClass}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="BDT">BDT (৳)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Exch. Rate
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Booking Date
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Shipment Date
                    </label>
                    <input
                      type="date"
                      value={shipmentDate}
                      onChange={(e) => setShipmentDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                    Remarks / Special Instructions
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Supplier delivery notes, quality test requirements, etc."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 2. Multi-Job / PO Selector */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-[#103A40]/60 border-white/10' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5]">
                      Multi-Job / PO Selector ({selectedOrderIds.length} Selected)
                    </h3>
                    <p className="text-[11px] font-bangla opacity-70">
                      এই বুকিং শিটে যুক্ত করার জন্য এক বা একাধিক বায়ার অর্ডার (PO) টিক দিন
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAllBuyerOrders}
                      onChange={(e) => setShowAllBuyerOrders(e.target.checked)}
                      className="rounded accent-[#0F8B8D]"
                    />
                    <span>Show All Buyers&apos; Orders</span>
                  </label>
                </div>

                {visibleOrdersForPicker.length === 0 ? (
                  <p className="text-xs opacity-60 py-2">
                    No active orders found for this buyer. Toggle &quot;Show All Buyers&apos; Orders&quot; above.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {visibleOrdersForPicker.map((o) => {
                      const checked = selectedOrderIds.includes(o.id);
                      const csCount = (colorSizesByOrder.get(o.id) || []).length;
                      return (
                        <label
                          key={o.id}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all text-xs ${
                            checked
                              ? isDark
                                ? 'bg-[#2BA5B5]/20 border-[#2BA5B5]'
                                : 'bg-teal-50 border-[#0F8B8D]'
                              : isDark
                              ? 'bg-[#0B2E33] border-white/10 hover:border-white/25'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOrderSelection(o.id)}
                            className="mt-0.5 rounded accent-[#0F8B8D]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                                {o.order_no}
                              </span>
                              <span className="font-bold tabular-nums">
                                {formatNumberBD(o.order_qty)} PCS
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold truncate">
                              PO: {o.po_no || '-'} · Style: {o.style_no}
                            </p>
                            <p className="text-[10px] opacity-65 truncate">
                              {o.item_name} · {csCount > 0 ? `${csCount} color-size entries` : 'No matrix'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Sensitivity Item Generator */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark
                    ? 'bg-[#0B2E33]/90 border-[#2BA5B5]/30'
                    : 'bg-teal-50/50 border-teal-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#0F8B8D] dark:text-[#2BA5B5] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Sensitivity Row Generator (5 Garments Modes)</span>
                    </h3>
                    <p className="text-[11px] font-bangla opacity-75">
                      নির্বাচিত অর্ডারগুলোর কালার ও সাইজ ম্যাট্রিক্স থেকে স্বয়ংক্রিয়ভাবে বুকিং সারি তৈরি করুন
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Sensitivity Type *
                    </label>
                    <select
                      value={genSensitivity}
                      onChange={(e) => setGenSensitivity(e.target.value as BookingSensitivity)}
                      className={inputClass}
                    >
                      {BOOKING_SENSITIVITY_META.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} ({m.exampleHint})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Link Store Item (Optional)
                    </label>
                    <select
                      value={genStoreItemId}
                      onChange={(e) => handleSelectGeneratorStoreItem(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">-- Custom / Manual Item --</option>
                      {storeItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.sku} — {it.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Item Group *
                    </label>
                    <input
                      type="text"
                      value={genItemGroup}
                      onChange={(e) => setGenItemGroup(e.target.value)}
                      placeholder="e.g. Main Label"
                      className={inputClass}
                    />
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Item Description *
                    </label>
                    <input
                      type="text"
                      value={genItemDesc}
                      onChange={(e) => setGenItemDesc(e.target.value)}
                      placeholder="e.g. Woven Main Label 40mm Satin Black"
                      className={inputClass}
                    />
                  </div>

                  {genSensitivity === 'CONTRAST_COLOR' && (
                    <div className="lg:col-span-2">
                      <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                        Contrast Item Color
                      </label>
                      <input
                        type="text"
                        value={genItemColor}
                        onChange={(e) => setGenItemColor(e.target.value)}
                        placeholder="e.g. Nickel / White"
                        className={inputClass}
                      />
                    </div>
                  )}

                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Cons. / PC
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={genConsumption}
                      onChange={(e) => setGenConsumption(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Wast%
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={genWastage}
                      onChange={(e) => setGenWastage(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      UOM
                    </label>
                    <select
                      value={genUom}
                      onChange={(e) => setGenUom(e.target.value)}
                      className={inputClass}
                    >
                      {UOM_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Cone Len (Opt.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={genConeLength}
                      onChange={(e) => setGenConeLength(e.target.value)}
                      placeholder="e.g. 4000"
                      className={inputClass}
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase opacity-75 mb-1">
                      Unit Rate ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={genUnitRate}
                      onChange={(e) => setGenUnitRate(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="lg:col-span-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateSensitivityRows}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Generate Rows</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBlankRow(genSensitivity)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                        isDark
                          ? 'bg-white/5 border-white/15 hover:bg-white/10'
                          : 'bg-white border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      + Blank
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Sensitivity-Grouped Item Lines Editor */}
              <div className="space-y-4">
                {draftItems.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-300 dark:border-white/15 rounded-2xl opacity-70 text-xs">
                    Select Orders above and click &quot;Generate Rows&quot; to build the trims/material booking table.
                  </div>
                ) : (
                  BOOKING_SENSITIVITY_META.map((sensMeta) => {
                    const groupRows = draftItems.filter((r) => r.sensitivity === sensMeta.key);
                    if (groupRows.length === 0) return null;

                    let sensWoSum = 0;
                    let sensAmtSum = 0;
                    groupRows.forEach((r) => {
                      const c = computeLineNumbers(r, currency, parsedExchRate);
                      sensWoSum += c.woQty;
                      sensAmtSum += c.totalAmount;
                    });

                    return (
                      <div
                        key={sensMeta.key}
                        className={`rounded-2xl border overflow-hidden ${
                          isDark ? 'border-white/15 bg-[#103A40]/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div
                          className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
                            isDark
                              ? 'bg-[#103A40] border-white/10'
                              : 'bg-slate-100/90 border-slate-200'
                          }`}
                        >
                          <div>
                            <span className="text-xs font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                              {sensMeta.pdfHeader}
                            </span>
                            <span className="text-[10px] font-bangla opacity-70 ml-2">
                              ({sensMeta.labelBn})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
                            <span>
                              Subtotal WO: {formatNumberBD(sensWoSum, 2)} ·{' '}
                              {currency === 'BDT' ? '৳' : '$'}
                              {formatNumberBD(sensAmtSum, 2)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddBlankRow(sensMeta.key)}
                              className="px-2 py-1 rounded-lg bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] text-[10px] font-bold cursor-pointer"
                            >
                              + Row
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[11px] min-w-[1150px]">
                            <thead>
                              <tr className="border-b border-slate-200/20 opacity-75 text-[10px] uppercase">
                                <th className="p-2">Job / PO</th>
                                <th className="p-2">Item Group</th>
                                <th className="p-2">Item Description</th>
                                <th className="p-2">Gmts Color</th>
                                <th className="p-2">Item Color</th>
                                <th className="p-2">Gmts Size</th>
                                <th className="p-2">Item Size</th>
                                <th className="p-2 text-right">Order Qty</th>
                                <th className="p-2 text-right">Cons.</th>
                                <th className="p-2 text-right">Wast%</th>
                                <th className="p-2 text-right">WO Qty</th>
                                <th className="p-2">UOM</th>
                                <th className="p-2 text-right">Cone Len</th>
                                <th className="p-2 text-right">Cost/Dzn($)</th>
                                <th className="p-2 text-right">Rate</th>
                                <th className="p-2 text-right">Amount</th>
                                <th className="p-2">Remarks</th>
                                <th className="p-2 text-center">Del</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/15">
                              {groupRows.map((row) => {
                                const calc = computeLineNumbers(row, currency, parsedExchRate);
                                const cellInput = `w-full px-1.5 py-1 text-[11px] rounded-lg border ${
                                  isDark
                                    ? 'bg-[#0B2E33] border-white/15 text-white'
                                    : 'bg-white border-slate-200 text-slate-900'
                                }`;

                                return (
                                  <tr key={row.localId}>
                                    <td className="p-1.5 w-36">
                                      <select
                                        value={row.order_id}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'order_id', e.target.value)
                                        }
                                        className={cellInput}
                                      >
                                        {orders.map((o) => (
                                          <option key={o.id} value={o.id}>
                                            {o.order_no} ({o.po_no || o.style_no})
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-1.5 w-28">
                                      <input
                                        type="text"
                                        value={row.item_group}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'item_group', e.target.value)
                                        }
                                        className={cellInput}
                                      />
                                    </td>
                                    <td className="p-1.5 w-44">
                                      <input
                                        type="text"
                                        value={row.item_description}
                                        onChange={(e) =>
                                          updateDraftItem(
                                            row.localId,
                                            'item_description',
                                            e.target.value
                                          )
                                        }
                                        className={cellInput}
                                      />
                                    </td>
                                    <td className="p-1.5 w-24">
                                      <input
                                        type="text"
                                        value={row.gmts_color}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'gmts_color', e.target.value)
                                        }
                                        className={cellInput}
                                      />
                                    </td>
                                    <td className="p-1.5 w-24">
                                      <input
                                        type="text"
                                        value={row.item_color}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'item_color', e.target.value)
                                        }
                                        className={cellInput}
                                      />
                                    </td>
                                    <td className="p-1.5 w-16">
                                      <input
                                        type="text"
                                        value={row.gmts_size}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'gmts_size', e.target.value)
                                        }
                                        className={`${cellInput} text-center`}
                                      />
                                    </td>
                                    <td className="p-1.5 w-16">
                                      <input
                                        type="text"
                                        value={row.item_size}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'item_size', e.target.value)
                                        }
                                        className={`${cellInput} text-center`}
                                      />
                                    </td>
                                    <td className="p-1.5 w-20">
                                      <input
                                        type="number"
                                        min="0"
                                        value={row.order_qty}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'order_qty', e.target.value)
                                        }
                                        className={`${cellInput} text-right tabular-nums`}
                                      />
                                    </td>
                                    <td className="p-1.5 w-16">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={row.consumption}
                                        onChange={(e) =>
                                          updateDraftItem(
                                            row.localId,
                                            'consumption',
                                            e.target.value
                                          )
                                        }
                                        className={`${cellInput} text-right tabular-nums`}
                                      />
                                    </td>
                                    <td className="p-1.5 w-14">
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={row.wastage_percent}
                                        onChange={(e) =>
                                          updateDraftItem(
                                            row.localId,
                                            'wastage_percent',
                                            e.target.value
                                          )
                                        }
                                        className={`${cellInput} text-right tabular-nums`}
                                      />
                                    </td>
                                    <td className="p-1.5 text-right font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5] tabular-nums whitespace-nowrap">
                                      {formatNumberBD(calc.woQty, 2)}
                                    </td>
                                    <td className="p-1.5 w-20">
                                      <select
                                        value={row.uom}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'uom', e.target.value)
                                        }
                                        className={cellInput}
                                      >
                                        {UOM_OPTIONS.map((u) => (
                                          <option key={u} value={u}>
                                            {u}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="p-1.5 w-16">
                                      <input
                                        type="number"
                                        min="0"
                                        value={row.cone_length}
                                        onChange={(e) =>
                                          updateDraftItem(
                                            row.localId,
                                            'cone_length',
                                            e.target.value
                                          )
                                        }
                                        className={`${cellInput} text-right tabular-nums`}
                                      />
                                    </td>
                                    <td className="p-1.5 w-20">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder={calc.costPerDzn.toFixed(3)}
                                        value={row.cost_per_dzn}
                                        onChange={(e) =>
                                          updateDraftItem(
                                            row.localId,
                                            'cost_per_dzn',
                                            e.target.value
                                          )
                                        }
                                        className={`${cellInput} text-right tabular-nums`}
                                      />
                                    </td>
                                    <td className="p-1.5 w-20">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={row.unit_rate}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'unit_rate', e.target.value)
                                        }
                                        className={`${cellInput} text-right tabular-nums`}
                                      />
                                    </td>
                                    <td className="p-1.5 text-right font-extrabold tabular-nums whitespace-nowrap">
                                      {currency === 'BDT' ? '৳' : '$'}
                                      {formatNumberBD(calc.totalAmount, 2)}
                                    </td>
                                    <td className="p-1.5 w-24">
                                      <input
                                        type="text"
                                        value={row.remarks}
                                        onChange={(e) =>
                                          updateDraftItem(row.localId, 'remarks', e.target.value)
                                        }
                                        className={cellInput}
                                      />
                                    </td>
                                    <td className="p-1.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDraftItems((prev) =>
                                            prev.filter((r) => r.localId !== row.localId)
                                          )
                                        }
                                        className="p-1 text-rose-500 hover:text-rose-600 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className={`px-6 py-4 border-t flex flex-wrap items-center justify-between gap-4 shrink-0 ${
                isDark ? 'bg-[#103A40] border-white/10' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center gap-4 text-xs font-extrabold tabular-nums">
                <span>Rows: {draftItems.length}</span>
                <span>Total WO Qty: {formatNumberBD(draftTotals.totalWoQty, 2)}</span>
                <span className="text-[#0F8B8D] dark:text-[#2BA5B5] text-sm">
                  Total Amount: {currency === 'BDT' ? '৳' : '$'}
                  {formatNumberBD(draftTotals.totalAmount, 2)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className={`px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer ${
                    isDark
                      ? 'bg-white/5 border-white/15 hover:bg-white/10'
                      : 'bg-white border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveBooking('draft')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer disabled:opacity-50 ${
                    isDark
                      ? 'bg-white/10 border-white/15 hover:bg-white/15 text-white'
                      : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveBooking('submitted')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Approval</span>
                </button>

                {canApproveBooking && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveBooking('approved')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save &amp; Approve</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">Delete Material Booking?</h3>
                <p className="text-xs opacity-75 mt-1">
                  Are you sure you want to delete booking{' '}
                  <span className="font-mono font-bold">{deleteTarget.booking_no}</span> and all of
                  its line items? This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className={`px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                  isDark ? 'border-white/15 hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteBooking}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Booking</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default MaterialBookingPage;
