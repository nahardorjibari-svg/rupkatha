import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
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
  AlertTriangle,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUnit } from '../../context/UnitContext';
import { supabase } from '../../lib/supabaseClient';
import { getDhakaDateString } from '../../lib/dhakaTime';
import {
  formatNumberBD,
  formatStoreDate,
  formatStoreDateTime,
} from '../../lib/storeFormat';
import { computeLiveStoreData } from '../../lib/storeStockCalc';
import {
  canApproveGrn,
  canEditGrn,
  type StoreCategory,
  type StoreGrn,
  type StoreGrnStatus,
  type StoreIssue,
  type StoreIssueItem,
  type StoreIssueOrderRef,
  type StoreItem,
  type StoreStockStatusRow,
  type StoreUnit,
  type StoreUom,
  type StoreWarehouse,
} from '../../types/store';

interface ActiveOrderOption extends StoreIssueOrderRef {
  status?: string | null;
  order_qty?: number | null;
}

interface DraftIssueLine {
  localId: string;
  item_id: string;
  itemSearch: string;
  qty: string;
  remarks: string;
}

const DEPARTMENT_OPTIONS = ['Cutting', 'Sewing', 'Finishing'] as const;
const LINE_OPTIONS = ['Line 1', 'Line 2', 'Line 3', 'Line 4'] as const;

const createEmptyLine = (): DraftIssueLine => ({
  localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  item_id: '',
  itemSearch: '',
  qty: '1',
  remarks: '',
});

