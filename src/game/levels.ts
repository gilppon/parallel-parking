import {
  CAR_L,
  CAR_W,
  WORLD_H,
  WORLD_W,
  type LevelDef,
  type LevelTheme,
  type ParkedCarDef,
  type PillarDef,
  type WallDef,
} from './types';

interface SuperCar {
  name: string;
  color: string;
  price: number;
  /** tier (collection sorting + unlock requirement display) */
  tier: 1 | 2 | 3;
}

export const SUPERCARS: SuperCar[] = [
  { name: 'Lotus Emeya', color: '#e11d9a', price: 3.4, tier: 1 },
  { name: 'Lamborghini Huracan', color: '#f5c400', price: 3.9, tier: 1 },
  { name: 'McLaren 720S', color: '#ff6a00', price: 4.7, tier: 1 },
  { name: 'Ferrari SF90', color: '#d80000', price: 6.1, tier: 1 },
  { name: 'Rolls-Royce Spectre', color: '#6d28a8', price: 8.3, tier: 2 },
  { name: 'Porsche 918', color: '#12b76a', price: 11, tier: 2 },
  { name: 'Pagani Huayra', color: '#dfe7ec', price: 38, tier: 2 },
  { name: 'Aston Martin Valkyrie', color: '#0e7c66', price: 40, tier: 2 },
  { name: 'Koenigsegg Jesko', color: '#8f9aa5', price: 42, tier: 3 },
  { name: 'Bugatti Chiron', color: '#1f4bff', price: 55, tier: 3 },
];

/** Collection unlock requirement: total stars (requirement grows with tier) */
export const CAR_STAR_REQ = [0, 6, 12, 18];

export function carStarReq(tier: number): number {
  return CAR_STAR_REQ[Math.max(1, Math.min(3, tier)) - 1] ?? 0;
}

export const formatPrice = (p: number) => (p >= 10 ? `$${Math.round(p)}M` : `$${p.toFixed(1)}M`);

const ROW_Y = 526; // bottom parking lane centre-line
const CURB_TOP = 556;
const TOP_ROW_Y = 124;

interface CurbOpts {
  id: number;
  name: string;
  subtitle: string;
  hint: string;
  theme?: LevelTheme;
  slack: number;
  gx: number;
  start: { x: number; y: number; angle: number };
  angleTol: number;
  topRow?: boolean;
  extraCars?: { x: number; y: number; angle: number }[];
  pillars?: { x: number; y: number }[];
  reward?: number;
}

let carCounter = 0;
const pickCar = (seed: number): SuperCar => SUPERCARS[(seed * 7 + carCounter++ * 3) % SUPERCARS.length];

function makeCar(x: number, y: number, angle: number, seed: number): ParkedCarDef {
  const c = pickCar(seed);
  return { x, y, angle, color: c.color, name: c.name, price: c.price };
}

function commonWalls(theme: LevelTheme, hasTopWall = true): WallDef[] {
  const walls: WallDef[] = [
    // bottom curb / sidewalk
    { x: WORLD_W / 2, y: (CURB_TOP + WORLD_H + 40) / 2, w: WORLD_W + 200, h: WORLD_H + 40 - CURB_TOP },
    // side boundaries
    { x: -30, y: WORLD_H / 2, w: 60, h: WORLD_H * 2 },
    { x: WORLD_W + 30, y: WORLD_H / 2, w: 60, h: WORLD_H * 2 },
  ];
  if (hasTopWall) walls.push({ x: WORLD_W / 2, y: 45, w: WORLD_W + 200, h: 90 });
  void theme;
  return walls;
}

