/**
 * Portal ad bridge (Poki / CrazyGames / mock auto-detect).
 *
 * - On a Poki / CrazyGames host (or with a `?poki` / `?crazy` query param, or when
 *   the portal already injected the SDK <script> into index.html) the real SDK is
 *   used; the script is lazily injected as a fallback when it is missing.
 * - Everywhere else a *mock* is used which shows a fake ad overlay through the
 *   React UI so the ad flow can be tested end to end.
 * - Any failure or a blocked SDK falls back on a timeout so gameplay never stalls.
 * - Audio is force-muted for the whole ad: both portals require it.
 *
 * Hooks used by the game:
 *   init → notifyReady (gameLoadingFinished / loadingStop) → gameplayStart / gameplayStop
 *   commercialBreak  (between levels / after several crashes)
 *   rewardedBreak    (free coins, double reward)
 */
import { audio } from './AudioFx';
import { bridge } from './bridge';

interface PokiSDKApi {
  init: () => Promise<void>;
  gameLoadingFinished: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  commercialBreak: (beforeAd?: () => void) => Promise<void>;
  rewardedBreak: (beforeAd?: () => void) => Promise<boolean>;
  setDebug?: (on: boolean) => void;
}

interface CrazyGamesApi {
  init: () => Promise<void>;
  game: {
    loadingStart: () => void;
    loadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
  };
  ad: {
    requestAd: (type: 'midgame' | 'rewarded', callbacks: CrazyAdCallbacks) => Promise<void>;
  };
}

interface CrazyAdCallbacks {
  adStarted: () => void;
  adFinished: () => void;
  adError: () => void;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKApi;
    CrazyGames?: { SDK?: CrazyGamesApi };
  }
}

type Provider = 'poki' | 'crazy' | null;

const POKI_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
const CRAZY_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

function detectPortal(): Exclude<Provider, null> | null {
  try {
    const host = window.location.hostname;
    const q = window.location.search;
    if (/poki(-gdn)?\.com$/.test(host) || /[?&]poki/.test(q)) return 'poki';
    if (/(^|\.)crazygames\.com$/.test(host) || /[?&]crazy/.test(q)) return 'crazy';
  } catch {
    /* ignore */
  }
  return null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error('sdk timeout')), 4000);
    el.src = src;
    el.async = true;
    el.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('sdk load error'));
    };
    document.head.appendChild(el);
  });
}

class PokiService {
  private sdk: PokiSDKApi | null = null;
  private provider: Provider = null;
  private playing = false;
  private playingNotified = false;
  private loadingSent = false;
  /** the first frame beat the SDK handshake – flush the signal once init lands */
  private loadingPending = false;
  private initDone = false;
  private loadingFinishedNotified = false;
  // start the frequency cap at boot so players get a few clean minutes first
  private lastMockAd = Date.now() - 20_000;
  private adRunning = false;
  ready = false;

  get isMock() {
    return this.provider === null;
  }

  async init() {
    if (typeof window !== 'undefined') {
      const want = detectPortal();
      try {
        if (want === 'crazy' && !window.CrazyGames?.SDK) {
          try {
            await loadScript(CRAZY_URL);
          } catch {
            /* adblocker etc. – fall through to the mock */
          }
          await PokiService.withTimeout(window.CrazyGames?.SDK?.init() ?? Promise.resolve(), 5000, undefined);
          if (window.CrazyGames?.SDK) {
            this.provider = 'crazy';
            try {
              window.CrazyGames.SDK.game.loadingStart();
            } catch {
              /* ignore */
            }
            // eslint-disable-next-line no-console
            console.info('[CrazyGames] SDK initialised');
          }
        } else if (want === 'poki' || window.PokiSDK) {
          if (want === 'poki' && !window.PokiSDK) {
            try {
              await loadScript(POKI_URL);
            } catch {
              /* adblocker etc. – fall through to the mock */
            }
          }
          await PokiService.withTimeout(window.PokiSDK?.init() ?? Promise.resolve(), 5000, undefined);
          this.sdk = window.PokiSDK ?? null;
          if (this.sdk) {
            this.provider = 'poki';
            // eslint-disable-next-line no-console
            console.info('[Poki] SDK initialised');
          }
        }
      } catch {
        // adblocker etc. – the SDK still resolves ads instantly after a failed init
        if (this.provider === 'crazy') {
          this.provider = window.CrazyGames?.SDK ? 'crazy' : null;
        } else {
          this.sdk = window.PokiSDK ?? null;
          this.provider = this.sdk ? 'poki' : null;
        }
      }
    }
    this.ready = true;
    this.initDone = true;
    if (this.loadingPending) {
      this.loadingPending = false;
      this.sendLoadingFinished();
    }
  }

