import type { PlanningOrder, OrderStatusInfo } from '../types/planning';

/**
 * Computes exact status info according to view status_key and strict hierarchy
 */
export function getOrderStatus(order: PlanningOrder): OrderStatusInfo {
  const statusKey = order.status_key;
  const isDone = Boolean(order.is_done) || statusKey === 'po_done';
  const cuttingQty = Number(order.cutting_qty || 0);
  const orderQty = Number(order.order_qty || 0);
  const totalInput = Number(order.total_input || 0);
  const totalOutput = Number(order.total_output || 0);
  const totalWashSent = Number(order.total_wash_sent || 0);
  const totalWashRecv = Number(order.total_wash_recv || 0);
  const totalFinishing = Number(order.total_finishing || 0);
  const lineNo = (order.line_no || '').trim();

  // 1. If statusKey is provided by view, map it directly:
  if (statusKey) {
    switch (statusKey) {
      case 'po_done':
        return {
          type: 'po_done',
          label: 'PO done ✓',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 font-bold',
          rowTintClass: 'bg-emerald-50/60 dark:bg-emerald-950/20',
        };
      case 'not_cut':
        return {
          type: 'not_cut',
          label: 'Not cut',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
          rowTintClass: 'bg-slate-50/40 dark:bg-slate-900/30',
        };
      case 'cutting_running':
        return {
          type: 'cutting_running',
          label: 'Cutting running',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
          rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
        };
      case 'cut_no_line':
      case 'cut_done_no_line':
        return {
          type: 'cut_no_line',
          label: 'Cut done · no line yet',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 font-semibold',
          rowTintClass: 'bg-rose-50/70 dark:bg-rose-950/25',
        };
      case 'ready_input':
      case 'ready_to_input':
        return {
          type: 'ready_to_input',
          label: 'Ready to input',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
          rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
        };
      case 'input_pending': {
        const pending = Math.max(0, cuttingQty - totalInput);
        return {
          type: 'input_pending',
          label: `Input pending ${pending.toLocaleString()}`,
          pendingCount: pending,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
          rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
        };
      }
      case 'output_pending': {
        const pending = Math.max(0, totalInput - totalOutput);
        return {
          type: 'output_pending',
          label: `Input done · output pending ${pending.toLocaleString()}`,
          pendingCount: pending,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
          rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
        };
      }
      case 'sewing_done':
        return {
          type: 'sewing_done',
          label: 'Sewing done · send to wash',
          badgeClass: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-200',
          rowTintClass: 'bg-teal-50/60 dark:bg-teal-950/20',
        };
      case 'wash_pending': {
        const pending = Math.max(0, totalWashSent - totalWashRecv);
        return {
          type: 'wash_pending',
          label: `Wash sent · waiting recv ${pending.toLocaleString()}`,
          pendingCount: pending,
          badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200',
          rowTintClass: 'bg-orange-50/50 dark:bg-orange-950/15',
        };
      }
      case 'finishing_pending': {
        const pending = Math.max(0, totalWashRecv - totalFinishing);
        return {
          type: 'finishing_pending',
          label: `Wash recv · finishing pending ${pending.toLocaleString()}`,
          pendingCount: pending,
          badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200',
          rowTintClass: 'bg-purple-50/50 dark:bg-purple-950/15',
        };
      }
    }
  }

  // Fallback computation if status_key is missing
  if (isDone) {
    return {
      type: 'po_done',
      label: 'PO done ✓',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 font-bold',
      rowTintClass: 'bg-emerald-50/60 dark:bg-emerald-950/20',
    };
  }
  if (cuttingQty === 0) {
    return {
      type: 'not_cut',
      label: 'Not cut',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
      rowTintClass: 'bg-slate-50/40 dark:bg-slate-900/30',
    };
  }
  if (cuttingQty > 0 && cuttingQty < orderQty) {
    return {
      type: 'cutting_running',
      label: 'Cutting running',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }
  if (cuttingQty >= orderQty && !lineNo) {
    return {
      type: 'cut_no_line',
      label: 'Cut done · no line yet',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 font-semibold',
      rowTintClass: 'bg-rose-50/70 dark:bg-rose-950/25',
    };
  }
  if (totalInput === 0) {
    return {
      type: 'ready_to_input',
      label: 'Ready to input',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }
  if (totalInput < cuttingQty) {
    const pending = cuttingQty - totalInput;
    return {
      type: 'input_pending',
      label: `Input pending ${pending.toLocaleString()}`,
      pendingCount: pending,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }
  if (totalInput >= cuttingQty && totalOutput < totalInput) {
    const pending = totalInput - totalOutput;
    return {
      type: 'output_pending',
      label: `Input done · output pending ${pending.toLocaleString()}`,
      pendingCount: pending,
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200',
      rowTintClass: 'bg-amber-50/50 dark:bg-amber-950/15',
    };
  }
  if (totalWashSent > totalWashRecv) {
    const pending = totalWashSent - totalWashRecv;
    return {
      type: 'wash_pending',
      label: `Wash sent · waiting recv ${pending.toLocaleString()}`,
      pendingCount: pending,
      badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200',
      rowTintClass: 'bg-orange-50/50 dark:bg-orange-950/15',
    };
  }
  if (totalWashRecv > totalFinishing) {
    const pending = totalWashRecv - totalFinishing;
    return {
      type: 'finishing_pending',
      label: `Wash recv · finishing pending ${pending.toLocaleString()}`,
      pendingCount: pending,
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200',
      rowTintClass: 'bg-purple-50/50 dark:bg-purple-950/15',
    };
  }
  return {
    type: 'sewing_done',
    label: 'Sewing done · send to wash',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-200',
    rowTintClass: 'bg-teal-50/60 dark:bg-teal-950/20',
  };
}

/**
 * Builds rolling window of days starting from a base Dhaka date with an offset
 */
export function buildWindowDays(
  dhakaTodayStr: string,
  offsetDays = -1,
  count = 8
) {
  const columns = [];
  const [year, month, day] = dhakaTodayStr.split('-').map(Number);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(year, month - 1, day + offsetDays + i));
    const yStr = d.getUTCFullYear();
    const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dStr = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    const dayOfWeekIdx = d.getUTCDay();
    const isFriday = dayOfWeekIdx === 5;
    const isToday = dateStr === dhakaTodayStr;

    columns.push({
      dateStr,
      displayDay: `${dStr}/${mStr}`,
      dayOfWeek: dayNames[dayOfWeekIdx],
      isFriday,
      isToday,
    });
  }
  return columns;
}

/**
 * Builds 30 rolling days starting from Dhaka today
 */
export function buildRolling30Days(dhakaTodayStr: string) {
  return buildWindowDays(dhakaTodayStr, 0, 30);
}
