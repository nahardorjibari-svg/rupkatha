/**
 * Full-Display Giant Floating Announcement Overlay
 * - Appears over the Line Dashboard TV board whenever the Bangla speaker announcement fires
 * - Oversized high-contrast Bangla text + rotating neon border light so everyone across the factory floor can read it clearly
 * - pointer-events-none + z-[9998] so top-right Sound/Fullscreen controls remain clickable to mute immediately
 */
import React from 'react';
import { AlertTriangle, Volume2 } from 'lucide-react';
import type { ActiveShortageAnnouncement } from '../../hooks/useShortageVoiceAlert';
import { getOptionBLineColor, toBanglaDigits } from '../../hooks/useLineDashStyle';

interface ShortageSpeechOverlayProps {
  announcement: ActiveShortageAnnouncement | null;
}

export const ShortageSpeechOverlay: React.FC<ShortageSpeechOverlayProps> = ({ announcement }) => {
  if (!announcement || announcement.entries.length === 0) return null;

  const isSingleLine = announcement.entries.length === 1;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      role="status"
      aria-live="assertive"
    >
      <div className="relative w-full max-w-[92rem] rounded-[2.25rem] sm:rounded-[3rem] p-[5px] overflow-hidden shadow-[0_0_65px_rgba(239,68,68,0.92),0_0_130px_rgba(220,38,38,0.55)]">
        {/* Rotating 4-side bright border light */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 w-[135%] aspect-square animate-border-light-spin"
          style={{
            background:
              'conic-gradient(from 0deg, #EF4444 0deg, #FFFFFF 38deg, #FCA5A5 76deg, #7F1D1D 140deg, #EF4444 180deg, #FFFFFF 218deg, #FCA5A5 256deg, #7F1D1D 320deg, #EF4444 360deg)',
          }}
        />

        {/* High-luminance inner display panel */}
        <div className="relative z-10 rounded-[calc(2.25rem-5px)] sm:rounded-[calc(3rem-5px)] bg-gradient-to-br from-[#6D1010] via-[#A91818] to-[#6D1010] border border-white/40 px-[clamp(1.5rem,4vw,4rem)] py-[clamp(1.5rem,4.5vh,3.5rem)] flex flex-col items-center text-center gap-[clamp(0.9rem,2.4vh,2rem)] shadow-[inset_0_0_50px_rgba(255,255,255,0.2)]">
          {/* Live Speaking Badge */}
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-black/35 border border-white/40 shadow-[0_0_24px_rgba(255,255,255,0.35)]">
            <Volume2 className="w-[clamp(1.5rem,2.4vw,2.4rem)] h-[clamp(1.5rem,2.4vw,2.4rem)] text-[#FEF08A] animate-pulse shrink-0" />
            <span
              className="font-bangla font-bold text-white tracking-wide leading-none"
              style={{ fontSize: 'clamp(1.25rem, 2.2vw, 2.2rem)' }}
            >
              লাইভ ঘোষণা চলছে · ATTENTION PLEASE
            </span>
          </div>

          {/* Line(s) & Giant Shortage Amount */}
          {isSingleLine ? (
            <div className="flex flex-col items-center gap-[clamp(0.45rem,1.2vh,1rem)]">
              <div className="flex items-center justify-center flex-wrap gap-4">
                <span
                  className="px-6 py-1.5 rounded-2xl font-black text-white tracking-wide shadow-lg border border-white/30"
                  style={{
                    backgroundColor: getOptionBLineColor(announcement.entries[0].lineNo).hex,
                    fontSize: 'clamp(1.85rem, 3.6vw, 3.6rem)',
                  }}
                >
                  লাইন {toBanglaDigits(announcement.entries[0].lineNo)}
                </span>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-[clamp(2.2rem,4vw,4rem)] h-[clamp(2.2rem,4vw,4rem)] text-[#FEF08A] animate-pulse shrink-0" />
                  <span
                    className="font-bangla font-bold text-[#FFE4E6] leading-tight"
                    style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4.6rem)' }}
                  >
                    মোট ঘাটতি
                  </span>
                </div>
              </div>

              <div
                className="font-sans font-black text-white tabular-nums leading-[0.95]"
                style={{
                  fontSize: 'clamp(4rem, 11.5vw, 10.5rem)',
                  textShadow:
                    '0 0 32px rgba(255, 255, 255, 0.95), 0 0 65px rgba(254, 202, 202, 0.85)',
                }}
              >
                {announcement.entries[0].shortQty.toLocaleString()}{' '}
                <span
                  className="font-bangla text-[#FEF08A]"
                  style={{ fontSize: 'clamp(2.4rem, 5.5vw, 5.2rem)' }}
                >
                  পিস
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-[clamp(0.75rem,1.6vw,1.5rem)]">
              {announcement.entries.map((entry) => (
                <div
                  key={entry.lineNo}
                  className="rounded-2xl bg-black/35 border border-white/30 px-6 py-4 flex items-center justify-between gap-4"
                >
                  <span
                    className="px-4 py-1 rounded-xl font-black text-white shrink-0"
                    style={{
                      backgroundColor: getOptionBLineColor(entry.lineNo).hex,
                      fontSize: 'clamp(1.35rem, 2.2vw, 2.2rem)',
                    }}
                  >
                    লাইন {toBanglaDigits(entry.lineNo)}
                  </span>
                  <span
                    className="font-bangla font-bold text-white tabular-nums"
                    style={{
                      fontSize: 'clamp(1.8rem, 3.4vw, 3.4rem)',
                      textShadow: '0 0 20px rgba(255,255,255,0.7)',
                    }}
                  >
                    ঘাটতি {toBanglaDigits(entry.shortQty)} পিস
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Giant Full Action Message for Floor Workers */}
          <div className="w-full rounded-3xl bg-black/35 border border-[#FEF08A]/45 px-[clamp(1rem,3vw,2.75rem)] py-[clamp(0.85rem,2vh,1.75rem)] shadow-inner">
            <p
              className="font-bangla font-bold text-[#FEF08A] leading-snug"
              style={{
                fontSize: 'clamp(1.85rem, 4.1vw, 4rem)',
                textShadow: '0 2px 18px rgba(0, 0, 0, 0.6)',
              }}
            >
              সবাই দ্রুত কাজ করুন এবং প্রোডাকশন ঘাটতি পূরণ করুন!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShortageSpeechOverlay;