  private sendLoadingFinished() {
    if (this.loadingFinishedNotified) return;
    if (this.provider === 'poki') this.sdk?.gameLoadingFinished();
    else if (this.provider === 'crazy') {
      try {
        window.CrazyGames?.SDK?.game?.loadingStop();
      } catch {
        /* ignore */
      }
    }
    this.loadingFinishedNotified = true;
    this.notifyGameplayStart();
  }

  /**
   * gameLoadingFinished must be called exactly once, after the real first frame is drawn.
   * (if the portal's loading gauge drifts from the actual ready point, that's a timeout reject)
   */
  notifyReady() {
    if (this.loadingSent) return;
    this.loadingSent = true;
    if (!this.initDone) {
      this.loadingPending = true;
      return;
    }
    this.sendLoadingFinished();
  }

  gameplayStart() {
    this.playing = true;
    this.notifyGameplayStart();
  }

  private notifyGameplayStart() {
    if (!this.initDone || !this.loadingFinishedNotified || !this.playing || this.playingNotified) return;
    try {
      if (this.provider === 'poki') this.sdk?.gameplayStart();
      else if (this.provider === 'crazy') window.CrazyGames?.SDK?.game?.gameplayStart();
      else return;
      this.playingNotified = true;
    } catch {
      /* ignore */
    }
  }

  gameplayStop() {
    this.playing = false;
    if (!this.playingNotified) return;
    try {
      if (this.provider === 'poki') this.sdk?.gameplayStop();
      else if (this.provider === 'crazy') {
        window.CrazyGames?.SDK?.game?.gameplayStop();
      }
    } catch {
      /* ignore */
    } finally {
      this.playingNotified = false;
    }
  }

  /** timeout fallback so a silent SDK can't wedge the session */
  private static async withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([p, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))]);
  }

  /** Interstitial. Resolves when the ad (or nothing) is done. */
  async commercialBreak(): Promise<void> {
    if (this.adRunning) return;
    this.gameplayStop();
    this.adRunning = true;
    try {
      if (this.provider === 'poki' && this.sdk) {
        await PokiService.withTimeout(
          this.sdk.commercialBreak(() => audio.setAdMuted(true)),
          8000,
          undefined,
        );
      } else if (this.provider === 'crazy') {
        await PokiService.withTimeout(
          window.CrazyGames?.SDK?.ad?.requestAd('midgame', {
            adStarted: () => audio.setAdMuted(true),
            adFinished: () => audio.setAdMuted(false),
            adError: () => audio.setAdMuted(false),
          }) ?? Promise.resolve(),
          10000,
          undefined,
        );
      } else {
        // mock: frequency capped to once every 45 s
        const now = Date.now();
        if (now - this.lastMockAd < 45_000) return;
        this.lastMockAd = now;
        audio.setAdMuted(true);
        await PokiService.withTimeout(
          new Promise<void>((resolve) => bridge.emit('ad', { kind: 'commercial', done: () => resolve() })),
          8000,
          undefined,
        );
      }
    } catch {
      /* ad failures are ignored */
    } finally {
      audio.setAdMuted(false);
      this.adRunning = false;
    }
  }

  /** Rewarded video. Resolves true when the user earned the reward. */
  async rewardedBreak(): Promise<boolean> {
    if (this.adRunning) return false;
    this.gameplayStop();
    this.adRunning = true;
    try {
      if (this.provider === 'poki' && this.sdk) {
        return await PokiService.withTimeout(
          this.sdk.rewardedBreak(() => audio.setAdMuted(true)),
          20000,
          false,
        );
      }
      if (this.provider === 'crazy') {
        let ok = false;
        await PokiService.withTimeout(
          window.CrazyGames?.SDK?.ad?.requestAd('rewarded', {
            adStarted: () => audio.setAdMuted(true),
            adFinished: () => {
              audio.setAdMuted(false);
              ok = true;
            },
            adError: () => {
              audio.setAdMuted(false);
              ok = false;
            },
          }) ?? Promise.resolve(),
          20000,
          undefined,
        );
        return ok;
      }
      if (detectPortal() !== null) return false;
      audio.setAdMuted(true);
      return await PokiService.withTimeout(
        new Promise<boolean>((resolve) => bridge.emit('ad', { kind: 'rewarded', done: (r) => resolve(r) })),
        20000,
        false,
      );
    } catch {
      return false;
    } finally {
      audio.setAdMuted(false);
      this.adRunning = false;
    }
  }
}

export const poki = new PokiService();
