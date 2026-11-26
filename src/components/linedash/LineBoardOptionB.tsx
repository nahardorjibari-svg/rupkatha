/**
 * Option B: High-Contrast Big Number TV Board (/linedash/:line)
 * Designed for 16:9 factory floor TVs (1920x1080 & 1366x768), zero scroll, >= 18px text
 * Flat solid dark surfaces (#0A0A0A + subtle dark-blue vignette), Hind Siliguri + Inter bold
 */
import React from 'react';
import {
  AlertTriangle,
  ArrowDown,
  Check,
  CheckCircle2,
  Clock,
  Hourglass,
  Star,
  Users,
} from 'lucide-react';
import type { BoardUnit, LiveConnectionState } from '../../hooks/useLineDashboardData';
import type { DhakaClockInfo, LineBoardMetrics } from '../../lib/lineDashboardUtils';
import {
  getOptionBLineColor,
  getTrafficLightState,
  toBanglaDigits,
} from '../../hooks/useLineDashStyle';

interface LineBoardOptionBProps {
  lineNo: number;
  metrics: LineBoardMetrics;
  clock: DhakaClockInfo;
  effectiveUnit: BoardUnit;
  loading: boolean;
  connectionState: LiveConnectionState;
  flashingKeys: Set<string>;
  standaloneMode: boolean;
}

