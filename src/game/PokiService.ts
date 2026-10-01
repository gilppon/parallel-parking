/**
 * Poki SDK integration layer.
 *
 * - When the game is hosted on Poki (or the SDK <script> is injected into
 *   index.html: https://game-cdn.poki.com/scripts/v2/poki-sdk.js) the real
 *   `window.PokiSDK` is used.
 * - Everywhere else a *mock* is used which shows a fake ad overlay through the
 *   React UI so the ad flow can be tested end to end.
 *
 * Hooks used by the game:
 *   init → gameLoadingFinished → gameplayStart / gameplayStop
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

declare global {
  interface Window {
    PokiSDK?: PokiSDKApi;
  }
}

class PokiService {
  private sdk: PokiSDKApi | null = null;
  private playing = false;
  private loadingSent = false;
  // start the frequency cap at boot so players get a few clean minutes first
  private lastMockAd = Date.now() - 20_000;
  private adRunning = false;
  ready = false;

  get isMock() {
    return !this.sdk;
  }

  async init() {
    if (typeof window !== 'undefined' && window.PokiSDK) {
      try {
        await window.PokiSDK.init();
        this.sdk = window.PokiSDK;
        // eslint-disable-next-line no-console
        console.info('[Poki] SDK initialised');
      } catch {
        // adblocker etc. – the SDK still resolves ads instantly after a failed init
        this.sdk = window.PokiSDK;
      }
    }
    this.ready = true;
  }

  /**
   * gameLoadingFinished는 실제 첫 프레임이 그려진 뒤에 한 번만 호출해야 한다.
   * (포털 로딩 게이지가 실제 준비 시점과 어긋나면 타임아웃 리젝 사유가 된다)
   */
  notifyReady() {
    if (this.loadingSent) return;
    this.loadingSent = true;
    this.sdk?.gameLoadingFinished();
  }

  gameplayStart() {
    if (this.playing) return;
    this.playing = true;
    this.sdk?.gameplayStart();
  }

  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this.sdk?.gameplayStop();
  }

  /** SDK가 응답하지 않아 세션이 잠기지 않도록 타임아웃 폴백 */
  private static async withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([p, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms))]);
  }

  /** Interstitial. Resolves when the ad (or nothing) is done. */
  async commercialBreak(): Promise<void> {
    if (this.adRunning) return;
    this.gameplayStop();
    this.adRunning = true;
    try {
      if (this.sdk) {
        await PokiService.withTimeout(
          this.sdk.commercialBreak(() => audio.setAdMuted(true)),
          8000,
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
      /* 광고 실패는 무시 */
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
      if (this.sdk) {
        return await PokiService.withTimeout(
          this.sdk.rewardedBreak(() => audio.setAdMuted(true)),
          20000,
          false,
        );
      }
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
