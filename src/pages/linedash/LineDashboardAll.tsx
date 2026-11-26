/**
 * All Lines 2x2 Enterprise TV Overview (/linedash/all)
 * Deep navy gradient + light-blue enterprise cards, 16:9 no-scroll layout
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Hourglass,
  Radio,
  Target,
  Tv,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useLineDashboardData } from '../../hooks/useLineDashboardData';
import { useLineDashStyle } from '../../hooks/useLineDashStyle';
import { useShortageVoiceAlert } from '../../hooks/useShortageVoiceAlert';
import { LineDashStyleControls } from '../../components/linedash/LineDashStyleControls';
import { LineAllOptionB } from '../../components/linedash/LineAllOptionB';
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

  const { activeStyle, setLineDashStyle } = useLineDashStyle();

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

  useShortageVoiceAlert(soundEnabled, linesMetrics, loading);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (next) {
        try {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const unlock = new SpeechSynthesisUtterance('');
            unlock.volume = 0;
            window.speechSynthesis.speak(unlock);
          }
        } catch {
          // Ignore unlock errors
        }
      }
      return next;
    });
  }, []);

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
    navigate(`/linedash/${ln}${location.search}`);
  };

  const getDotClass = (state: CellVisualState) => {
    if (state === 'good') return 'bg-emerald-500 ring-emerald-200';
    if (state === 'short') return 'bg-rose-500 ring-rose-200';
    if (state === 'entry_due') return 'bg-orange-500 ring-orange-300 animate-pulse';
    if (state === 'running') return 'bg-amber-400 ring-amber-200 animate-pulse';
    if (state === 'neutral') return 'bg-sky-500 ring-sky-200';
    return 'bg-slate-300 ring-slate-100';
  };

  const isOptionB = activeStyle === 'b';

  const boardContent = (
    <div
      ref={boardRef}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      className={`flex flex-col justify-between overflow-hidden select-none text-white ${
        isOptionB
          ? 'bg-[#0A0A0A]'
          : 'bg-gradient-to-br from-[#030E24] via-[#071D47] to-[#0B2D6E]'
      } ${
        standaloneMode
          ? 'fixed inset-0 z-[9999] w-screen h-screen p-[clamp(0.45rem,0.95vw,0.85rem)]'
          : 'relative -m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-5rem)] p-[clamp(0.4rem,0.85vw,0.75rem)]'
      } gap-[clamp(0.3rem,0.58vh,0.5rem)]`}
    >
      {/* Background Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isOptionB
            ? 'radial-gradient(ellipse at center, rgba(16, 36, 80, 0.24) 0%, rgba(10, 10, 10, 0.96) 72%, #0A0A0A 100%)'
            : 'radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.24), transparent 44%), radial-gradient(circle at 82% 88%, rgba(37, 99, 235, 0.24), transparent 48%)',
        }}
      />

      {/* Top-Right Style Switch & TV Controls */}
      <LineDashStyleControls
        activeStyle={activeStyle}
        onChangeStyle={setLineDashStyle}
        isKiosk={isKiosk}
        standaloneMode={standaloneMode}
        controlsVisible={controlsVisible}
        showUnitSwitch={showUnitSwitch}
        effectiveUnit={effectiveUnit}
        setManualUnit={setManualUnit}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onToggleFullscreen={toggleFullscreen}
        searchQuery={location.search}
      />

      {isOptionB ? (
        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          <LineAllOptionB
            linesMetrics={linesMetrics}
            clock={clock}
            effectiveUnit={effectiveUnit}
            loading={loading}
            connectionState={connectionState}
            flashingKeys={flashingKeys}
            onOpenLine={openLineBoard}
          />
        </div>
      ) : (
      /* MAIN VERTICAL TV STACK (OPTION A - UNCHANGED) */
      <div className="relative z-10 flex flex-col justify-between flex-1 gap-[clamp(0.4rem,0.8vh,0.7rem)] min-h-0">
        {/* HEADER BAR */}
        <header className="shrink-0 rounded-xl bg-gradient-to-r from-[#061A42]/95 via-[#0B2B68]/95 to-[#061A42]/95 border border-sky-400/45 border-t-4 border-t-sky-400 px-[clamp(0.75rem,1.4vw,1.5rem)] py-[clamp(0.35rem,0.68vh,0.58rem)] flex items-center justify-between gap-3 shadow-[0_0_24px_rgba(56,189,248,0.2)]">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="p-1.5 rounded-xl bg-sky-400/15 border border-sky-300/35 text-white shrink-0 shadow-[0_0_12px_rgba(56,189,248,0.25)]">
              <Tv className="w-[clamp(1.2rem,1.9vw,1.8rem)] h-[clamp(1.2rem,1.9vw,1.8rem)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1
                  className="font-black tracking-wide !text-white leading-none truncate drop-shadow-sm"
                  style={{ fontSize: 'clamp(1.1rem, 1.85vw, 1.95rem)' }}
                >
                  ALL LINES LIVE MONITOR
                </h1>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 border border-emerald-300/75 text-white shrink-0 shadow-[0_0_14px_rgba(34,197,94,0.45)]">
                  <Radio className="w-3 h-3 animate-pulse text-white" />
                  <span className="text-[11px] font-black tracking-wider uppercase">
                    LIVE PRODUCTION
                  </span>
                </div>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-sky-500/25 border border-sky-300/45 text-sky-100 text-[11px] font-extrabold uppercase tracking-wider">
                  {effectiveUnit} UNIT
                </span>
              </div>
              <p className="font-bangla text-xs sm:text-sm text-sky-100/90 font-medium leading-normal mt-0.5">
                লাইনভিত্তিক সরাসরি উৎপাদন বোর্ড (বিস্তারিত দেখতে যেকোনো লাইনে ক্লিক করুন)
              </p>
            </div>
          </div>

          <div className="hidden xl:flex items-center justify-center min-w-0 px-2">
            <span
              className="font-black tracking-[0.12em] uppercase !text-white text-center truncate drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]"
              style={{ fontSize: 'clamp(0.95rem, 1.45vw, 1.55rem)' }}
            >
              RUPKATHA APPARELS LTD.
            </span>
          </div>

          <div className="flex items-center gap-[clamp(0.6rem,1.1vw,1.2rem)] shrink-0">
            <div
              className="hidden md:flex items-center gap-1.5 font-bangla text-sky-100 font-bold whitespace-nowrap"
              style={{ fontSize: 'clamp(0.82rem, 1.05vw, 1.05rem)' }}
            >
              <Calendar className="w-4 h-4 text-sky-300 shrink-0" />
              <span>{clock.formattedDate}</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#041436]/90 border border-sky-400/45 font-black text-white tabular-nums whitespace-nowrap shadow-[0_0_12px_rgba(56,189,248,0.2)]"
              style={{ fontSize: 'clamp(0.9rem, 1.25vw, 1.3rem)' }}
            >
              <Clock className="w-4 h-4 text-sky-300 shrink-0" />
              <span>{clock.formattedTime}</span>
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
                className={`group text-left rounded-2xl bg-gradient-to-b from-[#0A2558] to-[#061638] hover:from-[#0C2D6B] hover:to-[#071A42] text-white border-2 border-sky-400/55 hover:border-sky-300 shadow-[0_0_24px_rgba(56,189,248,0.18)] transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer focus-visible:ring-4 focus-visible:ring-sky-400 ${
                  cardChanged ? 'ring-4 ring-amber-400' : ''
                }`}
              >
                {/* Card Header Strip (Line-colored top border) */}
                <div
                  className="shrink-0 bg-[#06183D] text-white px-[clamp(0.75rem,1.2vw,1.2rem)] py-[clamp(0.38rem,0.68vh,0.58rem)] flex items-center justify-between gap-2 border-b border-sky-400/30"
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
                    <div className="w-full h-24 rounded-xl bg-white/10" />
                  </div>
                ) : !m.hasReport ? (
                  <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 text-center">
                    <div
                      className="font-bangla font-bold text-white leading-relaxed"
                      style={{ fontSize: 'clamp(1.15rem, 1.6vw, 1.6rem)' }}
                    >
                      আজকের রিপোর্ট শুরু হয়নি
                    </div>
                    <div className="text-xs font-semibold text-sky-200 mt-1">
                      Click to open Line {padded} TV board
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 px-[clamp(0.75rem,1.2vw,1.2rem)] py-[clamp(0.45rem,0.8vh,0.72rem)] flex flex-col justify-between gap-2">
                    {/* Metrics + Progress Ring */}
                    <div className="flex items-center justify-between gap-3 flex-1 min-h-0">
                      {/* 3 Rich Gradient Numeric Boxes: Target / Done / Remaining */}
                      <div className="grid grid-cols-3 gap-2.5 flex-1 min-w-0">
                        <div className="rounded-xl bg-gradient-to-br from-[#0E4AB8] to-[#061F54] border border-sky-400/70 px-3 py-2 flex flex-col justify-center shadow-inner">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bangla text-xs font-bold text-sky-100 leading-normal">
                              আজকের লক্ষ্য
                            </span>
                            <Target className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                          </div>
                          <span
                            className="font-black text-white tabular-nums leading-tight mt-0.5"
                            style={{ fontSize: 'clamp(1.2rem, 1.85vw, 1.95rem)' }}
                          >
                            {m.dayTarget !== null ? m.dayTarget.toLocaleString() : '-'}
                          </span>
                        </div>

                        <div className="rounded-xl bg-gradient-to-br from-[#107839] to-[#073B1B] border border-emerald-400/70 px-3 py-2 flex flex-col justify-center shadow-inner">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bangla text-xs font-bold text-emerald-100 leading-normal">
                              উৎপাদন হয়েছে
                            </span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                          </div>
                          <span
                            className="font-black text-[#6EE7B7] tabular-nums leading-tight mt-0.5"
                            style={{ fontSize: 'clamp(1.2rem, 1.85vw, 1.95rem)' }}
                          >
                            {m.done.toLocaleString()}
                          </span>
                        </div>

                        <div
                          className={`rounded-xl border px-3 py-2 flex flex-col justify-center shadow-inner ${
                            m.isGoalMet
                              ? 'bg-gradient-to-br from-[#107839] to-[#073B1B] border-emerald-400/70'
                              : 'bg-gradient-to-br from-[#BE123C] to-[#570A21] border-rose-400/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`font-bangla text-xs font-bold leading-normal ${
                                m.isGoalMet ? 'text-emerald-100' : 'text-rose-100'
                              }`}
                            >
                              {m.isGoalMet ? 'লক্ষ্য পূরণ' : 'এখনো বাকি'}
                            </span>
                            <Hourglass
                              className={`w-3.5 h-3.5 shrink-0 ${
                                m.isGoalMet ? 'text-emerald-200' : 'text-rose-200'
                              }`}
                            />
                          </div>
                          <span
                            className={`font-black tabular-nums leading-tight mt-0.5 ${
                              m.isGoalMet ? 'text-[#6EE7B7]' : 'text-[#FDE047]'
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
                      <div className="shrink-0 rounded-xl bg-[#041434] border border-sky-400/45 text-white px-3 py-1.5 flex flex-col items-center justify-center">
                        <div className="relative w-[clamp(3.6rem,5vw,5rem)] h-[clamp(3.6rem,5vw,5rem)]">
                          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
                            <circle
                              cx="44"
                              cy="44"
                              r={r}
                              stroke="rgba(148, 163, 184, 0.22)"
                              strokeWidth="8"
                              fill="none"
                            />
                            <circle
                              cx="44"
                              cy="44"
                              r={r}
                              stroke={m.isGoalMet ? '#4ADE80' : '#38BDF8'}
                              strokeWidth="8"
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

                    {/* Per-line Mini Hour Dots + Footer Strip */}
                    <div className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t border-sky-400/25">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-200 shrink-0">
                          Q.C.P H1-H{m.workingHours}
                        </span>
                        <div className={`flex items-center ${m.qcpDots.length > 10 ? 'gap-1' : 'gap-1.5'}`}>
                          {m.qcpDots.map((dotState, idx) => (
                            <div
                              key={idx + 1}
                              className="flex flex-col items-center"
                              title={
                                dotState === 'entry_due'
                                  ? `H${idx + 1}: রিপোর্ট এন্ট্রি দিন (Entry Due)`
                                  : `H${idx + 1}: ${dotState}`
                              }
                            >
                              <span
                                className={`${m.qcpDots.length > 10 ? 'w-3 h-3' : 'w-3.5 h-3.5'} rounded-full ring-2 ${getDotClass(dotState)}`}
                              />
                              <span className="text-[10px] font-bold text-sky-200 leading-none mt-0.5">
                                {idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-sky-500/25 border border-sky-400/35 text-sky-100">
                          <Users className="w-3.5 h-3.5" />
                          MP: {m.manpowerTotal ?? '-'}
                        </span>
                        {m.isLatestHourShort ? (
                          <span className="inline-flex items-center gap-1 text-[#FB7185] font-extrabold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            H{m.latestHourNo}: {m.latestProduced}/{m.latestTarget}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#4ADE80] font-extrabold">
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
        <footer className="shrink-0 rounded-xl bg-gradient-to-r from-[#061A42]/95 via-[#09245A]/95 to-[#061A42]/95 border border-sky-400/35 px-[clamp(0.85rem,1.3vw,1.35rem)] py-[clamp(0.26rem,0.52vh,0.44rem)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 h-4 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
            <span
              className="font-bold text-white truncate"
              style={{ fontSize: 'clamp(0.78rem, 0.98vw, 0.98rem)' }}
            >
              Keep Production On Track &nbsp;|&nbsp; Achieve Today&apos;s Target
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#4ade80]'
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
              className="hidden sm:inline italic font-bold text-sky-100"
              style={{ fontSize: 'clamp(0.76rem, 0.95vw, 0.95rem)' }}
            >
              &ldquo;Together for a Productive Factory&rdquo;
            </span>
          </div>
        </footer>
      </div>
      )}
    </div>
  );

  if (isKiosk) {
    return boardContent;
  }

  return <AdminLayout>{boardContent}</AdminLayout>;
};

export default LineDashboardAll;
