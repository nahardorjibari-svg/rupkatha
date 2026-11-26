/**
 * 5-Minute Periodic Bangla Voice Shortage Alert Hook
 * - Controlled by the top-right Sound toggle ("Muted" <-> "Sound On")
 * - When Sound is ON and any monitored line has a net shortage (totalNetVariance < 0):
 *   1) Announces immediately when Sound is turned ON or when a shortage newly appears
 *   2) Repeats every 5 minutes (300,000ms) until the shortage is filled or Sound is muted
 */
import { useEffect, useRef } from 'react';
import {
  computeLineNetVariance,
  speakBanglaShortageAlert,
  stopBanglaSpeech,
  type LineBoardMetrics,
} from '../lib/lineDashboardUtils';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useShortageVoiceAlert(
  soundEnabled: boolean,
  linesMetrics: Record<number, LineBoardMetrics>,
  loading: boolean,
  targetLineNo?: number
) {
  const latestShortRef = useRef<Array<{ lineNo: number; shortQty: number }>>([]);
  const prevSoundRef = useRef<boolean>(false);
  const prevHasShortRef = useRef<boolean>(false);

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

    if (!soundEnabled) {
      stopBanglaSpeech();
    } else if (hasAnyShortage && (justUnmuted || justEnteredShortage)) {
      speakBanglaShortageAlert(latestShortRef.current);
    }

    prevSoundRef.current = soundEnabled;
    prevHasShortRef.current = hasAnyShortage;
  }, [soundEnabled, hasAnyShortage]);

  // Repeat every 5 minutes while Sound is ON and shortage persists
  useEffect(() => {
    if (!soundEnabled || !hasAnyShortage) return;

    const timer = setInterval(() => {
      if (latestShortRef.current.length > 0) {
        speakBanglaShortageAlert(latestShortRef.current);
      }
    }, FIVE_MINUTES_MS);

    return () => {
      clearInterval(timer);
    };
  }, [soundEnabled, hasAnyShortage]);

  // Ensure voices are pre-warmed by the browser and cancel speech on unmount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    } catch {
      // Ignore
    }
    return () => {
      stopBanglaSpeech();
    };
  }, []);
}
