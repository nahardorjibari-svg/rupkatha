/**
 * Option B: All Lines 2x2 Compact Big Number TV Overview (/linedash/all)
 * Near-black (#0A0A0A) + subtle dark-blue vignette, flat solid cards,
 * Line badge, লক্ষ্য / হয়েছে / বাকি big numbers, traffic light, mini hour dots
 */
import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Star,
  Tv,
  Users,
} from 'lucide-react';
import type { BoardUnit, LiveConnectionState } from '../../hooks/useLineDashboardData';
import type { DhakaClockInfo, LineBoardMetrics } from '../../lib/lineDashboardUtils';
import {
  getOptionBLineColor,
  getTrafficLightState,
} from '../../hooks/useLineDashStyle';

interface LineAllOptionBProps {
  linesMetrics: Record<number, LineBoardMetrics>;
  clock: DhakaClockInfo;
  effectiveUnit: BoardUnit;
  loading: boolean;
  connectionState: LiveConnectionState;
  flashingKeys: Set<string>;
  onOpenLine: (lineNo: number) => void;
}

export const LineAllOptionB: React.FC<LineAllOptionBProps> = ({
  linesMetrics,
  clock,
  effectiveUnit,
  loading,
  connectionState,
  flashingKeys,
  onOpenLine,
}) => {
  return (
    <div className="relative z-10 flex flex-col justify-between h-full min-h-0 gap-[clamp(0.38rem,0.75vh,0.68rem)]">
      {/* HEADER */}
      <header className="shrink-0 rounded-xl bg-[#13151A] border border-white/10 px-[clamp(0.75rem,1.25vw,1.35rem)] py-[clamp(0.35rem,0.65vh,0.58rem)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-[clamp(0.6rem,1vw,1rem)] min-w-0">
          <div className="flex items-center gap-2 px-[clamp(0.75rem,1.2vw,1.3rem)] py-1.5 rounded-xl bg-[#185FA5] text-white font-black tracking-wide leading-none shrink-0">
            <Tv className="w-5 h-5 shrink-0" />
            <span style={{ fontSize: 'clamp(1.125rem, 1.75vw, 1.9rem)' }}>
              ALL LINES
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#142611] border border-[#27500A] shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#97C459] opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]" />
            </span>
            <span
              className="font-black tracking-wider text-[#97C459] uppercase leading-none"
              style={{ fontSize: 'clamp(1.125rem, 1.25vw, 1.35rem)' }}
            >
              LIVE
            </span>
          </div>

          <span
            className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-[#1C2026] border border-white/10 text-slate-200 font-bold uppercase leading-none"
            style={{ fontSize: 'clamp(1.125rem, 1.2vw, 1.3rem)' }}
          >
            {effectiveUnit.toUpperCase()}
          </span>

          <div
            className="hidden lg:flex items-center gap-2 font-semibold whitespace-nowrap"
            style={{ fontSize: 'clamp(1.125rem, 1.2vw, 1.28rem)' }}
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

        <div className="flex items-center gap-[clamp(0.65rem,1.2vw,1.25rem)] shrink-0">
          <span
            className="hidden md:inline font-bangla font-bold text-slate-300 whitespace-nowrap leading-none"
            style={{ fontSize: 'clamp(1.125rem, 1.3vw, 1.4rem)' }}
          >
            {clock.formattedDate}
          </span>
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#0A0A0A] border border-white/15 font-black text-white tabular-nums whitespace-nowrap leading-none"
            style={{ fontSize: 'clamp(1.15rem, 1.55vw, 1.75rem)' }}
          >
            <Clock className="w-4 h-4 text-slate-300 shrink-0" />
            <span>{clock.formattedTime}</span>
          </div>
        </div>
      </header>

      {/* 2x2 COMPACT BOARDS */}
      <section className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-[clamp(0.45rem,0.9vw,0.85rem)]">
        {[1, 2, 3, 4].map((ln) => {
          const m = linesMetrics[ln];
          const lineColor = getOptionBLineColor(ln);
          const qcpRow =
            m.rows.find((r) => r.key === 'output') || m.rows[m.rows.length - 1];
          const firstUnenteredHour = qcpRow.cells.find((c) => c.value === null)?.hourNo ?? null;

          const trafficState = getTrafficLightState(
            m.done,
            m.targetSoFar,
            m.hasReport,
            m.enteredQcpHours
          );

          const trafficCircleClass =
            trafficState === 'green'
              ? 'bg-[#22C55E] shadow-[0_0_12px_rgba(34,197,94,0.8)]'
              : trafficState === 'yellow'
              ? 'bg-[#FACC15] shadow-[0_0_12px_rgba(250,204,21,0.8)]'
              : trafficState === 'red'
              ? 'bg-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.8)]'
              : 'bg-slate-600';

          const isBehindTargetSoFar =
            m.targetSoFar !== null && m.enteredQcpHours > 0 && m.done < m.targetSoFar;

          let totalShort = 0;
          if (m.hourlyTarget !== null) {
            for (const cell of qcpRow.cells) {
              if (cell.value !== null && cell.value < m.hourlyTarget) {
                totalShort += cell.value - m.hourlyTarget;
              }
            }
          }

          const cardFlashing =
            flashingKeys.has(`L${ln}:done`) ||
            flashingKeys.has(`L${ln}:dayTarget`) ||
            flashingKeys.has(`L${ln}:remaining`);

          const progressClamped = Math.max(0, Math.min(100, m.progressPct));
          const progressFillClass = m.isGoalMet
            ? 'bg-[#97C459]'
            : trafficState === 'red'
            ? 'bg-[#F09595]'
            : trafficState === 'yellow'
            ? 'bg-[#FAC775]'
            : 'bg-[#97C459]';

          return (
            <button
              key={ln}
              type="button"
              onClick={() => onOpenLine(ln)}
              className={`text-left rounded-2xl bg-[#13151A] hover:bg-[#181B22] border border-white/12 hover:border-white/30 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-white ${
                cardFlashing
                  ? 'ring-2 ring-white shadow-[0_0_24px_rgba(255,255,255,0.75)]'
                  : ''
              }`}
            >
              {/* Card Top Strip */}
              <div className="shrink-0 bg-[#0D0F13] border-b border-white/10 px-[clamp(0.75rem,1.2vw,1.25rem)] py-[clamp(0.32rem,0.6vh,0.52rem)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="px-3.5 py-1 rounded-xl font-black text-white tracking-wide leading-none shrink-0"
                    style={{
                      backgroundColor: lineColor.hex,
                      fontSize: 'clamp(1.125rem, 1.45vw, 1.6rem)',
                    }}
                  >
                    {lineColor.label}
                  </span>

                  {m.hasReport ? (
                    <div className="min-w-0 flex items-center gap-2.5 truncate">
                      <span
                        className="font-bold text-white truncate leading-none"
                        style={{ fontSize: 'clamp(1.125rem, 1.25vw, 1.38rem)' }}
                      >
                        {m.buyer}
                      </span>
                      <span className="text-slate-500 hidden sm:inline">·</span>
                      <span
                        className="font-semibold text-slate-300 truncate leading-none hidden sm:inline"
                        style={{ fontSize: 'clamp(1.125rem, 1.18vw, 1.3rem)' }}
                      >
                        {m.style}
                      </span>
                    </div>
                  ) : (
                    <span
                      className="font-semibold text-slate-400 leading-none"
                      style={{ fontSize: 'clamp(1.125rem, 1.2vw, 1.3rem)' }}
                    >
                      {effectiveUnit.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Traffic Light Circle */}
                <span
                  className={`w-5 h-5 rounded-full border-2 border-white/25 shrink-0 ${trafficCircleClass}`}
                  title={`Target Pace: ${trafficState}`}
                />
              </div>

              {/* Card Body */}
              {loading ? (
                <div className="flex-1 p-4 animate-pulse flex items-center justify-center">
                  <div className="w-full h-24 rounded-xl bg-white/5" />
                </div>
              ) : !m.hasReport ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 text-center">
                  <div
                    className="font-bangla font-bold text-white leading-relaxed"
                    style={{ fontSize: 'clamp(1.35rem, 1.9vw, 2rem)' }}
                  >
                    আজকের রিপোর্ট শুরু হয়নি
                  </div>
                </div>
              ) : m.hourlyTarget === null ? (
                <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                  <div className="w-full rounded-xl bg-[#791F1F] border border-[#F09595] p-4 text-center">
                    <span
                      className="font-bangla font-bold text-white"
                      style={{ fontSize: 'clamp(1.35rem, 1.9vw, 2rem)' }}
                    >
                      টার্গেট দেওয়া হয়নি
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 px-[clamp(0.75rem,1.2vw,1.2rem)] py-[clamp(0.35rem,0.65vh,0.6rem)] flex flex-col justify-between gap-2">
                  {/* 3 Big Number Blocks: লক্ষ্য / হয়েছে / বাকি */}
                  <div className="flex-1 min-h-0 grid grid-cols-3 gap-[clamp(0.45rem,0.8vw,0.75rem)]">
                    {/* লক্ষ্য */}
                    <div className="rounded-xl bg-[#0D0F13] border border-white/10 px-3 py-2 flex flex-col justify-between min-w-0">
                      <span
                        className="font-bangla font-bold text-[#FAC775] leading-none truncate"
                        style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.55rem)' }}
                      >
                        লক্ষ্য
                      </span>
                      <span
                        className="font-sans font-bold text-[#FAC775] tabular-nums leading-none truncate"
                        style={{
                          fontSize: 'clamp(2rem, 3.6vw, 4.2rem)',
                          textShadow: '0 0 20px rgba(250, 199, 117, 0.28)',
                        }}
                      >
                        {m.dayTarget !== null ? m.dayTarget.toLocaleString() : '-'}
                      </span>
                    </div>

                    {/* হয়েছে */}
                    <div className="rounded-xl bg-[#0D0F13] border border-white/10 px-3 py-2 flex flex-col justify-between min-w-0">
                      <span
                        className={`font-bangla font-bold leading-none truncate ${
                          isBehindTargetSoFar ? 'text-[#F09595]' : 'text-[#97C459]'
                        }`}
                        style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.55rem)' }}
                      >
                        হয়েছে
                      </span>
                      <span
                        className={`font-sans font-bold tabular-nums leading-none truncate ${
                          isBehindTargetSoFar ? 'text-[#F09595]' : 'text-[#97C459]'
                        }`}
                        style={{
                          fontSize: 'clamp(2rem, 3.6vw, 4.2rem)',
                          textShadow: isBehindTargetSoFar
                            ? '0 0 20px rgba(240, 149, 149, 0.28)'
                            : '0 0 20px rgba(151, 196, 89, 0.28)',
                        }}
                      >
                        {m.done.toLocaleString()}
                      </span>
                    </div>

                    {/* বাকি / লক্ষ্য পূরণ */}
                    <div
                      className={`rounded-xl border px-3 py-2 flex flex-col justify-between min-w-0 ${
                        m.isGoalMet
                          ? 'bg-[#122B09] border-[#27500A]'
                          : 'bg-[#2A0F0F] border-[#791F1F]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`font-bangla font-bold leading-none truncate ${
                            m.isGoalMet ? 'text-[#97C459]' : 'text-[#F7C1C1]'
                          }`}
                          style={{ fontSize: 'clamp(1.125rem, 1.35vw, 1.55rem)' }}
                        >
                          {m.isGoalMet ? 'লক্ষ্য পূরণ' : 'বাকি'}
                        </span>
                        {m.isExceeded ? (
                          <Star className="w-5 h-5 text-[#FAC775] fill-[#FAC775] shrink-0" />
                        ) : m.isGoalMet ? (
                          <CheckCircle2 className="w-5 h-5 text-[#97C459] shrink-0" />
                        ) : null}
                      </div>
                      <span
                        className={`font-sans font-bold tabular-nums leading-none truncate ${
                          m.isGoalMet ? 'text-[#97C459]' : 'text-[#F7C1C1]'
                        }`}
                        style={{
                          fontSize: 'clamp(2rem, 3.6vw, 4.2rem)',
                          textShadow: m.isGoalMet
                            ? '0 0 20px rgba(151, 196, 89, 0.3)'
                            : '0 0 20px rgba(247, 193, 193, 0.25)',
                        }}
                      >
                        {m.isExceeded
                          ? `+${m.exceededBy.toLocaleString()}`
                          : m.remaining !== null
                          ? m.remaining.toLocaleString()
                          : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Thin Progress Bar */}
                  <div className="shrink-0 flex items-center gap-2.5">
                    <div className="flex-1 h-2 rounded-full bg-[#1F232B] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progressFillClass}`}
                        style={{ width: `${progressClamped}%` }}
                      />
                    </div>
                    <span
                      className="font-sans font-bold text-slate-200 tabular-nums leading-none shrink-0"
                      style={{ fontSize: 'clamp(1.125rem, 1.2vw, 1.35rem)' }}
                    >
                      {m.progressPct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Mini Hour Dots + Bottom Status */}
                  <div className="shrink-0 flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      {qcpRow.cells.map((cell) => {
                        const isCurr = cell.value === null && firstUnenteredHour === cell.hourNo;
                        let dotCls = 'bg-slate-600 border-slate-500';
                        if (cell.value !== null && m.hourlyTarget !== null) {
                          dotCls =
                            cell.value >= m.hourlyTarget
                              ? 'bg-[#22C55E] border-[#97C459]'
                              : 'bg-[#EF4444] border-[#F09595]';
                        } else if (isCurr) {
                          dotCls = 'bg-[#FAC775]/25 border-2 border-[#FAC775] animate-pulse';
                        }

                        return (
                          <div
                            key={cell.hourNo}
                            className="flex flex-col items-center shrink-0"
                            title={`H${cell.hourNo}: ${cell.value ?? '-'}`}
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded-full border ${dotCls}`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="hidden xl:inline-flex items-center gap-1 text-slate-300 font-bold tabular-nums"
                        style={{ fontSize: 'clamp(1.125rem, 1.15vw, 1.25rem)' }}
                      >
                        <Users className="w-4 h-4" />
                        {m.manpowerTotal ?? '-'}
                      </span>

                      {totalShort < 0 ? (
                        <span
                          className="inline-flex items-center gap-1 font-bangla font-bold text-[#F09595]"
                          style={{ fontSize: 'clamp(1.125rem, 1.25vw, 1.35rem)' }}
                        >
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>ঘাটতি {totalShort.toLocaleString()}</span>
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 font-bangla font-bold text-[#97C459]"
                          style={{ fontSize: 'clamp(1.125rem, 1.25vw, 1.35rem)' }}
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>সব ঠিক আছে</span>
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
    </div>
  );
};

export default LineAllOptionB;
