/**
 * Line Dashboard Calculations, Themes, Dhaka Clock & Audio Alert Utilities
 * Rupkatha Apparels Ltd. (src/lib/lineDashboardUtils.ts)
 */

export type LinePartKey = 'back' | 'front' | 'asm' | 'output';

export interface LineThemeConfig {
  lineNo: number;
  name: string;
  accentHex: string;
  dotClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  badgeBorderClass: string;
}

export const LINE_THEMES: Record<number, LineThemeConfig> = {
  1: {
    lineNo: 1,
    name: 'Line 1',
    accentHex: '#3B82F6',
    dotClass: 'bg-blue-500',
    badgeBgClass: 'bg-blue-600',
    badgeTextClass: 'text-blue-700',
    badgeBorderClass: 'border-blue-400',
  },
  2: {
    lineNo: 2,
    name: 'Line 2',
    accentHex: '#A855F7',
    dotClass: 'bg-purple-500',
    badgeBgClass: 'bg-purple-600',
    badgeTextClass: 'text-purple-700',
    badgeBorderClass: 'border-purple-400',
  },
  3: {
    lineNo: 3,
    name: 'Line 3',
    accentHex: '#F97316',
    dotClass: 'bg-orange-500',
    badgeBgClass: 'bg-orange-600',
    badgeTextClass: 'text-orange-700',
    badgeBorderClass: 'border-orange-400',
  },
  4: {
    lineNo: 4,
    name: 'Line 4',
    accentHex: '#14B8A6',
    dotClass: 'bg-teal-500',
    badgeBgClass: 'bg-teal-600',
    badgeTextClass: 'text-teal-700',
    badgeBorderClass: 'border-teal-400',
  },
};

export function getLineTheme(lineNo: number): LineThemeConfig {
  return LINE_THEMES[lineNo] || LINE_THEMES[1];
}

export const LINE_PART_ROWS: Array<{
  key: LinePartKey;
  label: string;
  targetField: 'back_hour_target' | 'front_hour_target' | 'asm_hour_target' | 'output_hour_target';
  qtyField: 'back_qty' | 'front_qty' | 'asm' | 'output_qty';
}> = [
  { key: 'back', label: 'BACK', targetField: 'back_hour_target', qtyField: 'back_qty' },
  { key: 'front', label: 'FRONT', targetField: 'front_hour_target', qtyField: 'front_qty' },
  { key: 'asm', label: 'A.S.M', targetField: 'asm_hour_target', qtyField: 'asm' },
  { key: 'output', label: 'Q.C.P', targetField: 'output_hour_target', qtyField: 'output_qty' },
];

/**
 * Strictly distinguishes NULL / empty from numeric 0.
 * NULL = not entered; 0 = entered zero.
 */
export function parseNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export interface DhakaClockInfo {
  dateStr: string; // YYYY-MM-DD
  formattedDate: string; // e.g. "18 Nov 2026, Wed"
  formattedTime: string; // e.g. "10:24 AM"
  hour24: number;
  minute: number;
}

const BANGLA_WEEKDAYS: Record<string, string> = {
  Sun: 'রবিবার',
  Mon: 'সোমবার',
  Tue: 'মঙ্গলবার',
  Wed: 'বুধবার',
  Thu: 'বৃহস্পতিবার',
  Fri: 'শুক্রবার',
  Sat: 'শনিবার',
};

export function getDhakaClockInfo(now = new Date()): DhakaClockInfo {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  }).formatToParts(now);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const enWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
  }).format(now);
  const banglaWeekday = BANGLA_WEEKDAYS[enWeekday] || getPart('weekday');
  const formattedDate = `${getPart('day')} ${getPart('month')} ${getPart('year')}, ${banglaWeekday}`;

  const formattedTime = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const time24 = now.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const [hh, mm] = time24.split(':').map(Number);

  return {
    dateStr,
    formattedDate,
    formattedTime,
    hour24: Number.isFinite(hh) ? hh : 8,
    minute: Number.isFinite(mm) ? mm : 0,
  };
}

