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
    if (v !== null && v !== undefined && v !== '' && !isNaN(Number(v))) {
      total += Number(v);
      hasValid = true;
    }
  }
  return hasValid ? total : null;
}

/**
 * Calculates line totals across 10 hours for back, front, output, and asm.
 */
export function calculateLineHourTotals(hoursList = []) {
  let totalBack = null;
  let totalFront = null;
  let totalOutput = null;
  let totalAsm = null;

  for (const h of hoursList) {
    const b = h.backQty !== undefined ? h.backQty : h.back_qty;
    const f = h.frontQty !== undefined ? h.frontQty : h.front_qty;
    const o = h.outputQty !== undefined ? h.outputQty : h.output_qty;
    const a = h.asm !== undefined ? h.asm : h.asm_qty;

    if (b !== null && b !== undefined && b !== '' && !isNaN(Number(b))) {
      totalBack = (totalBack || 0) + Number(b);
    }
    if (f !== null && f !== undefined && f !== '' && !isNaN(Number(f))) {
      totalFront = (totalFront || 0) + Number(f);
    }
    if (o !== null && o !== undefined && o !== '' && !isNaN(Number(o))) {
      totalOutput = (totalOutput || 0) + Number(o);
    }
    if (a !== null && a !== undefined && a !== '' && !isNaN(Number(a))) {
      totalAsm = (totalAsm || 0) + Number(a);
    }
  }

  return { totalBack, totalFront, totalOutput, totalAsm };
}

/**
 * Computes achievement percentage safely: (totalOutput / totalTarget) * 100
 */
export function calculateAchievement(totalOutput, totalTarget) {
  if (totalOutput === null || totalTarget === null || totalTarget <= 0) {
    return null;
  }
  return Number(((totalOutput / totalTarget) * 100).toFixed(1));
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
  if (val === null || val === undefined || val === '' || isNaN(Number(val))) {
    return '-';
  }
  return Number(val).toLocaleString();
}

/**
 * Calculates metrics for a specific part (back, front, output, asm) of a line.
 */
export function calculatePartMetrics(line, part = 'output') {
  let rawHourTarget = null;
  let qtyKey = 'outputQty';
  let altQtyKey = 'output_qty';

  if (part === 'back') {
    rawHourTarget = line.backHourTarget ?? line.back_hour_target;
    qtyKey = 'backQty';
    altQtyKey = 'back_qty';
  } else if (part === 'front') {
    rawHourTarget = line.frontHourTarget ?? line.front_hour_target;
    qtyKey = 'frontQty';
    altQtyKey = 'front_qty';
  } else if (part === 'asm') {
    rawHourTarget = line.asmHourTarget ?? line.asm_hour_target;
    qtyKey = 'asm';
    altQtyKey = 'asm';
  } else {
    rawHourTarget = line.outputHourTarget ?? line.output_hour_target;
    qtyKey = 'outputQty';
    altQtyKey = 'output_qty';
  }

  const hourTarget = (rawHourTarget !== null && rawHourTarget !== undefined && rawHourTarget !== '' && !isNaN(Number(rawHourTarget)))
    ? Number(rawHourTarget)
    : null;

  const rawWorkingHours = line.workingHours ?? line.working_hours;
  const workingHours = (rawWorkingHours !== null && rawWorkingHours !== undefined && rawWorkingHours !== '' && !isNaN(Number(rawWorkingHours)))
    ? Math.max(1, Math.min(10, parseInt(rawWorkingHours, 10)))
    : 8;

  const totalTarget = hourTarget !== null ? hourTarget * workingHours : null;

  // Calculate total actual
  let totalActual = null;
  const hoursList = line.hours || [];
  for (const h of hoursList) {
    const val = h[qtyKey] !== undefined ? h[qtyKey] : h[altQtyKey];
    if (val !== null && val !== undefined && val !== '' && !isNaN(Number(val))) {
      totalActual = (totalActual || 0) + Number(val);
    }
  }

  let achievement = null;
  let shortExcessQty = null;
  let shortPct = 0;
  let excessPct = 0;
  let status = 'no_target';

  if (totalTarget !== null) {
    if (totalActual === null) {
      status = 'pending';
    } else {
      shortExcessQty = totalActual - totalTarget;
      achievement = totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;
      if (shortExcessQty < 0) {
        status = 'short';
        shortPct = totalTarget > 0 ? Number(((Math.abs(shortExcessQty) / totalTarget) * 100).toFixed(1)) : 0;
      } else if (shortExcessQty === 0) {
        status = 'achieved';
      } else {
        status = 'excess';
        excessPct = totalTarget > 0 ? Number(((shortExcessQty / totalTarget) * 100).toFixed(1)) : 0;
      }
    }
  }

  return {
    hourTarget,
    workingHours,
    totalTarget,
    totalActual,
    achievement,
    shortExcessQty,
    shortPct,
    excessPct,
    status, // 'no_target' | 'pending' | 'short' | 'achieved' | 'excess'
  };
}

/**
 * Calculates hourly Short/Excess and Remaining Target across hours 1 to 10 for a part.
 */
