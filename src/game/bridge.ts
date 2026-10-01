import { emptyInput, type HudState, type ResultPayload } from './types';

export interface AdRequest {
  kind: 'commercial' | 'rewarded';
  /** call when the (mock) ad finishes. `rewarded` is only meaningful for rewarded ads. */
  done: (rewarded: boolean) => void;
}

export interface BannerPayload {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}

interface Events {
  hud: HudState;
  result: ResultPayload;
  banner: BannerPayload;
  ad: AdRequest;
  'cmd:preview': number;
  'cmd:start': number;
  'cmd:restart': void;
  'cmd:pause': boolean;
  'cmd:loadout': void;
  'cmd:coins-earned': number;
}

type Handler<T> = (payload: T) => void;

/**
 * Tiny typed event bus that decouples the React UI from the Phaser scene.
 * `touch` carries on-screen control state (mobile).
 */
class Bridge {
  touch = emptyInput();
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(ev: K, fn: Handler<Events[K]>): () => void {
    const set = (this.handlers[ev] ??= new Set() as never) as Set<Handler<Events[K]>>;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  emit<K extends keyof Events>(ev: K, ...args: Events[K] extends void ? [] : [Events[K]]) {
    const set = this.handlers[ev] as Set<Handler<Events[K]>> | undefined;
    set?.forEach((fn) => fn(args[0] as Events[K]));
  }
}

export const bridge = new Bridge();