/**
 * Estimates elapsed factory shift hours in Dhaka (8:00 AM start, 13:00-14:00 lunch break)
 * Used as fallback for remaining time only when no hours are entered yet.
 */
export function getClockElapsedShiftHours(clock: DhakaClockInfo, workingHours: number): number {
  const decimalHour = clock.hour24 + clock.minute / 60;
  if (decimalHour <= 8) return 0;
  let elapsed = decimalHour - 8;
  // Subtract 1 hour lunch break between 13:00 and 14:00
  if (decimalHour > 14) {
    elapsed -= 1;
  } else if (decimalHour > 13) {
    elapsed -= decimalHour - 13;
  }
  return Math.max(0, Math.min(workingHours, Math.floor(elapsed)));
}

/**
 * Returns the Dhaka 24h decimal end time of a shift hour (8:00 AM start, 13:00-14:00 lunch break).
 * H1..H5 end at 9:00..13:00 (1:00 PM); H6..H12 end at 15:00..21:00.
 */
export function getShiftHourEndDecimal(hourNo: number): number {
  return hourNo <= 5 ? 8 + hourNo : 9 + hourNo;
}

export type CellVisualState = 'good' | 'short' | 'running' | 'entry_due' | 'empty' | 'neutral';

export interface PartRowCell {
  hourNo: number;
  value: number | null;
  state: CellVisualState;
}

export interface PartRowSummary {
  key: LinePartKey;
  label: string;
  hourTarget: number | null;
  enteredCount: number;
  total: number | null;
  totalStatus: 'good' | 'short' | 'neutral';
  cells: PartRowCell[];
}

export interface LineBoardMetrics {
  lineNo: number;
  hasReport: boolean;
  buyer: string;
  style: string;
  po: string;
  orderQty: number | null;
  workingHours: number;
  hourlyTarget: number | null;
  dayTarget: number | null;
  done: number;
  remaining: number | null;
  exceededBy: number;
  isGoalMet: boolean;
  isExceeded: boolean;
  progressPct: number;
  enteredQcpHours: number;
  remainingHours: number;
  currentRunningHour: number | null;
  isRunningHourEntryDue: boolean;
  // Latest Q.C.P hour
  latestHourNo: number | null;
  latestProduced: number | null;
  latestTarget: number | null;
  latestShort: number | null; // target - produced (> 0 means short)
  isLatestHourShort: boolean;
  // Performance / efficiency
  targetSoFar: number | null;
  efficiencyPct: number | null;
  // Manpower
  manpowerTotal: number | null;
  op: number | null;
  hp: number | null;
  ir: number | null;
  lineChiefName: string;
  // Hourly rows (BACK, FRONT, A.S.M, Q.C.P)
  rows: PartRowSummary[];
  // 10 mini dots for All Lines card
  qcpDots: CellVisualState[];
}

