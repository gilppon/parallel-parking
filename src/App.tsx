import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audio } from './game/AudioFx';
import { bridge, type AdRequest, type BannerPayload } from './game/bridge';
import { LEVELS } from './game/levels';
import { poki } from './game/PokiService';
import { store } from './game/save';
import { WORLD_H, WORLD_W, type HudState, type ResultPayload } from './game/types';
import { useEscape, useSave } from './ui/common';
import { FailBanner, Hud, isTouchDevice, PauseOverlay } from './ui/Hud';
import { AdOverlay, Garage, LevelSelect, MenuScreen, ResultOverlay } from './ui/Screens';

type Screen = 'menu' | 'levels' | 'garage' | 'play';

export default function App() {
  const gameHost = useRef<HTMLDivElement>(null);
  const bannerTimer = useRef<number | undefined>(undefined);
  const nextBusy = useRef(false);
  const resultRef = useRef<ResultPayload | null>(null);

  const save = useSave();
  const touch = useMemo(isTouchDevice, []);

  const [scale, setScale] = useState(1);
  const [portrait, setPortrait] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [hud, setHud] = useState<HudState | null>(null);
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [banner, setBanner] = useState<BannerPayload | null>(null);
  const [ad, setAd] = useState<AdRequest | null>(null);
  const [paused, setPaused] = useState(false);
  resultRef.current = result;

  // ---------------------------------------------------------------- responsive scaling
  useEffect(() => {
    const fit = () => {
      setScale(Math.min(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H));
      setPortrait(window.innerHeight > window.innerWidth * 1.05);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // ---------------------------------------------------------------- boot Phaser + Poki
  useEffect(() => {
    let cancelled = false;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    void poki.init();
    import('./game/createGame').then(({ createGame }) => {
      if (cancelled || !gameHost.current) return;
      game = createGame(gameHost.current);
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  // ---------------------------------------------------------------- bridge subscriptions
  useEffect(() => {
    const offs = [
      bridge.on('hud', (h) => {
        setHud(h);
        setLoaded(true);
        poki.notifyReady(); // once only, after the first frame lands (keeps the portal loading gauge honest)
        if (h.phase === 'ready' || h.phase === 'running') {
          setResult((r) => (r ? null : r));
        }
      }),
      bridge.on('result', (r) => setResult(r)),
      bridge.on('banner', (b) => {
        setBanner(b);
        window.clearTimeout(bannerTimer.current);
        bannerTimer.current = window.setTimeout(() => setBanner(null), 1700);
      }),
      bridge.on('ad', (req) => setAd(req)),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  // audio unlock on the first interaction
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    audio.setMuted(save.muted);
  }, [save.muted]);

  useEffect(() => {
    bridge.emit('cmd:pause', paused);
    if (paused) poki.gameplayStop();
  }, [paused]);

  // auto-pause on tab switch / focus loss (stuck-key bug + stops Poki counting the background)
  const playingRef = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    playingRef.current = screen === 'play';
  }, [screen]);

  useEffect(() => {
    const autoPause = () => {
      if (!playingRef.current || pausedRef.current) return;
      if (!resultRef.current) {
        setPaused(true);
        poki.gameplayStop();
      }
    };
    const onVis = () => {
      if (document.hidden) autoPause();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', autoPause);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', autoPause);
    };
  }, []);

  // ---------------------------------------------------------------- actions
  const startLevel = useCallback((i: number) => {
    audio.unlock();
    // Music needs the same first gesture as the AudioContext itself.
    audio.startMusic();
    (document.activeElement as HTMLElement | null)?.blur?.();
    setResult(null);
    setBanner(null);
    setPaused(false);
    setScreen('play');
    bridge.emit('cmd:pause', false);
    bridge.emit('cmd:start', i);
  }, []);

  const goMenu = useCallback(() => {
    poki.gameplayStop();
    setResult(null);
    setPaused(false);
    setScreen('menu');
    bridge.emit('cmd:pause', false);
    bridge.emit('cmd:preview', Math.min(store.get().unlocked, LEVELS.length - 1));
  }, []);

  const openGarage = useCallback(() => {
    setScreen('garage');
    bridge.emit('cmd:preview', 0);
  }, []);

  const togglePause = useCallback(() => {
    if (screen !== 'play' || !hud) return;
    if (hud.phase !== 'ready' && hud.phase !== 'running') return;
    setPaused((p) => !p);
  }, [screen, hud]);

  useEscape(togglePause, screen === 'play' && !ad);

  const onNext = useCallback(async () => {
    if (!result || nextBusy.current) return;
    nextBusy.current = true;
    try {
      await poki.commercialBreak();
      startLevel(Math.min(LEVELS.length - 1, result.levelIndex + 1));
    } finally {
      nextBusy.current = false;
    }
  }, [result, startLevel]);

  const toggleMute = useCallback(() => {
    const next = !store.get().muted;
    store.update(() => ({ muted: next }));
    // Unmuting is a gesture: (re)start the loop if it never got going.
    if (!next) audio.startMusic();
  }, []);

  // ---------------------------------------------------------------- render
  const playing = screen === 'play';
  const failResult = result && result.kind !== 'success' ? result : null;
  const successResult = result && result.kind === 'success' ? result : null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden font-body">
      <div style={{ width: WORLD_W * scale, height: WORLD_H * scale }} className="relative shrink-0">
        <div
          className="absolute left-0 top-0 overflow-hidden bg-[#0b0d12]"
          style={{ width: WORLD_W, height: WORLD_H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        >
          {/* Phaser canvas */}
          <div ref={gameHost} className="absolute inset-0" />

          {/* screens */}
          {screen === 'menu' && (
            <MenuScreen
              onPlay={startLevel}
              onLevels={() => setScreen('levels')}
              onGarage={openGarage}
              muted={save.muted}
              onMute={toggleMute}
            />
          )}
          {screen === 'levels' && <LevelSelect onPlay={startLevel} onBack={goMenu} />}
          {screen === 'garage' && <Garage onBack={goMenu} />}

          {playing && hud && (
            <Hud
              hud={hud}
              coins={save.coins}
              touch={touch}
              muted={save.muted}
              banner={banner}
              onPause={togglePause}
              onMute={toggleMute}
            />
          )}
          {playing && failResult && <FailBanner result={failResult} />}
          {playing && successResult && (
            <ResultOverlay
              result={successResult}
              isLast={successResult.levelIndex >= LEVELS.length - 1}
              onNext={onNext}
              onRetry={() => startLevel(successResult.levelIndex)}
              onMenu={goMenu}
            />
          )}
          {playing && paused && (
            <PauseOverlay
              onResume={() => setPaused(false)}
              onRestart={() => {
                setPaused(false);
                bridge.emit('cmd:restart');
              }}
              onMenu={goMenu}
            />
          )}

          {ad && <AdOverlay req={ad} onClose={() => setAd(null)} />}

          {/* loading splash. Kept mounted so the opacity transition can play, but once
              loaded it is fully removed from the tree: `animate-blink` on the child sets
              `opacity: 1`, which re-reveals the text through a parent `opacity-0`. */}
          <div
            className={`absolute inset-0 z-[60] grid place-items-center bg-[#05060a] transition-opacity duration-500 ${
              loaded ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
            hidden={loaded}
            aria-hidden={loaded}
          >
            {!loaded && (
              <div className="text-center">
                <div className="font-display text-[54px] text-lime-300 neon-text animate-blink">LOADING…</div>
                <div className="text-white/50 text-[14px] mt-2">Spinning up the supercar…</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {portrait && (
        <div className="fixed left-1/2 top-2 -translate-x-1/2 z-[100] rounded-full bg-black/80 border border-white/20 px-4 py-2 text-[13px] text-white/90">
          📱 Rotate to landscape for a much bigger view
        </div>
      )}
    </div>
  );
}
