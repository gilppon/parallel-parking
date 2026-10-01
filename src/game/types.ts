/**
 * Shared types & constants for "Extreme Parallel Parking Physics".
 */
import type Phaser from 'phaser';

/** Alias so the rest of the code base can talk about Matter bodies. */
export type MatterBody = MatterJS.BodyType;
export type PhaserNS = typeof Phaser;

export const WORLD_W = 1280;
export const WORLD_H = 720;

/** Car footprint in world pixels. 100px ≈ 4.5m  →  1px ≈ 4.5cm */
export const CAR_L = 100;
export const CAR_W = 46;
export const PX_TO_CM = 4.5;

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  handbrake: boolean;
  boost: boolean;
}

export const emptyInput = (): InputState => ({
  left: false,
  right: false,
  up: false,
  down: false,
  handbrake: false,
  boost: false,
});

/** Data structure from the design spec. */
export interface CarPhysicsBody {
  body: MatterJS.BodyType;
  steeringAngle: number;
  driftFactor: number;
  isParkedCorrectly: boolean;
}

export interface ParkedCarDef {
  x: number;
  y: number;
  /** radians, 0 = nose pointing +x */
  angle: number;
  color: string;
  name: string;
  /** price in USD millions (for funny repair bills) */
  price: number;
}

export interface PillarDef {
  x: number;
  y: number;
  r: number;
}

export interface WallDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Parking zone. `w` runs along the car's length axis, `h` across. */
export interface ZoneDef {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

export type LevelTheme = 'street' | 'garage';

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  hint: string;
  theme: LevelTheme;
  timeLimit: number;
  start: { x: number; y: number; angle: number };
  zone: ZoneDef;
  parked: ParkedCarDef[];
  pillars: PillarDef[];
  walls: WallDef[];
  angleTolDeg: number;
  /** total slack (both ends together) in px – for display */
  slackPx: number;
  reward: number;
}

export interface HudState {
  phase: 'idle' | 'ready' | 'running' | 'success' | 'fail';
  timeLeft: number;
  timeLimit: number;
  speedKmh: number;
  drift: number;
  fuel: number;
  fuelMax: number;
  hasRocket: boolean;
  bumperCharges: number;
  bumperMax: number;
  parkProgress: number;
  inZone: boolean;
  aligned: boolean;
  overflowCm: number;
  angleErrDeg: number;
  levelIndex: number;
}

export interface ResultPayload {
  kind: 'success' | 'fail-crash' | 'fail-time';
  levelIndex: number;
  timeLeft: number;
  stars: number;
  perfect: boolean;
  coins: number;
  angleErrDeg: number;
  overflowCm: number;
  carName?: string;
  bill?: string;
  message: string;
  fails: number;
}

export const NEON_COLORS: Record<string, { label: string; color: number | 'rainbow' | null; cost: number }> = {
  none: { label: 'None', color: null, cost: 0 },
  cyan: { label: 'Cyber Cyan', color: 0x22e6ff, cost: 120 },
  pink: { label: 'Hot Pink', color: 0xff2fa8, cost: 120 },
  lime: { label: 'Neon Lime', color: 0x7dff2a, cost: 160 },
  gold: { label: 'Gold Rush', color: 0xffc933, cost: 220 },
  rainbow: { label: 'Rainbow', color: 'rainbow', cost: 450 },
};

export const PAINTS: { id: string; label: string; color: string }[] = [
  { id: 'white', label: 'Pearl White', color: '#f2f5f7' },
  { id: 'black', label: 'Matte Black', color: '#23262b' },
  { id: 'teal', label: 'Mint Teal', color: '#14b8a6' },
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'crimson', label: 'Crimson', color: '#e11d48' },
  { id: 'lemon', label: 'Lemon', color: '#facc15' },
];
