/**
 * Live Store & Inventory Calculations
 * Computes per-item stock, valuation, monthly movement, and recent activities
 * directly from base Supabase tables: store_items, store_categories, store_uoms,
 * store_grn (+ store_grn_items), and store_issues (+ store_issue_items).
 */

import type {
  StoreCategory,
  StoreGrn,
  StoreIssue,
  StoreItem,
  StoreMonthlyMovementRow,
  StoreRecentActivityRow,
  StoreStockStatusRow,
  StoreStockStatusType,
  StoreUom,
} from '../types/store';

export interface LiveItemStockComputation {
  statusRows: StoreStockStatusRow[];
  monthlyRows: StoreMonthlyMovementRow[];
  recentActivities: StoreRecentActivityRow[];
  pendingGrnCount: number;
}

export function normalizeItemOperationUnit(
  unit?: string | null
): 'knit' | 'woven' | 'both' {
  const lower = (unit || '').trim().toLowerCase();
  if (lower === 'knit' || lower === 'woven') return lower;
  return 'both';
}

export function computeLiveStoreData(params: {
  items: StoreItem[];
  categories: StoreCategory[];
  uoms: StoreUom[];
  grns: StoreGrn[];
  issues?: StoreIssue[];
  fallbackViewRows?: StoreStockStatusRow[];
}): LiveItemStockComputation {
  const { items, categories, uoms, grns, issues = [], fallbackViewRows = [] } = params;

  const categoryMap = new Map<string, StoreCategory>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  const uomMap = new Map<string, StoreUom>();
  uoms.forEach((u) => uomMap.set(u.id, u));

  const itemMap = new Map<string, StoreItem>();
  items.forEach((it) => itemMap.set(it.id, it));

  const fallbackMap = new Map<string, StoreStockStatusRow>();
  fallbackViewRows.forEach((r) => fallbackMap.set(r.item_id, r));

  // Per-item accumulation from approved GRNs and approved Issues
  const grnStats = new Map<
    string,
    { knitQty: number; wovenQty: number; totalQty: number; totalBdt: number }
  >();
  const issueStats = new Map<
    string,
    { knitQty: number; wovenQty: number; totalQty: number }
  >();

  let pendingGrnCount = 0;

  // Monthly movement accumulator: key = `${YYYY-MM}::${unit}`
  const monthlyMap = new Map<string, StoreMonthlyMovementRow>();
  const monthlyItemsMoved = new Map<string, Set<string>>();

  const ensureMonthly = (monthKey: string, unitKey: string): StoreMonthlyMovementRow => {
    const key = `${monthKey}::${unitKey}`;
    let row = monthlyMap.get(key);
    if (!row) {
      row = {
        month: monthKey,
        unit: unitKey,
        qty_in: 0,
        qty_out: 0,
        value_in: 0,
        value_out: 0,
        net_value: 0,
        items_moved: 0,
      };
      monthlyMap.set(key, row);
      monthlyItemsMoved.set(key, new Set<string>());
    }
    return row;
  };

  const recentActivities: StoreRecentActivityRow[] = [];

  grns.forEach((grn) => {
    const isApproved = grn.status === 'approved';
    if (grn.status === 'draft' || grn.status === 'submitted') {
      pendingGrnCount += 1;
    }

    const rate = grn.currency === 'USD' ? Math.max(0, Number(grn.exchange_rate || 1)) : 1;
    const grnUnit = (grn.unit || 'knit').toLowerCase() === 'woven' ? 'woven' : 'knit';
    const monthKey = (grn.grn_date || grn.created_at || '').slice(0, 7);
    const lines = grn.store_grn_items || [];

    lines.forEach((line) => {
      const qty = Math.max(0, Number(line.accepted_qty ?? line.qty ?? 0));
      const unitPrice = Math.max(0, Number(line.unit_price || 0));
      const lineBdt = qty * unitPrice * rate;

      if (isApproved && qty > 0) {
        const entry = grnStats.get(line.item_id) || {
          knitQty: 0,
          wovenQty: 0,
          totalQty: 0,
          totalBdt: 0,
        };
        if (grnUnit === 'knit') entry.knitQty += qty;
        else entry.wovenQty += qty;
        entry.totalQty += qty;
        entry.totalBdt += lineBdt;
        grnStats.set(line.item_id, entry);

        if (monthKey) {
          const mRow = ensureMonthly(monthKey, grnUnit);
          mRow.qty_in += qty;
          mRow.value_in += lineBdt;
          mRow.net_value = mRow.value_in - mRow.value_out;
          monthlyItemsMoved.get(`${monthKey}::${grnUnit}`)?.add(line.item_id);
        }
      }

      const item = itemMap.get(line.item_id);
      recentActivities.push({
        created_at:
          grn.approved_at ||
          grn.created_at ||
          (grn.grn_date ? `${grn.grn_date}T12:00:00+06:00` : ''),
        unit: grnUnit,
        movement_type: 'grn',
        qty_delta: qty,
        reference_no: isApproved ? grn.grn_no : `${grn.grn_no} (${grn.status})`,
        sku: item?.sku || null,
        item_name: item?.name || null,
        user_name: grn.approved_by_name || grn.created_by_name || grn.supplier_name || null,
      });
    });
  });

  // Compute average cost BDT per item from GRNs (fallback to item default_unit_cost)
  const itemAvgCostBdt = new Map<string, number>();
  items.forEach((it) => {
    const g = grnStats.get(it.id);
    if (g && g.totalQty > 0 && g.totalBdt > 0) {
      itemAvgCostBdt.set(it.id, g.totalBdt / g.totalQty);
    } else {
      itemAvgCostBdt.set(it.id, Math.max(0, Number(it.default_unit_cost || 0)));
    }
  });

  issues.forEach((issue) => {
    const isApproved = issue.status === 'approved';
    const issueUnit = (issue.unit || 'knit').toLowerCase() === 'woven' ? 'woven' : 'knit';
    const monthKey = (issue.issue_date || issue.created_at || '').slice(0, 7);
    const lines = issue.store_issue_items || [];

    lines.forEach((line) => {
      const qty = Math.max(0, Number(line.qty || 0));
      const item = itemMap.get(line.item_id);
      const unitCost = itemAvgCostBdt.get(line.item_id) || 0;
      const lineBdt = qty * unitCost;

      if (isApproved) {
        const entry = issueStats.get(line.item_id) || {
          knitQty: 0,
          wovenQty: 0,
          totalQty: 0,
        };
        if (issueUnit === 'knit') entry.knitQty += qty;
        else entry.wovenQty += qty;
        entry.totalQty += qty;
        issueStats.set(line.item_id, entry);

        if (monthKey) {
          const mRow = ensureMonthly(monthKey, issueUnit);
          mRow.qty_out += qty;
          mRow.value_out += lineBdt;
          mRow.net_value = mRow.value_in - mRow.value_out;
          monthlyItemsMoved.get(`${monthKey}::${issueUnit}`)?.add(line.item_id);
        }
      }

      recentActivities.push({
        created_at:
          issue.approved_at ||
          issue.created_at ||
          (issue.issue_date ? `${issue.issue_date}T12:00:00+06:00` : ''),
        unit: issueUnit,
        movement_type: 'issue',
        qty_delta: -qty,
        reference_no: issue.issue_no || 'ISSUE',
        sku: item?.sku || null,
        item_name: item?.name || null,
        user_name:
          issue.approved_by_name ||
          [issue.department, issue.purpose].filter(Boolean).join(' · ') ||
          null,
      });
    });
  });

  const statusRows: StoreStockStatusRow[] = items.map((it) => {
    const cat = it.category_id ? categoryMap.get(it.category_id) : undefined;
    const uom = it.uom_id ? uomMap.get(it.uom_id) : undefined;
    const minStock = Math.max(0, Number(it.minimum_stock || 0));

    const g = grnStats.get(it.id);
    const iss = issueStats.get(it.id);
    const fb = fallbackMap.get(it.id);

    const hasDirectMovements = Boolean((g && g.totalQty > 0) || (iss && iss.totalQty > 0));

    let knitQty = 0;
    let wovenQty = 0;
    let currentStock = 0;
    let stockValue = 0;

    if (hasDirectMovements) {
      knitQty = Math.max(0, (g?.knitQty || 0) - (iss?.knitQty || 0));
      wovenQty = Math.max(0, (g?.wovenQty || 0) - (iss?.wovenQty || 0));
      currentStock = knitQty + wovenQty;
      const avgCost = itemAvgCostBdt.get(it.id) || 0;
      stockValue = currentStock * avgCost;
    } else if (fb && Number(fb.current_stock || 0) > 0) {
      knitQty = Number(fb.knit_qty || 0);
      wovenQty = Number(fb.woven_qty || 0);
      currentStock = Number(fb.current_stock || 0);
      stockValue = Number(fb.stock_value || 0);
    }

    let status: StoreStockStatusType = 'in_stock';
    if (!it.is_active) {
      status = 'inactive';
    } else if (currentStock <= 0) {
      status = 'out';
    } else if (minStock > 0 && currentStock <= minStock) {
      status = 'low';
    }

    return {
      item_id: it.id,
      sku: it.sku,
      item_name: it.name,
      item_name_bn: it.name_bn,
      category_name: cat?.name || fb?.category_name || 'Uncategorized',
      uom: uom?.code || fb?.uom || '-',
      minimum_stock: minStock,
      knit_qty: knitQty,
      woven_qty: wovenQty,
      current_stock: currentStock,
      stock_value: stockValue,
      status,
    };
  });

  monthlyMap.forEach((row, key) => {
    row.items_moved = monthlyItemsMoved.get(key)?.size || 0;
  });

  const monthlyRows = Array.from(monthlyMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  recentActivities.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return {
    statusRows,
    monthlyRows,
    recentActivities: recentActivities.slice(0, 40),
    pendingGrnCount,
  };
}