/** Parallel parking along the bottom curb, gap between two supercars. */
function curbLevel(o: CurbOpts): LevelDef {
  carCounter = o.id * 2;
  const gap = CAR_L + o.slack;
  const parked: ParkedCarDef[] = [];
  const pitch = CAR_L + 12;

  // Rear neighbour (left of gap) and everything further left
  let x = o.gx - gap / 2 - CAR_L / 2;
  while (x > 20) {
    parked.push(makeCar(x, ROW_Y, 0, o.id));
    x -= pitch;
  }
  // Front neighbour (right of gap) and everything further right
  x = o.gx + gap / 2 + CAR_L / 2;
  while (x < WORLD_W - 20) {
    parked.push(makeCar(x, ROW_Y, 0, o.id));
    x += pitch;
  }

  if (o.topRow) {
    const tpitch = CAR_L + 16;
    for (let tx = 60; tx < WORLD_W - 30; tx += tpitch) {
      parked.push(makeCar(tx, TOP_ROW_Y, Math.PI, o.id + 3));
    }
  }
  (o.extraCars ?? []).forEach((c) => parked.push(makeCar(c.x, c.y, c.angle, o.id + 5)));

  const pillars: PillarDef[] = (o.pillars ?? []).map((p) => ({ ...p, r: 20 }));

  // Early stages get a taller zone (extends towards the road) so a slightly
  // crooked park still counts; the curb-side edge stays fixed.
  const extra = Math.max(0, Math.round((o.slack - 44) * 0.4));
  const zoneH = CAR_W + 12 + extra;

  return {
    id: o.id,
    name: o.name,
    subtitle: o.subtitle,
    hint: o.hint,
    theme: o.theme ?? 'street',
    timeLimit: 10,
    start: o.start,
    zone: { x: o.gx, y: CURB_TOP - zoneH / 2, w: gap, h: zoneH, angle: 0 },
    parked,
    pillars,
    walls: commonWalls(o.theme ?? 'street'),
    angleTolDeg: o.angleTol,
    slackPx: o.slack,
    reward: o.reward ?? 100 + o.id * 30,
  };
}

interface BayOpts {
  id: number;
  name: string;
  subtitle: string;
  hint: string;
  theme?: LevelTheme;
  slack: number;
  gx: number;
  start: { x: number; y: number; angle: number };
  angleTol: number;
  pillars?: { x: number; y: number }[];
  extraCars?: { x: number; y: number; angle: number }[];
  reward?: number;
}

const BAY_Y = 150;

/** Perpendicular bay parking against the top wall. */
function bayLevel(o: BayOpts): LevelDef {
  carCounter = o.id * 2 + 1;
  const parked: ParkedCarDef[] = [];
  const gapW = CAR_W + o.slack;
  const off = gapW / 2 + CAR_W / 2;
  const pitch = CAR_W + 9;

  let x = o.gx - off;
  while (x > 20) {
    parked.push(makeCar(x, BAY_Y, Math.PI / 2, o.id));
    x -= pitch;
  }
  x = o.gx + off;
  while (x < WORLD_W - 20) {
    parked.push(makeCar(x, BAY_Y, Math.PI / 2, o.id));
    x += pitch;
  }
  (o.extraCars ?? []).forEach((c) => parked.push(makeCar(c.x, c.y, c.angle, o.id + 5)));
  const pillars: PillarDef[] = (o.pillars ?? []).map((p) => ({ ...p, r: 20 }));

  const walls: WallDef[] = [
    { x: WORLD_W / 2, y: 48, w: WORLD_W + 200, h: 96 },
    { x: WORLD_W / 2, y: WORLD_H + 30, w: WORLD_W + 200, h: 100 },
    { x: -30, y: WORLD_H / 2, w: 60, h: WORLD_H * 2 },
    { x: WORLD_W + 30, y: WORLD_H / 2, w: 60, h: WORLD_H * 2 },
  ];

  return {
    id: o.id,
    name: o.name,
    subtitle: o.subtitle,
    hint: o.hint,
    theme: o.theme ?? 'street',
    timeLimit: 10,
    start: o.start,
    zone: { x: o.gx, y: BAY_Y - 1, w: CAR_L + 14, h: gapW, angle: Math.PI / 2 },
    parked,
    pillars,
    walls,
    angleTolDeg: o.angleTol,
    slackPx: o.slack,
    reward: o.reward ?? 100 + o.id * 30,
  };
}

