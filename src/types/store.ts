/**
 * Store & Inventory Module Types & Role Capability Helpers
 * Rupkatha Apparels Ltd.
 */

export type StoreUnit = 'knit' | 'woven';
export type StoreCurrency = 'BDT' | 'USD';
export type StoreStockStatusType = 'in_stock' | 'low' | 'out' | 'inactive';
export type StoreGrnStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface StoreCategory {
  id: string;
  code: string;
  name: string;
  name_bn?: string | null;
  description?: string | null;
  parent_id?: string | null;
  is_active: boolean;
}

export interface StoreUom {
  id: string;
  code: string;
  name: string;
  decimal_places: number;
  is_active: boolean;
}

export interface StoreWarehouse {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface StoreItemExtraFields {
  gsm?: string | number | null;
  width?: string | null;
  composition?: string | null;
  count?: string | null;
  type?: string | null;
  lot?: string | null;
  [key: string]: unknown;
}

export interface StoreItem {
  id: string;
  sku: string;
  name: string;
  name_bn?: string | null;
  category_id?: string | null;
  uom_id?: string | null;
  item_type?: string | null;
  description?: string | null;
  minimum_stock: number;
  default_unit_cost: number;
  default_currency: StoreCurrency | string;
  extra_fields?: StoreItemExtraFields | null;
  is_active: boolean;
}

export interface StoreGrn {
  id: string;
  grn_no: string;
  grn_date: string;
  warehouse_id: string;
  unit: StoreUnit;
  supplier_name: string;
  challan_no?: string | null;
  po_reference?: string | null;
  currency: StoreCurrency;
  exchange_rate: number;
  remarks?: string | null;
  status: StoreGrnStatus;
  created_by?: string | null;
  created_by_name?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  store_grn_items?: StoreGrnItem[];
}

export interface StoreGrnItem {
  id?: string;
  grn_id?: string;
  item_id: string;
  qty: number;
  unit_price: number;
  batch_no?: string | null;
  remarks?: string | null;
}

// Read-only Database Views

export interface StoreStockStatusRow {
  item_id: string;
  sku: string;
  item_name: string;
  item_name_bn?: string | null;
  category_name: string;
  uom: string;
  minimum_stock: number;
  knit_qty: number;
  woven_qty: number;
  current_stock: number;
  stock_value: number;
  status: StoreStockStatusType;
}

export interface StoreCategoryValueRow {
  category_name: string;
  item_count: number;
  stock_value: number;
}

export interface StoreMonthlyMovementRow {
  month: string; // e.g. '2026-11' or '2026-11-01'
  unit: StoreUnit | string;
  qty_in: number;
  qty_out: number;
  value_in: number;
  value_out: number;
  net_value: number;
  items_moved: number;
}

export interface StoreRecentActivityRow {
  created_at: string;
  unit: StoreUnit | string;
  movement_type: string; // 'grn' | 'issue' | 'transfer_in' | 'transfer_out' | 'adj_*'
  qty_delta: number;
  reference_no?: string | null;
  sku?: string | null;
  item_name?: string | null;
  user_name?: string | null;
}

// Role-based Store Access & Capabilities (reads profiles.role + profiles.is_active)

export const STORE_ALLOWED_ROLES = [
  'admin',
  'store_keeper',
  'store_manager',
  'production_manager',
  'accounts',
] as const;

export type StoreAllowedRole = (typeof STORE_ALLOWED_ROLES)[number];

export function canAccessStore(role?: string | null, isActive?: boolean | null): boolean {
  if (isActive === false) return false;
  if (!role) return false;
  return (STORE_ALLOWED_ROLES as readonly string[]).includes(role);
}

export function canEditGrn(role?: string | null, isActive?: boolean | null): boolean {
  if (!canAccessStore(role, isActive)) return false;
  return role === 'admin' || role === 'store_keeper' || role === 'store_manager';
}

export function canApproveGrn(role?: string | null, isActive?: boolean | null): boolean {
  if (!canAccessStore(role, isActive)) return false;
  return role === 'admin' || role === 'store_manager';
}

export function canEditItems(role?: string | null, isActive?: boolean | null): boolean {
  if (!canAccessStore(role, isActive)) return false;
  return role === 'admin';
}

export function canDeleteStoreDocument(
  role?: string | null,
  isActive?: boolean | null,
  status?: string | null,
  createdBy?: string | null,
  currentUserId?: string | null
): boolean {
  if (!canAccessStore(role, isActive)) return false;
  if (status !== 'draft' && status !== 'rejected') return false;
  if (role === 'admin' || role === 'store_manager') return true;
  if (role === 'store_keeper') {
    return Boolean(currentUserId && createdBy && createdBy === currentUserId);
  }
  return false;
}

export function isAccountsReadOnly(role?: string | null): boolean {
  return role === 'accounts';
}