export function calculatePartHourlyBreakdown(line, part = 'output') {
  const metrics = calculatePartMetrics(line, part);
  const { hourTarget, workingHours, totalTarget } = metrics;
  const qtyKey = part === 'back' ? 'backQty' : part === 'front' ? 'frontQty' : part === 'asm' ? 'asm' : 'outputQty';
  const altQtyKey = part === 'back' ? 'back_qty' : part === 'front' ? 'front_qty' : part === 'asm' ? 'asm' : 'output_qty';

  const hourly = [];
  let runningActual = 0;
  let hasStarted = false;

  for (let hr = 1; hr <= 10; hr++) {
    const hObj = (line.hours || []).find((h) => (h.hourNo ?? h.hour_no) === hr) || {};
    const val = hObj[qtyKey] !== undefined ? hObj[qtyKey] : hObj[altQtyKey];

    const hasEntered = val !== null && val !== undefined && val !== '' && !isNaN(Number(val));
    const hourActual = hasEntered ? Number(val) : null;

    if (hasEntered) {
      runningActual += hourActual;
      hasStarted = true;
    }

    // Cumulative target counts up to min(hr, workingHours)
    const cumTarget = hourTarget !== null ? hourTarget * Math.min(hr, workingHours) : null;
    const cumActual = hasStarted ? runningActual : null;

    // Short/Excess for this hour = cumulative actual - cumulative target
    const shortExcess = (hasStarted && cumTarget !== null) ? runningActual - cumTarget : null;

    // Remaining Target for this hour = Total Target - cumulative actual (never below 0 for display)
    const remaining = (hasStarted && totalTarget !== null)
      ? Math.max(0, totalTarget - runningActual)
      : (totalTarget !== null && !hasStarted ? totalTarget : null);

    // Difference for this single hour vs Hour Target
    const hourDiff = (hourActual !== null && hourTarget !== null) ? hourActual - hourTarget : null;

    hourly.push({
      hourNo: hr,
      hourActual,
      cumActual,
      cumTarget,
      shortExcess,
      remaining,
      hourDiff,
    });
  }

  return {
    metrics,
    hourly,
  };
}

/**
 * Top Management Summary for a group of lines (e.g. for a date or factory unit).
 */
export function calculateManagementSummary(linesList = []) {
  const parts = ['output', 'back', 'front', 'asm'];
  const summaryByPart = {};

  parts.forEach((p) => {
    let sumTarget = 0;
    let sumActual = 0;
    let hasTarget = false;
    let hasActual = false;

    linesList.forEach((line) => {
      const m = calculatePartMetrics(line, p);
      if (m.totalTarget !== null) {
        sumTarget += m.totalTarget;
        hasTarget = true;
        if (m.totalActual !== null) {
          sumActual += m.totalActual;
          hasActual = true;
        }
      }
    });

    const totalTarget = hasTarget ? sumTarget : null;
    const totalActual = hasActual ? sumActual : (hasTarget ? 0 : null);
    const shortExcessQty = (totalTarget !== null && totalActual !== null) ? totalActual - totalTarget : null;
    const shortQty = shortExcessQty !== null && shortExcessQty < 0 ? Math.abs(shortExcessQty) : 0;
    const shortPct = (totalTarget && totalTarget > 0 && shortQty > 0)
      ? Number(((shortQty / totalTarget) * 100).toFixed(1))
      : 0;
    const achievement = (totalTarget && totalTarget > 0 && totalActual !== null)
      ? Number(((totalActual / totalTarget) * 100).toFixed(1))
      : null;

    summaryByPart[p] = {
      totalTarget,
      totalActual,
      shortExcessQty,
      shortQty,
      shortPct,
      achievement,
      status: shortExcessQty === null ? 'no_target' : shortExcessQty < 0 ? 'short' : shortExcessQty === 0 ? 'achieved' : 'excess',
    };
  });

  // Per-line breakdown (primary focus on Out Put)
  const lineSummaries = linesList.map((line) => {
    const lineNo = line.lineNo ?? line.line_no;
    const buyer = line.buyerName ?? line.buyer_name ?? '-';
    const style = line.styleNo ?? line.style_no ?? '-';
    const outMetrics = calculatePartMetrics(line, 'output');
    const backMetrics = calculatePartMetrics(line, 'back');
    const frontMetrics = calculatePartMetrics(line, 'front');
    const asmMetrics = calculatePartMetrics(line, 'asm');

    return {
      lineNo,
      factoryUnit: line.factory_unit || line.unit || '',
      buyer,
      style,
      output: outMetrics,
      back: backMetrics,
      front: frontMetrics,
      asm: asmMetrics,
    };
  });

  // Calculate best and worst line by Out Put achievement % among lines with a target
  const linesWithTargetAndActual = lineSummaries.filter(
    (l) => l.output.totalTarget !== null && l.output.achievement !== null
  );

  let bestLine = null;
  let worstLine = null;

  if (linesWithTargetAndActual.length > 0) {
    linesWithTargetAndActual.sort((a, b) => (b.output.achievement || 0) - (a.output.achievement || 0));
    bestLine = linesWithTargetAndActual[0];
    worstLine = linesWithTargetAndActual[linesWithTargetAndActual.length - 1];
  }

  return {
    byPart: summaryByPart,
    lines: lineSummaries,
    bestLine,
    worstLine,
  };
}
