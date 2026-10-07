import { useEffect, useState } from 'react';
import { audio } from '../game/AudioFx';
import { bridge, type AdRequest } from '../game/bridge';
import { LEVELS, SUPERCARS, carStarReq } from '../game/levels';
import { poki } from '../game/PokiService';
import { createParkingShareUrl } from '../game/share';
import {
  BUMPER_COSTS,
  BUMPER_LEVELS,
  ROCKET_COSTS,
  ROCKET_LEVELS,
  dailyStatus,
  nextMilestone,
  store,
  totalStars,
  upcomingMilestone,
} from '../game/save';
import { NEON_COLORS, PAINTS, type ResultPayload } from '../game/types';
import { cn } from '../utils/cn';
import { Btn, CoinBadge, Keycap, Stars, useSave } from './common';

function msProgress(d: ReturnType<typeof store.get>, at: number): number {
  const best = Math.max(totalStars(d), d.fails, d.perfects);
  return Math.min(at, best);
}

// ====================================================================================
export function MenuScreen({
  onPlay,
  onLevels,
  onGarage,
  muted,
  onMute,
}: {
  onPlay: (i: number) => void;
  onLevels: () => void;
  onGarage: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  const save = useSave();
  const [confirmReset, setConfirmReset] = useState(false);
  const totalStars_ = totalStars(save);
  const next = Math.min(save.unlocked, LEVELS.length - 1);
  const daily = dailyStatus(save);
  const ms = nextMilestone(save);
  const nextMs = upcomingMilestone(save);

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#05060a] via-[#05060a]/85 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060a]/70 via-transparent to-[#05060a]/40" />

      <div className="absolute right-3 top-3 flex max-w-[calc(100vw-1.5rem)] flex-wrap justify-end gap-2 sm:right-5 sm:top-5">
        <button
          onClick={() => {
            const got = store.claimDaily();
            if (got > 0) audio.buy();
          }}
          disabled={!daily.available}
          title="Daily check-in reward"
          className={cn(
            'rounded-full border px-3 py-1.5 text-[13px] font-black transition',
            daily.available
              ? 'border-lime-300/70 bg-lime-400/20 text-lime-200 animate-pulse cursor-pointer'
              : 'border-white/15 bg-black/40 text-white/40 cursor-default'
          )}
        >
          {daily.available ? `📅 +${daily.coins} (Day ${daily.day})` : `📅 Day ${daily.day} claimed`}
        </button>
        {ms ? (
          <button
            onClick={() => {
              const got = store.claimMilestone(ms.at);
              if (got > 0) audio.buy();
            }}
            title={ms.label}
            className="rounded-full border border-amber-300/70 bg-amber-400/20 px-3 py-1.5 text-[13px] font-black text-amber-200 animate-pulse"
          >
            {ms.icon} +{ms.coins}
          </button>
        ) : nextMs ? (
          <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[12px] text-white/50">
            {nextMs.icon} {Math.min(msProgress(save, nextMs.at), nextMs.at)}/{nextMs.at}
          </span>
        ) : null}
        <CoinBadge coins={save.coins} />
        <Btn tone="ghost" size="sm" onClick={onMute}>{muted ? '🔇' : '🔊'}</Btn>
      </div>

      <div
        className="absolute left-4 right-4 z-20 animate-slide-up sm:left-14 sm:right-auto sm:w-[min(640px,calc(100vw-7rem))]"
        style={{ top: "clamp(3.5rem, 12dvh, 4.375rem)" }}
      >
        <div className="font-display text-xs tracking-[0.32em] text-cyan-300 neon-text sm:text-[19px]">
          EXTREME PARALLEL PARKING PHYSICS
        </div>
        <h1 className="mt-2 font-display leading-[0.98] text-white text-outline" style={{ fontSize: "clamp(30px, 9dvh, 100px)" }}>
          Alley <span className="text-lime-300 neon-text">Nightmare</span>
          <br />
          Parallel
          <br />
          Parking <span className="text-pink-400 neon-text">Master</span>
        </h1>
        <p className="mt-2 text-xs text-white/80 leading-relaxed sm:mt-4 sm:text-[19px]">
          Not even <b className="text-amber-300">1cm</b> of clearance between supercars is tolerated.
          <br />
          Rocket Booster and handbrake drift. Park in <b className="text-lime-300">under 10 seconds</b>.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-7 sm:gap-4">
          <Btn size="lg" onClick={() => onPlay(next)} className="px-4 sm:px-10">
            ▶ {save.unlocked > 0 ? `Continue · STAGE ${next + 1}` : 'Start Game'}
          </Btn>
          <Btn tone="cyan" size="md" onClick={onLevels}>Stage Select</Btn>
          <Btn tone="pink" size="md" onClick={onGarage}>🔧 Garage</Btn>
        </div>

        <div className="mt-4 glass rounded-2xl p-3 inline-flex flex-wrap gap-x-4 gap-y-2 items-center text-xs text-white/85 sm:mt-7 sm:p-4 sm:text-[14px] sm:max-w-[600px]">
          <span className="flex items-center gap-2"><Keycap>↑</Keycap><Keycap>↓</Keycap> Gas · Brake / Reverse</span>
          <span className="flex items-center gap-2"><Keycap>←</Keycap><Keycap>→</Keycap> Steer</span>
          <span className="flex items-center gap-2"><Keycap wide>SPACE</Keycap> Drift</span>
          <span className="flex items-center gap-2"><Keycap wide>SHIFT</Keycap> Rocket Booster</span>
          <span className="flex items-center gap-2"><Keycap>R</Keycap> Restart <Keycap>ESC</Keycap> Pause</span>
        </div>
      </div>

      <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60 sm:bottom-6 sm:left-14 sm:right-auto sm:gap-6 sm:text-[14px]">
        <span>★ {totalStars_} / {LEVELS.length * 3}</span>
        <span>💥 {save.fails} lifetime crashes</span>
        <button
          tabIndex={-1}
          className="underline underline-offset-2 hover:text-white cursor-pointer"
          onClick={() => setConfirmReset(true)}
        >
          Reset Progress
        </button>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="mt-2 font-display text-2xl text-white">Reset Progress</div>
            <p className="mt-1 text-[14px] text-white/70">
              All saved progress (coins, upgrades, records) will be wiped.
            </p>
            <div className="mt-5 flex gap-3">
              <Btn size="md" onClick={() => setConfirmReset(false)} className="flex-1">
                Cancel
              </Btn>
              <Btn
                size="md"
                tone="pink"
                className="flex-1"
                onClick={() => {
                  setConfirmReset(false);
                  store.reset();
                  bridge.emit('cmd:loadout');
                }}
              >
                Reset
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================================
export function LevelSelect({ onPlay, onBack }: { onPlay: (i: number) => void; onBack: () => void }) {
  const save = useSave();
  return (
    <div className="absolute inset-0 bg-[#05060a]/80 backdrop-blur-[2px]">
      <div className="absolute top-5 left-6 flex items-center gap-4">
        <Btn tone="ghost" size="sm" onClick={onBack}>← Back</Btn>
        <h2 className="font-display text-[42px] text-white">Stage Select</h2>
      </div>
      <div className="absolute top-5 right-6"><CoinBadge coins={save.coins} /></div>

      <div className="absolute left-10 right-10 top-[100px] grid grid-cols-5 gap-5">
        {LEVELS.map((lv, i) => {
          const locked = i > save.unlocked;
          return (
            <button
              key={lv.id}
              tabIndex={-1}
              disabled={locked}
              onMouseEnter={() => !locked && bridge.emit('cmd:preview', i)}
              onClick={() => {
                audio.unlock();
                audio.click();
                onPlay(i);
              }}
              className={cn(
                'glass rounded-2xl p-4 text-left h-[228px] flex flex-col transition-all cursor-pointer',
                locked ? 'opacity-45 cursor-not-allowed' : 'hover:-translate-y-1 hover:border-lime-300/70 hover:shadow-[0_0_30px_rgba(163,230,53,0.25)]'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="font-display text-[48px] leading-none text-lime-300 neon-text">
                  {String(lv.id).padStart(2, '0')}
                </div>
                {locked ? <span className="text-[28px]">🔒</span> : <Stars n={save.stars[i]} size={20} />}
              </div>
              <div className="font-display text-[20px] mt-2 leading-tight">{lv.name}</div>
              <div className="text-[12px] text-white/60 mt-1 leading-snug flex-1">{lv.subtitle}</div>
              <div className="flex items-center justify-between text-[12px] mt-2 text-white/75">
                <span className="rounded-md bg-white/10 px-2 py-0.5">
                  {lv.zone.angle !== 0 ? '90°' : 'Parallel'} · {Math.round(lv.slackPx * 4.5)}cm
                </span>
                <span>{save.best[i] != null ? `⏱ ${save.best[i]!.toFixed(1)}s` : lv.theme === 'garage' ? 'Underground' : 'Alley'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ====================================================================================
function neonDot(id: string) {
  const n = NEON_COLORS[id];
  if (n.color === null) return 'transparent';
  if (n.color === 'rainbow') return 'conic-gradient(#f0f,#0ff,#0f0,#ff0,#f0f)';
  return `#${n.color.toString(16).padStart(6, '0')}`;
}

export function Garage({ onBack }: { onBack: () => void }) {
  const save = useSave();
  const [adBusy, setAdBusy] = useState(false);

  const changed = () => bridge.emit('cmd:loadout');

  const rocketNext = save.rocket < 3 ? ROCKET_LEVELS[save.rocket + 1]! : null;
  const bumperNext = save.bumper < 2 ? BUMPER_LEVELS[save.bumper + 1]! : null;

  const buy = (ok: boolean) => {
    if (ok) {
      audio.coin();
      changed();
    } else audio.deny();
  };

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-l from-[#05060a]/95 via-[#05060a]/60 to-transparent" />
      <div className="absolute top-5 left-6 flex items-center gap-4">
        <Btn tone="ghost" size="sm" onClick={onBack}>← Back</Btn>
        <h2 className="font-display text-[42px] text-white">🔧 Garage</h2>
      </div>
      <div className="absolute left-10 top-[130px] glass rounded-2xl px-5 py-3 text-[14px] text-white/80 max-w-[420px]">
        Check the car preview on the road to the left. Neon and paint apply instantly.
      </div>

      <div className="absolute right-6 top-5 bottom-5 w-[700px] glass rounded-3xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-[26px] text-white">Upgrade Shop</div>
          <CoinBadge coins={save.coins} />
        </div>

        {/* Rocket */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[22px] text-orange-300">🚀 Rocket Booster <span className="text-white/60 text-[15px]">Lv {save.rocket}/3</span></div>
              <div className="text-[13px] text-white/65 mt-1">
                Ignite with SHIFT! Explosive thrust until the tank runs dry. Release it and the fuel slowly refills.
              </div>
              {rocketNext && (
                <div className="text-[12px] text-orange-200/90 mt-1">
                  Next up: stronger, longer burn · top speed {Math.round(rocketNext.maxSpeed * 0.162)}km/h
                </div>
              )}
            </div>
            <Btn
              tone="amber"
              size="sm"
              disabled={save.rocket >= 3 || save.coins < (ROCKET_COSTS[save.rocket] ?? 0)}
              onClick={() => buy(store.buyRocket())}
            >
              {save.rocket >= 3 ? 'MAX' : `${save.rocket === 0 ? 'Unlock' : 'Upgrade'} ${ROCKET_COSTS[save.rocket]}`}
            </Btn>
          </div>
          <div className="flex gap-1.5 mt-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className={cn('h-2 flex-1 rounded-full', save.rocket >= n ? 'bg-orange-400 shadow-[0_0_10px_#fb923c]' : 'bg-white/10')} />
            ))}
          </div>
        </section>

        {/* Bumper */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[22px] text-cyan-300">🌀 Spring Bumper <span className="text-white/60 text-[15px]">Lv {save.bumper}/2</span></div>
              <div className="text-[13px] text-white/65 mt-1">
                Slow hits bounce off with a silent <b>BOING!</b> — no alarm, no bill. Charges refill every attempt.
              </div>
              {bumperNext && (
                <div className="text-[12px] text-cyan-200/90 mt-1">
                  Next up: forgives hits under {Math.round(bumperNext.threshold * 0.162)}km/h · {bumperNext.charges}{' '}
                  {bumperNext.charges === 1 ? 'charge' : 'charges'}
                </div>
              )}
            </div>
            <Btn
              tone="cyan"
              size="sm"
              disabled={save.bumper >= 2 || save.coins < (BUMPER_COSTS[save.bumper] ?? 0)}
              onClick={() => buy(store.buyBumper())}
            >
              {save.bumper >= 2 ? 'MAX' : `${save.bumper === 0 ? 'Unlock' : 'Upgrade'} ${BUMPER_COSTS[save.bumper]}`}
            </Btn>
          </div>
          <div className="flex gap-1.5 mt-3">
            {[1, 2].map((n) => (
              <div key={n} className={cn('h-2 flex-1 rounded-full', save.bumper >= n ? 'bg-cyan-300 shadow-[0_0_10px_#67e8f9]' : 'bg-white/10')} />
            ))}
          </div>
        </section>

        {/* Neon */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="font-display text-[22px] text-pink-300 mb-2">💡 Neon Underglow</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(NEON_COLORS).map(([id, n]) => {
              const owned = save.neonOwned.includes(id);
              const active = save.neon === id;
              return (
                <button
                  key={id}
                  tabIndex={-1}
                  onClick={() => {
                    audio.unlock();
                    if (owned) {
                      audio.click();
                      store.update({ neon: id });
                      changed();
                    } else buy(store.buyNeon(id, n.cost));
                  }}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-left flex items-center gap-2.5 transition-all cursor-pointer',
                    active ? 'border-lime-300 bg-lime-300/15' : 'border-white/15 bg-white/5 hover:bg-white/10',
                    !owned && save.coins < n.cost && 'opacity-50'
                  )}
                >
                  <span
                    className="w-6 h-6 rounded-full border border-white/40 shrink-0"
                    style={{ background: neonDot(id), boxShadow: n.color !== null ? `0 0 12px ${neonDot(id)}` : undefined }}
                  />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold truncate">{n.label}</span>
                    <span className="block text-[11px] text-white/60">{owned ? (active ? 'Equipped' : 'Owned') : `${n.cost}`}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paint */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="font-display text-[22px] text-white mb-2">🎨 Car Color <span className="text-white/50 text-[13px]">Free</span></div>
          <div className="flex gap-3 flex-wrap">
            {PAINTS.map((p) => (
              <button
                key={p.id}
                tabIndex={-1}
                title={p.label}
                onClick={() => {
                  audio.unlock();
                  audio.click();
                  store.update({ paint: p.id });
                  changed();
                }}
                className={cn(
                  'w-11 h-11 rounded-full border-4 transition-transform cursor-pointer hover:scale-110',
                  save.paint === p.id ? 'border-lime-300 scale-110' : 'border-white/30'
                )}
                style={{ background: p.color }}
              />
            ))}
          </div>
        </section>

        {/* Car collection */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="font-display text-[22px] text-lime-300 mb-1">
            🏎️ Supercar Collection <span className="text-white/60 text-[15px]">{save.carsOwned.length}/{SUPERCARS.length}</span>
          </div>
          <div className="text-[13px] text-white/65 mb-3">
            Bank stars to unlock supercars. Tier 1 is free from the start, Tier 2 at 6 stars, Tier 3 at 18 stars.
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SUPERCARS.map((c, i) => {
              const owned = save.carsOwned.includes(i);
              const active = save.carEquipped === i;
              const req = carStarReq(c.tier);
              const stars = totalStars(save);
              const can = !owned && stars >= req;
              return (
                <button
                  key={c.name}
                  tabIndex={-1}
                  title={c.name}
                  onClick={() => {
                    audio.unlock();
                    if (owned) {
                      audio.click();
                      store.equipCar(i);
                    } else if (can) {
                      audio.buy();
                      store.claimCar(i);
                    }
                    changed();
                  }}
                  className={cn(
                    'relative rounded-xl border-2 px-2 py-2 text-center transition-all cursor-pointer',
                    active ? 'border-lime-300 bg-lime-300/15' : 'border-white/15 bg-white/5 hover:bg-white/10',
                    !owned && 'opacity-60'
                  )}
                >
                  <span
                    className="mx-auto block h-7 w-12 rounded-md border border-white/40"
                    style={{ background: owned ? c.color : '#3a3f4a' }}
                  />
                  <span className="mt-1 block text-[10px] leading-tight text-white/80 truncate">
                    {owned ? c.name.split(' ')[0] : '???'}
                  </span>
                  <span className="block text-[9px] text-white/50">
                    {owned ? (active ? 'Equipped' : 'Owned') : `★${req}`}
                  </span>
                  {can && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-lime-400 px-1.5 py-px text-[9px] font-black text-black">
                      UNLOCK!
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Rewarded ad */}
        <section className="rounded-2xl bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-300/30 p-4 flex items-center justify-between">
          <div>
            <div className="font-display text-[20px] text-amber-200">🎬 Ad Reward · Free Coins</div>
            <div className="text-[13px] text-white/70">Watch a short ad for 200 coins.</div>
          </div>
          <Btn
            tone="amber"
            size="sm"
            disabled={adBusy}
            onClick={async () => {
              setAdBusy(true);
              const ok = await poki.rewardedBreak();
              setAdBusy(false);
              if (ok) {
                store.update((d) => ({ coins: d.coins + 200 }));
                audio.coin();
              }
            }}
          >
            🎬 Get +200
          </Btn>
        </section>
      </div>
    </div>
  );
}

// ====================================================================================
export function ResultOverlay({
  result,
  isLast,
  onNext,
  onRetry,
  onMenu,
}: {
  result: ResultPayload;
  isLast: boolean;
  onNext: () => void;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const [doubled, setDoubled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const lv = LEVELS[result.levelIndex];

  useEffect(() => {
    let active = true;
    void createParkingShareUrl(result).then((url) => {
      if (active) setShareUrl(url);
    });
    return () => {
      active = false;
    };
  }, [result]);

  return (
    <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[3px]">
      <div className="glass rounded-3xl px-12 py-8 text-center w-[640px] animate-pop">
        <div className="font-display text-[64px] leading-none text-lime-300 neon-text">
          {result.perfect ? 'PERFECT PARK!' : 'PARKED!'}
        </div>
        <div className="text-[15px] text-white/60 mt-1">STAGE {lv.id} · {lv.name}</div>
        <Stars n={result.stars} size={64} className="mt-2" />
        <div className="text-[16px] text-white/85 mt-2">{result.message}</div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-white/5 border border-white/10 py-3">
            <div className="text-[12px] text-white/55">Time Left</div>
            <div className="font-display text-[28px] tabular-nums">{result.timeLeft.toFixed(2)}s</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 py-3">
            <div className="text-[12px] text-white/55">Angle Error</div>
            <div className="font-display text-[28px] tabular-nums">{Math.abs(result.angleErrDeg).toFixed(1)}°</div>
          </div>
          <div className="rounded-xl bg-amber-400/15 border border-amber-300/40 py-3">
            <div className="text-[12px] text-amber-200/80">Coins Earned</div>
            <div className="font-display text-[28px] text-amber-300 tabular-nums">
              +{result.coins}
              {doubled && <span className="text-[16px] text-lime-300"> ×2</span>}
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            const text = `Can you park better? I earned ${result.stars} stars with ${Math.abs(result.angleErrDeg).toFixed(1)}° angle error at Level ${result.levelIndex + 1}.`;
            const url = shareUrl || window.location.href;
            try {
              if (navigator.share) {
                await navigator.share({ title: 'Perfect Park challenge', text, url });
                setShareMessage('Challenge shared! 🚗');
                return;
              }
              await navigator.clipboard.writeText(`${text} ${url}`);
              setShareMessage('Challenge link copied! Send it to a friend 🚗');
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') return;
              try {
                await navigator.clipboard.writeText(`${text} ${url}`);
                setShareMessage('Challenge link copied! Send it to a friend 🚗');
              } catch {
                setShareMessage('Copy the game link from your browser to challenge a friend.');
              }
            }
          }}
          className="mt-4 w-full rounded-xl border border-cyan-200/30 bg-cyan-300/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20"
        >
          🚗 Challenge a friend on this parking bay
        </button>
        {shareMessage && <div aria-live="polite" className="mt-2 text-xs text-lime-200">{shareMessage}</div>}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!isLast ? (
            <Btn size="md" onClick={onNext}>Next Stage ▶</Btn>
          ) : (
            <div className="font-display text-[22px] text-amber-300 w-full">🏆 All stages cleared! You&rsquo;re a legendary valet!</div>
          )}
          <Btn tone="cyan" size="md" onClick={onRetry}>↺ Retry</Btn>
          <Btn
            tone="amber"
            size="md"
            disabled={doubled || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await poki.rewardedBreak();
              setBusy(false);
              if (ok) {
                store.update((d) => ({ coins: d.coins + result.coins }));
                audio.coin();
                setDoubled(true);
              }
            }}
          >
            🎬 Watch Ad · 2× Coins
          </Btn>
          <Btn tone="ghost" size="md" onClick={onMenu}>Main Menu</Btn>
        </div>
      </div>
    </div>
  );
}

// ====================================================================================
export function AdOverlay({ req, onClose }: { req: AdRequest; onClose: () => void }) {
  const total = req.kind === 'rewarded' ? 5 : 3;
  const [left, setLeft] = useState(total);

  useEffect(() => {
    const id = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-[#0a0a12]">
      <div className="text-center">
        <div className="text-[13px] tracking-[0.3em] text-white/40 mb-3">ADVERTISEMENT</div>
        <div className="w-[560px] h-[315px] rounded-2xl border border-white/15 bg-gradient-to-br from-indigo-700 via-fuchsia-600 to-orange-500 grid place-items-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(45deg,transparent_0_18px,rgba(255,255,255,.25)_18px_36px)]" />
          <div className="relative">
            <div className="font-display text-[46px] text-white text-outline animate-floaty">🏎️ SUPER PARK™</div>
            <div className="text-white/90 text-[16px] mt-2">Download now and park 100 supercars!</div>
          </div>
        </div>
        <div className="mt-5 h-2 w-[560px] mx-auto rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-lime-300 transition-[width] duration-1000 ease-linear" style={{ width: `${((total - left) / total) * 100}%` }} />
        </div>
        <div className="mt-5">
          {left > 0 ? (
            <div className="font-display text-[22px] text-white/70">
              {req.kind === 'rewarded' ? `Reward in ${left}s` : `Ad ends in ${left}s`}
            </div>
          ) : (
            <Btn
              onClick={() => {
                req.done(req.kind === 'rewarded');
                onClose();
              }}
            >
              {req.kind === 'rewarded' ? '🎁 Collect Reward' : 'Close Ad ▶'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