export const LEVELS: LevelDef[] = [
  curbLevel({
    id: 1,
    name: 'Rookie Valet',
    subtitle: 'Roomy spot… just warming up',
    hint: '↑ Throttle · ←→ Steer · SPACE Handbrake drift',
    slack: 104,
    gx: 760,
    start: { x: 150, y: 330, angle: 0 },
    angleTol: 16,
  }),
  curbLevel({
    id: 2,
    name: 'Wrong-Way Alley',
    subtitle: 'Come in from the far side! Reverse at an angle',
    hint: 'Overshoot it, then reverse (↓) and flick the tail out with the handbrake',
    slack: 80,
    gx: 520,
    start: { x: 1140, y: 300, angle: Math.PI },
    angleTol: 14,
  }),
  curbLevel({
    id: 3,
    name: 'Cheongdam Supercar Strip',
    subtitle: 'Both kerbs are packed with supercars',
    hint: 'The road narrowed. Set your entry angle early',
    slack: 66,
    gx: 840,
    start: { x: 140, y: 310, angle: 0 },
    angleTol: 12,
    topRow: true,
  }),
  curbLevel({
    id: 4,
    name: 'Double-Parking Hell',
    subtitle: 'A ballsy double-parker in the middle of the road',
    hint: 'Rocket Booster unlocks in the Garage (no? shove it in with a SPACE drift)',
    slack: 58,
    gx: 930,
    start: { x: 150, y: 290, angle: 0 },
    angleTol: 12,
    topRow: true,
    extraCars: [{ x: 560, y: 432, angle: 0.08 }],
  }),
  bayLevel({
    id: 5,
    name: '90° Knife Fold',
    subtitle: 'Back in perpendicular between two supercars',
    hint: 'Perpendicular! Drive in forwards or reverse in — both fine',
    slack: 50,
    gx: 640,
    start: { x: 1120, y: 470, angle: Math.PI },
    angleTol: 10,
  }),
  curbLevel({
    id: 6,
    name: 'Parking Garage Pillars',
    subtitle: 'Concrete pillars set off no alarm (they just hurt)',
    hint: 'Pillars are lethal! Buy the Spring Bumper in the Garage to bounce off slow contact',
    theme: 'garage',
    slack: 50,
    gx: 700,
    start: { x: 140, y: 300, angle: 0 },
    angleTol: 11,
    topRow: true,
    pillars: [
      { x: 420, y: 350 },
      { x: 940, y: 300 },
    ],
  }),
  curbLevel({
    id: 7,
    name: 'Supercar Museum',
    subtitle: 'Hundreds of millions on the lot. Scratch it, life over',
    hint: 'The trick: drift it in rear-end first, nothing else',
    slack: 44,
    gx: 600,
    start: { x: 1150, y: 300, angle: Math.PI },
    angleTol: 10,
    topRow: true,
    extraCars: [{ x: 900, y: 424, angle: -0.06 }],
  }),
  bayLevel({
    id: 8,
    name: 'Underground Bunker 90°',
    subtitle: 'Thread the pillars and knife it in',
    hint: 'Kill your speed and line up the entry angle',
    theme: 'garage',
    slack: 40,
    gx: 880,
    start: { x: 160, y: 500, angle: 0 },
    angleTol: 8,
    pillars: [
      { x: 520, y: 380 },
      { x: 1080, y: 400 },
    ],
  }),
  curbLevel({
    id: 9,
    name: 'The 1cm Error',
    subtitle: 'Slack on both ends: 1.5m. Hold your breath too',
    hint: "No time to even flick the indicator!",
    theme: 'garage',
    slack: 34,
    gx: 480,
    start: { x: 1150, y: 300, angle: Math.PI },
    angleTol: 8,
    topRow: true,
    extraCars: [{ x: 820, y: 430, angle: 0.05 }],
    pillars: [{ x: 660, y: 320 }],
  }),
  curbLevel({
    id: 10,
    name: "God's Hand",
    subtitle: 'Dedicated to the legendary valet parker',
    hint: "You got this far. You're already a legend.",
    theme: 'garage',
    slack: 28,
    gx: 800,
    start: { x: 140, y: 300, angle: 0 },
    angleTol: 6,
    topRow: true,
    extraCars: [{ x: 420, y: 420, angle: -0.05 }],
    pillars: [{ x: 1000, y: 330 }],
    reward: 700,
  }),
];