const parseLineFromPurpose = (purpose?: string | null): string => {
  const raw = (purpose || '').trim();
  if (!raw) return '-';
  const match = raw.match(/Line\s*[#-]?\s*(\d+)/i);
  if (match) return `Line ${match[1]}`;
  return raw;
};

export const StoreIssuePage: React.FC = () => {
  const { isDark } = useTheme();
  const { profile, user } = useAuth();
  const { activeUnit } = useUnit();

  const currentUserId = user?.id || profile?.id || null;
  const allowEdit = canEditGrn(profile?.role, profile?.is_active);
  const allowApprove = canApproveGrn(profile?.role, profile?.is_active);

  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<StoreIssue[]>([]);
  const [orders, setOrders] = useState<ActiveOrderOption[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [uoms, setUoms] = useState<StoreUom[]>([]);
  const [warehouses, setWarehouses] = useState<StoreWarehouse[]>([]);
  const [stockRows, setStockRows] = useState<StoreStockStatusRow[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<'all' | string>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | StoreUnit>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | StoreGrnStatus>('all');

  // View / Print A4 Issue Slip
  const [viewingIssue, setViewingIssue] = useState<StoreIssue | null>(null);

  // Create / Edit Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<StoreIssue | null>(null);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'confirm' | null>(null);

  // Form fields
  const [issueDate, setIssueDate] = useState(getDhakaDateString());
  const [unit, setUnit] = useState<StoreUnit>('knit');
  const [warehouseId, setWarehouseId] = useState('');
  const [department, setDepartment] = useState<string>('Cutting');
  const [lineNo, setLineNo] = useState<string>('Line 1');
  const [orderId, setOrderId] = useState<string>('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<DraftIssueLine[]>([createEmptyLine()]);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  // Approve / Reject Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    issue: StoreIssue;
  } | null>(null);
  const [processingConfirm, setProcessingConfirm] = useState(false);

  // Delete Confirmation dialog
  const [deletingIssue, setDeletingIssue] = useState<StoreIssue | null>(null);
  const [processingDelete, setProcessingDelete] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [issueRes, orderRes, itemRes, catRes, uomRes, whRes, grnRes, viewRes] =
        await Promise.all([
          supabase
            .from('store_issues')
            .select(
              'id, issue_no, issue_date, warehouse_id, unit, department, purpose, order_id, remarks, status, approved_by, approved_by_name, approved_at, created_at, orders(id, order_no, po_no, style_no, item_name, unit, buyers(name, code)), store_issue_items(id, issue_id, item_id, qty, remarks)'
            )
            .order('issue_date', { ascending: false })
            .order('created_at', { ascending: false }),
          supabase
            .from('orders')
            .select('id, order_no, po_no, style_no, item_name, unit, status, order_qty, buyers(name, code)')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false }),
          supabase.from('store_items').select('*').order('sku', { ascending: true }),
          supabase.from('store_categories').select('*'),
          supabase.from('store_uoms').select('*'),
          supabase.from('store_warehouses').select('*').eq('is_active', true),
          supabase
            .from('store_grn')
            .select(
              'id, grn_no, grn_date, unit, currency, exchange_rate, status, created_at, approved_at, created_by_name, approved_by_name, supplier_name, store_grn_items(item_id, qty, accepted_qty, rejected_qty, unit_price)'
            ),
          supabase.from('store_v_stock_status').select('*'),
        ]);

      if (issueRes.error) throw issueRes.error;
      if (itemRes.error) throw itemRes.error;
      if (catRes.error) throw catRes.error;
      if (uomRes.error) throw uomRes.error;
      if (whRes.error) throw whRes.error;
      if (grnRes.error) throw grnRes.error;

      const loadedIssues = (issueRes.data || []) as unknown as StoreIssue[];
      const loadedOrders = orderRes.error
        ? []
        : ((orderRes.data || []) as unknown as ActiveOrderOption[]);
      const loadedItems = (itemRes.data || []) as StoreItem[];
      const loadedCats = (catRes.data || []) as StoreCategory[];
      const loadedUoms = (uomRes.data || []) as StoreUom[];
      const loadedGrns = (grnRes.data || []) as unknown as StoreGrn[];
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

      setIssues(loadedIssues);
      setOrders(loadedOrders);
      setItems(loadedItems);
      setUoms(loadedUoms);
      setWarehouses((whRes.data || []) as StoreWarehouse[]);
      setStockRows(computed.statusRows);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load material issue records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const activeItems = useMemo(() => {
    return items.filter((it) => it.is_active !== false);
  }, [items]);

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

  const orderMap = useMemo(() => {
    const map = new Map<string, ActiveOrderOption>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  const stockMap = useMemo(() => {
    const map = new Map<string, StoreStockStatusRow>();
    stockRows.forEach((r) => map.set(r.item_id, r));
    return map;
  }, [stockRows]);

  const getAvailableStockForUnit = useCallback(
    (itemId: string, targetUnit: StoreUnit): number => {
      const row = stockMap.get(itemId);
      if (!row) return 0;
      return targetUnit === 'knit' ? Number(row.knit_qty || 0) : Number(row.woven_qty || 0);
    },
    [stockMap]
  );

  const openNewDrawer = useCallback(() => {
    if (!allowEdit) return;
    setEditingIssue(null);
    setIssueDate(getDhakaDateString());
    setUnit(activeUnit === 'woven' ? 'woven' : 'knit');
    setWarehouseId(defaultWarehouse?.id || '');
    setDepartment('Cutting');
    setLineNo('Line 1');
    setOrderId('');
    setRemarks('');
    setLines([createEmptyLine()]);
    setOpenPickerId(null);
    setDrawerOpen(true);
  }, [allowEdit, activeUnit, defaultWarehouse]);

  const openEditDrawer = (issue: StoreIssue) => {
    if (!allowEdit) return;
    if (issue.status === 'approved' || issue.status === 'submitted') {
      toast.error('Submitted or approved issues cannot be edited.');
      return;
    }

    setEditingIssue(issue);
    setIssueDate(issue.issue_date || getDhakaDateString());
    setUnit(issue.unit === 'woven' ? 'woven' : 'knit');
    setWarehouseId(issue.warehouse_id || defaultWarehouse?.id || '');
    setDepartment(issue.department || 'Cutting');
    const parsedLine = parseLineFromPurpose(issue.purpose);
    setLineNo((LINE_OPTIONS as readonly string[]).includes(parsedLine) ? parsedLine : 'Line 1');
    setOrderId(issue.order_id || '');
    setRemarks(issue.remarks || '');

    const existingLines = (issue.store_issue_items || []).map((li) => {
      const it = itemMap.get(li.item_id);
      return {
        localId: li.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item_id: li.item_id,
        itemSearch: it ? `${it.sku} — ${it.name}` : li.item_id,
        qty: String(li.qty ?? 0),
        remarks: li.remarks || '',
      };
    });

    setLines(existingLines.length > 0 ? existingLines : [createEmptyLine()]);
    setOpenPickerId(null);
    setDrawerOpen(true);
  };

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((iss) => {
      if (q) {
        const orderRef = iss.orders || (iss.order_id ? orderMap.get(iss.order_id) : undefined);
        const matchNo = (iss.issue_no || '').toLowerCase().includes(q);
        const matchDept = (iss.department || '').toLowerCase().includes(q);
        const matchLine = parseLineFromPurpose(iss.purpose).toLowerCase().includes(q);
        const matchOrd = (orderRef?.order_no || '').toLowerCase().includes(q);
        const matchPo = (orderRef?.po_no || '').toLowerCase().includes(q);
        const matchStyle = (orderRef?.style_no || '').toLowerCase().includes(q);
        const matchBuyer = (orderRef?.buyers?.name || '').toLowerCase().includes(q);
        if (
          !matchNo &&
          !matchDept &&
          !matchLine &&
          !matchOrd &&
          !matchPo &&
          !matchStyle &&
          !matchBuyer
        ) {
          return false;
        }
      }
      if (deptFilter !== 'all' && iss.department !== deptFilter) return false;
      if (unitFilter !== 'all' && iss.unit !== unitFilter) return false;
      if (statusFilter !== 'all' && iss.status !== statusFilter) return false;
      return true;
    });
  }, [issues, search, deptFilter, unitFilter, statusFilter, orderMap]);

  // Summary metrics for header strip
  const summaryStats = useMemo(() => {
    const total = filteredIssues.length;
    const approved = filteredIssues.filter((i) => i.status === 'approved').length;
    const pending = filteredIssues.filter(
      (i) => i.status === 'draft' || i.status === 'submitted'
    ).length;
    const totalQty = filteredIssues
      .filter((i) => i.status === 'approved')
      .reduce(
        (acc, iss) =>
          acc + (iss.store_issue_items || []).reduce((s, l) => s + Number(l.qty || 0), 0),
        0
      );
    return { total, approved, pending, totalQty };
  }, [filteredIssues]);

  const getOtherRowsQtyForItem = useCallback(
    (itemId: string, excludeLocalId: string): number => {
      return lines.reduce((sum, l) => {
        if (l.localId === excludeLocalId || l.item_id !== itemId) return sum;
        const q = Number(l.qty || 0);
        return sum + (Number.isFinite(q) && q > 0 ? q : 0);
      }, 0);
    },
    [lines]
  );

  const handleSelectItemForLine = (localId: string, item: StoreItem) => {
    const unitAvail = getAvailableStockForUnit(item.id, unit);
    const otherQty = getOtherRowsQtyForItem(item.id, localId);
    const maxAvail = Math.max(0, unitAvail - otherQty);

    setLines((prev) =>
      prev.map((line) => {
        if (line.localId !== localId) return line;
        const currentQty = Number(line.qty || 0);
        const nextQty =
          maxAvail <= 0 ? '0' : currentQty > maxAvail ? String(maxAvail) : line.qty || '1';
        return {
          ...line,
          item_id: item.id,
          itemSearch: `${item.sku} — ${item.name}`,
          qty: nextQty,
        };
      })
    );
    setOpenPickerId(null);
  };

  const handleLineQtyChange = (localId: string, rawVal: string) => {
    const targetLine = lines.find((l) => l.localId === localId);
    if (!targetLine) return;

    if (rawVal === '') {
      setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, qty: '' } : l)));
      return;
    }

    const num = Number(rawVal);
    if (!Number.isFinite(num) || num < 0) return;

    if (targetLine.item_id) {
      const unitAvail = getAvailableStockForUnit(targetLine.item_id, unit);
      const otherQty = getOtherRowsQtyForItem(targetLine.item_id, localId);
      const maxAvail = Math.max(0, unitAvail - otherQty);

      if (num > maxAvail) {
        const sr = stockMap.get(targetLine.item_id);
        toast.error(
          `Cannot issue more than available stock (${formatNumberBD(maxAvail, 2)} ${
            sr?.uom || ''
          } in ${unit.toUpperCase()}).`,
          { id: `stock-limit-${targetLine.localId}` }
        );
        setLines((prev) =>
          prev.map((l) => (l.localId === localId ? { ...l, qty: String(maxAvail) } : l))
        );
        return;
      }
    }

    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, qty: rawVal } : l)));
  };

  const handleLineChange = (localId: string, field: keyof DraftIssueLine, value: string) => {
    if (field === 'qty') {
      handleLineQtyChange(localId, value);
      return;
    }
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

  const generateFallbackIssueNo = useCallback(() => {
    let maxSeq = 1000;
    issues.forEach((iss) => {
      const m = String(iss.issue_no || '').match(/(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
      }
    });
    return `ISS-${maxSeq + 1}`;
  }, [issues]);

  const isRpcFallbackCode = (err: any) => {
    const code = String(err?.code || '');
    const msg = String(err?.message || '').toLowerCase();
    return (
      code === 'PGRST202' ||
      code === '42883' ||
      code === '42501' ||
      msg.includes('could not find the function') ||
      msg.includes('permission denied for function')
    );
  };

  const persistIssue = async (action: 'draft' | 'confirm') => {
    if (!allowEdit) {
      toast.error('You do not have permission to create or edit material issues.');
      return;
    }

    if (!department.trim()) {
      toast.error('Please select a department.');
      return;
    }

    const activeWarehouseId = warehouseId || defaultWarehouse?.id || null;

    const unresolvedLine = lines.find((l) => l.itemSearch.trim() && !l.item_id);
    if (unresolvedLine) {
      toast.error('Please select a valid item from the dropdown for every line.');
      return;
    }

    const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
    if (validLines.length === 0) {
      toast.error('Please add at least one item with issue quantity > 0.');
      return;
    }

    // Strict stock validation per item across all rows
    const requestedByItem = new Map<string, number>();
    validLines.forEach((l) => {
      requestedByItem.set(l.item_id, (requestedByItem.get(l.item_id) || 0) + Number(l.qty));
    });

    for (const [itId, reqQty] of requestedByItem.entries()) {
      const avail = getAvailableStockForUnit(itId, unit);
      if (reqQty > avail) {
        const item = itemMap.get(itId);
        const sr = stockMap.get(itId);
        toast.error(
          `Insufficient ${unit.toUpperCase()} stock for ${item?.sku || 'item'}: requested ${formatNumberBD(
            reqQty,
            2
          )}, available ${formatNumberBD(avail, 2)} ${sr?.uom || ''}.`
        );
        return;
      }
    }

    setSubmittingAction(action);
    try {
      let targetIssueId = editingIssue?.id;
      let resolvedIssueNo = editingIssue?.issue_no || '';

      const basePayload = {
        issue_date: issueDate,
        warehouse_id: activeWarehouseId,
        unit,
        department,
        purpose: lineNo,
        order_id: orderId || null,
        remarks: remarks.trim() || null,
      };

      if (!editingIssue) {
        const { data: nextNo, error: noErr } = await supabase.rpc('store_next_no', {
          p_kind: 'issue',
        });
        if (!noErr && nextNo) {
          resolvedIssueNo = String(nextNo);
        } else if (noErr && !isRpcFallbackCode(noErr)) {
          throw noErr;
        } else {
          resolvedIssueNo = generateFallbackIssueNo();
        }

        const { data: insertedIssue, error: insertErr } = await supabase
          .from('store_issues')
          .insert({
            issue_no: resolvedIssueNo,
            ...basePayload,
            status: 'draft',
          })
          .select('id, issue_no')
          .single();

        if (insertErr) throw insertErr;
        targetIssueId = insertedIssue.id;
        resolvedIssueNo = insertedIssue.issue_no;
      } else {
        const { error: updateErr } = await supabase
          .from('store_issues')
          .update(basePayload)
          .eq('id', editingIssue.id);
        if (updateErr) throw updateErr;

        const { error: delErr } = await supabase
          .from('store_issue_items')
          .delete()
          .eq('issue_id', editingIssue.id);
        if (delErr) throw delErr;
      }

      if (!targetIssueId) throw new Error('Issue ID missing after save.');

      const itemsPayload: Omit<StoreIssueItem, 'id'>[] = validLines.map((l) => ({
        issue_id: targetIssueId!,
        item_id: l.item_id,
        qty: Number(l.qty),
        remarks: l.remarks.trim() || null,
      }));

      const { error: linesErr } = await supabase
        .from('store_issue_items')
        .insert(itemsPayload);
      if (linesErr) throw linesErr;

      if (action === 'confirm') {
        // 1. Submit
        const { error: submitErr } = await supabase.rpc('store_submit', {
          p_kind: 'issue',
          p_id: targetIssueId,
        });
        if (submitErr) {
          if (isRpcFallbackCode(submitErr)) {
            const { error: directSubmitErr } = await supabase
              .from('store_issues')
              .update({ status: 'submitted' })
              .eq('id', targetIssueId);
            if (directSubmitErr) throw directSubmitErr;
          } else {
            throw submitErr;
          }
        }

        // 2. Approve / Confirm Stock Out
        let approvedNow = false;
        const { error: approveErr } = await supabase.rpc('store_approve_issue', {
          p_issue_id: targetIssueId,
        });

        if (!approveErr) {
          approvedNow = true;
        } else if (isRpcFallbackCode(approveErr)) {
          const { error: directApproveErr } = await supabase
            .from('store_issues')
            .update({
              status: 'approved',
              ...(currentUserId ? { approved_by: currentUserId } : {}),
              approved_by_name: profile?.full_name || null,
              approved_at: new Date().toISOString(),
            })
            .eq('id', targetIssueId);

          if (!directApproveErr) {
            approvedNow = true;
          } else if (String(directApproveErr.code || '') !== '42501') {
            throw directApproveErr;
          }
        } else {
          throw approveErr;
        }

        if (approvedNow) {
          toast.success(`Issue ${resolvedIssueNo} confirmed & stock updated!`);
        } else {
          toast.success(`Issue ${resolvedIssueNo} submitted for Manager approval.`);
        }
      } else {
        toast.success(`Issue ${resolvedIssueNo} saved as draft.`);
      }

      setDrawerOpen(false);
      await loadData();
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Failed to save material issue.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmApproveReject = async () => {
    if (!confirmAction || !allowApprove) return;
    setProcessingConfirm(true);
    try {
      if (confirmAction.type === 'approve') {
        const { error } = await supabase.rpc('store_approve_issue', {
          p_issue_id: confirmAction.issue.id,
        });
        if (error) {
          if (isRpcFallbackCode(error)) {
            const { error: directErr } = await supabase
              .from('store_issues')
              .update({
                status: 'approved',
                ...(currentUserId ? { approved_by: currentUserId } : {}),
                approved_by_name: profile?.full_name || null,
                approved_at: new Date().toISOString(),
              })
              .eq('id', confirmAction.issue.id);
            if (directErr) throw directErr;
          } else {
            throw error;
          }
        }
        toast.success(`Issue ${confirmAction.issue.issue_no} approved & stock updated.`);
      } else {
        const { error } = await supabase.rpc('store_reject', {
          p_kind: 'issue',
          p_id: confirmAction.issue.id,
        });
        if (error) {
          if (isRpcFallbackCode(error)) {
            const { error: directErr } = await supabase
              .from('store_issues')
              .update({ status: 'rejected' })
              .eq('id', confirmAction.issue.id);
            if (directErr) throw directErr;
          } else {
            throw error;
          }
        }
        toast.success(`Issue ${confirmAction.issue.issue_no} rejected.`);
      }

      const targetId = confirmAction.issue.id;
      setConfirmAction(null);
      await loadData();

      if (viewingIssue && viewingIssue.id === targetId) {
        const { data } = await supabase
          .from('store_issues')
          .select(
            'id, issue_no, issue_date, warehouse_id, unit, department, purpose, order_id, remarks, status, approved_by, approved_by_name, approved_at, created_at, orders(id, order_no, po_no, style_no, item_name, unit, buyers(name, code)), store_issue_items(id, issue_id, item_id, qty, remarks)'
          )
          .eq('id', targetId)
          .single();
        if (data) setViewingIssue(data as unknown as StoreIssue);
      }
    } catch (err: any) {
      const dbMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbMessage || 'Approval action failed.');
    } finally {
      setProcessingConfirm(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingIssue) return;
    if (deletingIssue.status === 'approved' || deletingIssue.status === 'submitted') {
      toast.error('Submitted or approved issues cannot be deleted.');
      setDeletingIssue(null);
      return;
    }

    setProcessingDelete(true);
    try {
      const { error } = await supabase
        .from('store_issues')
        .delete()
        .eq('id', deletingIssue.id);
      if (error) throw error;

      toast.success(`Issue ${deletingIssue.issue_no} deleted.`);
      setDeletingIssue(null);
      await loadData();
    } catch (err: any) {
      const dbError = [err?.message, err?.details, err?.hint].filter(Boolean).join(' — ');
      toast.error(dbError || 'Failed to delete issue.');
    } finally {
      setProcessingDelete(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            Confirmed / Approved
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

  const draftTotalQty = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.qty || 0) || 0), 0);
  }, [lines]);

  // =========================================================================
  // VIEW / PRINT A4 MATERIAL ISSUE SLIP (CHALLAN)
  // =========================================================================
  if (viewingIssue) {
    const wh = viewingIssue.warehouse_id ? warehouseMap.get(viewingIssue.warehouse_id) : undefined;
    const lineList = viewingIssue.store_issue_items || [];
    const orderRef =
      viewingIssue.orders ||
      (viewingIssue.order_id ? orderMap.get(viewingIssue.order_id) : undefined);
    const totalIssuedQty = lineList.reduce((sum, l) => sum + Number(l.qty || 0), 0);

    return (
      <AdminLayout>
        <div className="space-y-4">
          {/* Toolbar (hidden in print) */}
          <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewingIssue(null)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <div className="text-left">
                <span className="block leading-tight">Back to Issue List</span>
                <span className="block text-[10px] font-bangla opacity-70 leading-tight">
                  তালিকায় ফিরে যান
                </span>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {allowApprove && viewingIssue.status === 'submitted' && (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'approve', issue: viewingIssue })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <div className="text-left">
                      <span className="block leading-tight">Approve Issue</span>
                      <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                        অনুমোদন করুন
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'reject', issue: viewingIssue })}
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
                  <span className="block leading-tight">Print A4 Issue Slip</span>
                  <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                    চালান প্রিন্ট করুন
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Printable A4 Challan */}
          <div className="job-card-paper max-w-[210mm] mx-auto bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 print:rounded-none print:border-none print:shadow-none print:p-0">
            {/* Company Header */}
            <div className="border-b-2 border-slate-800 pb-4 mb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight !text-slate-900">
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
                  Material Issue Challan
                </p>
                <p className="text-xs font-bangla text-slate-600">মালামাল ইস্যু চালান (স্টক আউট)</p>
                <p className="text-sm font-mono font-bold mt-1 text-slate-900">
                  {viewingIssue.issue_no}
                </p>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6 border border-slate-300 rounded-xl p-3.5 bg-slate-50/70 print:bg-white">
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">
                  Issue Date
                </span>
                <span className="font-semibold">{formatStoreDate(viewingIssue.issue_date)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Unit</span>
                <span className="font-semibold uppercase">{viewingIssue.unit}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">
                  Department
                </span>
                <span className="font-bold">{viewingIssue.department}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Line #</span>
                <span className="font-bold">{parseLineFromPurpose(viewingIssue.purpose)}</span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] uppercase text-slate-500 font-bold block">
                  Order &amp; PO Reference
                </span>
                <span className="font-bold">
                  {orderRef
                    ? `${orderRef.order_no}${
                        orderRef.po_no ? ` · PO: ${orderRef.po_no}` : ''
                      } · Style: ${orderRef.style_no}${
                        orderRef.buyers?.name ? ` (${orderRef.buyers.name})` : ''
                      }`
                    : 'General Production / Non-Order'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">
                  Warehouse
                </span>
                <span className="font-semibold">
                  {wh ? `${wh.name} (${wh.code})` : 'MAIN-STORE'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-bold block">Status</span>
                <span className="font-bold uppercase">{viewingIssue.status}</span>
              </div>

              <div className="col-span-2 sm:col-span-4 border-t border-slate-200 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    Approved / Confirmed By
                  </span>
                  <span className="font-semibold">
                    {viewingIssue.approved_by_name
                      ? `${viewingIssue.approved_by_name} (${formatStoreDateTime(
                          viewingIssue.approved_at
                        )})`
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-bold block">
                    Remarks
                  </span>
                  <span>{viewingIssue.remarks || '-'}</span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full border-collapse text-xs mb-5">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border border-slate-300">
                  <th className="py-2 px-2.5 border border-slate-300 text-center w-10">SL</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-left">SKU</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-left">Item Description</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-center">UOM</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-right">Issued Qty</th>
                  <th className="py-2 px-2.5 border border-slate-300 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {lineList.map((line, idx) => {
                  const item = itemMap.get(line.item_id);
                  const uom = item?.uom_id ? uomMap.get(item.uom_id) : undefined;
                  return (
                    <tr key={line.id || idx} className="border border-slate-300">
                      <td className="py-2 px-2.5 border border-slate-300 text-center">{idx + 1}</td>
                      <td className="py-2 px-2.5 border border-slate-300 font-mono font-semibold">
                        {item?.sku || '-'}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300">
                        <span className="font-semibold block">{item?.name || line.item_id}</span>
                        {item?.name_bn && (
                          <span className="text-[10px] font-bangla text-slate-600 block">
                            {item.name_bn}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-center">
                        {uom?.code || '-'}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-right font-bold">
                        {formatNumberBD(line.qty, 2)}
                      </td>
                      <td className="py-2 px-2.5 border border-slate-300 text-slate-600">
                        {line.remarks || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border border-slate-300">
                  <td colSpan={4} className="py-2.5 px-3 border border-slate-300 text-right uppercase">
                    Total Issued Quantity ({lineList.length} Item{lineList.length > 1 ? 's' : ''})
                  </td>
                  <td className="py-2.5 px-2.5 border border-slate-300 text-right text-[#0F8B8D]">
                    {formatNumberBD(totalIssuedQty, 2)}
                  </td>
                  <td className="py-2.5 px-2.5 border border-slate-300" />
                </tr>
              </tfoot>
            </table>

            {/* Signature Blocks */}
            <div className="grid grid-cols-3 gap-6 pt-12 mt-8 text-xs text-center">
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-bold">Store In-Charge</div>
                <p className="text-[10px] font-bangla text-slate-500">স্টোর ইন-চার্জ</p>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-bold">
                  Received By (Dept / Line)
                </div>
                <p className="text-[10px] font-bangla text-slate-500">গ্রহণকারী (বিভাগ / লাইন)</p>
              </div>
              <div>
                <div className="border-t border-slate-700 pt-1.5 font-bold">Authorized By</div>
                <p className="text-[10px] font-bangla text-slate-500">অনুমোদনকারী</p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm Approve / Reject Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs print:hidden">
            <div
              className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
                isDark
                  ? 'bg-[#103A40] border-white/15 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <h3 className="text-lg font-extrabold">
                {confirmAction.type === 'approve' ? 'Approve Material Issue?' : 'Reject Issue?'}
              </h3>
              <p className="text-xs font-bangla opacity-70 mt-0.5">
                {confirmAction.type === 'approve'
                  ? 'আপনি কি এই মালামাল ইস্যু অনুমোদন করতে চান?'
                  : 'আপনি কি এই ইস্যু প্রত্যাখ্যান করতে চান?'}
              </p>
              <p className="text-xs mt-3 opacity-85">
                Issue <strong>{confirmAction.issue.issue_no}</strong> ({confirmAction.issue.department} ·{' '}
                {parseLineFromPurpose(confirmAction.issue.purpose)}).
                {confirmAction.type === 'approve'
                  ? ' Stock balances will be deducted immediately.'
                  : ' Rejected issues can be edited and resubmitted.'}
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
                  <span>
                    {confirmAction.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    );
  }

  // =========================================================================
  // MAIN MATERIAL ISSUE LIST VIEW
  // =========================================================================
  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Stock Out — Material Issue
            </h1>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              স্টক আউট (মালামাল ইস্যু) — কাটিং, সুইং ও ফিনিশিং ফ্লোরে মালামাল প্রদান ও চালান ব্যবস্থাপনা
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
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
                  <span className="block leading-tight">New Material Issue</span>
                  <span className="block text-[10px] font-bangla opacity-75 leading-tight">
                    নতুন মালামাল ইস্যু
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Total Issues <span className="font-bangla opacity-70">(মোট চালান)</span>
            </p>
            <p className="text-xl font-extrabold mt-1">{formatNumberBD(summaryStats.total)}</p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Confirmed <span className="font-bangla opacity-70">(অনুমোদিত)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">
              {formatNumberBD(summaryStats.approved)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Pending / Draft <span className="font-bangla opacity-70">(অপেক্ষমাণ)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-amber-600 dark:text-amber-400">
              {formatNumberBD(summaryStats.pending)}
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 ${
              isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-semibold text-[#0F8B8D] dark:text-[#2BA5B5]">
              Issued Qty (Confirmed){' '}
              <span className="font-bangla opacity-70">(মোট প্রদত্ত পরিমাণ)</span>
            </p>
            <p className="text-xl font-extrabold mt-1 text-[#0F8B8D] dark:text-[#2BA5B5]">
              {formatNumberBD(summaryStats.totalQty, 2)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div
          className={`rounded-2xl border p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 ${
            isDark ? 'bg-[#103A40]/85 border-white/10' : 'glass-card bg-white border-slate-200'
          }`}
        >
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Issue #, Order Ref, Style, Line..."
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Departments (সব বিভাগ)</option>
              {DEPARTMENT_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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
              <option value="approved">Approved (অনুমোদিত)</option>
              <option value="submitted">Submitted (জমাকৃত)</option>
              <option value="draft">Draft (খসড়া)</option>
              <option value="rejected">Rejected (প্রত্যাখ্যাত)</option>
            </select>
          </div>
        </div>

        {/* Material Issues Table */}
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
                    <span className="block font-bold">Issue #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      ইস্যু নং
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Date</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      তারিখ
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Department</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      বিভাগ
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Line #</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      লাইন নং
                    </span>
                  </th>
                  <th className="py-3 px-3">
                    <span className="block font-bold">Order Ref / Order No</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      অর্ডার রেফারেন্স
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <span className="block font-bold">Total Items</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      মোট আইটেম
                    </span>
                  </th>
                  <th className="py-3 px-3 text-center">
                    <span className="block font-bold">Status</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      অবস্থা
                    </span>
                  </th>
                  <th className="py-3 px-4 text-right">
                    <span className="block font-bold">Actions</span>
                    <span className="block text-[10px] font-bangla opacity-70 font-normal">
                      অ্যাকশন
                    </span>
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
                ) : filteredIssues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-400">
                      <ClipboardList className="w-9 h-9 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold text-sm">No material issue records found</p>
                      <p className="text-xs font-bangla opacity-70 mt-0.5">
                        কোনো মালামাল ইস্যুর তথ্য পাওয়া যায়নি — নতুন ইস্যু তৈরি করুন
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => {
                    const orderRef =
                      issue.orders || (issue.order_id ? orderMap.get(issue.order_id) : undefined);
                    const itemLines = issue.store_issue_items || [];
                    const sumQty = itemLines.reduce((s, l) => s + Number(l.qty || 0), 0);

                    const canEditThis =
                      allowEdit && (issue.status === 'draft' || issue.status === 'rejected');
                    const canDeleteThis =
                      allowEdit && (issue.status === 'draft' || issue.status === 'rejected');
                    const canApproveThis = allowApprove && issue.status === 'submitted';

                    return (
                      <tr
                        key={issue.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] block">
                            {issue.issue_no}
                          </span>
                          <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/10 inline-block mt-0.5">
                            {issue.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {formatStoreDate(issue.issue_date)}
                        </td>
                        <td className="py-3 px-3 font-semibold">{issue.department}</td>
                        <td className="py-3 px-3 font-semibold">
                          {parseLineFromPurpose(issue.purpose)}
                        </td>
                        <td className="py-3 px-3">
                          {orderRef ? (
                            <div>
                              <span className="font-mono font-bold block">
                                {orderRef.order_no}
                                {orderRef.po_no ? ` · PO: ${orderRef.po_no}` : ''}
                              </span>
                              <span className="text-[11px] opacity-70 block">
                                {orderRef.style_no}
                                {orderRef.buyers?.name ? ` · ${orderRef.buyers.name}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="opacity-60">General / Non-Order</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className="font-bold block">
                            {itemLines.length} item{itemLines.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] opacity-70 block">
                            Qty: {formatNumberBD(sumQty, 2)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {renderStatusBadge(issue.status)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingIssue(issue)}
                              title="View / Print Challan"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-slate-300/60 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Slip</span>
                            </button>

                            {canEditThis && (
                              <button
                                type="button"
                                onClick={() => openEditDrawer(issue)}
                                title="Edit Draft"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-[#2BA5B5]/30 bg-[#2BA5B5]/10 text-[#0F8B8D] dark:text-[#2BA5B5] hover:bg-[#2BA5B5]/20 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}

                            {canDeleteThis && (
                              <button
                                type="button"
                                onClick={() => setDeletingIssue(issue)}
                                title="Delete Draft"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}

                            {canApproveThis && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'approve', issue })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmAction({ type: 'reject', issue })}
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

      {/* Create / Edit Material Issue Drawer */}
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
                  {editingIssue
                    ? `Edit Material Issue — ${editingIssue.issue_no}`
                    : 'New Material Issue'}
                </h2>
                <p className="text-xs font-bangla opacity-70">
                  {editingIssue
                    ? 'মালামাল ইস্যু তথ্য হালনাগাদ করুন'
                    : 'বিভাগ ও লাইন অনুযায়ী স্টক থেকে মালামাল ইস্যু করুন'}
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
              {/* Header Info Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Issue # <span className="font-bangla opacity-70 font-normal">(নম্বর)</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={editingIssue ? editingIssue.issue_no : 'Auto-generated on save'}
                    className={`${inputClass} opacity-75 cursor-not-allowed`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Issue Date * <span className="font-bangla opacity-70 font-normal">(তারিখ)</span>
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
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

              {/* Header Info Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Department * <span className="font-bangla opacity-70 font-normal">(বিভাগ)</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={inputClass}
                  >
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Line # * <span className="font-bangla opacity-70 font-normal">(লাইন)</span>
                  </label>
                  <select
                    value={lineNo}
                    onChange={(e) => setLineNo(e.target.value)}
                    className={inputClass}
                  >
                    {LINE_OPTIONS.map((ln) => (
                      <option key={ln} value={ln}>
                        {ln}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">
                    Buyer Order Ref{' '}
                    <span className="font-bangla opacity-70 font-normal">(অর্ডার রেফারেন্স)</span>
                  </label>
                  <select
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">General / Non-Order Issue</option>
                    {orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.order_no}
                        {ord.po_no ? ` · PO: ${ord.po_no}` : ''} — {ord.style_no}
                        {ord.buyers?.name ? ` (${ord.buyers.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Remarks <span className="font-bangla opacity-70 font-normal">(মন্তব্য)</span>
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional requisition note, receiver name, etc."
                  className={inputClass}
                />
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold">Items to Issue</h3>
                    <p className="text-[11px] font-bangla opacity-70">
                      মজুদকৃত পণ্য নির্বাচন করুন — প্রাপ্য স্টকের বেশি পরিমাণ প্রদান করা যাবে না
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLines((prev) => [...prev, createEmptyLine()])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2BA5B5]/15 text-[#0F8B8D] dark:text-[#2BA5B5] border border-[#2BA5B5]/30 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                    <span className="font-bangla opacity-70 text-[10px]">(নতুন সারি)</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {lines.map((line, index) => {
                    const query = line.itemSearch.trim().toLowerCase();
                    const suggestions = activeItems
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
                    const selectedStock = line.item_id ? stockMap.get(line.item_id) : undefined;

                    const unitAvail = line.item_id
                      ? getAvailableStockForUnit(line.item_id, unit)
                      : 0;
                    const otherUnitAvail = selectedStock
                      ? unit === 'knit'
                        ? Number(selectedStock.woven_qty || 0)
                        : Number(selectedStock.knit_qty || 0)
                      : 0;
                    const otherRowsQty = line.item_id
                      ? getOtherRowsQtyForItem(line.item_id, line.localId)
                      : 0;
                    const remainingAvail = Math.max(0, unitAvail - otherRowsQty);
                    const enteredQty = Number(line.qty || 0);
                    const exceedsStock = Boolean(line.item_id && enteredQty > remainingAvail);

                    return (
                      <div
                        key={line.localId}
                        className={`p-3 rounded-2xl border space-y-2.5 ${
                          exceedsStock
                            ? 'border-rose-500/60 bg-rose-500/5'
                            : isDark
                            ? 'bg-white/5 border-white/10'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                              Item #{index + 1}
                              {selectedUom ? ` · UOM: ${selectedUom.code}` : ''}
                            </span>
                            {line.item_id && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  remainingAvail > 0
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                }`}
                              >
                                <Package className="w-3 h-3" />
                                Available ({unit.toUpperCase()}):{' '}
                                {formatNumberBD(remainingAvail, 2)} {selectedUom?.code || ''}
                              </span>
                            )}
                            {line.item_id && remainingAvail <= 0 && otherUnitAvail > 0 && (
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                                ({unit === 'knit' ? 'Woven' : 'Knit'} has{' '}
                                {formatNumberBD(otherUnitAvail, 2)})
                              </span>
                            )}
                          </div>

                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setLines((prev) => prev.filter((item) => item.localId !== line.localId))
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
                          <div className="md:col-span-6 relative">
                            <label className="block text-[10px] font-bold mb-1 opacity-75">
                              Item (SKU / Name) *
                            </label>
                            <input
                              type="text"
                              value={line.itemSearch}
                              onFocus={() => setOpenPickerId(line.localId)}
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
                              placeholder="Search SKU or item name..."
                              className={inputClass}
                            />

                            {openPickerId === line.localId && (
                              <div
                                className={`absolute left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-xl border shadow-xl z-30 ${
                                  isDark
                                    ? 'bg-[#0B2E33] border-white/15 text-white'
                                    : 'bg-white border-slate-200 text-slate-900'
                                }`}
                              >
                                {suggestions.length === 0 ? (
                                  <div className="p-3 text-xs text-slate-400">
                                    No matching items found
                                  </div>
                                ) : (
                                  suggestions.map((it) => {
                                    const u = it.uom_id ? uomMap.get(it.uom_id) : undefined;
                                    const avail = getAvailableStockForUnit(it.id, unit);
                                    return (
                                      <button
                                        key={it.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => handleSelectItemForLine(line.localId, it)}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#2BA5B5]/15 flex items-center justify-between gap-2 cursor-pointer"
                                      >
                                        <div className="min-w-0">
                                          <span className="font-mono font-bold text-[#0F8B8D] dark:text-[#2BA5B5] mr-1.5">
                                            {it.sku}
                                          </span>
                                          <span className="font-semibold">{it.name}</span>
                                        </div>
                                        <span
                                          className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                                            avail > 0
                                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                              : 'bg-rose-500/15 text-rose-500'
                                          }`}
                                        >
                                          Avail: {formatNumberBD(avail, 2)} {u?.code || ''}
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
                              Issue Qty *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={line.item_id ? remainingAvail : undefined}
                              disabled={Boolean(line.item_id && remainingAvail <= 0)}
                              value={line.qty}
                              onChange={(e) =>
                                handleLineChange(line.localId, 'qty', e.target.value)
                              }
                              className={`${inputClass} ${
                                exceedsStock ? 'border-rose-500 ring-1 ring-rose-500' : ''
                              }`}
                            />
                          </div>

                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-bold mb-1 opacity-75">
                              Line Remarks
                            </label>
                            <input
                              type="text"
                              value={line.remarks}
                              onChange={(e) =>
                                handleLineChange(line.localId, 'remarks', e.target.value)
                              }
                              placeholder="Optional note..."
                              className={inputClass}
                            />
                          </div>
                        </div>

                        {exceedsStock && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Quantity cannot exceed available stock ({formatNumberBD(remainingAvail, 2)}).
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Footer Box */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isDark
                    ? 'bg-[#0B2E33]/80 border-[#2BA5B5]/30'
                    : 'bg-teal-50/70 border-teal-200'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">Total Issue Summary</span>
                  <span className="text-[11px] font-bangla opacity-70 block">
                    মোট ইস্যুকৃত আইটেম ও পরিমাণ
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold block opacity-75">
                    {lines.filter((l) => l.item_id && Number(l.qty) > 0).length} valid line(s)
                  </span>
                  <span className="text-xl font-extrabold text-[#0F8B8D] dark:text-[#2BA5B5]">
                    {formatNumberBD(draftTotalQty, 2)} Units
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
                onClick={() => persistIssue('draft')}
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
                onClick={() => persistIssue('confirm')}
                disabled={submittingAction !== null}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-[#0F8B8D] hover:bg-[#0b6f71] text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {submittingAction === 'confirm' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <div className="text-left">
                  <span className="block leading-tight">Confirm Issue</span>
                  <span className="block text-[10px] font-bangla opacity-80 leading-tight">
                    ইস্যু নিশ্চিত করুন
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
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <h3 className="text-lg font-extrabold">
              {confirmAction.type === 'approve' ? 'Approve Material Issue?' : 'Reject Issue?'}
            </h3>
            <p className="text-xs font-bangla opacity-70 mt-0.5">
              {confirmAction.type === 'approve'
                ? 'আপনি কি এই মালামাল ইস্যু অনুমোদন করতে চান?'
                : 'আপনি কি এই ইস্যু প্রত্যাখ্যান করতে চান?'}
            </p>
            <p className="text-xs mt-3 opacity-85">
              Issue <strong>{confirmAction.issue.issue_no}</strong> (
              {confirmAction.issue.department} · {parseLineFromPurpose(confirmAction.issue.purpose)}).
              {confirmAction.type === 'approve'
                ? ' Stock balances will be deducted upon approval.'
                : ' Rejected issues can be edited and resubmitted.'}
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
                <span>
                  {confirmAction.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {deletingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs">
          <div
            className={`max-w-md w-full rounded-2xl border p-6 shadow-2xl ${
              isDark
                ? 'bg-[#103A40] border-white/15 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
              Delete Issue? <span className="font-bangla opacity-80">(ইস্যু মুছবেন?)</span>
            </h3>
            <p className="text-xs mt-3 leading-relaxed opacity-90">
              <strong>{deletingIssue.issue_no}</strong> ({deletingIssue.department}) and all its
              items will be permanently deleted. This cannot be undone.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingIssue(null)}
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

export default StoreIssuePage;
