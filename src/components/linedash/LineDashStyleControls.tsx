/**
 * Top-Right Style Switch ("Option A | Option B") and TV Controls Bar
 * - Normal mode: anchored cleanly at the top-right without covering the board clock
 * - Fullscreen mode: floats top-right and auto-hides after 3s idle
 * - Kiosk mode (?kiosk=1): completely hidden
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import type { BoardUnit } from '../../hooks/useLineDashboardData';
import type { LineDashStyle } from '../../hooks/useLineDashStyle';

interface LineDashStyleControlsProps {
  activeStyle: LineDashStyle;
  onChangeStyle: (style: LineDashStyle) => void;
  showAllLinesLink?: boolean;
  isKiosk: boolean;
  standaloneMode: boolean;
  controlsVisible: boolean;
  showUnitSwitch: boolean;
  effectiveUnit: BoardUnit;
  setManualUnit: (unit: BoardUnit) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  searchQuery?: string;
}

export const LineDashStyleControls: React.FC<LineDashStyleControlsProps> = ({
  activeStyle,
  onChangeStyle,
  showAllLinesLink = false,
  isKiosk,
  standaloneMode,
  controlsVisible,
  showUnitSwitch,
  effectiveUnit,
  setManualUnit,
  soundEnabled,
  onToggleSound,
  onToggleFullscreen,
  searchQuery = '',
}) => {
  if (isKiosk) return null;

  const isOptionB = activeStyle === 'b';

  return (
    <div
      className={`${
        standaloneMode
          ? `fixed top-3 right-3 z-[10000] transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`
          : 'relative z-20 shrink-0 flex justify-end'
      }`}
    >
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-xl border shadow-xl backdrop-blur-md ${
          isOptionB
            ? 'bg-[#121418]/95 border-white/15'
            : 'bg-[#071633]/95 border-sky-400/40'
        }`}
      >
        {showAllLinesLink && (
          <Link
            to={`/linedash/all${searchQuery}`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
            title="All Lines Overview"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Lines</span>
          </Link>
        )}

        {/* Option A | Option B Segmented Toggle */}
        <div
          className="flex items-center bg-black/50 border border-white/15 rounded-lg p-0.5"
          role="group"
          aria-label="Board Display Style"
        >
          <button
            type="button"
            onClick={() => onChangeStyle('a')}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
              activeStyle === 'a'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Option A
          </button>
          <button
            type="button"
            onClick={() => onChangeStyle('b')}
            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
              activeStyle === 'b'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Option B
          </button>
        </div>

        {showUnitSwitch && (
          <div className="flex items-center bg-black/50 border border-white/15 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setManualUnit('knit')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                effectiveUnit === 'knit'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Knit
            </button>
            <button
              type="button"
              onClick={() => setManualUnit('woven')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                effectiveUnit === 'woven'
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Woven
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleSound}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            soundEnabled
              ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
              : 'bg-white/10 hover:bg-white/20 text-slate-200'
          }`}
          title={
            soundEnabled
              ? 'Mute sound & 5-min Bangla shortage voice alert'
              : 'Turn on sound & 5-min Bangla shortage voice alert'
          }
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors cursor-pointer"
          title="Toggle Fullscreen (F)"
        >
          {standaloneMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{standaloneMode ? 'Exit' : 'Fullscreen'}</span>
        </button>
      </div>
    </div>
  );
};

export default LineDashStyleControls;
