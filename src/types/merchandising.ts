/**
 * Merchandising & Auto Costing Module Types
 * Rupkatha Apparels Ltd.
 */

export type MerchUnit = 'woven' | 'knit';
export type MerchCurrency = 'USD' | 'BDT';
export type ConsumptionBasis = 'per_pc' | 'per_dzn';
export type CostingStatus = 'draft' | 'submitted' | 'approved';
export type CostHeadKey =
  | 'fabric'
  | 'sewing_thread'
  | 'labels'
  | 'accessories'
  | 'embellishment'
  | 'commercial'
  | 'overhead';

export interface GarmentCostHeadMeta {
  key: CostHeadKey | 'cm';
  order: number;
  label: string;
  shortLabel: string;
  labelBn: string;
  description: string;
  dbFallbackType: 'fabric' | 'trims' | 'accessories' | 'other';
  isBomHead: boolean;
}

export const GARMENT_COST_HEADS: GarmentCostHeadMeta[] = [
  {
    key: 'fabric',
    order: 1,
    label: '1. Fabric',
    shortLabel: 'Fabric',
    labelBn: 'ফেব্রিক (মূল কাপড় ও রিব)',
    description: 'Main shell fabric, contrast, rib, collar/cuff, pocketing',
    dbFallbackType: 'fabric',
    isBomHead: true,
  },
  {
    key: 'sewing_thread',
    order: 2,
    label: '2. Sewing Thread',
    shortLabel: 'Sewing Thread',
    labelBn: 'সুইং থ্রেড (সেলাই সুতা)',
    description: 'Spun polyester, core spun, overlock & flatlock thread',
    dbFallbackType: 'trims',
    isBomHead: true,
  },
  {
    key: 'labels',
    order: 3,
    label: '3. Labels (Main, Care, Size)',
    shortLabel: 'Labels',
    labelBn: 'লেবেল (মেইন, কেয়ার, সাইজ)',
    description: 'Woven/printed main label, care label, size tab, hangtag',
    dbFallbackType: 'trims',
    isBomHead: true,
  },
  {
    key: 'accessories',
    order: 4,
    label: '4. Accessories & Trims',
    shortLabel: 'Accessories & Trims',
    labelBn: 'বাটন, জিপার, ইলাস্টিক, পলি ও কার্টন',
    description: 'Button, zipper, elastic, drawcord, polybag, master carton',
    dbFallbackType: 'accessories',
    isBomHead: true,
  },
  {
    key: 'embellishment',
    order: 5,
    label: '5. Embellishment & Processing',
    shortLabel: 'Embellishment',
    labelBn: 'প্রিন্টিং, এমব্রয়ডারি ও ওয়াশিং',
    description: 'Screen/AOP printing, embroidery, garments/enzyme wash',
    dbFallbackType: 'other',
    isBomHead: true,
  },
  {
    key: 'cm',
    order: 6,
    label: '6. CM (Cost of Making / Sewing)',
    shortLabel: 'CM (Making)',
    labelBn: 'সিএম (কাটিং, সুইং ও ফিনিশিং মজুরি)',
    description: 'Calculated from SMV × Cost/Min ÷ Efficiency % or manual CM',
    dbFallbackType: 'other',
    isBomHead: false,
  },
  {
    key: 'commercial',
    order: 7,
    label: '7. Commercial, Freight & Bank Charges',
    shortLabel: 'Commercial & Freight',
    labelBn: 'কমার্শিয়াল, ফ্রেইট ও ব্যাংক চার্জ',
    description: 'B2B L/C commission, local/sea freight, C&F, courier, testing',
    dbFallbackType: 'other',
    isBomHead: true,
  },
  {
    key: 'overhead',
    order: 8,
    label: '8. Overhead & Other Expenses',
    shortLabel: 'Overhead & Other',
    labelBn: 'ফ্যাক্টরি ওভারহেড ও অন্যান্য খরচ',
    description: 'Admin overhead, inspection, miscellaneous contingency',
    dbFallbackType: 'other',
    isBomHead: true,
  },
];

export interface Buyer {
  id: string;
  code: string;
  name: string;
  country?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  default_currency: MerchCurrency | string;
  is_active: boolean;
  created_at?: string | null;
}

export interface OrderColorSize {
  id?: string;
  order_id?: string;
  color_name: string;
  size_name: string;
  ratio_qty: number;
  created_at?: string | null;
}

export interface MerchOrder {
  id: string;
  order_no: string;
  po_no?: string | null;
  buyer_id: string;
  style_no: string;
  item_name: string;
  unit: MerchUnit | string;
  order_qty: number;
  target_ship_date?: string | null;
  smv: number;
  currency: MerchCurrency | string;
  exchange_rate: number;
  status?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  buyers?: Buyer | null;
  order_color_sizes?: OrderColorSize[];
}

export interface OrderCosting {
  id: string;
  order_id: string;
  version: number;
  currency: MerchCurrency | string;
  exchange_rate: number;
  fabric_cost_pc: number;
  accessories_cost_pc: number;
  cm_cost_pc: number;
  total_cost_pc: number;
  total_order_cost: number;
  offered_fob_price: number;
  profit_per_pc: number;
  profit_margin_percent: number;
  total_profit: number;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  order_costing_items?: OrderCostingItem[];
}