export const LineBoardOptionB: React.FC<LineBoardOptionBProps> = ({
  lineNo,
  metrics,
  clock,
  effectiveUnit,
  loading,
  connectionState,
  flashingKeys,
  standaloneMode,
}) => {
  const lineColor = getOptionBLineColor(lineNo);
  const qcpRow =
    metrics.rows.find((r) => r.key === 'output') || metrics.rows[metrics.rows.length - 1];

  const trafficState = getTrafficLightState(
    metrics.done,
    metrics.targetSoFar,
    metrics.hasReport,
    metrics.enteredQcpHours
  );

  const trafficCircleClass =
    trafficState === 'green'
      ? 'bg-[#22C55E] shadow-[0_0_16px_rgba(34,197,94,0.85)]'
      : trafficState === 'yellow'
      ? 'bg-[#FACC15] shadow-[0_0_16px_rgba(250,204,21,0.85)]'
      : trafficState === 'red'
      ? 'bg-[#EF4444] shadow-[0_0_16px_rgba(239,68,68,0.85)]'
      : 'bg-slate-500';

  const trafficLabel =
    trafficState === 'green'
      ? 'On Target'
      : trafficState === 'yellow'
      ? 'Behind ≤10%'
      : trafficState === 'red'
      ? 'Behind >10%'
      : 'Waiting';

  const isBehindTargetSoFar =
    metrics.targetSoFar !== null && metrics.enteredQcpHours > 0 && metrics.done < metrics.targetSoFar;

  // First not-yet-entered hour in Q.C.P
  const firstUnenteredHour = qcpRow.cells.find((c) => c.value === null)?.hourNo ?? null;

  // Hour short = hour achieved - hour target (for short hours); Total short = sum of short hours
  const shortHoursList: Array<{ hourNo: number; diff: number }> = [];
  if (metrics.hourlyTarget !== null) {
    for (const cell of qcpRow.cells) {
      if (cell.value !== null && cell.value < metrics.hourlyTarget) {
        shortHoursList.push({
          hourNo: cell.hourNo,
          diff: cell.value - metrics.hourlyTarget, // negative, e.g. -20
        });
      }
    }
  }
  const totalShort = shortHoursList.reduce((sum, item) => sum + item.diff, 0);
  const hasShort = totalShort < 0;

  // Progress bar color & clamped width
  const progressClamped = Math.max(0, Math.min(100, metrics.progressPct));
  const progressColorState: 'green' | 'amber' | 'red' = (() => {
    if (metrics.isGoalMet) return 'green';
    if (metrics.efficiencyPct !== null) {
      if (metrics.efficiencyPct >= 100) return 'green';
      if (metrics.efficiencyPct >= 90) return 'amber';
      return 'red';
    }
    if (metrics.progressPct >= 100) return 'green';
    if (metrics.progressPct >= 50) return 'amber';
    return 'red';
  })();

  const progressFillClass =
    progressColorState === 'green'
      ? 'bg-[#97C459]'
      : progressColorState === 'amber'
      ? 'bg-[#FAC775]'
      : 'bg-[#F09595]';

  const progressTextClass =
    progressColorState === 'green'
      ? 'text-[#97C459]'
      : progressColorState === 'amber'
      ? 'text-[#FAC775]'
      : 'text-[#F09595]';

  // Giant number scale: 14-18vh in standalone TV mode, slightly tuned in embedded mode to guarantee zero scroll
  const giantNumFontSize = standaloneMode
    ? 'clamp(3.8rem, 13.8vh, 17.5vh)'
    : 'clamp(3.1rem, 11.4vh, 14.5vh)';

  const flashGlowClass =
    'ring-2 ring-white shadow-[0_0_28px_rgba(255,255,255,0.85)]';

  return (
    <div className="relative z-10 flex flex-col justify-between h-full min-h-0 gap-[clamp(0.35rem,0.72vh,0.65rem)]">
      {/* 1. HEADER */}
      <header className="shrink-0 rounded-xl bg-[#13151A] border border-white/10 px-[clamp(0.75rem,1.25vw,1.35rem)] py-[clamp(0.35rem,0.65vh,0.6rem)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-[clamp(0.6rem,1vw,1rem)] min-w-0">
          {/* Giant Line Badge */}
          <div
            className="px-[clamp(0.85rem,1.4vw,1.5rem)] py-[clamp(0.25rem,0.45vh,0.45rem)] rounded-xl text-white font-black tracking-wide leading-none shrink-0"
            style={{
              backgroundColor: lineColor.hex,
              fontSize: 'clamp(1.35rem, 2.25vw, 2.5rem)',
            }}
          >
            {lineColor.label}
          </div>

          {/* Pulsing Green LIVE dot */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#142611] border border-[#27500A] shrink-0">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#97C459] opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#22C55E]" />
            </span>
            <span
              className="font-black tracking-wider text-[#97C459] uppercase leading-none"
              style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.5rem)' }}
            >
              LIVE
            </span>
          </div>

          <span
            className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-[#1C2026] border border-white/10 text-slate-200 font-bold uppercase leading-none"
            style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.4rem)' }}
          >
            {effectiveUnit.toUpperCase()}
          </span>

          {/* Small Live connected / Reconnecting status */}
          <div
            className="hidden md:flex items-center gap-2 font-semibold whitespace-nowrap"
            style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.35rem)' }}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-[#22C55E]'
                  : 'bg-[#FAC775] animate-pulse'
              }`}
            />
            <span className={connectionState === 'connected' ? 'text-[#97C459]' : 'text-[#FAC775]'}>
              {connectionState === 'connected' ? 'Live connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>

        {/* Right: Date + Big Live Clock + Traffic-Light Circle */}
        <div className="flex items-center gap-[clamp(0.65rem,1.2vw,1.25rem)] shrink-0">
          <span
            className="hidden lg:inline font-bangla font-bold text-slate-300 whitespace-nowrap leading-none"
            style={{ fontSize: 'clamp(1.125rem, 1.38vw, 1.5rem)' }}
          >
            {clock.formattedDate}
          </span>

          <div
            className="flex items-center gap-2 px-3.5 py-1 rounded-xl bg-[#0A0A0A] border border-white/15 font-black text-white tabular-nums whitespace-nowrap leading-none"
            style={{ fontSize: 'clamp(1.25rem, 1.85vw, 2.15rem)' }}
          >
            <Clock className="w-[clamp(1.15rem,1.5vw,1.65rem)] h-[clamp(1.15rem,1.5vw,1.65rem)] text-slate-300 shrink-0" />
            <span>{clock.formattedTime}</span>
          </div>

          {/* Traffic Light Circle */}
          <div
            className="flex items-center justify-center shrink-0"
            title={`Target Pace: ${trafficLabel}`}
            aria-label={`Target Pace: ${trafficLabel}`}
          >
            <span
              className={`w-[clamp(1.4rem,2vw,2.2rem)] h-[clamp(1.4rem,2vw,2.2rem)] rounded-full border-2 border-white/25 ${trafficCircleClass}`}
            />
          </div>
        </div>
      </header>

      {/* BODY STATES */}
      {loading ? (
        <div className="flex-1 min-h-0 flex flex-col gap-3 animate-pulse">
          <div className="h-12 rounded-xl bg-white/5" />
          <div className="flex-1 grid grid-rows-4 gap-2.5">
            <div className="rounded-2xl bg-white/5" />
            <div className="rounded-2xl bg-white/5" />
            <div className="rounded-2xl bg-white/5" />
            <div className="rounded-2xl bg-white/5" />
          </div>
          <div className="h-24 rounded-xl bg-white/5" />
        </div>
      ) : !metrics.hasReport ? (
        /* NO REPORT TODAY FRIENDLY SCREEN */
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className="max-w-3xl w-full rounded-2xl bg-[#13151A] border border-white/15 p-8 sm:p-12 text-center">
            <div
              className="inline-flex items-center px-6 py-2 rounded-xl font-black text-white mb-6"
              style={{
                backgroundColor: lineColor.hex,
                fontSize: 'clamp(1.5rem, 2.4vw, 2.5rem)',
              }}
            >
              {lineColor.label} · {effectiveUnit.toUpperCase()}
            </div>
            <h2
              className="font-bangla font-bold text-white leading-relaxed"
              style={{ fontSize: 'clamp(2rem, 3.6vw, 3.6rem)' }}
            >
              আজকের রিপোর্ট শুরু হয়নি
            </h2>
            <p
              className="mt-3 text-slate-300 font-semibold"
              style={{ fontSize: 'clamp(1.125rem, 1.45vw, 1.5rem)' }}
            >
              {clock.formattedDate} · {connectionState === 'connected' ? 'Live connected' : 'Reconnecting...'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 2. INFO ROW (Two slim dark cards: Buyer, Style, Order qty, Manpower) */}
          <section className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-[clamp(0.45rem,0.9vw,0.85rem)]">
            <div className="rounded-xl bg-[#13151A] border border-white/10 px-[clamp(0.75rem,1.2vw,1.25rem)] py-[clamp(0.32rem,0.58vh,0.52rem)] flex items-center justify-between gap-4 min-w-0">
              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                <span
                  className="font-bangla font-bold text-slate-400 shrink-0 leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.4rem)' }}
                >
                  বায়ার:
                </span>
                <span
                  className="font-bold text-white truncate leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.45vw, 1.65rem)' }}
                  title={metrics.buyer}
                >
                  {metrics.buyer}
                </span>
              </div>
              <div className="w-px h-6 bg-white/15 shrink-0" />
              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                <span
                  className="font-bangla font-bold text-slate-400 shrink-0 leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.4rem)' }}
                >
                  স্টাইল:
                </span>
                <span
                  className="font-bold text-white truncate leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.45vw, 1.65rem)' }}
                  title={metrics.style}
                >
                  {metrics.style}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-[#13151A] border border-white/10 px-[clamp(0.75rem,1.2vw,1.25rem)] py-[clamp(0.32rem,0.58vh,0.52rem)] flex items-center justify-between gap-4 min-w-0">
              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                <span
                  className="font-bangla font-bold text-slate-400 shrink-0 leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.4rem)' }}
                >
                  অর্ডার:
                </span>
                <span
                  className="font-bold text-white tabular-nums truncate leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.45vw, 1.65rem)' }}
                >
                  {metrics.orderQty !== null ? metrics.orderQty.toLocaleString() : '-'}
                </span>
              </div>
              <div className="w-px h-6 bg-white/15 shrink-0" />
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                <Users className="w-5 h-5 text-slate-300 shrink-0" />
                <span
                  className="font-bangla font-bold text-slate-400 shrink-0 leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.4rem)' }}
                >
                  জনবল:
                </span>
                <span
                  className="font-bold text-white tabular-nums leading-none"
                  style={{ fontSize: 'clamp(1.125rem, 1.45vw, 1.65rem)' }}
                >
                  {metrics.manpowerTotal !== null ? metrics.manpowerTotal : '-'}
                </span>
              </div>
            </div>
          </section>

          {/* EMPTY Q.C.P TARGET RED BOX ALERT */}
          {metrics.hourlyTarget === null ? (
            <div className="flex-1 min-h-0 flex flex-col justify-center gap-4">
              <div className="rounded-2xl bg-[#791F1F] border-2 border-[#F09595] px-8 py-10 text-center flex flex-col items-center justify-center gap-4">
                <AlertTriangle className="w-16 h-16 text-[#FAC775]" />
                <h2
                  className="font-bangla font-bold text-white leading-tight"
                  style={{ fontSize: 'clamp(2.2rem, 4.2vw, 4.5rem)' }}
                >
                  টার্গেট দেওয়া হয়নি
                </h2>
                <p
                  className="text-[#F7C1C1] font-bold"
                  style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.6rem)' }}
                >
                  {lineColor.label} — Q.C.P Hourly Target is empty in Sewing Entry
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 3. FOUR GIANT NUMBER ROWS STACKED */}
              <section className="flex-1 min-h-0 grid grid-rows-4 gap-[clamp(0.3rem,0.58vh,0.55rem)]">
                {/* Row 1: আজকের লক্ষ্য = Day Target (Yellow #FAC775) */}
                <div
                  className={`rounded-2xl bg-[#13151A] border border-white/10 px-[clamp(0.9rem,1.8vw,2rem)] flex items-center justify-between gap-4 min-h-0 transition-all duration-300 ${
                    flashingKeys.has(`L${lineNo}:dayTarget`) ? flashGlowClass : ''
                  }`}
                >
                  <span
                    className="font-bangla font-bold text-[#FAC775] leading-none truncate"
                    style={{ fontSize: 'clamp(1.65rem, 3vw, 3.5rem)' }}
                  >
                    আজকের লক্ষ্য
                  </span>
                  <div className="flex items-baseline gap-2.5 shrink-0">
                    <span
                      className="font-sans font-bold tabular-nums leading-[0.88] text-[#FAC775]"
                      style={{
                        fontSize: giantNumFontSize,
                        textShadow: '0 0 28px rgba(250, 199, 117, 0.35)',
                      }}
                    >
                      {metrics.dayTarget !== null ? metrics.dayTarget.toLocaleString() : '-'}
                    </span>
                    <span
                      className="font-sans font-bold text-slate-400 uppercase"
                      style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.65rem)' }}
                    >
                      PCS
                    </span>
                  </div>
                </div>

                {/* Row 2: এখন পর্যন্ত হয়েছে = Done (Green #97C459; turns Red #F09595 when behind target-so-far) */}
                <div
                  className={`rounded-2xl bg-[#13151A] border border-white/10 px-[clamp(0.9rem,1.8vw,2rem)] flex items-center justify-between gap-4 min-h-0 transition-all duration-300 ${
                    flashingKeys.has(`L${lineNo}:done`) ? flashGlowClass : ''
                  }`}
                >
                  <span
                    className={`font-bangla font-bold leading-none truncate ${
                      isBehindTargetSoFar ? 'text-[#F09595]' : 'text-[#97C459]'
                    }`}
                    style={{ fontSize: 'clamp(1.65rem, 3vw, 3.5rem)' }}
                  >
                    এখন পর্যন্ত হয়েছে
                  </span>
                  <div className="flex items-baseline gap-2.5 shrink-0">
                    <span
                      className={`font-sans font-bold tabular-nums leading-[0.88] ${
                        isBehindTargetSoFar ? 'text-[#F09595]' : 'text-[#97C459]'
                      }`}
                      style={{
                        fontSize: giantNumFontSize,
                        textShadow: isBehindTargetSoFar
                          ? '0 0 28px rgba(240, 149, 149, 0.35)'
                          : '0 0 28px rgba(151, 196, 89, 0.35)',
                      }}
                    >
                      {metrics.done.toLocaleString()}
                    </span>
                    <span
                      className="font-sans font-bold text-slate-400 uppercase"
                      style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.65rem)' }}
                    >
                      PCS
                    </span>
                  </div>
                </div>

                {/* Row 3: এখনো বাকি = Remaining (#2A0F0F with #F7C1C1; Green card with big check when 0 / লক্ষ্য পূরণ; +N with star if exceeded) */}
                <div
                  className={`rounded-2xl border px-[clamp(0.9rem,1.8vw,2rem)] flex items-center justify-between gap-4 min-h-0 transition-all duration-300 ${
                    metrics.isGoalMet
                      ? 'bg-[#122B09] border-[#27500A]'
                      : 'bg-[#2A0F0F] border-[#791F1F]'
                  } ${flashingKeys.has(`L${lineNo}:remaining`) ? flashGlowClass : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {metrics.isGoalMet ? (
                      <CheckCircle2 className="w-[clamp(1.85rem,2.9vw,3.3rem)] h-[clamp(1.85rem,2.9vw,3.3rem)] text-[#97C459] shrink-0" />
                    ) : (
                      <Hourglass className="w-[clamp(1.75rem,2.7vw,3rem)] h-[clamp(1.75rem,2.7vw,3rem)] text-[#F7C1C1] shrink-0" />
                    )}
                    <span
                      className={`font-bangla font-bold leading-none truncate ${
                        metrics.isGoalMet ? 'text-[#97C459]' : 'text-[#F7C1C1]'
                      }`}
                      style={{ fontSize: 'clamp(1.65rem, 3vw, 3.5rem)' }}
                    >
                      {metrics.isGoalMet ? 'লক্ষ্য পূরণ' : 'এখনো বাকি'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {metrics.isExceeded && (
                      <Star className="w-[clamp(2rem,3.4vw,3.8rem)] h-[clamp(2rem,3.4vw,3.8rem)] text-[#FAC775] fill-[#FAC775] shrink-0" />
                    )}
                    {metrics.isGoalMet && !metrics.isExceeded && (
                      <CheckCircle2 className="w-[clamp(2.2rem,3.8vw,4.2rem)] h-[clamp(2.2rem,3.8vw,4.2rem)] text-[#97C459] shrink-0" />
                    )}
                    <div className="flex items-baseline gap-2.5">
                      <span
                        className={`font-sans font-bold tabular-nums leading-[0.88] ${
                          metrics.isGoalMet ? 'text-[#97C459]' : 'text-[#F7C1C1]'
                        }`}
                        style={{
                          fontSize: giantNumFontSize,
                          textShadow: metrics.isGoalMet
                            ? '0 0 28px rgba(151, 196, 89, 0.4)'
                            : '0 0 28px rgba(247, 193, 193, 0.32)',
                        }}
                      >
                        {metrics.isExceeded
                          ? `+${metrics.exceededBy.toLocaleString()}`
                          : metrics.remaining !== null
                          ? metrics.remaining.toLocaleString()
                          : '-'}
                      </span>
                      <span
                        className={`font-sans font-bold uppercase ${
                          metrics.isGoalMet ? 'text-[#97C459]/80' : 'text-[#F7C1C1]/75'
                        }`}
                        style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.65rem)' }}
                      >
                        PCS
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 4: এই ঘণ্টায় টার্গেট = Q.C.P Hour Target (Blue #85B7EB) */}
                <div
                  className={`rounded-2xl bg-[#13151A] border border-white/10 px-[clamp(0.9rem,1.8vw,2rem)] flex items-center justify-between gap-4 min-h-0 transition-all duration-300 ${
                    flashingKeys.has(`L${lineNo}:dayTarget`) ? flashGlowClass : ''
                  }`}
                >
                  <span
                    className="font-bangla font-bold text-[#85B7EB] leading-none truncate"
                    style={{ fontSize: 'clamp(1.65rem, 3vw, 3.5rem)' }}
                  >
                    এই ঘণ্টায় টার্গেট
                  </span>
                  <div className="flex items-baseline gap-2.5 shrink-0">
                    <span
                      className="font-sans font-bold tabular-nums leading-[0.88] text-[#85B7EB]"
                      style={{
                        fontSize: giantNumFontSize,
                        textShadow: '0 0 28px rgba(133, 183, 235, 0.35)',
                      }}
                    >
                      {metrics.hourlyTarget !== null ? metrics.hourlyTarget.toLocaleString() : '-'}
                    </span>
                    <span
                      className="font-sans font-bold text-slate-400 uppercase"
                      style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.65rem)' }}
                    >
                      PCS
                    </span>
                  </div>
                </div>
              </section>

              {/* THIN PROGRESS BAR WITH PERCENTAGE (RED / AMBER / GREEN) */}
              <div className="shrink-0 flex items-center gap-3 px-1">
                <div className="flex-1 h-3 rounded-full bg-[#1C1F26] overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${progressFillClass}`}
                    style={{ width: `${progressClamped}%` }}
                  />
                </div>
                <span
                  className={`font-sans font-bold tabular-nums leading-none shrink-0 ${progressTextClass}`}
                  style={{ fontSize: 'clamp(1.125rem, 1.5vw, 1.75rem)' }}
                >
                  {metrics.progressPct.toFixed(1)}%
                </span>
              </div>

              {/* 4. HOUR TILES: One row of N tiles (8 to 12), equal width */}
              <section
                className="shrink-0 grid gap-[clamp(0.3rem,0.55vw,0.55rem)]"
                style={{
                  gridTemplateColumns: `repeat(${metrics.workingHours}, minmax(0, 1fr))`,
                }}
              >
                {qcpRow.cells.map((cell) => {
                  const isCurrentHour = cell.value === null && firstUnenteredHour === cell.hourNo;
                  const diff =
                    cell.value !== null && metrics.hourlyTarget !== null
                      ? cell.value - metrics.hourlyTarget
                      : null;
                  const isShort = diff !== null && diff < 0;
                  const isAtOrAbove = diff !== null && diff >= 0;
                  const tileFlash = flashingKeys.has(`L${lineNo}:output:h${cell.hourNo}`);

                  let cardBg = 'bg-[#17191E] border-white/10';
                  if (isShort) {
                    cardBg = 'bg-[#791F1F] border-[#F09595]/50';
                  } else if (isAtOrAbove) {
                    cardBg = 'bg-[#27500A] border-[#97C459]/50';
                  } else if (isCurrentHour) {
                    cardBg = 'bg-[#1D1B10] border-2 border-[#FAC775] animate-pulse';
                  }

                  return (
                    <div
                      key={cell.hourNo}
                      className={`rounded-xl border px-1.5 py-[clamp(0.3rem,0.6vh,0.55rem)] flex flex-col items-center justify-between text-center min-w-0 transition-all duration-300 ${cardBg} ${
                        tileFlash ? flashGlowClass : ''
                      }`}
                    >
                      {/* Hour Label (H1...) */}
                      <span
                        className={`font-sans font-bold leading-none ${
                          isCurrentHour
                            ? 'text-[#FAC775]'
                            : isShort
                            ? 'text-[#F7C1C1]'
                            : isAtOrAbove
                            ? 'text-[#D6F5B0]'
                            : 'text-slate-400'
                        }`}
                        style={{ fontSize: 'clamp(1.125rem, 1.25vw, 1.35rem)' }}
                      >
                        H{cell.hourNo}
                      </span>

                      {/* Achieved Number Big or Current Hour "এখন / ..." or "-" */}
                      {cell.value !== null ? (
                        <span
                          className="font-sans font-bold text-white tabular-nums leading-tight my-0.5 truncate max-w-full"
                          style={{
                            fontSize:
                              metrics.workingHours >= 11
                                ? 'clamp(1.25rem, 1.75vw, 2.15rem)'
                                : 'clamp(1.4rem, 2.05vw, 2.5rem)',
                          }}
                        >
                          {cell.value.toLocaleString()}
                        </span>
                      ) : isCurrentHour ? (
                        <div className="flex flex-col items-center justify-center my-0.5 leading-none">
                          <span
                            className="font-bangla font-bold text-[#FAC775] leading-tight"
                            style={{ fontSize: 'clamp(1.125rem, 1.3vw, 1.45rem)' }}
                          >
                            এখন
                          </span>
                          <span
                            className="font-sans font-bold text-[#FAC775] leading-none"
                            style={{ fontSize: 'clamp(1.125rem, 1.4vw, 1.6rem)' }}
                          >
                            ...
                          </span>
                        </div>
                      ) : (
                        <span
                          className="font-sans font-bold text-slate-500 leading-tight my-0.5"
                          style={{ fontSize: 'clamp(1.35rem, 1.8vw, 2.2rem)' }}
                        >
                          -
                        </span>
                      )}

                      {/* Difference / Symbol */}
                      <div
                        className="flex items-center justify-center gap-0.5 font-sans font-bold tabular-nums leading-none min-h-[1.25rem]"
                        style={{ fontSize: 'clamp(1.125rem, 1.2vw, 1.32rem)' }}
                      >
                        {isShort && diff !== null ? (
                          <span className="inline-flex items-center gap-0.5 text-[#F7C1C1]">
                            <ArrowDown className="w-4 h-4 shrink-0" />
                            <span>{diff.toLocaleString()}</span>
                          </span>
                        ) : isAtOrAbove && diff !== null ? (
                          <span className="inline-flex items-center gap-0.5 text-[#97C459]">
                            <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                            {diff > 0 && <span>+{diff.toLocaleString()}</span>}
                          </span>
                        ) : (
                          <span className="text-transparent select-none">.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* 5. BOTTOM ALERT STRIP */}
              {hasShort ? (
                <footer className="shrink-0 rounded-xl bg-[#2A0F0F] border border-[#791F1F] px-[clamp(0.85rem,1.5vw,1.5rem)] py-[clamp(0.38rem,0.7vh,0.65rem)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="w-6 h-6 text-[#F09595] shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span
                          className="font-bangla font-bold text-[#F7C1C1] leading-tight"
                          style={{ fontSize: 'clamp(1.2rem, 1.65vw, 1.9rem)' }}
                        >
                          মোট ঘাটতি
                        </span>
                        <span
                          className="font-sans font-bold text-[#F09595] tabular-nums leading-tight"
                          style={{ fontSize: 'clamp(1.35rem, 2.05vw, 2.4rem)' }}
                        >
                          {totalShort.toLocaleString()} PCS
                        </span>
                      </div>
                      <p
                        className="font-bangla font-bold text-[#F7C1C1]/90 leading-snug truncate"
                        style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.5rem)' }}
                      >
                        {shortHoursList
                          .map(
                            (item) =>
                              `ঘণ্টা ${toBanglaDigits(item.hourNo)}: ${item.diff.toLocaleString()}`
                          )
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                </footer>
              ) : (
                <footer className="shrink-0 rounded-xl bg-[#132A09] border border-[#27500A] px-[clamp(0.85rem,1.5vw,1.5rem)] py-[clamp(0.45rem,0.85vh,0.75rem)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-[clamp(1.5rem,2.1vw,2.25rem)] h-[clamp(1.5rem,2.1vw,2.25rem)] text-[#97C459] shrink-0" />
                    <span
                      className="font-bangla font-bold text-[#97C459] leading-none"
                      style={{ fontSize: 'clamp(1.35rem, 1.9vw, 2.2rem)' }}
                    >
                      সব ঠিক আছে
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-2 font-semibold whitespace-nowrap xl:hidden"
                    style={{ fontSize: 'clamp(1.125rem, 1.3vw, 1.35rem)' }}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        connectionState === 'connected'
                          ? 'bg-[#22C55E]'
                          : 'bg-[#FAC775] animate-pulse'
                      }`}
                    />
                    <span
                      className={
                        connectionState === 'connected' ? 'text-[#97C459]' : 'text-[#FAC775]'
                      }
                    >
                      {connectionState === 'connected' ? 'Live connected' : 'Reconnecting...'}
                    </span>
                  </div>
                </footer>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LineBoardOptionB;
