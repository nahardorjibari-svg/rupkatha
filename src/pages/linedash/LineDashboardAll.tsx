/**
 * All Lines 2x2 Enterprise TV Overview (/linedash/all)
 * Deep navy gradient + light-blue enterprise cards, 16:9 no-scroll layout
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Radio,
  Tv,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useLineDashboardData } from '../../hooks/useLineDashboardData';
import { getLineTheme, type CellVisualState } from '../../lib/lineDashboardUtils';

export const LineDashboardAll: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const isKiosk = searchParams.get('kiosk') === '1';

  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(Boolean(document.fullscreenElement));
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    clock,
    effectiveUnit,
    setManualUnit,
    showUnitSwitch,
    loading,
    connectionState,
    linesMetrics,
    flashingKeys,
  } = useLineDashboardData(soundEnabled);

  useEffect(() => {
    const onFsChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setIsFullscreen(fsActive);
      if (!fsActive) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const currentlyFull = Boolean(document.fullscreenElement) || isExpanded;
    if (!currentlyFull) {
      setIsExpanded(true);
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fallback to in-app full-viewport mode when iframe/browser blocks native fullscreen
      }
    } else {
      setIsExpanded(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore fullscreen exit errors
      }
    }
  }, [isExpanded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isExpanded && !document.fullscreenElement) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen, isExpanded]);

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    bumpControls();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [bumpControls]);

  const standaloneMode = isKiosk || isFullscreen || isExpanded;

  const openLineBoard = (ln: number) => {
    navigate(isKiosk ? `/linedash/${ln}?kiosk=1` : `/linedash/${ln}`);
  };

  const getDotClass = (state: CellVisualState) => {
    if (state === 'good') return 'bg-emerald-500 ring-emerald-200';
    if (state === 'short') return 'bg-rose-500 ring-rose-200';
    if (state === 'running') return 'bg-amber-400 ring-amber-200 animate-pulse';
    if (state === 'neutral') return 'bg-sky-500 ring-sky-200';
    return 'bg-slate-300 ring-slate-100';
  };

  const boardContent = (
    <div
      ref={boardRef}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      className={`flex flex-col justify-between overflow-hidden select-none text-white bg-gradient-to-br from-[#071633] via-[#0B224B] to-[#0D2D63] ${
        standaloneMode
          ? 'fixed inset-0 z-[9999] w-screen h-screen p-[clamp(0.5rem,1vw,0.9rem)]'
          : 'relative -m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-5rem)] p-[clamp(0.45rem,0.9vw,0.85rem)]'
      }`}
    >
      {/* Subtle enterprise atmospheric glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background:
            'radial-gradient(circle at 20% 15%, rgba(56, 189, 248, 0.22), transparent 45%), radial-gradient(circle at 80% 85%, rgba(37, 99, 235, 0.2), transparent 50%)',
        }}
      />

      {/* Floating TV Controls (hidden in kiosk=1, auto-hides after 3s idle) */}
      {!isKiosk && (
        <div
          className={`fixed z-[10000] flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#071633]/92 border border-sky-400/35 shadow-2xl backdrop-blur-md transition-opacity duration-300 ${
            standaloneMode ? 'top-3 right-3' : 'bottom-4 right-4'
          } ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {showUnitSwitch && (
            <div className="flex items-center bg-slate-900/80 border border-white/15 rounded-lg p-0.5">
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
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                : 'bg-white/10 hover:bg-white/20 text-slate-200'
            }`}
            title={soundEnabled ? 'Mute short alert sound' : 'Enable short alert sound'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors cursor-pointer"
            title="Toggle Fullscreen (F)"
          >
            {standaloneMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{standaloneMode ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      )}

      {/* MAIN VERTICAL TV STACK */}
      <div className="relative z-10 flex flex-col justify-between h-full gap-[clamp(0.4rem,0.8vh,0.7rem)] min-h-0">
        {/* HEADER BAR */}
        <header className="shrink-0 rounded-xl bg-[#081C3E]/95 border-t-4 border-b-2 border-sky-500 px-[clamp(0.75rem,1.4vw,1.5rem)] py-[clamp(0.35rem,0.7vh,0.6rem)] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-200 shrink-0">
              <Tv className="w-[clamp(1.2rem,1.9vw,1.8rem)] h-[clamp(1.2rem,1.9vw,1.8rem)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1
                  className="font-black tracking-wide text-white leading-none truncate"
                  style={{ fontSize: 'clamp(1.15rem, 2vw, 2.1rem)' }}
                >
                  ALL LINES LIVE MONITOR
                </h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shrink-0">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                  <span className="text-[11px] font-extrabold tracking-wider uppercase">
                    LIVE PRODUCTION
                  </span>
                </div>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-sky-200 text-[11px] font-bold uppercase tracking-wider">
                  {effectiveUnit} UNIT
                </span>
              </div>
              <p className="font-bangla text-xs sm:text-sm text-sky-100/90 font-medium leading-normal mt-0.5">
                লাইনভিত্তিক সরাসরি উৎপাদন বোর্ড (বিস্তারিত দেখতে যেকোনো লাইনে ক্লিক করুন)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-[clamp(0.6rem,1.2vw,1.25rem)] shrink-0">
            <div
              className="hidden md:block text-sky-100 font-semibold"
              style={{ fontSize: 'clamp(0.82rem, 1.05vw, 1.05rem)' }}
            >
              {clock.formattedDate}
            </div>
            <div
              className="px-3.5 py-1.5 rounded-xl bg-[#102E63] border border-sky-400/35 font-extrabold text-white tabular-nums"
              style={{ fontSize: 'clamp(0.9rem, 1.25vw, 1.3rem)' }}
            >
              {clock.formattedTime}
            </div>
          </div>
        </header>

        {/* 2x2 GRID OF LINES 1-4 */}
        <section className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-[clamp(0.55rem,1.05vw,0.95rem)]">
          {[1, 2, 3, 4].map((ln) => {
            const m = linesMetrics[ln];
            const theme = getLineTheme(ln);
            const padded = String(ln).padStart(2, '0');

            // Traffic light indicator
            let lightColor = 'bg-slate-400';
            let lightLabel = 'No Report';
            let lightPillClass = 'bg-slate-200 text-slate-700 border-slate-300';
            if (m.hasReport) {
              if (m.isLatestHourShort) {
                lightColor = 'bg-rose-500';
                lightLabel = `Short -${m.latestShort}`;
                lightPillClass = 'bg-rose-100 text-rose-700 border-rose-300';
              } else if (m.efficiencyPct !== null && m.efficiencyPct < 80) {
                lightColor = 'bg-amber-500';
                lightLabel = `Eff ${m.efficiencyPct.toFixed(0)}%`;
                lightPillClass = 'bg-amber-100 text-amber-800 border-amber-300';
              } else if (m.enteredQcpHours > 0) {
                lightColor = 'bg-emerald-500';
                lightLabel = m.isGoalMet ? 'Target Met' : 'On Track';
                lightPillClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
              } else {
                lightColor = 'bg-amber-400';
                lightLabel = 'Starting';
                lightPillClass = 'bg-amber-100 text-amber-800 border-amber-300';
              }
            }

            const r = 34;
            const circ = 2 * Math.PI * r;
            const pctClamped = Math.max(0, Math.min(100, m.progressPct));
            const dashOffset = circ - (pctClamped / 100) * circ;
            const cardChanged =
              flashingKeys.has(`L${ln}:done`) || flashingKeys.has(`L${ln}:dayTarget`);

            return (
              <button
                key={ln}
                type="button"
                onClick={() => openLineBoard(ln)}
                className={`group text-left rounded-2xl bg-[#F4F8FF] hover:bg-white text-[#0B1E40] border-2 border-sky-300 hover:border-sky-400 shadow-xl transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer focus-visible:ring-4 focus-visible:ring-sky-400 ${
                  cardChanged ? 'ring-4 ring-amber-400' : ''
                }`}
              >
                {/* Card Header Strip (Line-colored top border) */}
                <div
                  className="shrink-0 bg-[#122D5E] text-white px-[clamp(0.75rem,1.2vw,1.2rem)] py-[clamp(0.4rem,0.7vh,0.6rem)] flex items-center justify-between gap-2"
                  style={{ borderTop: `4px solid ${theme.accentHex}` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="px-3 py-0.5 rounded-lg font-black text-white tracking-wide shrink-0 shadow-xs"
                      style={{
                        backgroundColor: theme.accentHex,
                        fontSize: 'clamp(0.9rem, 1.3vw, 1.32rem)',
                      }}
                    >
                      LINE {padded}
                    </span>
                    {m.hasReport ? (
                      <div className="min-w-0">
                        <div
                          className="font-extrabold text-white truncate leading-snug"
                          style={{ fontSize: 'clamp(0.85rem, 1.08vw, 1.08rem)' }}
                        >
                          {m.buyer}
                        </div>
                        <div className="text-xs font-semibold text-sky-200 truncate leading-snug">
                          Style: {m.style}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-sky-200/85">
                        {effectiveUnit.toUpperCase()} UNIT
                      </span>
                    )}
                  </div>

                  {/* Traffic Light Status Pill */}
                  <div
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-extrabold ${lightPillClass}`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${lightColor}`} />
                    <span>{lightLabel}</span>
                  </div>
                </div>

                {/* Card Body */}
                {loading ? (
                  <div className="flex-1 p-4 animate-pulse flex items-center justify-center">
                    <div className="w-full h-24 rounded-xl bg-sky-200/60" />
                  </div>
                ) : !m.hasReport ? (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 text-center">
                    <div
                      className="font-bangla font-bold text-[#0B224B] leading-relaxed"
                      style={{ fontSize: 'clamp(1.15rem, 1.6vw, 1.6rem)' }}
                    >
                      আজকের রিপোর্ট শুরু হয়নি
                    </div>
                    <div className="text-xs font-semibold text-slate-600 mt-1">
                      Click to open Line {padded} TV board
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 px-[clamp(0.75rem,1.2vw,1.2rem)] py-[clamp(0.45rem,0.8vh,0.75rem)] flex flex-col justify-between gap-2">
                    {/* Metrics + Progress Ring */}
                    <div className="flex items-center justify-between gap-3 flex-1 min-h-0">
                      {/* 3 Numeric Boxes: Target / Done / Remaining */}
                      <div className="grid grid-cols-3 gap-2.5 flex-1 min-w-0">
                        <div className="rounded-xl bg-[#E0EEFF] border border-[#93C5FD] px-3 py-2 flex flex-col justify-center">
                          <span className="font-bangla text-xs font-bold text-[#1E3A8A] leading-normal">
                            আজকের লক্ষ্য
                          </span>
                          <span
                            className="font-black text-[#0B224B] tabular-nums leading-tight mt-0.5"
                            style={{ fontSize: 'clamp(1.2rem, 1.85vw, 1.95rem)' }}
                          >
                            {m.dayTarget !== null ? m.dayTarget.toLocaleString() : '-'}
                          </span>
                        </div>

                        <div className="rounded-xl bg-[#DCFCE7] border border-[#86EFAC] px-3 py-2 flex flex-col justify-center">
                          <span className="font-bangla text-xs font-bold text-[#14532D] leading-normal">
                            উৎপাদন হয়েছে
                          </span>
                          <span
                            className="font-black text-[#064E3B] tabular-nums leading-tight mt-0.5"
                            style={{ fontSize: 'clamp(1.2rem, 1.85vw, 1.95rem)' }}
                          >
                            {m.done.toLocaleString()}
                          </span>
                        </div>

                        <div
                          className={`rounded-xl border px-3 py-2 flex flex-col justify-center ${
                            m.isGoalMet
                              ? 'bg-[#DCFCE7] border-[#86EFAC]'
                              : 'bg-[#FEE2E2] border-[#FCA5A5]'
                          }`}
                        >
                          <span
                            className={`font-bangla text-xs font-bold leading-normal ${
                              m.isGoalMet ? 'text-[#14532D]' : 'text-[#991B1B]'
                            }`}
                          >
                            {m.isGoalMet ? 'লক্ষ্য পূরণ' : 'এখনো বাকি'}
                          </span>
                          <span
                            className={`font-black tabular-nums leading-tight mt-0.5 ${
                              m.isGoalMet ? 'text-[#064E3B]' : 'text-[#7F1D1D]'
                            }`}
                            style={{ fontSize: 'clamp(1.2rem, 1.85vw, 1.95rem)' }}
                          >
                            {m.isExceeded
                              ? `+${m.exceededBy.toLocaleString()}`
                              : m.remaining !== null
                              ? m.remaining.toLocaleString()
                              : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Circular Progress Ring */}
                      <div className="shrink-0 rounded-xl bg-[#0A1D42] text-white px-3 py-1.5 flex flex-col items-center justify-center">
                        <div className="relative w-[clamp(3.6rem,5vw,5rem)] h-[clamp(3.6rem,5vw,5rem)]">
                          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
                            <circle
                              cx="44"
                              cy="44"
                              r={r}
                              stroke="rgba(148, 163, 184, 0.25)"
                              strokeWidth="7.5"
                              fill="none"
                            />
                            <circle
                              cx="44"
                              cy="44"
                              r={r}
                              stroke={m.isGoalMet ? '#22C55E' : '#38BDF8'}
                              strokeWidth="7.5"
                              strokeLinecap="round"
                              fill="none"
                              strokeDasharray={circ}
                              strokeDashoffset={dashOffset}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xs sm:text-sm font-extrabold tabular-nums leading-none">
                              {m.progressPct.toFixed(0)}%
                            </span>
                            <span className="font-bangla text-[10px] text-sky-200 leading-normal">
                              সম্পন্ন
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 10 Mini Hour Dots + Footer Strip */}
                    <div className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t border-sky-200">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                          Q.C.P H1-H10
                        </span>
                        <div className="flex items-center gap-1.5">
                          {m.qcpDots.map((dotState, idx) => (
                            <div
                              key={idx + 1}
                              className="flex flex-col items-center"
                              title={`H${idx + 1}: ${dotState}`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full ring-2 ${getDotClass(dotState)}`}
                              />
                              <span className="text-[10px] font-bold text-slate-600 leading-none mt-0.5">
                                {idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-[#0B224B]">
                        <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-900">
                          <Users className="w-3.5 h-3.5" />
                          MP: {m.manpowerTotal ?? '-'}
                        </span>
                        {m.isLatestHourShort ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-extrabold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            H{m.latestHourNo}: {m.latestProduced}/{m.latestTarget}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {m.remainingHours} Hr Left
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </section>

        {/* FOOTER BAR */}
        <footer className="shrink-0 rounded-xl bg-[#071836]/95 border border-sky-400/25 px-[clamp(0.85rem,1.3vw,1.35rem)] py-[clamp(0.28rem,0.55vh,0.45rem)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span
              className="font-bold text-sky-100 truncate"
              style={{ fontSize: 'clamp(0.78rem, 0.98vw, 0.98rem)' }}
            >
              Keep Production On Track | Achieve Today&apos;s Target
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span
                className={
                  connectionState === 'connected' ? 'text-emerald-300' : 'text-amber-300'
                }
              >
                {connectionState === 'connected' ? 'Live connected' : 'Reconnecting...'}
              </span>
            </div>

            <span
              className="hidden sm:inline italic font-semibold text-sky-200/90"
              style={{ fontSize: 'clamp(0.76rem, 0.95vw, 0.95rem)' }}
            >
              Together for a Productive Factory
            </span>
          </div>
        </footer>
      </div>
    </div>
  );

  if (isKiosk) {
    return boardContent;
  }

  return <AdminLayout>{boardContent}</AdminLayout>;
};

export default LineDashboardAll;
