/**
 * Planning & Production TypeScript Types
 * Rupkatha Apparels Ltd.
 */

export interface PlanningOrder {
  id: string;
  po: string;
  style: string | null;
  colour: string;
  wash: string | null;
  order_qty: number;
  line_no: string;
  start_date: string | null;
  cutting_qty: number;
  wash_send: number;
  factory_unit: 'knit' | 'woven';
  is_done: boolean;
  total_input?: number;
  total_output?: number;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PlanningDaily {
  id?: string;
  order_id: string;
  entry_date: string; // YYYY-MM-DD
  input_qty: number | null;
  output_qty: number | null;
  entered_by?: string | null;
  updated_at?: string;
}

export type PlanningTab = 'active' | 'upcoming' | 'done';

export interface DayColumn {
  dateStr: string; // YYYY-MM-DD
  displayDay: string; // e.g. "24-Oct"
  dayOfWeek: string; // e.g. "Fri", "Sat"
  isFriday: boolean;
  isToday: boolean;
}

export type OrderStatusType = 
  | 'po_done'
  | 'not_cut'
  | 'cutting_running'
  | 'cut_done_no_line'
  | 'ready_to_input'
  | 'input_pending'
  | 'output_pending'
  | 'sewing_done';

export interface OrderStatusInfo {
  type: OrderStatusType;
  label: string;
  badgeClass: string;
  rowTintClass: string;
  pendingCount?: number;
}
