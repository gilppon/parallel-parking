import type { HudState } from '../game/types';
import { cn } from '../utils/cn';
import { Keycap } from './common';

export interface CoachStep {
  title: string;
  body: string;
}

/**
 * Stateless step derivation: the overlay follows live game state, so restarts
 * (R key) and pauses can never desync it. Returns null when no step applies.
 */
export function coachStepFor(hud: HudState | null): number | null {
  if (!hud) return null;
  if (hud.phase === 'ready') return 0;
  if (hud.phase !== 'running') return null;
  if (!hud.inZone) return 1;
  return 2;
}

export interface CoachVisibility {
  playing: boolean;
  tutorialDone: boolean;
  /** 0-based level index from hud; null when no hud yet */
  levelIndex: number | null;
  hasResult: boolean;
  paused: boolean;
  hasAd: boolean;
  phase: HudState['phase'] | null;
}

/** First-run coach shows on level 1 only, during ready/running, never twice. */
export function shouldShowCoach(v: CoachVisibility): boolean {
  return (
    v.playing &&
    !v.tutorialDone &&
    v.levelIndex === 0 &&
    !v.hasResult &&
    !v.paused &&
    !v.hasAd &&
    (v.phase === 'ready' || v.phase === 'running')
  );
}

function StepBody({ step, touch }: { step: number; touch: boolean }) {
  if (step === 0) {
    return touch ? (
      <span>
        Hold <b className="text-lime-300">GAS ▲</b> to roll out — the timer starts when you move.
      </span>
    ) : (
      <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
        Hold <Keycap>↑</Keycap> to roll out — the timer starts when you move.
      </span>
    );
  }
  if (step === 1) {
    return touch ? (
      <span>
        Steer with <b className="text-lime-300">◀ ▶</b> toward the glowing green zone.
      </span>
    ) : (
      <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
        <Keycap>←</Keycap>
        <Keycap>→</Keycap> to steer toward the glowing green zone.
      </span>
    );
  }
  return touch ? (
    <span>
      Ease off, tap <b className="text-lime-300">▼</b> to settle — hold still until the sensor fills.
    </span>
  ) : (
    <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
      Ease off the gas, tap <Keycap>↓</Keycap> to settle — hold still until the sensor fills.
    </span>
  );
}

const TITLES = ['1 · Launch', '2 · Steer into the zone', '3 · Stop inside'];

/**
 * First-run driving coach. Bottom sheet like the genre standard: it never
 * covers the top timer/sensor HUD, stays clear of the corner touch pads, and
 * advances itself from live game state (no buttons to hunt mid-drive).
 */
export function CoachOverlay({
  step,
  touch,
  onSkip,
}: {
  step: number;
  touch: boolean;
  onSkip: () => void;
}) {
  const s = Math.max(0, Math.min(2, step));
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-lg glass rounded-2xl px-5 py-3.5 animate-slide-up">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-center flex-1">
            <div className="text-[11px] tracking-[0.25em] font-black text-lime-300">
              FIRST PARK {s + 1}/3
            </div>
            <div className="font-display text-[22px] text-white leading-tight">{TITLES[s]}</div>
            <div className="text-[14px] text-white/80 leading-snug mt-1">
              <StepBody step={s} touch={touch} />
            </div>
          </div>
          <button
            onClick={onSkip}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20',
              'font-display text-[13px] text-white/80 cursor-pointer'
            )}
          >
            Skip
          </button>
        </div>
        <div className="mt-2.5 flex gap-1.5 justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-10 rounded-full',
                i <= s ? 'bg-lime-300 shadow-[0_0_8px_#bef264]' : 'bg-white/20'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
