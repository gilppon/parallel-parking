import { useEffect, useState } from 'react';
import { audio } from '../game/AudioFx';
import { bridge, type AdRequest } from '../game/bridge';
import { LEVELS, SUPERCARS, carStarReq } from '../game/levels';
import { poki } from '../game/PokiService';
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
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#05060a] via-[#05060a]/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05060a]/70 via-transparent to-[#05060a]/40" />

      <div className="absolute top-5 right-5 flex items-center gap-2">
        <button
          onClick={() => {
            const got = store.claimDaily();
            if (got > 0) audio.buy();
          }}
          disabled={!daily.available}
          title="매일 출석 보상"
          className={cn(
            'rounded-full border px-3 py-1.5 text-[13px] font-black transition',
            daily.available
              ? 'border-lime-300/70 bg-lime-400/20 text-lime-200 animate-pulse cursor-pointer'
              : 'border-white/15 bg-black/40 text-white/40 cursor-default'
          )}
        >
          {daily.available ? `📅 +₩${daily.coins} (${daily.day}일)` : `📅 ${daily.day}일 출석`}
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
            {ms.icon} +₩{ms.coins}
          </button>
        ) : nextMs ? (
          <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[12px] text-white/50">
            {nextMs.icon} {Math.min(msProgress(save, nextMs.at), nextMs.at)}/{nextMs.at}
          </span>
        ) : null}
        <CoinBadge coins={save.coins} />
        <Btn tone="ghost" size="sm" onClick={onMute}>{muted ? '🔇' : '🔊'}</Btn>
      </div>

      <div className="absolute left-14 top-[70px] w-[640px] animate-slide-up">
        <div className="font-display text-[19px] tracking-[0.32em] text-cyan-300 neon-text">
          EXTREME PARALLEL PARKING PHYSICS
        </div>
        <h1 className="font-display text-[100px] leading-[0.98] mt-2 text-white text-outline">
          골목길 <span className="text-lime-300 neon-text">극악</span>
          <br />
          평행주차 <span className="text-pink-400 neon-text">마스터</span>
        </h1>
        <p className="mt-4 text-[19px] text-white/80 leading-relaxed">
          슈퍼카 사이의 <b className="text-amber-300">단 1cm</b> 오차도 허용되지 않는다.
          <br />
          로켓 부스터와 핸드브레이크 드리프트로 <b className="text-lime-300">10초 안에</b> 밀어 넣어라.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <Btn size="lg" onClick={() => onPlay(next)} className="px-10">
            ▶ {save.unlocked > 0 ? `이어하기 · STAGE ${next + 1}` : '게임 시작'}
          </Btn>
          <Btn tone="cyan" size="md" onClick={onLevels}>스테이지 선택</Btn>
          <Btn tone="pink" size="md" onClick={onGarage}>🔧 차고</Btn>
        </div>

        <div className="mt-7 glass rounded-2xl p-4 inline-flex flex-wrap gap-x-5 gap-y-2 items-center text-[14px] text-white/85 max-w-[600px]">
          <span className="flex items-center gap-2"><Keycap>↑</Keycap><Keycap>↓</Keycap> 가속 / 브레이크·후진</span>
          <span className="flex items-center gap-2"><Keycap>←</Keycap><Keycap>→</Keycap> 조향</span>
          <span className="flex items-center gap-2"><Keycap wide>SPACE</Keycap> 핸드브레이크 드리프트</span>
          <span className="flex items-center gap-2"><Keycap wide>SHIFT</Keycap> 로켓 부스터</span>
          <span className="flex items-center gap-2"><Keycap>R</Keycap> 재시작 <Keycap>ESC</Keycap> 일시정지</span>
        </div>
      </div>

      <div className="absolute left-14 bottom-6 flex items-center gap-6 text-[14px] text-white/60">
        <span>⭐ {totalStars_} / {LEVELS.length * 3}</span>
        <span>💥 누적 사고 {save.fails}회</span>
        <button
          tabIndex={-1}
          className="underline underline-offset-2 hover:text-white cursor-pointer"
          onClick={() => setConfirmReset(true)}
        >
          진행 초기화
        </button>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
            <div className="text-4xl">⚠️</div>
            <div className="mt-2 font-display text-2xl text-white">진행 초기화</div>
            <p className="mt-1 text-[14px] text-white/70">
              저장된 진행 상황(코인·업그레이드·기록)이 모두 사라집니다.
            </p>
            <div className="mt-5 flex gap-3">
              <Btn size="md" onClick={() => setConfirmReset(false)} className="flex-1">
                취소
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
                초기화
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
        <Btn tone="ghost" size="sm" onClick={onBack}>← 뒤로</Btn>
        <h2 className="font-display text-[42px] text-white">스테이지 선택</h2>
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
                  {lv.zone.angle !== 0 ? '직각' : '평행'} · 여유 {Math.round(lv.slackPx * 4.5)}cm
                </span>
                <span>{save.best[i] != null ? `⏱ ${save.best[i]!.toFixed(1)}s` : lv.theme === 'garage' ? '지하' : '골목'}</span>
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
        <Btn tone="ghost" size="sm" onClick={onBack}>← 뒤로</Btn>
        <h2 className="font-display text-[42px] text-white">🔧 차고</h2>
      </div>
      <div className="absolute left-10 top-[130px] glass rounded-2xl px-5 py-3 text-[14px] text-white/80 max-w-[420px]">
        차량 미리보기는 왼쪽 도로에서 확인하세요. 네온과 페인트는 즉시 반영됩니다.
      </div>

      <div className="absolute right-6 top-5 bottom-5 w-[700px] glass rounded-3xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-[26px] text-white">업그레이드 샵</div>
          <CoinBadge coins={save.coins} />
        </div>

        {/* Rocket */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[22px] text-orange-300">🚀 로켓 부스터 <span className="text-white/60 text-[15px]">Lv {save.rocket}/3</span></div>
              <div className="text-[13px] text-white/65 mt-1">
                SHIFT 로 점화! 연료가 다 떨어질 때까지 폭발적인 추진력. 쉬면 연료가 천천히 회복돼요.
              </div>
              {rocketNext && (
                <div className="text-[12px] text-orange-200/90 mt-1">
                  다음 레벨: 연료 {rocketNext.fuel} · 추력 {rocketNext.thrust} · 최고속도 {Math.round(rocketNext.maxSpeed * 0.162)}km/h
                </div>
              )}
            </div>
            <Btn
              tone="amber"
              size="sm"
              disabled={save.rocket >= 3 || save.coins < (ROCKET_COSTS[save.rocket] ?? 0)}
              onClick={() => buy(store.buyRocket())}
            >
              {save.rocket >= 3 ? 'MAX' : `${save.rocket === 0 ? '해금' : '강화'} ₩${ROCKET_COSTS[save.rocket]}`}
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
              <div className="font-display text-[22px] text-cyan-300">🌀 스프링 범퍼 <span className="text-white/60 text-[15px]">Lv {save.bumper}/2</span></div>
              <div className="text-[13px] text-white/65 mt-1">
                저속 접촉은 알람 없이 <b>BOING!</b> 튕겨냅니다. 시도마다 충전 횟수가 채워져요.
              </div>
              {bumperNext && (
                <div className="text-[12px] text-cyan-200/90 mt-1">
                  다음 레벨: {Math.round(bumperNext.threshold * 0.162)}km/h 미만 접촉 방어 · {bumperNext.charges}회
                </div>
              )}
            </div>
            <Btn
              tone="cyan"
              size="sm"
              disabled={save.bumper >= 2 || save.coins < (BUMPER_COSTS[save.bumper] ?? 0)}
              onClick={() => buy(store.buyBumper())}
            >
              {save.bumper >= 2 ? 'MAX' : `${save.bumper === 0 ? '해금' : '강화'} ₩${BUMPER_COSTS[save.bumper]}`}
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
          <div className="font-display text-[22px] text-pink-300 mb-2">💡 네온 언더글로우</div>
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
                    <span className="block text-[11px] text-white/60">{owned ? (active ? '장착 중' : '보유') : `₩${n.cost}`}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Paint */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3">
          <div className="font-display text-[22px] text-white mb-2">🎨 차량 색상 <span className="text-white/50 text-[13px]">무료</span></div>
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
            🏎️ 슈퍼카 컬렉션 <span className="text-white/60 text-[15px]">{save.carsOwned.length}/{SUPERCARS.length}</span>
          </div>
          <div className="text-[13px] text-white/65 mb-3">
            별을 모으면 슈퍼카가 해금돼요. 티어 1은 처음부터, 티어 2는 별 6개, 티어 3는 별 12개.
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
                    {owned ? (active ? '장착 중' : '보유') : `⭐${req}`}
                  </span>
                  {can && (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-lime-400 px-1.5 py-px text-[9px] font-black text-black">
                      해금!
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
            <div className="font-display text-[20px] text-amber-200">📺 무료 코인</div>
            <div className="text-[13px] text-white/70">짧은 광고를 보고 ₩200 코인을 받으세요 (Poki rewardedBreak)</div>
          </div>
          <Btn
            tone="lime"
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
            +200 받기
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
  const lv = LEVELS[result.levelIndex];

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
            <div className="text-[12px] text-white/55">남은 시간</div>
            <div className="font-display text-[28px] tabular-nums">{result.timeLeft.toFixed(2)}s</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 py-3">
            <div className="text-[12px] text-white/55">각도 오차</div>
            <div className="font-display text-[28px] tabular-nums">{Math.abs(result.angleErrDeg).toFixed(1)}°</div>
          </div>
          <div className="rounded-xl bg-amber-400/15 border border-amber-300/40 py-3">
            <div className="text-[12px] text-amber-200/80">획득 코인</div>
            <div className="font-display text-[28px] text-amber-300 tabular-nums">
              +{result.coins}
              {doubled && <span className="text-[16px] text-lime-300"> ×2</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!isLast ? (
            <Btn size="md" onClick={onNext}>다음 스테이지 ▶</Btn>
          ) : (
            <div className="font-display text-[22px] text-amber-300 w-full">🏆 모든 스테이지 클리어! 당신은 전설의 발렛 파커!</div>
          )}
          <Btn tone="cyan" size="md" onClick={onRetry}>↺ 다시</Btn>
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
            📺 코인 2배
          </Btn>
          <Btn tone="ghost" size="md" onClick={onMenu}>메뉴</Btn>
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
        <div className="text-[13px] tracking-[0.3em] text-white/40 mb-3">ADVERTISEMENT · POKI SDK MOCK</div>
        <div className="w-[560px] h-[315px] rounded-2xl border border-white/15 bg-gradient-to-br from-indigo-700 via-fuchsia-600 to-orange-500 grid place-items-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(45deg,transparent_0_18px,rgba(255,255,255,.25)_18px_36px)]" />
          <div className="relative">
            <div className="font-display text-[46px] text-white text-outline animate-floaty">🏎️ SUPER PARK™</div>
            <div className="text-white/90 text-[16px] mt-2">지금 다운로드하고 슈퍼카 100대를 주차하세요!</div>
          </div>
        </div>
        <div className="mt-5 h-2 w-[560px] mx-auto rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-lime-300 transition-[width] duration-1000 ease-linear" style={{ width: `${((total - left) / total) * 100}%` }} />
        </div>
        <div className="mt-5">
          {left > 0 ? (
            <div className="font-display text-[22px] text-white/70">
              {req.kind === 'rewarded' ? `보상까지 ${left}초` : `${left}초 후 건너뛰기`}
            </div>
          ) : (
            <Btn
              onClick={() => {
                req.done(req.kind === 'rewarded');
                onClose();
              }}
            >
              {req.kind === 'rewarded' ? '🎁 보상 받기' : '광고 닫기 ▶'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
