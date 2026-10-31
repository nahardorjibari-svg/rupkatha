import type { PlanningOrder, OrderStatusInfo } from '../types/planning';

/**
 * Computes exact status info according to strict 8-step hierarchy
 */
export function getOrderStatus(order: PlanningOrder): OrderStatusInfo {
  const isDone = Boolean(order.is_done);
  const cuttingQty = Number(order.cutting_qty || 0);
  const orderQty = Number(order.order_qty || 0);
  const totalInput = Number(order.total_input || 0);
  const totalOutput = Number(order.total_output || 0);
  const lineNo = (order.line_no || '').trim();

  // 1. PO Done
  if (isDone) {
    return {
      type: 'po_done',
      label: 'PO done',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
      rowTintClass: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    };
  }

  // 2. Not Cut
  if (cuttingQty === 0) {
    return {
      type: 'not_cut',
      label: 'Not cut',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      rowTintClass: 'bg-slate-50/40 dark:bg-slate-900/30',
    };
  }

  // 3. Cutting Running
  if (cuttingQty > 0 && cuttingQty < orderQty) {
    return {
      type: 'cutting_running',
      label: 'Cutting running',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }

  // 4. Cut Done · No Line Yet
  if (cuttingQty >= orderQty && !lineNo) {
    return {
      type: 'cut_done_no_line',
      label: 'Cut done · no line yet',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-700 font-semibold',
      rowTintClass: 'bg-rose-50/70 dark:bg-rose-950/25',
    };
  }

  // 5. Ready to input
  if (totalInput === 0) {
    return {
      type: 'ready_to_input',
      label: 'Ready to input',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }

  // 6. Input pending
  if (totalInput < cuttingQty) {
    const pending = cuttingQty - totalInput;
    return {
      type: 'input_pending',
      label: `Input pending ${pending.toLocaleString()}`,
      pendingCount: pending,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }

  // 7. Input done · output pending
  if (totalInput >= cuttingQty && totalOutput < totalInput) {
    const pending = totalInput - totalOutput;
    return {
      type: 'output_pending',
      label: `Input done · output pending ${pending.toLocaleString()}`,
      pendingCount: pending,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }

  // 8. Sewing done
  return {
    type: 'sewing_done',
    label: 'Sewing done',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
    rowTintClass: 'bg-emerald-50/60 dark:bg-emerald-950/20',
  };
}

/**
 * Builds 30 rolling days starting from Dhaka today
 */
export function buildRolling30Days(dhakaTodayStr: string) {
  const columns = [];
  // Parse YYYY-MM-DD
  const [year, month, day] = dhakaTodayStr.split('-').map(Number);
  
  for (let i = 0; i < 30; i++) {
    // Generate date in UTC or local preserving day offset
    const d = new Date(Date.UTC(year, month - 1, day + i));
    const yStr = d.getUTCFullYear();
    const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dStr = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dayOfWeekIdx = d.getUTCDay();
    const isFriday = dayOfWeekIdx === 5;
    const isToday = i === 0;

    columns.push({
      dateStr,
      displayDay: `${d.getUTCDate()}-${monthNames[d.getUTCMonth()]}`,
      dayOfWeek: dayNames[dayOfWeekIdx],
      isFriday,
      isToday,
    });
  }
  return columns;
}