export function computeLineBoardMetrics(
  lineData: any | null | undefined,
  lineNo: number,
  clock: DhakaClockInfo
): LineBoardMetrics {
  if (!lineData) {
    return {
      lineNo,
      hasReport: false,
      buyer: '-',
      style: '-',
      po: '-',
      orderQty: null,
      workingHours: 8,
      hourlyTarget: null,
      dayTarget: null,
      done: 0,
      remaining: null,
      exceededBy: 0,
      isGoalMet: false,
      isExceeded: false,
      progressPct: 0,
      enteredQcpHours: 0,
      remainingHours: 8,
      currentRunningHour: null,
      isRunningHourEntryDue: false,
      latestHourNo: null,
      latestProduced: null,
      latestTarget: null,
      latestShort: null,
      isLatestHourShort: false,
      targetSoFar: null,
      efficiencyPct: null,
      manpowerTotal: null,
      op: null,
      hp: null,
      ir: null,
      lineChiefName: '-',
      rows: LINE_PART_ROWS.map((p) => ({
        key: p.key,
        label: p.label,
        hourTarget: null,
        enteredCount: 0,
        total: null,
        totalStatus: 'neutral',
        cells: Array.from({ length: 8 }, (_, idx) => ({
          hourNo: idx + 1,
          value: null,
          state: 'empty' as CellVisualState,
        })),
      })),
      qcpDots: Array.from({ length: 8 }, () => 'empty'),
    };
  }

  const hoursMap = new Map<number, any>();
  for (const h of lineData.hours || lineData.sewing_report_hours || []) {
    const hrNo = Number(h.hour_no ?? h.hourNo);
    if (hrNo >= 1 && hrNo <= 12) {
      hoursMap.set(hrNo, h);
    }
  }

  const rawWorkingHours = parseNullableNumber(lineData.working_hours ?? lineData.workingHours);
  const workingHours = rawWorkingHours !== null ? Math.max(1, Math.min(12, Math.round(rawWorkingHours))) : 8;

  const hourlyTarget = parseNullableNumber(lineData.output_hour_target ?? lineData.outputHourTarget);
  const dayTarget = hourlyTarget !== null ? hourlyTarget * workingHours : null;

  // Determine highest hour with entered Q.C.P (output_qty) value within workingHours
  let maxEnteredQcpHour = 0;
  let maxEnteredAnyHour = 0;
  for (let hr = 1; hr <= workingHours; hr++) {
    const hObj = hoursMap.get(hr);
    if (!hObj) continue;
    if (parseNullableNumber(hObj.output_qty) !== null) {
      maxEnteredQcpHour = hr;
    }
    const anyEntered = LINE_PART_ROWS.some(
      (p) => parseNullableNumber(hObj[p.qtyField]) !== null
    );
    if (anyEntered) maxEnteredAnyHour = hr;
  }

  // Running hour: next Q.C.P hour after latest entered Q.C.P hour (within workingHours),
  // or based on Dhaka shift clock if no Q.C.P hours entered yet during shift.
  let currentRunningHour: number | null = null;
  if (maxEnteredQcpHour > 0) {
    if (maxEnteredQcpHour < workingHours) {
      currentRunningHour = maxEnteredQcpHour + 1;
    }
  } else {
    const decimalHour = clock.hour24 + clock.minute / 60;
    if (decimalHour >= 8 && decimalHour < 22) {
      const clockHr = getClockElapsedShiftHours(clock, workingHours) + 1;
      if (clockHr >= 1 && clockHr <= workingHours) {
        currentRunningHour = clockHr;
      }
    } else {
      currentRunningHour = 1;
    }
  }

  const decimalHourNow = clock.hour24 + clock.minute / 60;
  const isRunningHourEntryDue =
    currentRunningHour !== null && decimalHourNow >= getShiftHourEndDecimal(currentRunningHour);

  // Build rows in exact order: BACK, FRONT, A.S.M, Q.C.P (scoped to line's workingHours)
  const rows: PartRowSummary[] = LINE_PART_ROWS.map((part) => {
    const hourTarget = parseNullableNumber(lineData[part.targetField]);
    let enteredCount = 0;
    let totalSum = 0;

    const cells: PartRowCell[] = [];
    for (let hr = 1; hr <= workingHours; hr++) {
      const hObj = hoursMap.get(hr);
      const val = hObj ? parseNullableNumber(hObj[part.qtyField]) : null;

      let state: CellVisualState = 'empty';
      if (val !== null) {
        enteredCount++;
        totalSum += val;
        if (hourTarget !== null && hourTarget > 0) {
          state = val >= hourTarget ? 'good' : 'short';
        } else {
          state = 'neutral';
        }
      } else if (currentRunningHour === hr) {
        state = isRunningHourEntryDue ? 'entry_due' : 'running';
      } else {
        state = 'empty';
      }

      cells.push({ hourNo: hr, value: val, state });
    }

    const total = enteredCount > 0 ? totalSum : null;
    let totalStatus: 'good' | 'short' | 'neutral' = 'neutral';
    if (total !== null && hourTarget !== null && hourTarget > 0) {
      const expectedSoFar = hourTarget * enteredCount;
      totalStatus = total >= expectedSoFar ? 'good' : 'short';
    }

    return {
      key: part.key,
      label: part.label,
      hourTarget,
      enteredCount,
      total,
      totalStatus,
      cells,
    };
  });

  const qcpRow = rows.find((r) => r.key === 'output')!;
  const done = qcpRow.total ?? 0;
  const enteredQcpHours = qcpRow.enteredCount;

  const remaining = dayTarget !== null ? Math.max(dayTarget - done, 0) : null;
  const exceededBy = dayTarget !== null && done > dayTarget ? done - dayTarget : 0;
  const isExceeded = exceededBy > 0;
  const isGoalMet = dayTarget !== null && dayTarget > 0 && done >= dayTarget;

  const progressPct =
    dayTarget !== null && dayTarget > 0 ? Math.min(999.99, (done / dayTarget) * 100) : 0;

  const remainingHours =
    enteredQcpHours > 0
      ? Math.max(0, workingHours - enteredQcpHours)
      : Math.max(0, workingHours - getClockElapsedShiftHours(clock, workingHours));

  // Latest entered Q.C.P hour
  let latestHourNo: number | null = null;
  let latestProduced: number | null = null;
  for (let hr = workingHours; hr >= 1; hr--) {
    const cell = qcpRow.cells[hr - 1];
    if (cell && cell.value !== null) {
      latestHourNo = hr;
      latestProduced = cell.value;
      break;
    }
  }

  const latestShort =
    hourlyTarget !== null && latestProduced !== null ? hourlyTarget - latestProduced : null;
  const isLatestHourShort = latestShort !== null && latestShort > 0;

  // Performance / Efficiency = done / targetSoFar
  const targetSoFar =
    hourlyTarget !== null && enteredQcpHours > 0 ? hourlyTarget * enteredQcpHours : null;
  const efficiencyPct =
    targetSoFar !== null && targetSoFar > 0 ? (done / targetSoFar) * 100 : null;

  // Manpower
  const op = parseNullableNumber(lineData.op);
  const hp = parseNullableNumber(lineData.hp);
  const ir = parseNullableNumber(lineData.ir);
  const rawMpTotal = parseNullableNumber(lineData.manpower_total ?? lineData.manpowerTotal);
  const computedMpSum =
    op !== null || hp !== null || ir !== null ? (op ?? 0) + (hp ?? 0) + (ir ?? 0) : null;
  const manpowerTotal = rawMpTotal !== null ? rawMpTotal : computedMpSum;

  const buyer = String(lineData.buyer_name || '').trim() || '-';
  const style = String(lineData.style_no || '').trim() || '-';
  const po = String(lineData.po_no || lineData.po || '').trim() || '-';
  const orderQty = parseNullableNumber(lineData.order_qty ?? lineData.orderQty);
  const lineChiefName = String(lineData.line_chief_name || '').trim() || '-';

  // Check if line actually has meaningful report data today
  const hasAnyTarget =
    hourlyTarget !== null ||
    parseNullableNumber(lineData.back_hour_target) !== null ||
    parseNullableNumber(lineData.front_hour_target) !== null ||
    parseNullableNumber(lineData.asm_hour_target) !== null;
  const hasAnyHours = maxEnteredAnyHour > 0;
  const hasMeta = buyer !== '-' || style !== '-' || orderQty !== null || manpowerTotal !== null;
  const hasReport = Boolean(hasAnyTarget || hasAnyHours || hasMeta);

  return {
    lineNo,
    hasReport,
    buyer,
    style,
    po,
    orderQty,
    workingHours,
    hourlyTarget,
    dayTarget,
    done,
    remaining,
    exceededBy,
    isGoalMet,
    isExceeded,
    progressPct,
    enteredQcpHours,
    remainingHours,
    currentRunningHour,
    isRunningHourEntryDue,
    latestHourNo,
    latestProduced,
    latestTarget: hourlyTarget,
    latestShort,
    isLatestHourShort,
    targetSoFar,
    efficiencyPct,
    manpowerTotal,
    op,
    hp,
    ir,
    lineChiefName,
    rows,
    qcpDots: qcpRow.cells.map((c) => c.state),
  };
}

/**
 * Plays a short crisp two-tone Web Audio alert beep when a new Q.C.P hour turns red.
 */
export function playShortAlertBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    playTone(880, 0, 0.16);
    playTone(660, 0.18, 0.22);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore Web Audio autoplay/browser restrictions silently
  }
}