export interface OrderCostingItem {
  id?: string;
  costing_id?: string;
  store_item_id?: string | null;
  item_name: string;
  item_type: string; // 'fabric' | 'accessories' | 'trims' | 'packing' | 'other'
  uom: string;
  consumption: number;
  consumption_basis: ConsumptionBasis | string;
  wastage_percent: number;
  total_required_qty: number;
  unit_price: number;
  is_overridden: boolean;
  cost_per_pc: number;
  total_cost: number;
  currency: MerchCurrency | string;
  created_at?: string | null;
}

export type BookingType = 'TRIMS' | 'FABRIC' | 'SEWING_THREAD' | 'PACKING';

export type BookingSensitivity =
  | 'GARMENT_COLOR'
  | 'SIZE'
  | 'CONTRAST_COLOR'
  | 'COLOR_SIZE'
  | 'NONE';

export type BookingStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface SensitivityMeta {
  key: BookingSensitivity;
  label: string;
  pdfHeader: string;
  labelBn: string;
  exampleHint: string;
}

export const BOOKING_SENSITIVITY_META: SensitivityMeta[] = [
  {
    key: 'GARMENT_COLOR',
    label: 'As Per Garments Color',
    pdfHeader: 'As Per Garments Color',
    labelBn: 'গার্মেন্টস কালার অনুযায়ী',
    exampleHint: 'e.g. Carton Sticker, Zipper, Drawcord',
  },
  {
    key: 'SIZE',
    label: 'Size Sensitive',
    pdfHeader: 'Size Sensitive',
    labelBn: 'সাইজ অনুযায়ী',
    exampleHint: 'e.g. Main Label, Care Label, Size Tab',
  },
  {
    key: 'CONTRAST_COLOR',
    label: 'Contrast Color',
    pdfHeader: 'Contrast Color',
    labelBn: 'কন্ট্রাস্ট কালার',
    exampleHint: 'e.g. Safety Pin, Contrast Thread',
  },
  {
    key: 'COLOR_SIZE',
    label: 'Color & Size Sensitive',
    pdfHeader: 'Color & size sensitive',
    labelBn: 'কালার ও সাইজ উভয় অনুযায়ী',
    exampleHint: 'e.g. Polybag Sticker, Hangtag Barcode Sticker',
  },
  {
    key: 'NONE',
    label: 'No Sensitivity',
    pdfHeader: 'No Sensitivity',
    labelBn: 'সাধারণ (কোনো সেন্সিটিভিটি নেই)',
    exampleHint: 'e.g. Hang Tag with String, Tissue Paper, Polybag',
  },
];

export interface MaterialBookingItem {
  id?: string;
  booking_id?: string;
  order_id: string;
  store_item_id?: string | null;
  sensitivity: BookingSensitivity | string;
  item_group: string;
  item_description: string;
  gmts_color?: string | null;
  item_color?: string | null;
  gmts_size?: string | null;
  item_size?: string | null;
  order_qty: number;
  consumption: number;
  wastage_percent: number;
  required_qty: number;
  wo_qty: number;
  uom: string;
  cone_length?: number | null;
  cost_per_dzn?: number | null;
  unit_rate: number;
  total_amount: number;
  remarks?: string | null;
  created_at?: string | null;
  orders?: MerchOrder | null;
}

export interface MaterialBooking {
  id: string;
  booking_no: string;
  booking_type: BookingType | string;
  supplier_name: string;
  supplier_address?: string | null;
  buyer_id?: string | null;
  dealing_merchant?: string | null;
  delivery_to?: string | null;
  pay_mode?: string | null;
  source_type?: string | null;
  currency: MerchCurrency | string;
  exchange_rate: number;
  booking_date: string;
  delivery_date?: string | null;
  shipment_date?: string | null;
  status?: string | null;
  approval_status?: string | null;
  prepared_by?: string | null;
  prepared_at?: string | null;
  checked_by?: string | null;
  checked_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  buyers?: Buyer | null;
  material_booking_items?: MaterialBookingItem[];
}

export type CommercialLcType = 'MASTER_LC' | 'BTB_LC';

export interface SupplierPi {
  id: string;
  pi_no: string;
  pi_date: string;
  supplier_name: string;
  booking_id?: string | null;
  order_id?: string | null;
  currency: MerchCurrency | string;
  pi_value: number;
  status: string; // 'Received' | 'Approved'
  remarks?: string | null;
  created_at?: string | null;
  material_bookings?: MaterialBooking | null;
}

export interface CommercialLc {
  id: string;
  lc_number: string;
  lc_type: CommercialLcType | string;
  lc_date: string;
  buyer_id?: string | null;
  master_lc_id?: string | null;
  pi_id?: string | null;
  supplier_name?: string | null;
  issuing_bank?: string | null;
  currency: MerchCurrency | string;
  lc_value: number;
  expiry_date?: string | null;
  maturity_date?: string | null;
  bank_charges?: number | null;
  status: string;
  created_at?: string | null;
  buyers?: Buyer | null;
  supplier_pis?: SupplierPi | null;
}


