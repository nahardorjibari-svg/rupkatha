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
    const b = h.backQty !== undefined ? h.backQty : h.back_qty;
    const f = h.frontQty !== undefined ? h.frontQty : h.front_qty;
    const o = h.outputQty !== undefined ? h.outputQty : h.output_qty;

    if (b !== null && b !== undefined && b !== '' && !isNaN(Number(b))) {
      totalBack = (totalBack || 0) + Number(b);
    }
    if (f !== null && f !== undefined && f !== '' && !isNaN(Number(f))) {
      totalFront = (totalFront || 0) + Number(f);
    }
    if (o !== null && o !== undefined && o !== '' && !isNaN(Number(o))) {
      totalOutput = (totalOutput || 0) + Number(o);
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
