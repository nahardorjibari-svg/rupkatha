import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Eye,
  Edit2,
  Printer,
  CheckCircle2,
  XCircle,
  Send,
  Save,
  Trash2,
  X,
  Loader2,
  ArrowLeft,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import {
  exportStoreGrnExcel,
  exportStoreGrnPdf,
  formatBDT,
  formatNumberBD,
  formatStoreCurrency,
  formatStoreDate,
  formatStoreDateTime,
} from '../../lib/storeFormat';
import {
  canApproveGrn,
  canDeleteStoreDocument,
  canEditGrn,
  type StoreCurrency,
  type StoreGrn,
  type StoreGrnItem,
  type StoreGrnStatus,
  type StoreItem,
  type StoreUnit,
  type StoreUom,
  type StoreWarehouse,
} from '../../types/store';

interface DraftLineItem {
  localId: string;
  item_id: string;
  itemSearch: string;
  qty: string;
  unit_price: string;
  batch_no: string;
  remarks: string;
}

const createEmptyLine = (): DraftLineItem => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  item_id: '',
  itemSearch: '',
  qty: '1',
  unit_price: '0',
  batch_no: '',
  remarks: '',
});

export const StoreGrnPage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile, user } = useAuth();
  const { activeUnit } = useUnit();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUserId = user?.id || profile?.id || null;
  const allowEdit = canEditGrn(profile?.role, profile?.is_active);
  const allowApprove = canApproveGrn(profile?.role, profile?.is_active);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const [grns, setGrns] = useState<StoreGrn[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);
  const [warehouses, setWarehouses] = useState<StoreWarehouse[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [unitFilter, setUnitFilter] = useState<'all' | StoreUnit>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StoreGrnStatus>('all');

  // View / Print A4 Document mode
  const [viewingGrn, setViewingGrn] = useState<StoreGrn | null>(null);

  // Create / Edit Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGrn, setEditingGrn] = useState<StoreGrn | null>(null);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'submit' | null>(null);

  // Form fields
  const [grnDate, setGrnDate] = useState(getDhakaDateString());
  const [unit, setUnit] = useState<StoreUnit>('knit');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [poReference, setPoReference] = useState('');
  const [currency, setCurrency] = useState<StoreCurrency>('BDT');
  const [exchangeRate, setExchangeRate] = useState('1');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<DraftLineItem[]>([createEmptyLine()]);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  // Approve / Reject Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    grn: StoreGrn;
  } | null>(null);
  const [processingConfirm, setProcessingConfirm] = useState(false);

  // Delete Confirmation dialog
  const [deletingGrn, setDeletingGrn] = useState<StoreGrn | null>(null);
  const [processingDelete, setProcessingDelete] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [grnRes, itemRes, uomRes, whRes] = await Promise.all([
        supabase
          .from('store_grn')
          .select('*, store_grn_items(*)')
          .order('grn_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('store_items')
          .select('*')
          .eq('is_active', true)
          .order('sku', { ascending: true }),
        supabase.from('store_uoms').select('*'),
        supabase.from('store_warehouses').select('*').eq('is_active', true),
      ]);

      if (grnRes.error) throw grnRes.error;
      if (itemRes.error) throw itemRes.error;
      if (uomRes.error) throw uomRes.error;
      if (whRes.error) throw whRes.error;

      setGrns((grnRes.data || []) as StoreGrn[]);
      setItems((itemRes.data || []) as StoreItem[]);
      setUoms((uomRes.data || []) as StoreUom[]);
      setWarehouses((whRes.data || []) as StoreWarehouse[]);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load GRN records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync top unit filter if knit/woven
  useEffect(() => {
    if (activeUnit === 'knit' || activeUnit === 'woven') {
      setUnitFilter(activeUnit);
    } else {
      setUnitFilter('all');
    }
  }, [activeUnit]);

  const defaultWarehouse = useMemo(() => {
    return (
      warehouses.find((w) => w.code === 'MAIN-STORE') ||
      warehouses[0] ||
      null
    );
  }, [warehouses]);

  const itemMap = useMemo(() => {
    const map = new Map<string, StoreItem>();
    items.forEach((it) => map.set(it.id, it));
    return map;
  }, [items]);

  const uomMap = useMemo(() => {
    const map = new Map<string, StoreUom>();
    uoms.forEach((u) => map.set(u.id, u));
    return map;
  }, [uoms]);

  const warehouseMap = useMemo(() => {
    const map = new Map<string, StoreWarehouse>();
    warehouses.forEach((w) => map.set(w.id, w));
    return map;
  }, [warehouses]);

  const calcGrnTotals = useCallback((grn: StoreGrn) => {
    const lineList = grn.store_grn_items || [];
    const totalOriginal = lineList.reduce(
      (sum, l) => sum + Number(l.qty || 0) * Number(l.unit_price || 0),
      0
    );
    const rate = grn.currency === 'USD' ? Number(grn.exchange_rate || 1) : 1;
    const totalBdt = totalOriginal * rate;
    return { totalOriginal, totalBdt };
  }, []);

  const openNewDrawer = useCallback(() => {
    if (!allowEdit) return;
    setEditingGrn(null);
    setGrnDate(getDhakaDateString());
    setUnit(activeUnit === 'woven' ? 'woven' : 'knit');
    setWarehouseId(defaultWarehouse?.id || '');
    setSupplierName('');
    setChallanNo('');
    setPoReference('');
    setCurrency('BDT');
    setExchangeRate('1');
    setRemarks('');
    setLines([createEmptyLine()]);
    setOpenPickerId(null);
    setDrawerOpen(true);
  }, [allowEdit, activeUnit, defaultWarehouse]);

  // Handle ?new=1 query parameter
  useEffect(() => {
    if (searchParams.get('new') === '1' && !loading) {
      if (allowEdit) {
        openNewDrawer();
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, loading, allowEdit, openNewDrawer, setSearchParams]);

  const openEditDrawer = (grn: StoreGrn) => {
    if (!allowEdit) return;
    if (grn.status === 'approved' || grn.status === 'submitted') {
      toast.error('Submitted or approved GRNs cannot be edited.');
      return;
    }

    setEditingGrn(grn);
    setGrnDate(grn.grn_date || getDhakaDateString());
    setUnit(grn.unit || 'knit');
    setWarehouseId(grn.warehouse_id || defaultWarehouse?.id || '');
    setSupplierName(grn.supplier_name || '');
    setChallanNo(grn.challan_no || '');
    setPoReference(grn.po_reference || '');
    setCurrency(grn.currency === 'USD' ? 'USD' : 'BDT');
    setExchangeRate(String(grn.exchange_rate ?? 1));
    setRemarks(grn.remarks || '');

    const existingLines = (grn.store_grn_items || []).map((li) => {
      const it = itemMap.get(li.item_id);
      return {
        localId: li.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item_id: li.item_id,
        itemSearch: it ? `${it.sku} — ${it.name}` : li.item_id,
        qty: String(li.qty ?? 0),
        unit_price: String(li.unit_price ?? 0),
        batch_no: li.batch_no || '',
        remarks: li.remarks || '',
      };
    });

    setLines(existingLines.length > 0 ? existingLines : [createEmptyLine()]);
    setOpenPickerId(null);
    setDrawerOpen(true);
  };

  // Filtered GRNs
  const filteredGrns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grns.filter((g) => {
      if (q) {
        const matchNo = (g.grn_no || '').toLowerCase().includes(q);
        const matchSup = (g.supplier_name || '').toLowerCase().includes(q);
        const matchChallan = (g.challan_no || '').toLowerCase().includes(q);
        const matchPo = (g.po_reference || '').toLowerCase().includes(q);
        if (!matchNo && !matchSup && !matchChallan && !matchPo) return false;
      }
      if (dateFrom && g.grn_date < dateFrom) return false;
      if (dateTo && g.grn_date > dateTo) return false;
      if (unitFilter !== 'all' && g.unit !== unitFilter) return false;
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      return true;
    });
  }, [grns, search, dateFrom, dateTo, unitFilter, statusFilter]);

  // Running totals inside Form Drawer
  const draftTotals = useMemo(() => {
    const original = lines.reduce((sum, l) => {
      const q = Number(l.qty || 0);
      const p = Number(l.unit_price || 0);
      return sum + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
    }, 0);
    const rate = currency === 'USD' ? Math.max(0, Number(exchangeRate || 1)) : 1;
    const bdt = original * rate;
    return { original, bdt };
  }, [lines, currency, exchangeRate]);

  const handleSelectItemForLine = (localId: string, item: StoreItem) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;
        return {
          ...line,
          item_id: item.id,
          itemSearch: `${item.sku} — ${item.name}`,
          unit_price:
            Number(line.unit_price) > 0
              ? line.unit_price
              : String(item.default_unit_cost ?? 0),
        };
      })
    );
    setOpenPickerId(null);
  };

  const handleLineChange = (
    localId: string,
    field: keyof DraftLineItem,
    value: string
  ) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;
        if (field === 'itemSearch') {
          return { ...line, itemSearch: value, item_id: '' };
        }
        return { ...line, [field]: value };
      })
    );
  };

  const persistGrn = async (action: 'draft' | 'submit') => {
    if (!allowEdit) {
      toast.error('You do not have permission to create or edit GRNs.');
      return;
    }

    if (!supplierName.trim()) {
      toast.error('Supplier name is required.');
      return;
    }

    const activeWarehouseId = warehouseId || defaultWarehouse?.id;
    if (!activeWarehouseId) {
      toast.error('MAIN-STORE warehouse not found.');
      return;
    }

    const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
    if (validLines.length === 0) {
      toast.error('Please add at least one valid item with quantity > 0.');
      return;
    }

    const parsedRate = currency === 'USD' ? Number(exchangeRate || 1) : 1;
    if (currency === 'USD' && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
      toast.error('Exchange rate must be greater than 0 for USD.');
      return;
    }

    setSubmittingAction(action);
    try {
      let targetGrnId = editingGrn?.id;

      if (!editingGrn) {
        // Generate GRN number via RPC store_next_no('grn')
        const { data: nextNo, error: noErr } = await supabase.rpc('store_next_no', {
          p_kind: 'grn',
        });
        if (noErr) throw noErr;
        if (!nextNo) throw new Error('Failed to generate GRN number.');

        const { data: insertedGrn, error: insertErr } = await supabase
          .from('store_grn')
          .insert({
            grn_no: String(nextNo),
            grn_date: grnDate,
            warehouse_id: activeWarehouseId,
            unit,
            supplier_name: supplierName.trim(),
            challan_no: challanNo.trim() || null,
            po_reference: poReference.trim() || null,
            currency,
            exchange_rate: parsedRate,
            remarks: remarks.trim() || null,
            status: 'draft',
            ...(currentUserId ? { created_by: currentUserId } : {}),
            created_by_name: profile?.full_name || null,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        targetGrnId = insertedGrn.id;
      } else {
        const { error: updateErr } = await supabase
          .from('store_grn')
          .update({
            grn_date: grnDate,
            warehouse_id: activeWarehouseId,
            unit,
            supplier_name: supplierName.trim(),
            challan_no: challanNo.trim() || null,
            po_reference: poReference.trim() || null,
            currency,
            exchange_rate: parsedRate,
            remarks: remarks.trim() || null,
          })
          .eq('id', editingGrn.id);

        if (updateErr) throw updateErr;

        // Replace items
        const { error: delErr } = await supabase
          .from('store_grn_items')
          .delete()
          .eq('grn_id', editingGrn.id);
        if (delErr) throw delErr;
      }

      if (!targetGrnId) throw new Error('GRN ID missing after save.');

      const itemsPayload: Omit<StoreGrnItem, 'id'>[] = validLines.map((l) => ({
        grn_id: targetGrnId!,
        item_id: l.item_id,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price || 0),
        batch_no: l.batch_no.trim() || null,
        remarks: l.remarks.trim() || null,
      }));

      const { error: linesErr } = await supabase
        .from('store_grn_items')
        .insert(itemsPayload);
      if (linesErr) throw linesErr;

      if (action === 'submit') {
        const { error: submitErr } = await supabase.rpc('store_submit', {
          p_kind: 'grn',
          p_id: targetGrnId,
        });
        if (submitErr) throw submitErr;
        toast.success('GRN submitted for approval.');
      } else {
        toast.success('GRN draft saved.');
      }

      setDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save GRN.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmApproveReject = async () => {
    if (!confirmAction || !allowApprove) return;
    setProcessingConfirm(true);
    try {
      if (confirmAction.type === 'approve') {
        const { error } = await supabase.rpc('store_approve_grn', {
          p_grn_id: confirmAction.grn.id,
        });
        if (error) throw error;
        toast.success(`GRN ${confirmAction.grn.grn_no} approved.`);
      } else {
        const { error } = await supabase.rpc('store_reject', {
          p_kind: 'grn',
          p_id: confirmAction.grn.id,
        });
        if (error) throw error;
        toast.success(`GRN ${confirmAction.grn.grn_no} rejected.`);
      }

      setConfirmAction(null);
      await loadData();

      // Refresh viewingGrn if currently open
      if (viewingGrn && viewingGrn.id === confirmAction.grn.id) {
        const { data } = await supabase
          .from('store_grn')
          .select('*, store_grn_items(*)')
          .eq('id', confirmAction.grn.id)
          .single();
        if (data) setViewingGrn(data as StoreGrn);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Approval action failed.');
    } finally {
      setProcessingConfirm(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingGrn) return;
    if (deletingGrn.status === 'approved' || deletingGrn.status === 'submitted') {
      toast.error('Submitted or approved documents cannot be deleted.');
      setDeletingGrn(null);
      return;
    }

    setProcessingDelete(true);
    try {
      const { error } = await supabase
        .from('store_grn')
        .delete()
        .eq('id', deletingGrn.id);

      if (error) throw error;

      toast.success('GRN deleted');
      setDeletingGrn(null);
      await loadData();
    } catch (err: any) {
      const dbError = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbError || 'Failed to delete GRN.');
    } finally {
      setProcessingDelete(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const exportRows = filteredGrns.map((grn) => ({
        grn,
        ...calcGrnTotals(grn),
      }));
      await exportStoreGrnExcel(exportRows, getDhakaDateString());
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
      const exportRows = filteredGrns.map((grn) => ({
        grn,
        ...calcGrnTotals(grn),
      }));
      await exportStoreGrnPdf(exportRows, getDhakaDateString());
      toast.success('PDF downloaded.');
    } catch (err: any) {
      toast.error(err?.message || 'PDF export failed.');
    } finally {
      setExporting(null);
    }
  };

  const renderStatusBadge = (status: StoreGrnStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            Approved
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Submitted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30">
            Draft
          </span>
        );
    }
  };

  const inputClass = `w-full px-3 py-2 text-xs rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-[#2BA5B5] ${
    isDark
      ? 'bg-[#0B2E33] border-white/15 text-white placeholder:text-slate-400'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  }`;

  // =========================================================================
  // VIEW / PRINT A4 GRN DOCUMENT VIEW (rendered outside [role="dialog"] for print)
  // =========================================================================
  if (viewingGrn) {
    const { totalOriginal, totalBdt } = calcGrnTotals(viewingGrn);
    const wh = warehouseMap.get(viewingGrn.warehouse_id);
    const lineList = viewingGrn.store_grn_items || [];

    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Toolbar (hidden in print) */}
          <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewingGrn(null)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">Back to GRN List</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  তালিকায় ফিরে যান
                </span>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {allowApprove && viewingGrn.status === 'submitted' && (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'approve', grn: viewingGrn })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <div className="text-left">
                      <span className="block leading-tight">Approve</span>
                      <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                        অনুমোদন করুন
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'reject', grn: viewingGrn })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <div className="text-left">
                      <span className="block leading-tight">Reject</span>
                      <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                        প্রত্যাখ্যান করুন
                      </span>
                    </div>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <div className="text-left">
                  <span className="block leading-tight">Print A4 GRN</span>
                  <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                    প্রিন্ট করুন
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Formatted A4 Printable Sheet */}
          <div className="job-card-paper max-w-[210mm] mx-auto bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 print:rounded-none print:border-none print:shadow-none print:p-0">
            {/* Company Header */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  RUPKATHA APPARELS LTD.
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Raj place, Rishipara, Padma mor, Hemayetpur, Dhaka, Bangladesh
                </p>
                <p className="text-[11px] font-bangla text-slate-500 mt-0.5">
                  রূপকথা অ্যাপারেলস লিমিটেড · নিট ও উভেন গার্মেন্টস ম্যানুফ্যাকচারার
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm font-extrabold uppercase tracking-wider text-[#0F8B8D]">
                  Goods Received Note (GRN)
                </p>
                <p className="text-xs font-bangla text-slate-600">মালামাল গ্রহণ রসিদ</p>
                <p className="text-sm font-mono font-bold mt-1">{viewingGrn.grn_no}</p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6 border border-slate-300 rounded-xl p-3.5 bg-slate-50/70 print:bg-white">
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">GRN Date</span>
                <span className="font-semibold">{formatStoreDate(viewingGrn.grn_date)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Unit</span>
                <span className="font-semibold uppercase">{viewingGrn.unit}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Warehouse</span>
                <span className="font-semibold">{wh ? `${wh.name} (${wh.code})` : 'MAIN-STORE'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Status</span>
                <span className="font-bold uppercase">{viewingGrn.status}</span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Supplier Name</span>
                <span className="font-bold">{viewingGrn.supplier_name}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Challan No</span>
                <span className="font-semibold">{viewingGrn.challan_no || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">PO Reference</span>
                <span className="font-semibold">{viewingGrn.po_reference || '-'}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Currency</span>
                <span className="font-semibold">
                  {viewingGrn.currency}
                  {viewingGrn.currency === 'USD' ? ` (Rate: ৳${viewingGrn.exchange_rate})` : ''}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Prepared By</span>
                <span className="font-semibold">{viewingGrn.created_by_name || '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Approved By</span>
                <span className="font-semibold">
                  {viewingGrn.approved_by_name
                    ? `${viewingGrn.approved_by_name} (${formatStoreDateTime(viewingGrn.approved_at)})`
                    : '-'}
                </span>
              </div>

              {viewingGrn.remarks && (
                <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-2">
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">Remarks</span>
                  <span>{viewingGrn.remarks}</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <table className="w-full border-collapse text-xs mb-5">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border border-slate-300">
                  <th className="py-2 px-2.5 border border-slate-300 text-center w-10">SL</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-left">SKU</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-left">Item Description</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-center">UOM</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-left">Batch No</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-right">Qty</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-right">
                    Unit Price ({viewingGrn.currency})
                  </th>
                  <th className="py-2 px-2.5 border border-slate-300 text-right">
                    Total ({viewingGrn.currency})
                  </th>
                  <th className="py-2 px-2.5 border border-slate-300 text-right">Value (BDT ৳)</th>
                </tr>
              </thead>
              <tbody>
                {lineList.map((line, idx) => {
                  const item = itemMap.get(line.item_id);
                  const uom = item?.uom_id ? uomMap.get(item.uom_id) : undefined;
                  const lineTotal = Number(line.qty || 0) * Number(line.unit_price || 0);
                  const rate = viewingGrn.currency === 'USD' ? Number(viewingGrn.exchange_rate || 1) : 1;
                  const lineBdt = lineTotal * rate;

                  return (
                    <tr key={line.id || idx} className="border border-slate-300">
                      <td className="py-2 px-2.5 border border-slate-300 text-center">{idx + 1}</td>
                      <td className="py-2 px-2.5 border border-slate-300 font-mono">{item?.sku || '-'}</td>
                      <td className="py-2 px-2.5 border border-slate-300">
                        <span className="font-semibold block">{item?.name || line.item_id}</span>
                        {item?.name_bn && (
                          <span className="text-[10px] font-bangla text-slate-600 block">
                            {item.name_bn}
                          </span>
                        )}
                        {line.remarks && (
                          <span className="text-[10px] text-slate-500 block">Note: {line.remarks}</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-center">{uom?.code || '-'}</td>
                      <td className="py-2 px-2.5 border border-slate-300">{line.batch_no || '-'}</td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-semibold">
                        {formatNumberBD(line.qty, 2)}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right">
                        {formatStoreCurrency(line.unit_price, viewingGrn.currency, 2)}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-semibold">
                        {formatStoreCurrency(lineTotal, viewingGrn.currency, 2)}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-bold">
                        {formatBDT(lineBdt, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border border-slate-300">
                  <td colSpan={7} className="py-2.5 px-3 border border-slate-300 text-right uppercase">
                    Grand Total
                  </td>
                  <td className="py-2.5 px-2.5 border border-slate-300 text-right">
                    {formatStoreCurrency(totalOriginal, viewingGrn.currency, 2)}
                  </td>
                  <td className="py-2.5 px-2.5 border border-slate-300 text-right text-[#0F8B8D]">
                    {formatBDT(totalBdt, 2)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signature Boxes */}
            <div className="grid grid-cols-3 gap-6 pt-12 mt-8 text-xs text-center">
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-bold">Prepared by</div>
                <p className="text-[10px] font-bangla text-slate-500">প্রস্তুতকারী</p>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-bold">Store Manager</div>
                <p className="text-[10px] font-bangla text-slate-500">স্টোর ম্যানেজার</p>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-bold">Accounts</div>
                <p className="text-[10px] font-bangla text-slate-500">হিসাব বিভাগ</p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm Approve / Reject Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs print:hidden">
            <div
              className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
                isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <h3 className="text-lg font-extrabold">
                {confirmAction.type === 'approve' ? 'Approve GRN?' : 'Reject GRN?'}
              </h3>
              <p className="text-xs font-bangla opacity-70 mt-0.5">
                {confirmAction.type === 'approve'
                  ? 'আপনি কি এই জিআরএনটি অনুমোদন করতে চান?'
                  : 'আপনি কি এই জিআরএনটি প্রত্যাখ্যান করতে চান?'}
              </p>
              <p className="text-xs mt-3 opacity-85">
                GRN <strong>{confirmAction.grn.grn_no}</strong> ({confirmAction.grn.supplier_name}).
                {confirmAction.type === 'approve'
                  ? ' Stock balances will be updated upon approval.'
                  : ' Rejected GRNs can be edited and resubmitted.'}
              </p>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={processingConfirm}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproveReject}
                  disabled={processingConfirm}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                    confirmAction.type === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {processingConfirm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{confirmAction.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    );
  }

  // =========================================================================
  // MAIN GRN LIST VIEW
  // =========================================================================
  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Stock In — Goods Received Notes (GRN)
            </h1>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              স্টক ইন (জিআরএন) — মালামাল গ্রহণ, খসড়া, অনুমোদন ও প্রিন্ট ব্যবস্থাপনা
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting !== null || filteredGrns.length === 0}
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
                  এক্সেল
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting !== null || filteredGrns.length === 0}
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
                  পিডিএফ
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

            {allowEdit && (
              <button
                type="button"
                onClick={openNewDrawer}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md shadow-[#0F8B8D]/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <div className="text-left">
                  <span className="block leading-tight">New GRN</span>
                  <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                    নতুন জিআরএন
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search GRN No, Supplier, Challan..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="lg:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From Date"
              className={inputClass}
            />
          </div>

          <div className="lg:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To Date"
              className={inputClass}
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value as any)}
              className={inputClass}
            >
              <option value="all">All Units (সব ইউনিট)</option>
              <option value="knit">Knit (নিট)</option>
              <option value="woven">Woven (উভেন)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className={inputClass}
            >
              <option value="all">All Status (সব অবস্থা)</option>
              <option value="draft">Draft (খসড়া)</option>
              <option value="submitted">Submitted (জমাকৃত)</option>
              <option value="approved">Approved (অনুমোদিত)</option>
              <option value="rejected">Rejected (প্রত্যাখ্যাত)</option>
            </select>
          </div>
        </div>

        {/* GRN Table */}
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
                    <span className="block font-bold">GRN No</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">জিআরএন নং</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Date</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">তারিখ</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Supplier</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">সরবরাহকারী</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Challan</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">চালান নং</span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Unit</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">ইউনিট</span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Total Value (৳)</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">মোট মূল্য</span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">Status</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">অবস্থা</span>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <span className="block font-bold">Actions</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">অ্যাকশন</span>
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-slate-100'}`}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="py-4 px-4">
                        <div className="h-5 rounded bg-slate-200/50 dark:bg-white/10 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredGrns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <ClipboardList className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No GRN records found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো জিআরএন তথ্য পাওয়া যায়নি
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredGrns.map((grn) => {
                    const { totalBdt, totalOriginal } = calcGrnTotals(grn);
                    const canEditThis =
                      allowEdit && (grn.status === 'draft' || grn.status === 'rejected');
                    const canDeleteThis = canDeleteStoreDocument(
                      profile?.role,
                      profile?.is_active,
                      grn.status,
                      grn.created_by,
                      currentUserId
                    );
                    const canApproveThis = allowApprove && grn.status === 'submitted';

                    return (
                      <tr
                        key={grn.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5]">
                          {grn.grn_no}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {formatStoreDate(grn.grn_date)}
                        </td>
                        <td className="py-3 px-3 font-semibold">{grn.supplier_name}</td>
                        <td className="py-3 px-3">{grn.challan_no || '-'}</td>
                        <td className="py-3 px-3">
                          <span className="uppercase text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-200/60 dark:bg-white/10">
                            {grn.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold block">{formatBDT(totalBdt, 2)}</span>
                          {grn.currency === 'USD' && (
                            <span className="text-[10px] opacity-70 block">
                              ({formatStoreCurrency(totalOriginal, 'USD', 2)})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderStatusBadge(grn.status)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingGrn(grn)}
                              title="View / Print GRN"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300/60 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            {canEditThis && (
                              <button
                                type="button"
                                onClick={() => openEditDrawer(grn)}
                                title="Edit GRN"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-[#2BA5B5]/30 bg-[#2BA5B5]/10 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/20 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}

                            {canDeleteThis && (
                              <button
                                type="button"
                                onClick={() => setDeletingGrn(grn)}
                                title="Delete GRN"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <div className="text-left leading-none">
                                  <span className="block">Delete</span>
                                  <span className="block text-[9px] font-bangla opacity-70 mt-0.5">
                                    মুছুন
                                  </span>
                                </div>
                              </button>
                            )}

                            {canApproveThis && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'approve', grn })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'reject', grn })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
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

      {/* Create / Edit GRN Slide-Over Drawer */}
      {drawerOpen && allowEdit && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            onClick={() => !submittingAction && setDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
          />
          <div
            className={`relative z-10 w-full max-w-4xl h-full overflow-y-auto shadow-2xl border-l flex flex-col ${
              isDark
                ? 'bg-[#103A40] border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="p-5 border-b border-slate-200/20 flex items-center justify-between sticky top-0 z-20 bg-inherit">
              <div>
                <h2 className="text-lg font-extrabold">
                  {editingGrn ? `Edit GRN — ${editingGrn.grn_no}` : 'Create New GRN'}
                </h2>
                <p className="text-xs font-bangla opacity-70">
                  {editingGrn
                    ? 'জিআরএন তথ্য সংশোধন ও পুনরায় জমা দিন'
                    : 'নতুন মালামাল গ্রহণ রসিদ (জিআরএন) তৈরি করুন'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submittingAction && setDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    GRN No <span className="font-bangla opacity-70 font-normal">(নম্বর)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={editingGrn ? editingGrn.grn_no : 'Auto-generated on save'}
                    className={`${inputClass} opacity-75 cursor-not-allowed`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    GRN Date * <span className="font-bangla opacity-70 font-normal">(তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Unit * <span className="font-bangla opacity-70 font-normal">(ইউনিট)</span>
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as StoreUnit)}
                    className={inputClass}
                  >
                    <option value="knit">Knit (নিট)</option>
                    <option value="woven">Woven (উভেন)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Warehouse <span className="font-bangla opacity-70 font-normal">(গুদাম)</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className={inputClass}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold mb-1">
                    Supplier Name *{' '}
                    <span className="font-bangla opacity-70 font-normal">(সরবরাহকারী)</span>
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Supplier company name"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Challan No{' '}
                    <span className="font-bangla opacity-70 font-normal">(চালান নং)</span>
                  </label>
                  <input
                    type="text"
                    value={challanNo}
                    onChange={(e) => setChallanNo(e.target.value)}
                    placeholder="CH-001"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    PO Reference{' '}
                    <span className="font-bangla opacity-70 font-normal">(পিও রেফারেন্স)</span>
                  </label>
                  <input
                    type="text"
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    placeholder="PO-2026-01"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Currency <span className="font-bangla opacity-70 font-normal">(মুদ্রা)</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      const val = e.target.value as StoreCurrency;
                      setCurrency(val);
                      if (val === 'BDT') setExchangeRate('1');
                    }}
                    className={inputClass}
                  >
                    <option value="BDT">BDT (৳)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                {currency === 'USD' && (
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Exchange Rate (1 USD = ৳){' '}
                      <span className="font-bangla opacity-70 font-normal">(বিনিময় হার)</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                <div className={currency === 'USD' ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-bold mb-1">
                    Remarks <span className="font-bangla opacity-70 font-normal">(মন্তব্য)</span>
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Line Items</h3>
                    <p className="text-[11px] font-bangla opacity-70">
                      গ্রহণের জন্য পণ্যের তালিকা (এসকেইউ বা নাম দিয়ে খুঁজুন)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, createEmptyLine()])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line</span>
                    <span className="font-bangla opacity-70 text-[10px]">(নতুন সারি)</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lines.map((line, index) => {
                    const query = line.itemSearch.trim().toLowerCase();
                    const suggestions = items
                      .filter((it) => {
                        if (!query) return true;
                        return (
                          it.sku.toLowerCase().includes(query) ||
                          it.name.toLowerCase().includes(query) ||
                          (it.name_bn || '').toLowerCase().includes(query)
                        );
                      })
                      .slice(0, 12);

                    const selectedItem = line.item_id ? itemMap.get(line.item_id) : undefined;
                    const selectedUom = selectedItem?.uom_id
                      ? uomMap.get(selectedItem.uom_id)
                      : undefined;
                    const lineTotal = Number(line.qty || 0) * Number(line.unit_price || 0);

                    return (
                      <div
                        key={line.localId}
                        className={`p-3 rounded-2xl border space-y-2.5 ${
                          isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                            Item #{index + 1}
                            {selectedUom ? ` · UOM: ${selectedUom.code}` : ''}
                          </span>
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.filter((item) => item.localId !== line.localId)
                                )
                              }
                              className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                          {/* Searchable Item Picker */}
                          <div className="md:col-span-5 relative">
                            <label className="block text-[10px] font-bold mb-1 opacity-75">
                              Item (SKU / Name) *
                            </label>
                            <input
                              type="text"
                              value={line.itemSearch}
                              onFocus={() => setOpenPickerId(line.localId)}
                              onChange={(e) => {
                                handleLineChange(line.localId, 'itemSearch', e.target.value);
                                setOpenPickerId(line.localId);
                              }}
                              placeholder="Type SKU or item name..."
                              className={inputClass}
                            />

                            {openPickerId === line.localId && (
                              <div
                                className={`absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-xl z-30 ${
                                  isDark
                                    ? 'bg-[#0B2E33] border-white/15 text-white'
                                    : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              >
                                {suggestions.length === 0 ? (
                                  <div className="p-3 text-xs text-slate-400">
                                    No matching items
                                  </div>
                                ) : (
                                  suggestions.map((it) => {
                                    const u = it.uom_id ? uomMap.get(it.uom_id) : undefined;
                                    return (
                                      <button
                                        key={it.id}
                                        type="button"
                                        onClick={() => handleSelectItemForLine(line.localId, it)}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#2BA5B5]/15 flex items-center justify-between gap-2 cursor-pointer"
                                      >
                                        <div className="min-w-0">
                                          <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] mr-1.5">
                                            {it.sku}
                                          </span>
                                          <span className="font-semibold">{it.name}</span>
                                        </div>
                                        <span className="text-[10px] opacity-70 shrink-0">
                                          {u?.code || ''}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold mb-1 opacity-75">
                              Qty *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={line.qty}
                              onChange={(e) => handleLineChange(line.localId, 'qty', e.target.value)}
                              className={inputClass}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold mb-1 opacity-75">
                              Unit Price ({currency})
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) =>
                                handleLineChange(line.localId, 'unit_price', e.target.value)
                              }
                              className={inputClass}
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold mb-1 opacity-75">
                              Batch No
                            </label>
                            <input
                              type="text"
                              value={line.batch_no}
                              onChange={(e) =>
                                handleLineChange(line.localId, 'batch_no', e.target.value)
                              }
                              placeholder="Batch / Lot"
                              className={inputClass}
                            />
                          </div>

                          <div className="md:col-span-9">
                            <input
                              type="text"
                              value={line.remarks}
                              onChange={(e) =>
                                handleLineChange(line.localId, 'remarks', e.target.value)
                              }
                              placeholder="Line item remarks (optional)..."
                              className={inputClass}
                            />
                          </div>

                          <div className="md:col-span-3 flex items-center justify-end text-xs font-bold">
                            Subtotal: {formatStoreCurrency(lineTotal, currency, 2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Running Totals Box */}
              <div
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-[#0B2E33]/80 border-[#2BA5B5]/30'
                    : 'bg-teal-50/70 border-teal-200'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">Running Total</span>
                  <span className="text-[11px] font-bangla opacity-70 block">
                    মোট হিসাব ({currency} এবং টাকা)
                  </span>
                </div>
                <div className="text-left sm:text-right">
                  {currency === 'USD' && (
                    <span className="text-sm font-bold block text-slate-500 dark:text-slate-300">
                      Original: {formatStoreCurrency(draftTotals.original, 'USD', 2)}
                    </span>
                  )}
                  <span className="text-xl font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                    {formatBDT(draftTotals.bdt, 2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-200/20 flex flex-wrap items-center justify-end gap-2.5 sticky bottom-0 z-20 bg-inherit">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                disabled={submittingAction !== null}
                className="px-4 py-2 rounded-2xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
              >
                <span>Cancel</span>
                <span className="block text-[10px] font-bangla opacity-70">বাতিল</span>
              </button>

              <button
                type="button"
                onClick={() => persistGrn('draft')}
                disabled={submittingAction !== null}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer disabled:opacity-50 ${
                  isDark
                    ? 'bg-white/10 border-white/20 hover:bg-white/15 text-white'
                    : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800'
                }`}
              >
                {submittingAction === 'draft' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <div className="text-left">
                  <span className="block leading-tight">Save Draft</span>
                  <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                    খসড়া সংরক্ষণ
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => persistGrn('submit')}
                disabled={submittingAction !== null}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {submittingAction === 'submit' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <div className="text-left">
                  <span className="block leading-tight">Submit for Approval</span>
                  <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                    অনুমোদনের জন্য জমা দিন
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Approve / Reject Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <h3 className="text-lg font-extrabold">
              {confirmAction.type === 'approve' ? 'Approve GRN?' : 'Reject GRN?'}
            </h3>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              {confirmAction.type === 'approve'
                ? 'আপনি কি এই জিআরএনটি অনুমোদন করতে চান?'
                : 'আপনি কি এই জিআরএনটি প্রত্যাখ্যান করতে চান?'}
            </p>
            <p className="text-xs mt-3 opacity-85">
              GRN <strong>{confirmAction.grn.grn_no}</strong> ({confirmAction.grn.supplier_name}).
              {confirmAction.type === 'approve'
                ? ' Stock balances will be updated upon approval.'
                : ' Rejected GRNs can be edited and resubmitted.'}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={processingConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproveReject}
                disabled={processingConfirm}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                  confirmAction.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {processingConfirm && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmAction.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deletingGrn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
              isDark ? 'bg-[#103A40] border-white/15 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
              Delete GRN? <span className="font-bangla opacity-80">(জিআরএন মুছবেন?)</span>
            </h3>
            <p className="text-xs mt-3 leading-relaxed opacity-90">
              <strong>{deletingGrn.grn_no}</strong> ({deletingGrn.supplier_name}) and all its items
              will be permanently deleted. This cannot be undone.{' '}
              <span className="font-bangla opacity-75">(এটি স্থায়ীভাবে মুছে যাবে)</span>
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingGrn(null)}
                disabled={processingDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300/60 dark:border-white/15 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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

export default StoreGrnPage;
