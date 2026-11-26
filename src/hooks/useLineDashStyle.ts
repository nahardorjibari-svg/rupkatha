/**
 * Style Switch Hook & Option B Helpers for Line Dashboard TV Boards
 * - URL query (?style=a or ?style=b) always wins over localStorage
 * - Persists user toggle choice in localStorage ("linedash_style")
 * - Default = 'a'
 */
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type LineDashStyle = 'a' | 'b';

const STORAGE_KEY = 'linedash_style';

function readStoredStyle(): LineDashStyle {
  try {
    const val = localStorage.getItem(STORAGE_KEY)?.toLowerCase();
    return val === 'b' ? 'b' : 'a';
  } catch {
    return 'a';
  }
}

export function useLineDashStyle() {
  const location = useLocation();
  const navigate = useNavigate();

  const [storedStyle, setStoredStyle] = useState<LineDashStyle>(() => readStoredStyle());

  const urlStyleParam = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get('style')?.toLowerCase();
    if (raw === 'a' || raw === 'b') return raw as LineDashStyle;
    return null;
  }, [location.search]);

  // URL wins if ?style=a or ?style=b is specified; otherwise stored preference (default 'a')
  const activeStyle: LineDashStyle = urlStyleParam ?? storedStyle;

  const setLineDashStyle = useCallback(
    (next: LineDashStyle) => {
      setStoredStyle(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage restrictions
      }
      // If URL explicitly forced ?style=..., update it so toggle takes effect immediately
      const params = new URLSearchParams(location.search);
      if (params.has('style')) {
        params.set('style', next);
        const searchStr = params.toString();
        navigate(`${location.pathname}${searchStr ? `?${searchStr}` : ''}`, { replace: true });
      }
    },
    [location.pathname, location.search, navigate]
  );

  return {
    activeStyle,
    setLineDashStyle,
  };
}

export const OPTION_B_LINE_COLORS: Record<number, { hex: string; label: string }> = {
  1: { hex: '#185FA5', label: 'LINE 1' },
  2: { hex: '#534AB7', label: 'LINE 2' },
  3: { hex: '#C2410C', label: 'LINE 3' },
  4: { hex: '#0F766E', label: 'LINE 4' },
};

export function getOptionBLineColor(lineNo: number) {
  return OPTION_B_LINE_COLORS[lineNo] || OPTION_B_LINE_COLORS[1];
}

const BANGLA_DIGIT_MAP: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

export function toBanglaDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => BANGLA_DIGIT_MAP[d] ?? d);
}

export type TrafficLightState = 'green' | 'yellow' | 'red' | 'idle';

/**
 * Traffic-light status:
 * - green: on target (done >= targetSoFar)
 * - yellow: behind up to 10% of target-so-far (0 < targetSoFar - done <= 10% of targetSoFar)
 * - red: behind more than 10% of target-so-far
 * - idle: no target or no entered hours yet
 */
export function getTrafficLightState(
  done: number,
  targetSoFar: number | null,
  hasReport: boolean,
  enteredHours: number
): TrafficLightState {
  if (!hasReport || targetSoFar === null || targetSoFar <= 0 || enteredHours <= 0) {
    return 'idle';
  }
  if (done >= targetSoFar) return 'green';
  const behind = targetSoFar - done;
  if (behind <= targetSoFar * 0.1) return 'yellow';
  return 'red';
}
