/**
 * Sewing ERP Calculations & NULL-safe Utilities
 * Rupkatha Apparels Ltd. (src/lib/sewingCalc.js)
 */

/**
 * Safely adds numbers, ignoring null/undefined values.
 * Returns null if all values are null/undefined.
 */
export function safeSum(...values) {
  let hasValid = false;
  let total = 0;
  for (const v of values) {
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      total += Number(v);
      hasValid = true;
    }
  }
  return hasValid ? total : null;
}

/**
 * Calculates line totals across 10 hours for back, front, and output.
 */
export function calculateLineHourTotals(hoursList = []) {
  let totalBack = null;
  let totalFront = null;
  let totalOutput = null;

  for (const h of hoursList) {
    if (h.back_qty !== null && h.back_qty !== undefined) {
      totalBack = (totalBack || 0) + Number(h.back_qty);
    }
    if (h.front_qty !== null && h.front_qty !== undefined) {
      totalFront = (totalFront || 0) + Number(h.front_qty);
    }
    if (h.output_qty !== null && h.output_qty !== undefined) {
      totalOutput = (totalOutput || 0) + Number(h.output_qty);
    }
  }

  return { totalBack, totalFront, totalOutput };
}

/**
 * Computes achievement percentage safely: (totalOutput / totalTarget) * 100
 */
export function calculateAchievement(totalOutput, totalTarget) {
  if (totalOutput === null || totalTarget === null || totalTarget <= 0) {
    return null;
  }
  return Math.round((totalOutput / totalTarget) * 100);
}

/**
 * Computes output per manpower ratio: totalOutput / manpowerTotal
 */
export function calculateOutputPerManpower(totalOutput, manpowerTotal) {
  if (totalOutput === null || manpowerTotal === null || manpowerTotal <= 0) {
    return null;
  }
  return Number((totalOutput / manpowerTotal).toFixed(1));
}

/**
 * Formats a number or returns '-' if null
 */
export function formatNum(val) {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '-';
  }
  return Number(val).toLocaleString();
}
