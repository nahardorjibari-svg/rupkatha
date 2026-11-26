/**
 * Single-Line Enterprise TV Board (/linedash/:line)
 * Deep navy gradient + light-blue enterprise cards, Q.C.P-only hourly view, 16:9 no-scroll layout
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Hourglass,
  Radio,
  Star,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useLineDashboardData } from '../../hooks/useLineDashboardData';
import { useLineDashStyle } from '../../hooks/useLineDashStyle';
import { useShortageVoiceAlert } from '../../hooks/useShortageVoiceAlert';
import { LineDashStyleControls } from '../../components/linedash/LineDashStyleControls';
import { LineBoardOptionB } from '../../components/linedash/LineBoardOptionB';
import { ShortageSpeechOverlay } from '../../components/linedash/ShortageSpeechOverlay';
import { getLineTheme } from '../../lib/lineDashboardUtils';

const SewingMachineIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M5 28H31M7 28V23.5C7 22.12 8.12 21 9.5 21H18.5C19.6 21 20.5 20.1 20.5 19V13.5C20.5 12.12 19.38 11 18 11H10.5C9.12 11 8 12.12 8 13.5V15.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 15.5V19M11 19L10.3 20.8M20.5 13H27.5C28.88 13 30 14.12 30 15.5V28"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="26.5" cy="17.5" r="2.2" fill="currentColor" />
    <path d="M13 8H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const TShirtIcon: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M16.24 3.56 21 6.32l-1.9 3.92-2.6-1.15V20a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1V9.09L4.9 10.24 3 6.32l4.76-2.76a1 1 0 0 1 .92-.05 3.6 3.6 0 0 0 6.64 0 1 1 0 0 1 .92.05Z" />
  </svg>
);

export const LineDashboardBoard: React.FC = () => {
  const { line } = useParams<{ line: string }>();
  const location = useLocation();
  const parsedLine = Number(line);

  const isValidLine = Number.isInteger(parsedLine) && parsedLine >= 1 && parsedLine <= 4;
  const targetLine = isValidLine ? parsedLine : 1;

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
  } = useLineDashboardData(soundEnabled, targetLine);

  const { activeAnnouncement } = useShortageVoiceAlert(
    soundEnabled,
    linesMetrics,
    loading,
    targetLine
  );

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

  const metrics = linesMetrics[targetLine];
  const theme = getLineTheme(targetLine);
  const qcpRow = metrics.rows.find((r) => r.key === 'output') || metrics.rows[metrics.rows.length - 1];

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

  if (!isValidLine) {
    return <Navigate to="/linedash/all" replace />;
  }

  const standaloneMode = isKiosk || isFullscreen || isExpanded;
  const lineNumberPadded = String(targetLine).padStart(2, '0');

  // SVG progress circle calculations
  const circleRadius = 40;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const clampedPct = Math.max(0, Math.min(100, metrics.progressPct ?? 0));
  const strokeDashoffset = circleCircumference - (clampedPct / 100) * circleCircumference;

  const isGoalMet = metrics.isGoalMet;
  const isExceeded = metrics.isExceeded;
  const effPct = metrics.efficiencyPct;
  const effBarWidth = effPct !== null ? Math.max(0, Math.min(100, effPct)) : 0;
  const effBarColor =
    effPct === null
      ? 'bg-slate-300'
      : effPct >= 100
      ? 'bg-emerald-500'
      : effPct >= 80
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const totalExpectedSoFar =
    metrics.hourlyTarget !== null && qcpRow.enteredCount > 0
      ? metrics.hourlyTarget * qcpRow.enteredCount
      : null;
  const totalDiff =
    qcpRow.total !== null && totalExpectedSoFar !== null ? qcpRow.total - totalExpectedSoFar : null;

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
          : 'relative -m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-5rem)] p-[clamp(0.4rem,0.8vw,0.75rem)]'
      } ${!isOptionB ? 'gap-[clamp(0.35rem,0.65vh,0.55rem)]' : 'gap-[clamp(0.3rem,0.55vh,0.5rem)]'}`}
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

      {/* Full-Display Giant Floating Bangla Voice Announcement Overlay */}
      <ShortageSpeechOverlay announcement={activeAnnouncement} />

      {/* Top-Right Style Switch & TV Controls (hidden in kiosk=1, auto-hides after 3s idle in fullscreen) */}
      <LineDashStyleControls
        activeStyle={activeStyle}
        onChangeStyle={setLineDashStyle}
        showAllLinesLink
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
          <LineBoardOptionB
            lineNo={targetLine}
            metrics={metrics}
            clock={clock}
            effectiveUnit={effectiveUnit}
            loading={loading}
            connectionState={connectionState}
            flashingKeys={flashingKeys}
            standaloneMode={standaloneMode}
          />
        </div>
      ) : (
      /* MAIN VERTICAL TV STACK (OPTION A - UNCHANGED) */
      <div className="relative z-10 flex flex-col justify-between flex-1 gap-[clamp(0.42rem,0.85vh,0.72rem)] min-h-0">
        {/* 1. HEADER BAR */}
        <header
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#061A42]/95 via-[#0B2B68]/95 to-[#061A42]/95 px-[clamp(0.85rem,1.4vw,1.5rem)] py-[clamp(0.36rem,0.72vh,0.62rem)] flex items-center justify-between gap-3 border border-sky-400/45 shadow-[0_0_24px_rgba(56,189,248,0.2)]"
          style={{
            borderTop: `4px solid ${theme.accentHex}`,
          }}
        >
          <div className="flex items-center gap-[clamp(0.5rem,0.9vw,0.95rem)] shrink-0">
            <div className="p-1.5 rounded-xl bg-sky-400/15 border border-sky-300/35 text-white shrink-0 shadow-[0_0_12px_rgba(56,189,248,0.25)]">
              <SewingMachineIcon className="w-[clamp(1.4rem,2.1vw,2.1rem)] h-[clamp(1.4rem,2.1vw,2.1rem)]" />
            </div>
            <div className="h-7 w-[2px] bg-sky-300/40 shrink-0 hidden sm:block" />
            <h1
              className="font-black tracking-wide !text-white leading-none whitespace-nowrap drop-shadow-sm"
              style={{ fontSize: 'clamp(1.4rem, 2.35vw, 2.5rem)' }}
            >
              LINE {lineNumberPadded}
            </h1>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 border border-emerald-300/75 text-white shrink-0 shadow-[0_0_16px_rgba(34,197,94,0.45)]">
              <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
              <span
                className="font-black tracking-wider uppercase leading-none"
                style={{ fontSize: 'clamp(0.65rem, 0.85vw, 0.9rem)' }}
              >
                LIVE PRODUCTION
              </span>
            </div>
            <span
              className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-500/25 border border-sky-300/45 text-sky-100 font-extrabold uppercase tracking-wider leading-none shrink-0"
              style={{ fontSize: 'clamp(0.65rem, 0.78vw, 0.84rem)' }}
            >
              {effectiveUnit} UNIT
            </span>
          </div>

          {/* Center Company Title */}
          <div className="hidden md:flex items-center justify-center min-w-0 px-2">
            <span
              className="font-black tracking-[0.12em] uppercase !text-white text-center truncate drop-shadow-[0_0_10px_rgba(56,189,248,0.35)]"
              style={{ fontSize: 'clamp(0.95rem, 1.52vw, 1.68rem)' }}
            >
              RUPKATHA APPARELS LTD.
            </span>
          </div>

          <div className="flex items-center gap-[clamp(0.6rem,1.1vw,1.2rem)] shrink-0 text-right">
            <div
              className="hidden md:flex items-center gap-1.5 font-bangla text-sky-100 font-bold tracking-wide whitespace-nowrap"
              style={{ fontSize: 'clamp(0.82rem, 1.06vw, 1.1rem)' }}
            >
              <Calendar className="w-4 h-4 text-sky-300 shrink-0" />
              <span>{clock.formattedDate}</span>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#041436]/90 border border-sky-400/45 font-black text-white tabular-nums tracking-tight whitespace-nowrap shadow-[0_0_12px_rgba(56,189,248,0.2)]"
              style={{ fontSize: 'clamp(0.92rem, 1.28vw, 1.35rem)' }}
            >
              <Clock className="w-4 h-4 text-sky-300 shrink-0" />
              <span>{clock.formattedTime}</span>
            </div>
          </div>
        </header>

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="flex-1 min-h-0 flex flex-col gap-3 animate-pulse">
            <div className="h-12 rounded-xl bg-white/10" />
            <div className="grid grid-cols-4 gap-3 h-32">
              <div className="rounded-2xl bg-white/10" />
              <div className="rounded-2xl bg-white/10" />
              <div className="rounded-2xl bg-white/10" />
              <div className="rounded-2xl bg-white/10" />
            </div>
            <div className="flex-1 rounded-2xl bg-white/10" />
            <div className="grid grid-cols-4 gap-3 h-32">
              <div className="rounded-2xl bg-white/10" />
              <div className="rounded-2xl bg-white/10" />
              <div className="rounded-2xl bg-white/10" />
              <div className="rounded-2xl bg-white/10" />
            </div>
          </div>
        ) : !metrics.hasReport ? (
          /* NO REPORT TODAY STATE */
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="max-w-2xl w-full rounded-2xl bg-gradient-to-br from-[#0A2760] to-[#06183D] text-white border-2 border-sky-400/60 shadow-[0_0_32px_rgba(56,189,248,0.25)] p-8 sm:p-10 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/25 border border-sky-300/45 text-sky-100 font-extrabold text-sm tracking-wider uppercase mb-5">
                <SewingMachineIcon className="w-5 h-5" />
                <span>LINE {lineNumberPadded} · {effectiveUnit.toUpperCase()}</span>
              </div>
              <h2
                className="font-bangla font-bold !text-white leading-relaxed"
                style={{ fontSize: 'clamp(1.75rem, 2.9vw, 2.85rem)' }}
              >
                আজকের রিপোর্ট শুরু হয়নি
              </h2>
              <p
                className="mt-2 text-sky-200 font-semibold"
                style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.15rem)' }}
              >
                Waiting for today&apos;s sewing hourly production entry ({clock.formattedDate})
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-200 text-xs font-bold border border-emerald-400/40">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Auto-updating live as soon as Sewing Entry is saved</span>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE LINE DASHBOARD BODY */
          <>
            {/* 2. INFO STRIP (Dark Glowing Glass Ribbon) */}
            <section className="shrink-0 rounded-xl bg-gradient-to-r from-[#072154]/95 via-[#0B2E73]/95 to-[#072154]/95 text-white border border-sky-400/50 shadow-[0_0_18px_rgba(56,189,248,0.18)] px-[clamp(0.75rem,1.25vw,1.3rem)] py-[clamp(0.36rem,0.68vh,0.55rem)] flex items-center justify-between gap-2 overflow-hidden">
              <div className="flex items-center flex-1 min-w-0 divide-x divide-sky-300/35">
                <div className="pr-3 min-w-0 flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200 shrink-0">Buyer:</span>
                  <span
                    className="font-extrabold text-white truncate"
                    style={{ fontSize: 'clamp(0.82rem, 1.06vw, 1.06rem)' }}
                    title={metrics.buyer}
                  >
                    {metrics.buyer}
                  </span>
                </div>

                <div className="px-3 min-w-0 flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200 shrink-0">Style:</span>
                  <span
                    className="font-extrabold text-white truncate"
                    style={{ fontSize: 'clamp(0.82rem, 1.06vw, 1.06rem)' }}
                    title={metrics.style}
                  >
                    {metrics.style}
                  </span>
                </div>

                <div className="px-3 shrink-0 hidden sm:flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200">PO:</span>
                  <span
                    className="font-extrabold text-white"
                    style={{ fontSize: 'clamp(0.82rem, 1.04vw, 1.04rem)' }}
                  >
                    {metrics.po}
                  </span>
                </div>

                <div className="px-3 shrink-0 flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200">Order Qty:</span>
                  <span
                    className="font-extrabold text-white tabular-nums"
                    style={{ fontSize: 'clamp(0.82rem, 1.06vw, 1.06rem)' }}
                  >
                    {metrics.orderQty !== null ? metrics.orderQty.toLocaleString() : '-'}
                  </span>
                </div>

                <div className="px-3 shrink-0 flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200">Today Target:</span>
                  <span
                    className="font-black text-sky-300 tabular-nums"
                    style={{ fontSize: 'clamp(0.82rem, 1.08vw, 1.08rem)' }}
                  >
                    {metrics.dayTarget !== null ? `${metrics.dayTarget.toLocaleString()} PCS` : '-'}
                  </span>
                </div>

                <div className="px-3 shrink-0 hidden lg:flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200">Working Hours:</span>
                  <span
                    className="font-extrabold text-white tabular-nums"
                    style={{ fontSize: 'clamp(0.82rem, 1.06vw, 1.06rem)' }}
                  >
                    {metrics.workingHours} Hr
                  </span>
                </div>

                <div className="pl-3 shrink-0 flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-sky-200">Hourly Target:</span>
                  <span
                    className="font-extrabold text-amber-300 tabular-nums"
                    style={{ fontSize: 'clamp(0.82rem, 1.06vw, 1.06rem)' }}
                  >
                    {metrics.hourlyTarget !== null ? `${metrics.hourlyTarget.toLocaleString()} PCS` : '-'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/25 border border-sky-300/45 text-white font-extrabold shadow-xs">
                <Users className="w-3.5 h-3.5 text-sky-200" />
                <span style={{ fontSize: 'clamp(0.76rem, 0.96vw, 0.96rem)' }}>
                  Manpower: {metrics.manpowerTotal !== null ? metrics.manpowerTotal : '-'}
                </span>
              </div>
            </section>

            {/* 3. FOUR BIG GRADIENT KPI CARDS */}
            <section className="shrink-0 grid grid-cols-4 gap-[clamp(0.55rem,1vw,0.95rem)]">
              {/* (a) Today Target (Royal Blue Gradient Card) */}
              <div
                className={`rounded-2xl bg-gradient-to-br from-[#0E4AB8] via-[#093280] to-[#061F54] border-2 border-sky-400/75 text-white px-[clamp(0.8rem,1.3vw,1.3rem)] py-[clamp(0.5rem,0.95vh,0.82rem)] flex items-center gap-3 shadow-[0_0_22px_rgba(59,130,246,0.32)] transition-all duration-300 ${
                  flashingKeys.has(`L${targetLine}:dayTarget`) ? 'ring-4 ring-amber-400 scale-[1.01]' : ''
                }`}
              >
                <div className="p-2.5 rounded-2xl bg-white/15 border border-white/25 text-white shrink-0 shadow-inner">
                  <Target className="w-[clamp(1.65rem,2.5vw,2.6rem)] h-[clamp(1.65rem,2.5vw,2.6rem)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-bangla font-bold text-sky-100 leading-normal"
                    style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.32rem)' }}
                  >
                    আজকের লক্ষ্য
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className="font-black tabular-nums tracking-tight text-white leading-none drop-shadow-sm"
                      style={{ fontSize: 'clamp(1.7rem, 3.05vw, 3.3rem)' }}
                    >
                      {metrics.dayTarget !== null ? metrics.dayTarget.toLocaleString() : '-'}
                    </span>
                    <span
                      className="font-extrabold text-sky-200"
                      style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                    >
                      PCS
                    </span>
                  </div>
                </div>
              </div>

              {/* (b) Done So Far (Rich Emerald Gradient Card) */}
              <div
                className={`rounded-2xl bg-gradient-to-br from-[#107839] via-[#0B5929] to-[#073B1B] border-2 border-emerald-400/75 text-white px-[clamp(0.8rem,1.3vw,1.3rem)] py-[clamp(0.5rem,0.95vh,0.82rem)] flex items-center gap-3 shadow-[0_0_22px_rgba(34,197,94,0.3)] transition-all duration-300 ${
                  flashingKeys.has(`L${targetLine}:done`) ? 'ring-4 ring-amber-400 scale-[1.01]' : ''
                }`}
              >
                <div className="p-2.5 rounded-2xl bg-white text-emerald-700 shrink-0 shadow-md">
                  <CheckCircle2 className="w-[clamp(1.65rem,2.5vw,2.6rem)] h-[clamp(1.65rem,2.5vw,2.6rem)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-bangla font-bold text-emerald-100 leading-normal"
                    style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.32rem)' }}
                  >
                    উৎপাদন হয়েছে
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className="font-black tabular-nums tracking-tight text-[#6EE7B7] leading-none drop-shadow-sm"
                      style={{ fontSize: 'clamp(1.7rem, 3.05vw, 3.3rem)' }}
                    >
                      {metrics.done.toLocaleString()}
                    </span>
                    <span
                      className="font-extrabold text-white"
                      style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                    >
                      PCS
                    </span>
                  </div>
                </div>
              </div>

              {/* (c) Remaining (Rich Crimson Gradient; turns Emerald Green when goal met) */}
              <div
                className={`rounded-2xl border-2 px-[clamp(0.8rem,1.3vw,1.3rem)] py-[clamp(0.5rem,0.95vh,0.82rem)] flex items-center gap-3 text-white transition-all duration-300 ${
                  isGoalMet
                    ? 'bg-gradient-to-br from-[#107839] via-[#0B5929] to-[#073B1B] border-emerald-400/75 shadow-[0_0_22px_rgba(34,197,94,0.3)]'
                    : 'bg-gradient-to-br from-[#BE123C] via-[#881337] to-[#570A21] border-rose-400/75 shadow-[0_0_22px_rgba(244,63,94,0.32)]'
                } ${
                  flashingKeys.has(`L${targetLine}:remaining`) ? 'ring-4 ring-amber-400 scale-[1.01]' : ''
                }`}
              >
                <div
                  className={`p-2.5 rounded-2xl shrink-0 shadow-md ${
                    isGoalMet
                      ? 'bg-white/15 border border-white/25 text-amber-300'
                      : 'bg-white/15 border border-white/25 text-white'
                  }`}
                >
                  {isExceeded ? (
                    <Star className="w-[clamp(1.65rem,2.5vw,2.6rem)] h-[clamp(1.65rem,2.5vw,2.6rem)] fill-amber-300 text-amber-300" />
                  ) : isGoalMet ? (
                    <CheckCircle2 className="w-[clamp(1.65rem,2.5vw,2.6rem)] h-[clamp(1.65rem,2.5vw,2.6rem)] text-emerald-300" />
                  ) : (
                    <Hourglass className="w-[clamp(1.65rem,2.5vw,2.6rem)] h-[clamp(1.65rem,2.5vw,2.6rem)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-bangla font-bold leading-normal ${
                      isGoalMet ? 'text-emerald-100' : 'text-rose-100'
                    }`}
                    style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.32rem)' }}
                  >
                    {isGoalMet ? 'লক্ষ্য পূরণ' : 'এখনো বাকি'}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span
                      className={`font-black tabular-nums tracking-tight leading-none drop-shadow-sm ${
                        isGoalMet ? 'text-[#6EE7B7]' : 'text-[#FDE047]'
                      }`}
                      style={{ fontSize: 'clamp(1.7rem, 3.05vw, 3.3rem)' }}
                    >
                      {isExceeded
                        ? `+${metrics.exceededBy.toLocaleString()}`
                        : metrics.remaining !== null
                        ? metrics.remaining.toLocaleString()
                        : '-'}
                    </span>
                    <span
                      className="font-extrabold text-white"
                      style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                    >
                      PCS
                    </span>
                  </div>
                </div>
              </div>

              {/* (d) Navy Card: Glowing Circular Progress Ring + Remaining Time */}
              <div
                className={`rounded-2xl bg-gradient-to-br from-[#0A2558] via-[#071B42] to-[#041230] border-2 border-sky-400/70 text-white px-[clamp(0.75rem,1.2vw,1.25rem)] py-[clamp(0.45rem,0.9vh,0.78rem)] flex items-center justify-between gap-2 shadow-[0_0_22px_rgba(56,189,248,0.22)] transition-all duration-300 ${
                  flashingKeys.has(`L${targetLine}:progress`) ? 'ring-4 ring-amber-400' : ''
                }`}
              >
                <div className="flex items-center justify-center min-w-0">
                  <div className="relative w-[clamp(4.2rem,6vw,5.7rem)] h-[clamp(4.2rem,6vw,5.7rem)] shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <defs>
                        <linearGradient id={`ringGrad-${targetLine}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={isGoalMet ? '#4ADE80' : '#38BDF8'} />
                          <stop offset="100%" stopColor={isGoalMet ? '#22C55E' : '#22C55E'} />
                        </linearGradient>
                      </defs>
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        stroke="rgba(148, 163, 184, 0.22)"
                        strokeWidth="9"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        stroke={`url(#ringGrad-${targetLine})`}
                        strokeWidth="9"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={circleCircumference}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span
                        className="font-extrabold tabular-nums leading-none text-white"
                        style={{ fontSize: 'clamp(0.78rem, 1.08vw, 1.08rem)' }}
                      >
                        {metrics.progressPct.toFixed(1)}%
                      </span>
                      <span className="font-bangla font-bold text-[11px] text-sky-200 leading-normal">
                        সম্পন্ন
                      </span>
                    </div>
                  </div>
                </div>

                <div className="h-14 w-px bg-sky-400/35 shrink-0" />

                <div className="flex flex-col items-end justify-center text-right min-w-0">
                  <span
                    className="font-bangla font-bold text-sky-200 leading-normal"
                    style={{ fontSize: 'clamp(0.88rem, 1.15vw, 1.15rem)' }}
                  >
                    বাকি সময়
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="font-black tabular-nums leading-none text-[#FDE047] drop-shadow-sm"
                      style={{ fontSize: 'clamp(1.55rem, 2.5vw, 2.65rem)' }}
                    >
                      {metrics.remainingHours}
                    </span>
                    <span
                      className="font-bold text-sky-100"
                      style={{ fontSize: 'clamp(0.82rem, 1.05vw, 1.08rem)' }}
                    >
                      Hour
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. HOURLY PRODUCTION TABLE (Q.C.P + SHORT +/- on Dark Glowing Enterprise Card) */}
            <section className="flex-1 min-h-0 rounded-2xl bg-gradient-to-b from-[#082252]/95 to-[#051638]/95 border-2 border-sky-400/60 text-white shadow-[0_0_26px_rgba(56,189,248,0.2)] flex flex-col overflow-hidden">
              {/* Title Bar */}
              <div className="shrink-0 bg-gradient-to-r from-[#0A2963] via-[#0E3680] to-[#0A2963] border-b border-sky-400/40 text-white px-[clamp(0.8rem,1.3vw,1.35rem)] py-[clamp(0.35rem,0.7vh,0.6rem)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center gap-2 font-black tracking-wide uppercase">
                    <BarChart3 className="w-5 h-5 text-sky-300" />
                    <span style={{ fontSize: 'clamp(0.88rem, 1.18vw, 1.2rem)' }}>
                      HOURLY PRODUCTION — Q.C.P
                    </span>
                  </div>

                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-3.5 text-xs font-bold text-sky-100">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80] inline-block" />
                      Good
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e] inline-block" />
                      Short
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24] inline-block" />
                      Running
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-[0_0_6px_#fb923c] inline-block" />
                      Entry Due
                    </span>
                  </div>
                </div>

                <div
                  className="px-3.5 py-1 rounded-full bg-[#041434] border border-amber-400/80 font-extrabold text-white tabular-nums shrink-0 shadow-[0_0_12px_rgba(251,191,36,0.22)]"
                  style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                >
                  Target per Hour:{' '}
                  <span className="text-[#FDE047] font-black">
                    {metrics.hourlyTarget !== null ? metrics.hourlyTarget.toLocaleString() : '-'}
                  </span>{' '}
                  PCS
                </div>
              </div>

              {/* 2-Row Q.C.P Grid with Crisp Glowing Borders + Check/Warning Icons */}
              <div className="flex-1 min-h-0 flex flex-col p-1.5 bg-[#041330]/90">
                <table className="w-full h-full border-collapse table-fixed border-2 border-sky-400/45 bg-[#061A40]">
                  <thead>
                    <tr className="bg-[#0B2D6B] text-sky-100">
                      <th
                        className="w-[13%] text-center px-3 py-1.5 font-black uppercase tracking-wider border-2 border-sky-400/40"
                        style={{ fontSize: 'clamp(0.82rem, 1.08vw, 1.1rem)' }}
                      >
                        PARTS
                      </th>
                      {Array.from({ length: metrics.workingHours }, (_, idx) => (
                        <th
                          key={idx + 1}
                          className={`text-center py-1.5 font-black border-2 border-sky-400/40 ${
                            metrics.currentRunningHour === idx + 1
                              ? metrics.isRunningHourEntryDue
                                ? 'bg-orange-500/85 text-white'
                                : 'bg-amber-400/90 text-slate-950'
                              : ''
                          }`}
                          style={{
                            fontSize:
                              metrics.workingHours >= 11
                                ? 'clamp(0.78rem, 1.02vw, 1.08rem)'
                                : 'clamp(0.9rem, 1.18vw, 1.2rem)',
                          }}
                        >
                          H{idx + 1}
                        </th>
                      ))}
                      <th
                        className="w-[10%] text-center py-1.5 font-black uppercase tracking-wider bg-[#0F3882] text-white border-2 border-sky-400/40"
                        style={{ fontSize: 'clamp(0.82rem, 1.08vw, 1.1rem)' }}
                      >
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Main Q.C.P Output Row */}
                    <tr>
                      <td className="p-1.5 border-2 border-sky-400/40 bg-[#082252]">
                        <div className="h-full w-full rounded-xl bg-gradient-to-r from-[#0E4EA8] to-[#0A3578] border border-sky-300/45 px-2.5 py-1.5 flex items-center justify-center gap-2 shadow-inner">
                          <TShirtIcon className="w-[clamp(1.35rem,2vw,2rem)] h-[clamp(1.35rem,2vw,2rem)] text-sky-300 shrink-0" />
                          <div className="flex flex-col leading-tight">
                            <span
                              className="font-black tracking-wide text-white leading-none"
                              style={{ fontSize: 'clamp(1rem, 1.35vw, 1.42rem)' }}
                            >
                              Q.C.P
                            </span>
                            <span className="font-bangla text-[11px] font-bold text-sky-200 leading-tight mt-0.5">
                              উৎপাদন
                            </span>
                          </div>
                        </div>
                      </td>

                      {qcpRow.cells.map((cell) => {
                        const cellFlash = flashingKeys.has(
                          `L${targetLine}:output:h${cell.hourNo}`
                        );
                        let bgClass = 'bg-[#061A40]';
                        let textClass = 'text-slate-400/70 font-bold';

                        if (cell.state === 'good') {
                          bgClass = 'bg-emerald-500/12';
                          textClass = 'text-[#4ADE80] font-black';
                        } else if (cell.state === 'short') {
                          bgClass = 'bg-rose-500/15';
                          textClass = 'text-[#FB7185] font-black';
                        } else if (cell.state === 'neutral') {
                          bgClass = 'bg-sky-500/10';
                          textClass = 'text-white font-black';
                        } else if (cell.state === 'running') {
                          bgClass = 'bg-amber-400/18';
                          textClass = 'text-amber-300 font-black animate-pulse';
                        } else if (cell.state === 'entry_due') {
                          bgClass = 'bg-orange-500/25 ring-2 ring-inset ring-orange-400';
                          textClass = 'text-orange-200 font-extrabold';
                        }

                        return (
                          <td
                            key={cell.hourNo}
                            className={`text-center border-2 border-sky-400/40 tabular-nums transition-colors duration-300 ${bgClass} ${textClass} ${
                              cellFlash ? 'ring-2 ring-inset ring-amber-300 bg-amber-400/25' : ''
                            }`}
                          >
                            {cell.value !== null ? (
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span
                                  className="leading-none"
                                  style={{
                                    fontSize:
                                      metrics.workingHours >= 11
                                        ? 'clamp(1.1rem, 1.8vw, 2rem)'
                                        : 'clamp(1.3rem, 2.2vw, 2.4rem)',
                                  }}
                                >
                                  {cell.value.toLocaleString()}
                                </span>
                                {cell.state === 'good' && (
                                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </span>
                                )}
                                {cell.state === 'short' && (
                                  <AlertTriangle className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                                )}
                              </div>
                            ) : cell.state === 'entry_due' ? (
                              <div className="flex flex-col items-center justify-center px-1 leading-tight">
                                <span
                                  className="font-bangla font-extrabold text-amber-200 leading-snug"
                                  style={{
                                    fontSize:
                                      metrics.workingHours >= 11
                                        ? 'clamp(0.7rem, 0.98vw, 1.02rem)'
                                        : 'clamp(0.8rem, 1.12vw, 1.18rem)',
                                  }}
                                >
                                  রিপোর্ট
                                </span>
                                <span
                                  className="font-bangla font-extrabold text-white leading-snug"
                                  style={{
                                    fontSize:
                                      metrics.workingHours >= 11
                                        ? 'clamp(0.7rem, 0.98vw, 1.02rem)'
                                        : 'clamp(0.8rem, 1.12vw, 1.18rem)',
                                  }}
                                >
                                  এন্ট্রি দিন
                                </span>
                              </div>
                            ) : cell.state === 'running' ? (
                              <span
                                style={{
                                  fontSize:
                                    metrics.workingHours >= 11
                                      ? 'clamp(1.15rem, 1.85vw, 2rem)'
                                      : 'clamp(1.35rem, 2.25vw, 2.45rem)',
                                }}
                              >
                                ...
                              </span>
                            ) : (
                              <span className="text-xl">-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Q.C.P TOTAL */}
                      <td
                        className={`text-center border-2 border-sky-400/50 tabular-nums font-black transition-colors duration-300 ${
                          qcpRow.total === null
                            ? 'text-slate-400 bg-[#071D47]'
                            : qcpRow.totalStatus === 'good'
                            ? 'bg-emerald-500/20 text-[#4ADE80]'
                            : qcpRow.totalStatus === 'short'
                            ? 'bg-rose-500/20 text-[#FB7185]'
                            : 'bg-[#082252] text-white'
                        } ${flashingKeys.has(`L${targetLine}:output:total`) ? 'ring-2 ring-inset ring-amber-300' : ''}`}
                        style={{ fontSize: 'clamp(1.4rem, 2.35vw, 2.55rem)' }}
                      >
                        {qcpRow.total !== null ? qcpRow.total.toLocaleString() : '-'}
                      </td>
                    </tr>

                    {/* Variance / Short-Excess Row */}
                    <tr className="bg-[#041433] h-[34%]">
                      <td className="px-3 border-2 border-sky-400/40 bg-[#071F4A] text-sky-100">
                        <div className="flex items-center justify-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-sky-300 shrink-0" />
                          <span
                            className="font-black uppercase tracking-wide"
                            style={{ fontSize: 'clamp(0.78rem, 1.02vw, 1.05rem)' }}
                          >
                            SHORT / +/-
                          </span>
                        </div>
                      </td>

                      {qcpRow.cells.map((cell) => {
                        const diff =
                          cell.value !== null && metrics.hourlyTarget !== null
                            ? cell.value - metrics.hourlyTarget
                            : null;

                        let label = '-';
                        let cls = 'text-slate-400/70 font-semibold';

                        if (cell.state === 'entry_due') {
                          label = 'Entry Due';
                          cls = 'text-orange-300 font-extrabold bg-orange-500/15';
                        } else if (cell.state === 'running') {
                          label = 'Running';
                          cls = 'text-amber-300 font-extrabold bg-amber-400/10';
                        } else if (diff !== null) {
                          if (diff > 0) {
                            label = `+${diff.toLocaleString()}`;
                            cls = 'text-[#4ADE80] font-black bg-emerald-500/10';
                          } else if (diff === 0) {
                            label = '✓ 0';
                            cls = 'text-[#4ADE80] font-black bg-emerald-500/10';
                          } else {
                            label = diff.toLocaleString();
                            cls = 'text-[#FB7185] font-black bg-rose-500/10';
                          }
                        }

                        return (
                          <td
                            key={cell.hourNo}
                            className={`text-center border-2 border-sky-400/40 tabular-nums ${cls}`}
                            style={{ fontSize: 'clamp(0.9rem, 1.25vw, 1.32rem)' }}
                          >
                            {label}
                          </td>
                        );
                      })}

                      <td
                        className={`text-center border-2 border-sky-400/50 tabular-nums font-black ${
                          totalDiff === null
                            ? 'text-slate-400'
                            : totalDiff >= 0
                            ? 'text-[#4ADE80] bg-emerald-500/15'
                            : 'text-[#FB7185] bg-rose-500/15'
                        }`}
                        style={{ fontSize: 'clamp(1rem, 1.38vw, 1.42rem)' }}
                      >
                        {totalDiff === null
                          ? '-'
                          : totalDiff > 0
                          ? `+${totalDiff.toLocaleString()}`
                          : totalDiff === 0
                          ? '✓ 0'
                          : totalDiff.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 5. BOTTOM FOUR PANELS */}
            <section className="shrink-0 grid grid-cols-4 gap-[clamp(0.55rem,1vw,0.95rem)]">
              {/* Panel 1: Q.C.P - Final Status */}
              <div className="rounded-2xl bg-gradient-to-b from-[#0A265C] to-[#06183D] border-2 border-sky-400/60 text-white p-[clamp(0.5rem,0.9vw,0.8rem)] flex flex-col justify-between shadow-[0_0_20px_rgba(56,189,248,0.18)]">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                    <span
                      className="font-extrabold text-white truncate"
                      style={{ fontSize: 'clamp(0.84rem, 1.06vw, 1.08rem)' }}
                    >
                      Q.C.P - Final Status
                    </span>
                  </div>
                  {metrics.latestHourNo !== null && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/30 border border-sky-300/45 text-sky-100 text-xs font-extrabold shrink-0">
                      H{metrics.latestHourNo}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center divide-x divide-sky-400/25">
                  <div className="py-1 px-1">
                    <div className="text-[11px] font-bold text-sky-200 leading-tight">
                      Hour Target
                    </div>
                    <div
                      className="font-black text-white tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1.05rem, 1.45vw, 1.5rem)' }}
                    >
                      {metrics.latestTarget !== null ? metrics.latestTarget.toLocaleString() : '-'}
                    </div>
                  </div>
                  <div className="py-1 px-1">
                    <div className="text-[11px] font-bold text-sky-200 leading-tight">
                      Produced
                    </div>
                    <div
                      className={`font-black tabular-nums leading-tight mt-0.5 ${
                        metrics.isLatestHourShort ? 'text-[#FB7185]' : 'text-[#4ADE80]'
                      }`}
                      style={{ fontSize: 'clamp(1.05rem, 1.45vw, 1.5rem)' }}
                    >
                      {metrics.latestProduced !== null
                        ? metrics.latestProduced.toLocaleString()
                        : '-'}
                    </div>
                  </div>
                  <div className="py-1 px-1">
                    <div className="text-[11px] font-bold text-sky-200 leading-tight">Short</div>
                    <div
                      className={`font-black tabular-nums leading-tight mt-0.5 ${
                        metrics.isLatestHourShort
                          ? 'text-[#FB7185]'
                          : metrics.latestShort !== null
                          ? 'text-[#4ADE80]'
                          : 'text-slate-400'
                      }`}
                      style={{ fontSize: 'clamp(1.05rem, 1.45vw, 1.5rem)' }}
                    >
                      {metrics.latestShort !== null
                        ? metrics.latestShort > 0
                          ? metrics.latestShort.toLocaleString()
                          : 0
                        : '-'}
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-1.5 rounded-xl px-2.5 py-1.5 flex items-center justify-center gap-1.5 font-bangla font-bold leading-normal border ${
                    metrics.isLatestHourShort
                      ? 'bg-gradient-to-r from-rose-600 to-red-700 border-rose-300/60 text-white shadow-[0_0_14px_rgba(244,63,94,0.35)]'
                      : 'bg-gradient-to-r from-emerald-600 to-green-700 border-emerald-300/60 text-white shadow-[0_0_14px_rgba(34,197,94,0.3)]'
                  }`}
                  style={{ fontSize: 'clamp(0.75rem, 0.94vw, 0.96rem)' }}
                >
                  {metrics.isLatestHourShort ? (
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                  <span>
                    {metrics.isLatestHourShort ? 'LINE CHIEF-এর নজর প্রয়োজন' : 'সব ঠিক আছে'}
                  </span>
                </div>
              </div>

              {/* Panel 2: Line Performance */}
              <div
                className={`rounded-2xl bg-gradient-to-b from-[#0A265C] to-[#06183D] border-2 border-sky-400/60 text-white p-[clamp(0.5rem,0.9vw,0.8rem)] flex flex-col justify-between shadow-[0_0_20px_rgba(56,189,248,0.18)] ${
                  flashingKeys.has(`L${targetLine}:eff`) ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-sky-300 shrink-0" />
                    <span
                      className="font-extrabold text-white"
                      style={{ fontSize: 'clamp(0.84rem, 1.06vw, 1.08rem)' }}
                    >
                      Line Performance
                    </span>
                  </div>
                  {metrics.targetSoFar !== null && (
                    <span className="text-xs font-bold text-sky-200 tabular-nums">
                      {metrics.done.toLocaleString()} / {metrics.targetSoFar.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center my-1">
                  <span
                    className={`font-black tabular-nums leading-none drop-shadow-sm ${
                      effPct === null
                        ? 'text-slate-400'
                        : effPct >= 100
                        ? 'text-[#4ADE80]'
                        : effPct >= 80
                        ? 'text-amber-300'
                        : 'text-[#FB7185]'
                    }`}
                    style={{ fontSize: 'clamp(1.75rem, 2.7vw, 2.85rem)' }}
                  >
                    {effPct !== null ? `${effPct.toFixed(1)}%` : '-'}
                  </span>
                </div>

                <div>
                  <div className="w-full h-3.5 rounded-full bg-[#04112B] overflow-hidden border border-sky-400/40">
                    <div
                      className={`h-full transition-all duration-500 ${effBarColor}`}
                      style={{ width: `${effBarWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-sky-200/85 mt-1">
                    <span>0%</span>
                    <span className="text-white font-extrabold">Efficiency</span>
                    <span>100%+</span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Manpower */}
              <div className="rounded-2xl bg-gradient-to-b from-[#0A265C] to-[#06183D] border-2 border-sky-400/60 text-white p-[clamp(0.5rem,0.9vw,0.8rem)] flex flex-col justify-between shadow-[0_0_20px_rgba(56,189,248,0.18)]">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-sky-300 shrink-0" />
                    <span
                      className="font-extrabold text-white"
                      style={{ fontSize: 'clamp(0.84rem, 1.06vw, 1.08rem)' }}
                    >
                      Manpower
                    </span>
                  </div>
                  {metrics.lineChiefName !== '-' && (
                    <span className="truncate max-w-[52%] text-[11px] font-bold text-sky-200">
                      LC: {metrics.lineChiefName}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center divide-x divide-sky-400/25">
                  <div className="py-1 px-1">
                    <div className="text-[11px] font-bold text-sky-200 leading-tight">Present</div>
                    <div
                      className="font-black text-[#4ADE80] tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1.1rem, 1.55vw, 1.65rem)' }}
                    >
                      -
                    </div>
                  </div>
                  <div className="py-1 px-1">
                    <div className="text-[11px] font-bold text-sky-200 leading-tight">Absent</div>
                    <div
                      className="font-black text-[#FB7185] tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1.1rem, 1.55vw, 1.65rem)' }}
                    >
                      -
                    </div>
                  </div>
                  <div className="py-1 px-1">
                    <div className="text-[11px] font-bold text-sky-200 leading-tight">Total</div>
                    <div
                      className="font-black text-white tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1.1rem, 1.55vw, 1.65rem)' }}
                    >
                      {metrics.manpowerTotal !== null ? metrics.manpowerTotal : '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 rounded-xl bg-[#041434] border border-sky-400/35 px-3 py-1.5 flex items-center justify-around text-xs font-extrabold text-sky-100">
                  <span>OP: <strong className="text-white">{metrics.op ?? '-'}</strong></span>
                  <span className="text-sky-400/50">·</span>
                  <span>HP: <strong className="text-white">{metrics.hp ?? '-'}</strong></span>
                  <span className="text-sky-400/50">·</span>
                  <span>IR: <strong className="text-white">{metrics.ir ?? '-'}</strong></span>
                </div>
              </div>

              {/* Panel 4: Attention Required (Red Header + Soft Rose Body) OR On Track (Green) */}
              {metrics.isLatestHourShort ? (
                <div className="rounded-2xl bg-gradient-to-br from-[#FFF1F2] to-[#FFE4E6] border-2 border-rose-500 text-rose-950 overflow-hidden flex flex-col justify-between shadow-[0_0_22px_rgba(244,63,94,0.3)]">
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white px-3 py-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span
                      className="font-black uppercase tracking-wide truncate"
                      style={{ fontSize: 'clamp(0.72rem, 0.92vw, 0.95rem)' }}
                    >
                      LINE {lineNumberPadded} - ATTENTION REQUIRED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 px-2.5 py-2 flex-1 items-center">
                    <div className="flex flex-col gap-0.5 border-r border-rose-300/80 pr-2">
                      <div className="text-[11px] font-black text-rose-950 leading-tight mb-0.5">
                        Hourly Production Short
                      </div>
                      <div className="text-xs font-bold text-slate-800 flex justify-between">
                        <span>Target:</span>
                        <strong className="tabular-nums">{metrics.latestTarget ?? '-'} PCS</strong>
                      </div>
                      <div className="text-xs font-bold text-slate-800 flex justify-between">
                        <span>Actual:</span>
                        <strong className="tabular-nums">{metrics.latestProduced ?? '-'} PCS</strong>
                      </div>
                      <div className="text-xs font-black text-rose-600 flex justify-between">
                        <span>Short:</span>
                        <strong className="tabular-nums">{metrics.latestShort} PCS</strong>
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5 pl-0.5">
                      <div className="text-[11px] font-black text-slate-900 leading-tight mb-0.5">
                        PM Follow-up
                      </div>
                      <ul className="font-bangla font-bold text-[11px] text-slate-900 space-y-0.5 leading-snug">
                        <li className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>অপারেটরের কাজ দেখুন</span>
                        </li>
                        <li className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>মেশিন চেক করুন</span>
                        </li>
                        <li className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>প্রয়োজনে রি-অ্যালোকেশন</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-gradient-to-b from-[#0C3828] to-[#062419] border-2 border-emerald-400/75 text-white overflow-hidden flex flex-col justify-between shadow-[0_0_20px_rgba(34,197,94,0.25)]">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-3 py-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span
                      className="font-black uppercase tracking-wide"
                      style={{ fontSize: 'clamp(0.78rem, 0.98vw, 1rem)' }}
                    >
                      ON TRACK
                    </span>
                  </div>

                  <div
                    className="px-3 my-1.5 font-bangla font-bold text-emerald-100 text-center leading-normal"
                    style={{ fontSize: 'clamp(0.88rem, 1.1vw, 1.12rem)' }}
                  >
                    {isGoalMet
                      ? 'আজকের লক্ষ্য সফলভাবে অর্জিত হয়েছে'
                      : 'উৎপাদন লক্ষ্যমাত্রা অনুযায়ী চলছে'}
                  </div>

                  <div className="mx-2.5 mb-2 rounded-xl bg-black/25 border border-emerald-400/35 px-3 py-1.5 text-xs font-bold text-emerald-100 flex items-center justify-between">
                    <span>Line Chief:</span>
                    <span className="truncate max-w-[60%] text-white">{metrics.lineChiefName}</span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* 6. FOOTER BAR */}
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

export default LineDashboardBoard;
