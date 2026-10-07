import { useEffect, type ReactNode } from 'react';
import { bridge, type BannerPayload } from '../game/bridge';
import { audio } from '../game/AudioFx';
import { LEVELS } from '../game/levels';
import type { HudState, InputState, ResultPayload } from '../game/types';
import { cn } from '../utils/cn';
import { Btn, CoinBadge, Keycap } from './common';

export const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-bold border transition-colors',
        ok ? 'bg-lime-400/25 border-lime-300/70 text-lime-200' : 'bg-white/5 border-white/15 text-white/50'
      )}
    >
      <span className={cn('inline-block w-2 h-2 rounded-full', ok ? 'bg-lime-300 shadow-[0_0_8px_#bef264]' : 'bg-white/30')} />
      {label}
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('glass rounded-2xl px-4 py-3', className)}>{children}</div>;
}

interface HudProps {
  hud: HudState;
  coins: number;
  touch: boolean;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
  banner: BannerPayload | null;
}

export function Hud({ hud, coins, touch, muted, onPause, onMute, banner }: HudProps) {
  const level = LEVELS[hud.levelIndex];
  const urgent = hud.phase === 'running' && hud.timeLeft <= 3;
  const pct = Math.max(0, Math.min(1, hud.timeLeft / hud.timeLimit));
  const still = hud.speedKmh < 2.6;
  const ready = hud.phase === 'ready';

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* ---------------- top bar ---------------- */}
      <div className="absolute top-3 left-4 right-4 flex items-start justify-between">
        <Panel className="min-w-[300px] max-w-[360px]">
          <div className="flex items-center gap-3">
            <div className="font-display text-[34px] leading-none text-lime-300 neon-text">
              {String(level.id).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <div className="font-display text-[19px] leading-tight truncate">{level.name}</div>
              <div className="text-[12px] text-white/60 truncate">
                {level.subtitle} · {Math.round(level.slackPx * 4.5)}cm slack
              </div>
            </div>
          </div>
        </Panel>

        <div className="flex flex-col items-center w-[300px]">
          <div
            className={cn(
              'font-display text-[76px] leading-none tabular-nums text-outline transition-colors',
              urgent ? 'text-red-400 animate-blink' : 'text-white'
            )}
            style={{ textShadow: urgent ? '0 0 30px rgba(255,60,60,0.9)' : '0 0 24px rgba(120,220,255,0.55)' }}
          >
            {hud.timeLeft.toFixed(2)}
          </div>
          <div className="w-[260px] h-2.5 rounded-full bg-black/60 border border-white/20 overflow-hidden -mt-1">
            <div
              className={cn('h-full rounded-full', urgent ? 'bg-red-500' : 'bg-gradient-to-r from-cyan-300 to-lime-300')}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <CoinBadge coins={coins} />
          <Btn tone="ghost" size="sm" onClick={onMute} aria-label="Sound">
            {muted ? '🔇' : '🔊'}
          </Btn>
          <Btn tone="ghost" size="sm" onClick={onPause} aria-label="Pause">
            ⏸
          </Btn>
        </div>
      </div>

      {/* ---------------- ready hint ---------------- */}
      {ready && (
        <div className="absolute top-[128px] left-1/2 -translate-x-1/2 text-center animate-slide-up">
          <div className="glass rounded-2xl px-6 py-3 inline-block">
            <div className="font-display text-[26px] text-lime-300 animate-blink">
              {touch ? 'Tap GAS to launch! Timer starts.' : 'Press ↑ / W to launch! Timer starts.'}
            </div>
            <div className="text-[14px] text-white/75 mt-1">{level.hint}</div>
            {/* touch devices don't know the shortcuts → always show them */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-white/70">
              {touch ? (
<>
                    <span>◀ ▶ Steer</span>
                    <span>▲ Gas / ▼ Reverse</span>
                    <span>DRIFT Handbrake drift</span>
                    <span>🚀 Rocket Booster</span>
                    <span>⏸ Pause</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1">
                      <Keycap>↑↓←→</Keycap> Drive
                    </span>
                    <span className="flex items-center gap-1">
                      <Keycap wide>SPACE</Keycap> Drift
                    </span>
                  <span className="flex items-center gap-1">
                    <Keycap>SHIFT</Keycap> Rocket
                  </span>
                  <span className="flex items-center gap-1">
                    <Keycap>R</Keycap> Restart
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- toast ---------------- */}
      {banner && (
        <div key={banner.id} className="absolute top-[150px] left-1/2 -translate-x-1/2 animate-pop">
          <div
            className={cn(
              'font-display text-[26px] px-6 py-2 rounded-full border-2',
              banner.tone === 'good' && 'bg-lime-400/90 text-slate-950 border-lime-200',
              banner.tone === 'bad' && 'bg-red-500/90 text-white border-red-200',
              banner.tone === 'info' && 'bg-cyan-400/90 text-slate-950 border-cyan-100'
            )}
          >
            {banner.text}
          </div>
        </div>
      )}

      {/* ---------------- bottom bar ---------------- */}
      <div
        className={cn(
          'absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3',
          touch && 'left-[290px] right-[290px]'
        )}
      >
        {/* speed + drift */}
        <Panel className="w-[210px]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[44px] leading-none tabular-nums">{Math.round(hud.speedKmh)}</span>
            <span className="text-[13px] text-white/60 font-bold">km/h</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                'text-[12px] font-black tracking-wider',
                hud.drift > 0.3 ? 'text-pink-400 animate-blink' : 'text-white/50'
              )}
            >
              DRIFT
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-black/60 overflow-hidden border border-white/15">
              <div
                className="h-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-pink-500"
                style={{ width: `${Math.min(100, hud.drift * 100)}%` }}
              />
            </div>
          </div>
        </Panel>

        {/* parking sensor */}
        <Panel className="flex-1 max-w-[420px]">
          <div className="flex items-center justify-between">
            <div className="font-display text-[17px] text-emerald-300">🅿 PARKING SENSOR</div>
            <div className="text-[12px] text-white/70 tabular-nums">
              {hud.inZone ? 'IN ZONE' : `ERR ${hud.overflowCm.toFixed(0)}cm`} · ANGLE {hud.angleErrDeg.toFixed(1)}°
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Chip ok={hud.inZone} label="Position" />
            <Chip ok={hud.aligned} label={`Angle ±${level.angleTolDeg}°`} />
            <Chip ok={still} label="Stopped" />
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-black/60 overflow-hidden border border-white/15">
            <div
              className="h-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-[width] duration-75"
              style={{ width: `${hud.parkProgress * 100}%` }}
            />
          </div>
        </Panel>

        {/* rocket + bumper */}
        <Panel className="w-[230px]">
          {hud.hasRocket ? (
            <div>
              <div className="flex items-center justify-between text-[12px] font-black">
                <span className="text-orange-300">🚀 ROCKET</span>
                <Keycap>SHIFT</Keycap>
              </div>
              <div className="mt-1.5 h-3 rounded-full bg-black/60 overflow-hidden border border-white/15">
                <div
                  className={cn(
                    'h-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300',
                    hud.fuel < hud.fuelMax * 0.15 && 'animate-blink'
                  )}
                  style={{ width: `${(hud.fuel / Math.max(1, hud.fuelMax)) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[12px] text-white/45 font-bold">🔒 Rocket Booster · Garage</div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[12px] font-black">
            {hud.bumperMax > 0 ? (
              <>
                <span className="text-cyan-300">Spring Bumper</span>
                {Array.from({ length: hud.bumperMax }).map((_, i) => (
                  <span key={i} className={cn('text-[18px]', i < hud.bumperCharges ? '' : 'opacity-20 grayscale')}>
                    🌀
                  </span>
                ))}
              </>
            ) : (
              <span className="text-white/45">🔒 Spring Bumper · Garage</span>
            )}
          </div>
        </Panel>
      </div>

      {!touch && ready && (
        <div className="absolute bottom-[132px] left-1/2 -translate-x-1/2 flex items-center gap-3 text-[13px] text-white/80 glass rounded-full px-5 py-2">
          <Keycap>↑↓←→</Keycap> Drive <Keycap wide>SPACE</Keycap> Drift <Keycap>SHIFT</Keycap> Rocket <Keycap>R</Keycap> Restart <Keycap>ESC</Keycap> Pause
        </div>
      )}

      {touch && <TouchControls />}
    </div>
  );
}

// ------------------------------------------------------------------------------------
function HoldBtn({ k, className, children }: { k: keyof InputState; className?: string; children: ReactNode }) {
  const set = (v: boolean) => {
    bridge.touch[k] = v;
  };
  return (
    <button
      tabIndex={-1}
      type="button"
      className={cn(
        'pointer-events-auto touch-none select-none grid place-items-center rounded-2xl border-2 border-white/30 bg-white/15 backdrop-blur-sm text-white font-display active:bg-white/40 active:scale-95 transition-transform',
        className
      )}
      onPointerDown={(e) => {
        e.preventDefault();
        audio.unlock();
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function TouchControls() {
  useEffect(
    () => () => {
      Object.keys(bridge.touch).forEach((k) => {
        bridge.touch[k as keyof InputState] = false;
      });
    },
    []
  );
  return (
    <>
      <div className="absolute bottom-4 left-4 flex gap-3">
        <HoldBtn k="left" className="w-[120px] h-[120px] text-[46px]">◀</HoldBtn>
        <HoldBtn k="right" className="w-[120px] h-[120px] text-[46px]">▶</HoldBtn>
      </div>
      <div className="absolute bottom-4 right-4 grid grid-cols-2 gap-3">
        <HoldBtn k="handbrake" className="w-[120px] h-[88px] text-[20px] bg-pink-500/40">DRIFT</HoldBtn>
        <HoldBtn k="up" className="w-[120px] h-[88px] text-[30px] bg-lime-400/40">▲</HoldBtn>
        <HoldBtn k="boost" className="w-[120px] h-[88px] text-[20px] bg-orange-500/40">🚀</HoldBtn>
        <HoldBtn k="down" className="w-[120px] h-[88px] text-[30px]">▼</HoldBtn>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------
export function FailBanner({ result }: { result: ResultPayload }) {
  const crash = result.kind === 'fail-crash';
  return (
    <div className="absolute inset-0 pointer-events-none">
      {crash && <div className="absolute inset-0 animate-siren" />}
      <div className={cn('absolute top-[210px] left-1/2 -translate-x-1/2 text-center w-[900px]', crash && 'animate-shake')}>
        <div
          className="font-display text-[68px] leading-none text-outline text-red-400"
          style={{ textShadow: '0 0 30px rgba(255,40,40,0.9)' }}
        >
          {crash ? '🚨 ALARM BLASTED!' : '⏰ TIME UP!'}
        </div>
        <div className="mt-3 inline-block rounded-2xl bg-black/75 border border-red-400/60 px-6 py-3">
          <div className="font-display text-[26px] text-white">{result.message}</div>
          {result.bill && <div className="mt-1 font-display text-[22px] text-amber-300">🧾 {result.bill}</div>}
        </div>
        <div className="mt-3 text-[14px] text-white/80 animate-blink">
          Auto-restarting shortly · press <b>SPACE</b> or <b>R</b> to restart now
        </div>
      </div>
    </div>
  );
}

export function PauseOverlay({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-3xl p-10 text-center animate-pop">
        <div className="font-display text-[52px] text-white mb-6">PAUSED</div>
        <div className="flex flex-col gap-4 w-[300px]">
          <Btn size="lg" onClick={onResume}>▶ Resume</Btn>
          <Btn tone="cyan" onClick={onRestart}>↺ Restart</Btn>
          <Btn tone="ghost" onClick={onMenu}>Main Menu</Btn>
        </div>
      </div>
    </div>
  );
}
