/**
 * Single-Line Enterprise TV Board (/linedash/:line)
 * Deep navy gradient + light-blue enterprise cards, Q.C.P-only hourly view, 16:9 no-scroll layout
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Hourglass,
  Maximize2,
  Minimize2,
  Radio,
  ShieldCheck,
  Star,
  Target,
  TrendingUp,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { useLineDashboardData } from '../../hooks/useLineDashboardData';
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

  const boardContent = (
    <div
      ref={boardRef}
      onMouseMove={bumpControls}
      onTouchStart={bumpControls}
      className={`flex flex-col justify-between overflow-hidden select-none text-white bg-gradient-to-br from-[#071633] via-[#0B224B] to-[#0D2D63] ${
        standaloneMode
          ? 'fixed inset-0 z-[9999] w-screen h-screen p-[clamp(0.5rem,1vw,0.95rem)]'
          : 'relative -m-4 sm:-m-6 lg:-m-8 h-[calc(100vh-5rem)] p-[clamp(0.45rem,0.85vw,0.85rem)]'
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
          className={`fixed z-[10000] flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#071633]/95 border border-sky-400/40 shadow-2xl backdrop-blur-md transition-opacity duration-300 ${
            standaloneMode ? 'top-3 right-3' : 'bottom-4 right-4'
          } ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <Link
            to="/linedash/all"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-sky-100 transition-colors"
            title="All Lines Overview"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Lines</span>
          </Link>

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
      <div className="relative z-10 flex flex-col justify-between h-full gap-[clamp(0.45rem,0.9vh,0.75rem)] min-h-0">
        {/* 1. HEADER BAR (Accent color on header bar only) */}
        <header
          className="shrink-0 rounded-xl bg-[#081C3E]/95 px-[clamp(0.85rem,1.5vw,1.6rem)] py-[clamp(0.38rem,0.75vh,0.65rem)] flex items-center justify-between shadow-lg"
          style={{
            borderTop: `4px solid ${theme.accentHex}`,
            borderBottom: `2px solid ${theme.accentHex}`,
          }}
        >
          <div className="flex items-center gap-[clamp(0.6rem,1.1vw,1.1rem)] min-w-0">
            <div className="p-2 rounded-xl bg-white/10 border border-white/15 text-sky-200 shrink-0">
              <SewingMachineIcon className="w-[clamp(1.45rem,2.1vw,2.1rem)] h-[clamp(1.45rem,2.1vw,2.1rem)]" />
            </div>
            <h1
              className="font-black tracking-wide text-white leading-none"
              style={{ fontSize: 'clamp(1.45rem, 2.5vw, 2.65rem)' }}
            >
              LINE {lineNumberPadded}
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shrink-0">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span
                className="font-extrabold tracking-wider uppercase leading-none"
                style={{ fontSize: 'clamp(0.68rem, 0.85vw, 0.9rem)' }}
              >
                LIVE PRODUCTION
              </span>
            </div>
            <span
              className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/35 text-sky-100 font-bold uppercase tracking-wider leading-none"
              style={{ fontSize: 'clamp(0.68rem, 0.8vw, 0.85rem)' }}
            >
              {effectiveUnit} UNIT
            </span>
          </div>

          <div className="flex items-center gap-[clamp(0.7rem,1.3vw,1.35rem)] shrink-0 text-right">
            <div
              className="hidden md:block text-sky-100 font-semibold tracking-wide"
              style={{ fontSize: 'clamp(0.82rem, 1.1vw, 1.12rem)' }}
            >
              {clock.formattedDate}
            </div>
            <div
              className="px-3.5 py-1.5 rounded-xl bg-[#102E63] border border-sky-400/35 font-extrabold text-white tabular-nums tracking-tight"
              style={{ fontSize: 'clamp(0.95rem, 1.35vw, 1.4rem)' }}
            >
              {clock.formattedTime}
            </div>
          </div>
        </header>

        {/* LOADING SKELETON */}
        {loading ? (
          <div className="flex-1 min-h-0 flex flex-col gap-3 animate-pulse">
            <div className="h-12 rounded-xl bg-white/15" />
            <div className="grid grid-cols-4 gap-3 h-32">
              <div className="rounded-xl bg-white/15" />
              <div className="rounded-xl bg-white/15" />
              <div className="rounded-xl bg-white/15" />
              <div className="rounded-xl bg-white/15" />
            </div>
            <div className="flex-1 rounded-xl bg-white/15" />
            <div className="grid grid-cols-4 gap-3 h-32">
              <div className="rounded-xl bg-white/15" />
              <div className="rounded-xl bg-white/15" />
              <div className="rounded-xl bg-white/15" />
              <div className="rounded-xl bg-white/15" />
            </div>
          </div>
        ) : !metrics.hasReport ? (
          /* NO REPORT TODAY STATE */
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="max-w-2xl w-full rounded-2xl bg-[#F4F8FF] text-slate-900 border-2 border-sky-300 shadow-2xl p-8 sm:p-10 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0B224B] text-white font-extrabold text-sm tracking-wider uppercase mb-5">
                <SewingMachineIcon className="w-5 h-5" />
                <span>LINE {lineNumberPadded} · {effectiveUnit.toUpperCase()}</span>
              </div>
              <h2
                className="font-bangla font-bold text-[#0B224B] leading-relaxed"
                style={{ fontSize: 'clamp(1.75rem, 2.9vw, 2.85rem)' }}
              >
                আজকের রিপোর্ট শুরু হয়নি
              </h2>
              <p
                className="mt-2 text-slate-600 font-semibold"
                style={{ fontSize: 'clamp(0.9rem, 1.2vw, 1.15rem)' }}
              >
                Waiting for today&apos;s sewing hourly production entry ({clock.formattedDate})
              </p>
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-100 text-sky-900 text-xs font-bold border border-sky-200">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Auto-updating live as soon as Sewing Entry is saved</span>
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE LINE DASHBOARD BODY */
          <>
            {/* 2. INFO STRIP */}
            <section className="shrink-0 rounded-xl bg-[#F8FAFF] text-[#0B1E40] border border-sky-200 shadow-md px-[clamp(0.75rem,1.3vw,1.35rem)] py-[clamp(0.38rem,0.7vh,0.58rem)] flex items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-center flex-1 min-w-0 divide-x divide-slate-300/90">
                <div className="pr-3.5 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    Buyer
                  </div>
                  <div
                    className="font-extrabold text-[#0B1E40] truncate leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.15vw, 1.12rem)' }}
                    title={metrics.buyer}
                  >
                    {metrics.buyer}
                  </div>
                </div>

                <div className="px-3.5 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    Style
                  </div>
                  <div
                    className="font-extrabold text-[#0B1E40] truncate leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.15vw, 1.12rem)' }}
                    title={metrics.style}
                  >
                    {metrics.style}
                  </div>
                </div>

                <div className="px-3.5 shrink-0 hidden sm:block">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    PO
                  </div>
                  <div
                    className="font-bold text-slate-700 leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1.05rem)' }}
                  >
                    {metrics.po}
                  </div>
                </div>

                <div className="px-3.5 shrink-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    Order Qty
                  </div>
                  <div
                    className="font-extrabold text-[#0B1E40] tabular-nums leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.15vw, 1.12rem)' }}
                  >
                    {metrics.orderQty !== null ? metrics.orderQty.toLocaleString() : '-'}
                  </div>
                </div>

                <div className="px-3.5 shrink-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    Today Target
                  </div>
                  <div
                    className="font-extrabold text-blue-700 tabular-nums leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.15vw, 1.12rem)' }}
                  >
                    {metrics.dayTarget !== null ? `${metrics.dayTarget.toLocaleString()} PCS` : '-'}
                  </div>
                </div>

                <div className="px-3.5 shrink-0 hidden lg:block">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    Working Hours
                  </div>
                  <div
                    className="font-extrabold text-[#0B1E40] tabular-nums leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.15vw, 1.12rem)' }}
                  >
                    {metrics.workingHours} Hr
                  </div>
                </div>

                <div className="pl-3.5 shrink-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                    Hourly Target
                  </div>
                  <div
                    className="font-extrabold text-[#0B1E40] tabular-nums leading-snug"
                    style={{ fontSize: 'clamp(0.85rem, 1.15vw, 1.12rem)' }}
                  >
                    {metrics.hourlyTarget !== null ? `${metrics.hourlyTarget.toLocaleString()} PCS` : '-'}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B224B] text-white font-bold shadow-xs">
                <Users className="w-4 h-4 text-sky-300" />
                <span style={{ fontSize: 'clamp(0.78rem, 1vw, 1rem)' }}>
                  Manpower: {metrics.manpowerTotal !== null ? metrics.manpowerTotal : '-'}
                </span>
              </div>
            </section>

            {/* 3. FOUR BIG KPI CARDS */}
            <section className="shrink-0 grid grid-cols-4 gap-[clamp(0.55rem,1vw,0.95rem)]">
              {/* (a) Today Target (Blue Card) */}
              <div
                className={`rounded-2xl bg-[#E0EEFF] border-2 border-[#60A5FA] text-[#0F2A5A] px-[clamp(0.8rem,1.3vw,1.3rem)] py-[clamp(0.55rem,1.05vh,0.9rem)] flex flex-col justify-between shadow-md transition-all duration-300 ${
                  flashingKeys.has(`L${targetLine}:dayTarget`) ? 'ring-4 ring-amber-400 scale-[1.01]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-bangla font-bold text-[#1E3A8A] leading-normal"
                    style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.32rem)' }}
                  >
                    আজকের লক্ষ্য
                  </span>
                  <div className="p-2 rounded-xl bg-blue-600/15 text-blue-700 shrink-0">
                    <Target className="w-[clamp(1.1rem,1.5vw,1.5rem)] h-[clamp(1.1rem,1.5vw,1.5rem)]" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className="font-black tabular-nums tracking-tight text-[#0B224B] leading-none"
                    style={{ fontSize: 'clamp(1.7rem, 3vw, 3.25rem)' }}
                  >
                    {metrics.dayTarget !== null ? metrics.dayTarget.toLocaleString() : '-'}
                  </span>
                  <span
                    className="font-extrabold text-blue-800"
                    style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                  >
                    PCS
                  </span>
                </div>
              </div>

              {/* (b) Done So Far (Green Card) */}
              <div
                className={`rounded-2xl bg-[#DCFCE7] border-2 border-[#4ADE80] text-[#064E3B] px-[clamp(0.8rem,1.3vw,1.3rem)] py-[clamp(0.55rem,1.05vh,0.9rem)] flex flex-col justify-between shadow-md transition-all duration-300 ${
                  flashingKeys.has(`L${targetLine}:done`) ? 'ring-4 ring-amber-400 scale-[1.01]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-bangla font-bold text-[#14532D] leading-normal"
                    style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.32rem)' }}
                  >
                    উৎপাদন হয়েছে
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-600/15 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-[clamp(1.1rem,1.5vw,1.5rem)] h-[clamp(1.1rem,1.5vw,1.5rem)]" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className="font-black tabular-nums tracking-tight text-[#064E3B] leading-none"
                    style={{ fontSize: 'clamp(1.7rem, 3vw, 3.25rem)' }}
                  >
                    {metrics.done.toLocaleString()}
                  </span>
                  <span
                    className="font-extrabold text-emerald-800"
                    style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                  >
                    PCS
                  </span>
                </div>
              </div>

              {/* (c) Remaining (Red card; turns GREEN when remaining === 0 & dayTarget > 0) */}
              <div
                className={`rounded-2xl border-2 px-[clamp(0.8rem,1.3vw,1.3rem)] py-[clamp(0.55rem,1.05vh,0.9rem)] flex flex-col justify-between shadow-md transition-all duration-300 ${
                  isGoalMet
                    ? 'bg-[#DCFCE7] border-[#22C55E] text-[#064E3B]'
                    : 'bg-[#FEE2E2] border-[#F87171] text-[#7F1D1D]'
                } ${
                  flashingKeys.has(`L${targetLine}:remaining`) ? 'ring-4 ring-amber-400 scale-[1.01]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-bangla font-bold leading-normal ${
                      isGoalMet ? 'text-[#14532D]' : 'text-[#991B1B]'
                    }`}
                    style={{ fontSize: 'clamp(0.95rem, 1.3vw, 1.32rem)' }}
                  >
                    {isGoalMet ? 'লক্ষ্য পূরণ' : 'এখনো বাকি'}
                  </span>
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isGoalMet
                        ? 'bg-emerald-600/15 text-emerald-700'
                        : 'bg-rose-600/15 text-rose-700'
                    }`}
                  >
                    {isExceeded ? (
                      <Star className="w-[clamp(1.1rem,1.5vw,1.5rem)] h-[clamp(1.1rem,1.5vw,1.5rem)] fill-amber-400 text-amber-500" />
                    ) : isGoalMet ? (
                      <CheckCircle2 className="w-[clamp(1.1rem,1.5vw,1.5rem)] h-[clamp(1.1rem,1.5vw,1.5rem)]" />
                    ) : (
                      <Hourglass className="w-[clamp(1.1rem,1.5vw,1.5rem)] h-[clamp(1.1rem,1.5vw,1.5rem)]" />
                    )}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className="font-black tabular-nums tracking-tight leading-none"
                    style={{ fontSize: 'clamp(1.7rem, 3vw, 3.25rem)' }}
                  >
                    {isExceeded
                      ? `+${metrics.exceededBy.toLocaleString()}`
                      : metrics.remaining !== null
                      ? metrics.remaining.toLocaleString()
                      : '-'}
                  </span>
                  <span
                    className={`font-extrabold ${
                      isGoalMet ? 'text-emerald-800' : 'text-rose-800'
                    }`}
                    style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                  >
                    PCS
                  </span>
                </div>
              </div>

              {/* (d) Navy Card: Circular Progress Ring + Remaining Time */}
              <div
                className={`rounded-2xl bg-[#0A1D42] border-2 border-[#3B82F6]/65 text-white px-[clamp(0.75rem,1.2vw,1.25rem)] py-[clamp(0.45rem,0.9vh,0.8rem)] flex items-center justify-between gap-2 shadow-md transition-all duration-300 ${
                  flashingKeys.has(`L${targetLine}:progress`) ? 'ring-4 ring-amber-400' : ''
                }`}
              >
                <div className="flex items-center justify-center min-w-0">
                  <div className="relative w-[clamp(4.1rem,5.9vw,5.6rem)] h-[clamp(4.1rem,5.9vw,5.6rem)] shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        stroke="rgba(148, 163, 184, 0.25)"
                        strokeWidth="8.5"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r={circleRadius}
                        stroke={isGoalMet ? '#22C55E' : '#38BDF8'}
                        strokeWidth="8.5"
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

                <div className="h-14 w-px bg-sky-400/30 shrink-0" />

                <div className="flex flex-col items-end justify-center text-right min-w-0">
                  <span
                    className="font-bangla font-bold text-sky-200 leading-normal"
                    style={{ fontSize: 'clamp(0.88rem, 1.15vw, 1.15rem)' }}
                  >
                    বাকি সময়
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="font-black tabular-nums leading-none text-amber-300"
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

            {/* 4. HOURLY PRODUCTION TABLE (Q.C.P ONLY — Clean, Crisp, High-Readability) */}
            <section className="flex-1 min-h-0 rounded-2xl bg-[#F4F8FF] border-2 border-sky-300 text-[#0B1E40] shadow-lg flex flex-col overflow-hidden">
              {/* Title Bar */}
              <div className="shrink-0 bg-[#122D5E] text-white px-[clamp(0.8rem,1.3vw,1.35rem)] py-[clamp(0.38rem,0.75vh,0.65rem)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex items-center gap-2 font-extrabold tracking-wide uppercase">
                    <BarChart3 className="w-5 h-5 text-sky-300" />
                    <span style={{ fontSize: 'clamp(0.88rem, 1.18vw, 1.2rem)' }}>
                      HOURLY PRODUCTION — Q.C.P
                    </span>
                  </div>

                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-3.5 text-xs font-semibold text-sky-100">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                      Good
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                      Short
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" />
                      Running
                    </span>
                  </div>
                </div>

                <div
                  className="px-3.5 py-1 rounded-full bg-sky-500/25 border border-sky-300/45 font-extrabold text-sky-50 tabular-nums shrink-0"
                  style={{ fontSize: 'clamp(0.8rem, 1.05vw, 1.05rem)' }}
                >
                  Target per Hour:{' '}
                  {metrics.hourlyTarget !== null ? `${metrics.hourlyTarget.toLocaleString()} PCS` : '-'}
                </div>
              </div>

              {/* Spacious 2-Row Q.C.P Grid (Q.C.P Output + Variance +/-) with Strong Visible Borders */}
              <div className="flex-1 min-h-0 flex flex-col p-1.5 bg-[#E6EFFC]">
                <table className="w-full h-full border-collapse table-fixed border-2 border-[#1E3A8A]/45 bg-white">
                  <thead>
                    <tr className="bg-[#D2E4FC] text-[#0B224B]">
                      <th
                        className="w-[12.5%] text-left px-3.5 py-2 font-black uppercase tracking-wider border-2 border-[#1E3A8A]/40"
                        style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1.12rem)' }}
                      >
                        Q.C.P
                      </th>
                      {Array.from({ length: 10 }, (_, idx) => (
                        <th
                          key={idx + 1}
                          className={`text-center py-2 font-black border-2 border-[#1E3A8A]/40 ${
                            metrics.currentRunningHour === idx + 1
                              ? 'bg-amber-200 text-amber-950'
                              : ''
                          }`}
                          style={{ fontSize: 'clamp(0.9rem, 1.18vw, 1.2rem)' }}
                        >
                          H{idx + 1}
                        </th>
                      ))}
                      <th
                        className="w-[10.5%] text-center py-2 font-black uppercase tracking-wider bg-[#BDD6FA] border-2 border-[#1E3A8A]/40"
                        style={{ fontSize: 'clamp(0.85rem, 1.1vw, 1.12rem)' }}
                      >
                        TOTAL
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Main Q.C.P Output Row */}
                    <tr className="bg-white">
                      <td className="px-3.5 border-2 border-[#1E3A8A]/40 bg-emerald-100/80 text-emerald-950">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div className="flex flex-col">
                            <span
                              className="font-black tracking-wide leading-tight"
                              style={{ fontSize: 'clamp(1.05rem, 1.38vw, 1.45rem)' }}
                            >
                              Q.C.P
                            </span>
                            <span className="font-bangla text-xs font-bold text-emerald-800 leading-normal">
                              উৎপাদন
                            </span>
                          </div>
                        </div>
                      </td>

                      {qcpRow.cells.map((cell) => {
                        const cellFlash = flashingKeys.has(
                          `L${targetLine}:output:h${cell.hourNo}`
                        );
                        let bgClass = 'bg-white';
                        let textClass = 'text-slate-300 font-bold';

                        if (cell.state === 'good') {
                          bgClass = 'bg-emerald-50';
                          textClass = 'text-emerald-700 font-black';
                        } else if (cell.state === 'short') {
                          bgClass = 'bg-rose-50';
                          textClass = 'text-rose-600 font-black';
                        } else if (cell.state === 'neutral') {
                          bgClass = 'bg-slate-50';
                          textClass = 'text-slate-800 font-black';
                        } else if (cell.state === 'running') {
                          bgClass = 'bg-amber-100/90';
                          textClass = 'text-amber-700 font-black animate-pulse';
                        }

                        return (
                          <td
                            key={cell.hourNo}
                            className={`text-center border-2 border-[#1E3A8A]/40 tabular-nums transition-colors duration-300 ${bgClass} ${textClass} ${
                              cellFlash ? 'ring-2 ring-inset ring-amber-400 bg-amber-100' : ''
                            }`}
                            style={{ fontSize: 'clamp(1.35rem, 2.25vw, 2.45rem)' }}
                          >
                            {cell.value !== null
                              ? cell.value.toLocaleString()
                              : cell.state === 'running'
                              ? '...'
                              : '-'}
                          </td>
                        );
                      })}

                      {/* Q.C.P TOTAL */}
                      <td
                        className={`text-center border-2 border-[#1E3A8A]/45 tabular-nums font-black transition-colors duration-300 ${
                          qcpRow.total === null
                            ? 'text-slate-400 bg-slate-50'
                            : qcpRow.totalStatus === 'good'
                            ? 'bg-emerald-100 text-emerald-800'
                            : qcpRow.totalStatus === 'short'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-900'
                        } ${flashingKeys.has(`L${targetLine}:output:total`) ? 'ring-2 ring-inset ring-amber-400' : ''}`}
                        style={{ fontSize: 'clamp(1.4rem, 2.35vw, 2.55rem)' }}
                      >
                        {qcpRow.total !== null ? qcpRow.total.toLocaleString() : '-'}
                      </td>
                    </tr>

                    {/* Variance / Short-Excess Row */}
                    <tr className="bg-[#F8FAFF] h-[36%]">
                      <td className="px-3.5 border-2 border-[#1E3A8A]/40 bg-slate-200/75 text-[#0B224B]">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-700 shrink-0" />
                          <span
                            className="font-black uppercase tracking-wide"
                            style={{ fontSize: 'clamp(0.82rem, 1.08vw, 1.1rem)' }}
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
                        let cls = 'text-slate-400 font-semibold';

                        if (cell.state === 'running') {
                          label = 'Running';
                          cls = 'text-amber-700 font-extrabold bg-amber-50';
                        } else if (diff !== null) {
                          if (diff > 0) {
                            label = `+${diff.toLocaleString()}`;
                            cls = 'text-emerald-700 font-black bg-emerald-50/75';
                          } else if (diff === 0) {
                            label = '✓ 0';
                            cls = 'text-emerald-700 font-black bg-emerald-50/75';
                          } else {
                            label = diff.toLocaleString();
                            cls = 'text-rose-600 font-black bg-rose-50/75';
                          }
                        }

                        return (
                          <td
                            key={cell.hourNo}
                            className={`text-center border-2 border-[#1E3A8A]/40 tabular-nums ${cls}`}
                            style={{ fontSize: 'clamp(0.95rem, 1.32vw, 1.38rem)' }}
                          >
                            {label}
                          </td>
                        );
                      })}

                      <td
                        className={`text-center border-2 border-[#1E3A8A]/45 tabular-nums font-black ${
                          totalDiff === null
                            ? 'text-slate-400'
                            : totalDiff >= 0
                            ? 'text-emerald-700 bg-emerald-100/80'
                            : 'text-rose-600 bg-rose-100/80'
                        }`}
                        style={{ fontSize: 'clamp(1rem, 1.4vw, 1.45rem)' }}
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
              <div className="rounded-2xl bg-[#F4F8FF] border-2 border-sky-400 text-[#0B1E40] p-[clamp(0.55rem,0.95vw,0.85rem)] flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span
                    className="font-extrabold text-[#0B224B] truncate"
                    style={{ fontSize: 'clamp(0.85rem, 1.08vw, 1.1rem)' }}
                  >
                    Q.C.P - Final Status
                  </span>
                  {metrics.latestHourNo !== null && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-200 border border-sky-400 text-sky-950 text-xs font-extrabold">
                      H{metrics.latestHourNo}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white border-2 border-slate-300 py-1.5 px-1">
                    <div className="text-[11px] font-bold text-slate-600 leading-tight">
                      Hour Target
                    </div>
                    <div
                      className="font-black text-[#0B224B] tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1rem, 1.38vw, 1.4rem)' }}
                    >
                      {metrics.latestTarget !== null ? metrics.latestTarget.toLocaleString() : '-'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border-2 border-blue-300 py-1.5 px-1">
                    <div className="text-[11px] font-bold text-slate-600 leading-tight">
                      Produced
                    </div>
                    <div
                      className="font-black text-blue-700 tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1rem, 1.38vw, 1.4rem)' }}
                    >
                      {metrics.latestProduced !== null
                        ? metrics.latestProduced.toLocaleString()
                        : '-'}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl bg-white border-2 py-1.5 px-1 ${
                      metrics.isLatestHourShort
                        ? 'border-rose-500 bg-rose-50/70'
                        : metrics.latestShort !== null
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-600 leading-tight">Short</div>
                    <div
                      className={`font-black tabular-nums leading-tight mt-0.5 ${
                        metrics.isLatestHourShort
                          ? 'text-rose-600'
                          : metrics.latestShort !== null
                          ? 'text-emerald-600'
                          : 'text-slate-400'
                      }`}
                      style={{ fontSize: 'clamp(1rem, 1.38vw, 1.4rem)' }}
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
                  className={`mt-2 rounded-xl px-2.5 py-1.5 text-center font-bangla font-bold leading-normal ${
                    metrics.isLatestHourShort
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                  style={{ fontSize: 'clamp(0.76rem, 0.95vw, 0.96rem)' }}
                >
                  {metrics.isLatestHourShort ? 'LINE CHIEF-এর নজর প্রয়োজন' : 'সব ঠিক আছে'}
                </div>
              </div>

              {/* Panel 2: Line Performance */}
              <div
                className={`rounded-2xl bg-[#F4F8FF] border-2 border-sky-300 text-[#0B1E40] p-[clamp(0.55rem,0.95vw,0.85rem)] flex flex-col justify-between shadow-md ${
                  flashingKeys.has(`L${targetLine}:eff`) ? 'ring-2 ring-amber-400' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="font-extrabold text-[#0B224B]"
                    style={{ fontSize: 'clamp(0.82rem, 1.05vw, 1.08rem)' }}
                  >
                    Line Performance
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Efficiency
                  </span>
                </div>

                <div className="flex items-baseline justify-between my-1.5">
                  <span
                    className={`font-black tabular-nums leading-none ${
                      effPct === null
                        ? 'text-slate-400'
                        : effPct >= 100
                        ? 'text-emerald-600'
                        : effPct >= 80
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                    style={{ fontSize: 'clamp(1.65rem, 2.55vw, 2.65rem)' }}
                  >
                    {effPct !== null ? `${effPct.toFixed(1)}%` : '-'}
                  </span>
                  {metrics.targetSoFar !== null && (
                    <span className="text-xs font-bold text-slate-600 tabular-nums">
                      {metrics.done.toLocaleString()} / {metrics.targetSoFar.toLocaleString()}
                    </span>
                  )}
                </div>

                <div>
                  <div className="w-full h-3.5 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
                    <div
                      className={`h-full transition-all duration-500 ${effBarColor}`}
                      style={{ width: `${effBarWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-slate-500 mt-1">
                    <span>0%</span>
                    <span>80%</span>
                    <span>100%+</span>
                  </div>
                </div>
              </div>

              {/* Panel 3: Manpower */}
              <div className="rounded-2xl bg-[#F4F8FF] border-2 border-sky-300 text-[#0B1E40] p-[clamp(0.55rem,0.95vw,0.85rem)] flex flex-col justify-between shadow-md">
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span
                    className="font-extrabold text-[#0B224B]"
                    style={{ fontSize: 'clamp(0.82rem, 1.05vw, 1.08rem)' }}
                  >
                    Manpower
                  </span>
                  <Users className="w-4 h-4 text-blue-700" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white border border-sky-200 py-1.5 px-1">
                    <div className="text-[11px] font-bold text-slate-500 leading-tight">Total</div>
                    <div
                      className="font-black text-[#0B224B] tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1rem, 1.35vw, 1.35rem)' }}
                    >
                      {metrics.manpowerTotal !== null ? metrics.manpowerTotal : '-'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-sky-200 py-1.5 px-1">
                    <div className="text-[11px] font-bold text-slate-500 leading-tight">
                      Present
                    </div>
                    <div
                      className="font-black text-slate-500 tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1rem, 1.35vw, 1.35rem)' }}
                    >
                      -
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-sky-200 py-1.5 px-1">
                    <div className="text-[11px] font-bold text-slate-500 leading-tight">
                      Absent
                    </div>
                    <div
                      className="font-black text-slate-500 tabular-nums leading-tight mt-0.5"
                      style={{ fontSize: 'clamp(1rem, 1.35vw, 1.35rem)' }}
                    >
                      -
                    </div>
                  </div>
                </div>

                <div className="mt-2 rounded-xl bg-sky-100 border border-sky-200 px-2.5 py-1.5 flex items-center justify-between text-xs font-bold text-[#0B224B]">
                  <span>
                    OP: {metrics.op ?? '-'} · HP: {metrics.hp ?? '-'} · IR: {metrics.ir ?? '-'}
                  </span>
                  {metrics.lineChiefName !== '-' && (
                    <span className="truncate max-w-[45%] text-blue-800">
                      LC: {metrics.lineChiefName}
                    </span>
                  )}
                </div>
              </div>

              {/* Panel 4: Attention Required (Red) OR On Track (Green) */}
              {metrics.isLatestHourShort ? (
                <div className="rounded-2xl bg-[#FEF2F2] border-2 border-rose-500 text-rose-950 p-[clamp(0.55rem,0.95vw,0.85rem)] flex flex-col justify-between shadow-md">
                  <div className="flex items-center gap-1.5 bg-rose-600 text-white px-2.5 py-1.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span
                      className="font-black uppercase tracking-wide truncate"
                      style={{ fontSize: 'clamp(0.72rem, 0.92vw, 0.95rem)' }}
                    >
                      LINE {lineNumberPadded} - ATTENTION REQUIRED
                    </span>
                  </div>

                  <div className="mt-1.5 text-xs font-bold text-rose-900 flex items-center justify-between bg-white/90 rounded-xl px-2.5 py-1.5 border border-rose-200">
                    <span>
                      Target: <strong className="tabular-nums">{metrics.latestTarget ?? '-'}</strong>
                    </span>
                    <span>
                      Actual: <strong className="tabular-nums">{metrics.latestProduced ?? '-'}</strong>
                    </span>
                    <span className="text-rose-700 font-black tabular-nums">
                      Short: {metrics.latestShort}
                    </span>
                  </div>

                  <div className="mt-1.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
                      PM Follow-up
                    </div>
                    <ul className="font-bangla font-bold text-xs text-rose-950 leading-relaxed">
                      <li>• অপারেটরের কাজ দেখুন</li>
                      <li>• মেশিন চেক করুন · প্রয়োজনে রি-অ্যালোকেশন</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-[#ECFDF5] border-2 border-emerald-500 text-emerald-950 p-[clamp(0.55rem,0.95vw,0.85rem)] flex flex-col justify-between shadow-md">
                  <div className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span
                      className="font-black uppercase tracking-wide"
                      style={{ fontSize: 'clamp(0.78rem, 0.98vw, 1rem)' }}
                    >
                      ON TRACK
                    </span>
                  </div>

                  <div
                    className="my-1.5 font-bangla font-bold text-emerald-900 text-center leading-normal"
                    style={{ fontSize: 'clamp(0.9rem, 1.12vw, 1.15rem)' }}
                  >
                    {isGoalMet
                      ? 'আজকের লক্ষ্য সফলভাবে অর্জিত হয়েছে'
                      : 'উৎপাদন লক্ষ্যমাত্রা অনুযায়ী চলছে'}
                  </div>

                  <div className="rounded-xl bg-white/90 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>Line Chief:</span>
                    <span className="truncate max-w-[60%]">{metrics.lineChiefName}</span>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* 6. FOOTER BAR */}
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

export default LineDashboardBoard;
