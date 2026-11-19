/**
 * Realtime & Polling Data Hook for Line Dashboard TV Boards
 * - Today's date in Asia/Dhaka with automatic midnight rollover
 * - Factory unit sync (Knit/Woven; "all"/"both" defaults to "knit" with manual toggle)
 * - Supabase realtime subscription (400ms debounce) on sewing_report_hours, sewing_report_lines, sewing_reports
 * - 15-second polling fallback
 * - 1.5s change flash keys & optional sound beep when a new Q.C.P hour turns red
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUnit } from '../context/UnitContext';
import {
  computeLineBoardMetrics,
  getDhakaClockInfo,
  playShortAlertBeep,
  type DhakaClockInfo,
  type LineBoardMetrics,
} from '../lib/lineDashboardUtils';

export type BoardUnit = 'knit' | 'woven';
export type LiveConnectionState = 'connected' | 'reconnecting';

export function useLineDashboardData(soundEnabled: boolean, targetLineNo?: number) {
  const { activeUnit } = useUnit();

  // Top-bar unit: knit/woven direct, "all"/"both" defaults to "knit" with local override switch
  const [manualUnit, setManualUnit] = useState<BoardUnit>('knit');
  const effectiveUnit: BoardUnit =
    activeUnit === 'woven' ? 'woven' : activeUnit === 'knit' ? 'knit' : manualUnit;
  const showUnitSwitch = activeUnit !== 'knit' && activeUnit !== 'woven';

  const [clock, setClock] = useState<DhakaClockInfo>(() => getDhakaClockInfo());
  const [activeDate, setActiveDate] = useState<string>(() => getDhakaClockInfo().dateStr);

  const [rawLines, setRawLines] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('reconnecting');
  const [flashingKeys, setFlashingKeys] = useState<Set<string>>(new Set());

  const prevSnapshotRef = useRef<Map<string, string>>(new Map());
  const prevRedHoursRef = useRef<Map<string, boolean>>(new Map());
  const hasLoadedOnceRef = useRef<boolean>(false);
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // 1-second Dhaka clock & midnight rollover detector
  useEffect(() => {
    const timer = setInterval(() => {
      const next = getDhakaClockInfo();
      setClock(next);
      setActiveDate((prevDate) => (prevDate !== next.dateStr ? next.dateStr : prevDate));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerFlashKeys = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setFlashingKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
    setTimeout(() => {
      setFlashingKeys((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }, 1500);
  }, []);

  const fetchTodayLines = useCallback(
    async (isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('sewing_reports')
          .select(
            `
            id,
            report_date,
            factory_unit,
            updated_at,
            sewing_report_lines (
              id,
              report_id,
              line_no,
              buyer_name,
              style_no,
              order_qty,
              op,
              hp,
              ir,
              manpower_total,
              back_hour_target,
              front_hour_target,
              asm_hour_target,
              output_hour_target,
              working_hours,
              line_chief_name,
              sewing_report_hours (
                id,
                line_id,
                hour_no,
                back_qty,
                front_qty,
                asm,
                output_qty
              )
            )
          `
          )
          .eq('report_date', activeDate)
          .eq('factory_unit', effectiveUnit);

        if (error) {
          console.error('Line Dashboard fetch error:', error.message);
          setConnectionState('reconnecting');
          return;
        }

        const flattenedLines = (data || [])
          .flatMap((rep: any) =>
            (rep.sewing_report_lines || []).map((l: any) => ({
              ...l,
              hours: [...(l.sewing_report_hours || [])].sort(
                (a: any, b: any) => Number(a.hour_no) - Number(b.hour_no)
              ),
            }))
          )
          .sort((a: any, b: any) => Number(a.line_no) - Number(b.line_no));

        setRawLines(flattenedLines);
      } catch (err) {
        console.error('Line Dashboard fetch exception:', err);
        setConnectionState('reconnecting');
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [activeDate, effectiveUnit]
  );

  // Reset snapshot on unit/date/line change so unit switch doesn't beep or flash stale values
  useEffect(() => {
    hasLoadedOnceRef.current = false;
    prevSnapshotRef.current = new Map();
    prevRedHoursRef.current = new Map();
    fetchTodayLines(true);
  }, [fetchTodayLines, targetLineNo]);

  // Realtime subscription (400ms debounce) + 15-second polling fallback
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchTodayLines(false);
      }, 400);
    };

    const channel = supabase
      .channel(`linedash-${activeDate}-${effectiveUnit}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_report_hours' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_report_lines' },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sewing_reports' },
        scheduleRefresh
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnectionState('reconnecting');
        }
      });

    const pollInterval = setInterval(() => {
      fetchTodayLines(false);
    }, 15000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeDate, effectiveUnit, fetchTodayLines]);

  // Compute metrics for Lines 1..4
  const linesMetrics = useMemo<Record<number, LineBoardMetrics>>(() => {
    const byLine: Record<number, LineBoardMetrics> = {};
    for (let ln = 1; ln <= 4; ln++) {
      const found = rawLines.find((l) => Number(l.line_no) === ln);
      byLine[ln] = computeLineBoardMetrics(found, ln, clock);
    }
    return byLine;
  }, [rawLines, clock]);

  // Detect changed numbers (1.5s flash) and newly turned-red Q.C.P hours (optional beep)
  useEffect(() => {
    if (loading) return;

    const nextSnapshot = new Map<string, string>();
    const nextRedHours = new Map<string, boolean>();
    const changed: string[] = [];
    let shouldBeep = false;

    const inspectLines = targetLineNo ? [targetLineNo] : [1, 2, 3, 4];

    for (const ln of inspectLines) {
      const m = linesMetrics[ln];
      if (!m) continue;

      const kpiPairs: Array<[string, string]> = [
        [`L${ln}:dayTarget`, String(m.dayTarget ?? '')],
        [`L${ln}:done`, String(m.done)],
        [`L${ln}:remaining`, String(m.remaining ?? '')],
        [`L${ln}:progress`, m.progressPct.toFixed(2)],
        [`L${ln}:eff`, m.efficiencyPct !== null ? m.efficiencyPct.toFixed(1) : ''],
      ];

      for (const [key, val] of kpiPairs) {
        nextSnapshot.set(key, val);
        if (hasLoadedOnceRef.current && prevSnapshotRef.current.get(key) !== val) {
          changed.push(key);
        }
      }

      for (const row of m.rows) {
        const totalKey = `L${ln}:${row.key}:total`;
        const totalVal = String(row.total ?? '');
        nextSnapshot.set(totalKey, totalVal);
        if (hasLoadedOnceRef.current && prevSnapshotRef.current.get(totalKey) !== totalVal) {
          changed.push(totalKey);
        }

        for (const cell of row.cells) {
          const cellKey = `L${ln}:${row.key}:h${cell.hourNo}`;
          const cellVal = String(cell.value ?? '');
          nextSnapshot.set(cellKey, cellVal);
          if (hasLoadedOnceRef.current && prevSnapshotRef.current.get(cellKey) !== cellVal) {
            changed.push(cellKey);
          }

          if (row.key === 'output') {
            const isRedNow = cell.state === 'short';
            nextRedHours.set(cellKey, isRedNow);
            if (
              hasLoadedOnceRef.current &&
              isRedNow &&
              prevRedHoursRef.current.get(cellKey) === false
            ) {
              shouldBeep = true;
            }
          }
        }
      }
    }

    if (changed.length > 0) {
      triggerFlashKeys(changed);
    }
    if (shouldBeep && soundEnabledRef.current) {
      playShortAlertBeep();
    }

    prevSnapshotRef.current = nextSnapshot;
    prevRedHoursRef.current = nextRedHours;
    hasLoadedOnceRef.current = true;
  }, [linesMetrics, loading, targetLineNo, triggerFlashKeys]);

  return {
    clock,
    activeDate,
    effectiveUnit,
    setManualUnit,
    showUnitSwitch,
    loading,
    connectionState,
    linesMetrics,
    flashingKeys,
  };
}
