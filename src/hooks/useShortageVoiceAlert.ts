/**
 * 5-Minute Periodic Bangla Voice Shortage Alert Hook + Live Floating Display Overlay State
 * - Controlled by the top-right Sound toggle ("Muted" <-> "Sound On")
 * - When Sound is ON and any monitored line has a net shortage (totalNetVariance < 0):
 *   1) Announces immediately when Sound is turned ON or when a shortage newly appears
 *   2) Repeats every 5 minutes (300,000ms) until the shortage is filled or Sound is muted
 *   3) Exposes activeAnnouncement so a giant full-display Bangla text overlay floats on screen while speaking
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildBanglaShortageMessage,
  computeLineNetVariance,
  speakBanglaShortageAlert,
  stopBanglaSpeech,
  type LineBoardMetrics,
} from '../lib/lineDashboardUtils';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MIN_OVERLAY_MS = 7500;
const MAX_OVERLAY_MS = 13000;

export interface ActiveShortageAnnouncement {
  entries: Array<{ lineNo: number; shortQty: number }>;
  message: string;
  durationMs: number;
  triggeredAt: number;
}

export function useShortageVoiceAlert(
  soundEnabled: boolean,
  linesMetrics: Record<number, LineBoardMetrics>,
  loading: boolean,
  targetLineNo?: number
) {
  const [activeAnnouncement, setActiveAnnouncement] =
    useState<ActiveShortageAnnouncement | null>(null);

  const latestShortRef = useRef<Array<{ lineNo: number; shortQty: number }>>([]);
  const prevSoundRef = useRef<boolean>(false);
  const prevHasShortRef = useRef<boolean>(false);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endLingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOverlayTimers = useCallback(() => {
    if (minTimerRef.current) {
      clearTimeout(minTimerRef.current);
      minTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (endLingerTimerRef.current) {
      clearTimeout(endLingerTimerRef.current);
      endLingerTimerRef.current = null;
    }
  }, []);

  const triggerAnnouncement = useCallback(
    (entries: Array<{ lineNo: number; shortQty: number }>) => {
      if (entries.length === 0) return;
      clearOverlayTimers();

      const triggeredAt = Date.now();
      let minElapsed = false;
      let speechEnded = false;

      const tryHide = () => {
        if (minElapsed && speechEnded) {
          clearOverlayTimers();
          setActiveAnnouncement((prev) =>
            prev && prev.triggeredAt === triggeredAt ? null : prev
          );
        }
      };

      const message = buildBanglaShortageMessage(entries);
      setActiveAnnouncement({
        entries: [...entries],
        message,
        durationMs: MAX_OVERLAY_MS,
        triggeredAt,
      });

      minTimerRef.current = setTimeout(() => {
        minElapsed = true;
        tryHide();
      }, MIN_OVERLAY_MS);

      maxTimerRef.current = setTimeout(() => {
        clearOverlayTimers();
        setActiveAnnouncement((prev) =>
          prev && prev.triggeredAt === triggeredAt ? null : prev
        );
      }, MAX_OVERLAY_MS);

      speakBanglaShortageAlert(entries, () => {
        endLingerTimerRef.current = setTimeout(() => {
          speechEnded = true;
          tryHide();
        }, 1800);
      });
    },
    [clearOverlayTimers]
  );

  const shortEntries: Array<{ lineNo: number; shortQty: number }> = [];
  if (!loading) {
    const lineNos = targetLineNo ? [targetLineNo] : [1, 2, 3, 4];
    for (const ln of lineNos) {
      const net = computeLineNetVariance(linesMetrics[ln]);
      if (net !== null && net < 0) {
        shortEntries.push({ lineNo: ln, shortQty: Math.abs(net) });
      }
    }
  }

  latestShortRef.current = shortEntries;
  const hasAnyShortage = shortEntries.length > 0;

  // Immediate announcement when Sound is unmuted or when a shortage newly begins while unmuted
  useEffect(() => {
    const justUnmuted = soundEnabled && !prevSoundRef.current;
    const justEnteredShortage = soundEnabled && hasAnyShortage && !prevHasShortRef.current;

    if (!soundEnabled || !hasAnyShortage) {
      stopBanglaSpeech();
      clearOverlayTimers();
      setActiveAnnouncement(null);
    } else if (justUnmuted || justEnteredShortage) {
      triggerAnnouncement(latestShortRef.current);
    }

    prevSoundRef.current = soundEnabled;
    prevHasShortRef.current = hasAnyShortage;
  }, [soundEnabled, hasAnyShortage, triggerAnnouncement, clearOverlayTimers]);

  // Repeat every 5 minutes while Sound is ON and shortage persists
  useEffect(() => {
    if (!soundEnabled || !hasAnyShortage) return;

    const timer = setInterval(() => {
      if (latestShortRef.current.length > 0) {
        triggerAnnouncement(latestShortRef.current);
      }
    }, FIVE_MINUTES_MS);

    return () => {
      clearInterval(timer);
    };
  }, [soundEnabled, hasAnyShortage, triggerAnnouncement]);

  // Pre-warm voices and cleanup on unmount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    } catch {
      // Ignore
    }
    return () => {
      clearOverlayTimers();
      stopBanglaSpeech();
    };
  }, [clearOverlayTimers]);

  return { activeAnnouncement };
}
