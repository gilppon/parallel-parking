import { SUPERCARS, LEVELS, carStarReq } from './levels';

export interface SaveData {
  coins: number;
  /** highest unlocked level index (0-based) */
  unlocked: number;
  stars: number[];
  /** best remaining time per level (seconds) */
  best: (number | null)[];
  rocket: number; // 0..3
  bumper: number; // 0..2
  neonOwned: string[];
  neon: string;
  paint: string;
  fails: number;
  muted: boolean;
  /** unlocked supercar indices (collection) */
  carsOwned: number[];
  /** supercar index currently equipped (default 0) */
  carEquipped: number;
  perfects: number; // crash-free clears
  lastDaily: number;
  dailyStreak: number;
  claimedMilestones: number[];
}

export interface RocketStats {
  fuel: number;
  thrust: number;
  maxSpeed: number;
}
export interface BumperStats {
  charges: number;
  /** impact speeds (px/s) below this are forgiven */
  threshold: number;
}

export const ROCKET_LEVELS: (RocketStats | null)[] = [
  null,
  { fuel: 60, thrust: 520, maxSpeed: 560 },
  { fuel: 100, thrust: 640, maxSpeed: 640 },
  { fuel: 150, thrust: 780, maxSpeed: 740 },
];
export const ROCKET_COSTS = [250, 500, 900];

export const BUMPER_LEVELS: (BumperStats | null)[] = [
  null,
  { charges: 1, threshold: 150 },
  { charges: 2, threshold: 240 },
];
export const BUMPER_COSTS = [300, 650];

const KEY = 'extreme-parallel-parking-v1';

const defaults = (): SaveData => ({
  coins: 150,
  unlocked: 0,
  stars: LEVELS.map(() => 0),
  best: LEVELS.map(() => null),
  rocket: 0,
  bumper: 0,
  neonOwned: ['none'],
  neon: 'none',
  paint: 'white',
  fails: 0,
  muted: false,
  carsOwned: [0],
  carEquipped: 0,
  perfects: 0,
  lastDaily: 0,
  dailyStreak: 0,
  claimedMilestones: [],
});

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const d = defaults();
    return {
      ...d,
      ...parsed,
      coins: Math.max(0, Math.round(num(parsed.coins, d.coins))),
      unlocked: Math.max(0, Math.min(LEVELS.length - 1, Math.round(num(parsed.unlocked, 0)))),
      rocket: Math.max(0, Math.min(3, Math.round(num(parsed.rocket, 0)))),
      bumper: Math.max(0, Math.min(2, Math.round(num(parsed.bumper, 0)))),
      fails: Math.max(0, Math.round(num(parsed.fails, 0))),
      perfects: Math.max(0, Math.round(num(parsed.perfects, 0))),
      stars: LEVELS.map((_, i) => Math.max(0, Math.min(3, Math.round(num(parsed.stars?.[i], 0))))),
      best: LEVELS.map((_, i) => (typeof parsed.best?.[i] === 'number' ? parsed.best[i] : null)),
      neonOwned: parsed.neonOwned?.length ? parsed.neonOwned : d.neonOwned,
      carsOwned: Array.isArray(parsed.carsOwned) && parsed.carsOwned.length ? parsed.carsOwned : d.carsOwned,
      carEquipped: Math.max(0, Math.round(num(parsed.carEquipped, 0))),
      lastDaily: Math.max(0, num(parsed.lastDaily, 0)),
      dailyStreak: Math.max(0, Math.min(7, Math.round(num(parsed.dailyStreak, 0)))),
      claimedMilestones: Array.isArray(parsed.claimedMilestones)
        ? parsed.claimedMilestones.filter((x): x is number => typeof x === 'number')
        : [],
    };
  } catch {
    return defaults();
  }
}

/** Daily reward 7-day cycle (coins) */
export const DAILY_COINS = [40, 60, 90, 130, 190, 280, 420];

/** Achievements: fail / perfect / star milestones */
export interface Milestone {
  key: 'stars' | 'fails' | 'perfects';
  at: number;
  coins: number;
  label: string;
  icon: string;
}

export const MILESTONES: Milestone[] = [
  { key: 'stars', at: 3, coins: 120, icon: '★', label: '3 stars' },
  { key: 'stars', at: 9, coins: 300, icon: '★', label: '9 stars' },
  { key: 'stars', at: 20, coins: 700, icon: '★', label: '20 stars' },
  { key: 'perfects', at: 1, coins: 150, icon: '💎', label: '1 clean run' },
  { key: 'perfects', at: 5, coins: 500, icon: '💎', label: '5 clean runs' },
  { key: 'fails', at: 20, coins: 150, icon: '💥', label: '20 crashes' },
  { key: 'fails', at: 50, coins: 450, icon: '💥', label: '50 crashes' },
];

export function totalStars(d: SaveData): number {
  return d.stars.reduce((a, b) => a + b, 0);
}

export function dailyStatus(d: SaveData): { available: boolean; day: number; coins: number } {
  const now = Date.now();
  const today = new Date(now).toDateString();
  if (d.lastDaily > 0 && new Date(d.lastDaily).toDateString() === today) {
    const day = Math.min(Math.max(d.dailyStreak, 1), 7);
    return { available: false, day, coins: DAILY_COINS[day - 1] ?? 40 };
  }
  const yesterday = new Date(now - 86400000).toDateString();
  const continued = d.lastDaily > 0 && new Date(d.lastDaily).toDateString() === yesterday;
  const next = continued ? (d.dailyStreak % 7) + 1 : 1;
  return { available: true, day: next, coins: DAILY_COINS[next - 1] ?? 40 };
}

export function milestoneAchieved(d: SaveData, m: Milestone): boolean {
  if (m.key === 'stars') return totalStars(d) >= m.at;
  if (m.key === 'perfects') return d.perfects >= m.at;
  return d.fails >= m.at;
}

export function nextMilestone(d: SaveData): Milestone | null {
  for (const m of MILESTONES) {
    if (milestoneAchieved(d, m) && !d.claimedMilestones.includes(m.at)) return m;
  }
  return null;
}

export function upcomingMilestone(d: SaveData): Milestone | null {
  for (const m of MILESTONES) if (!d.claimedMilestones.includes(m.at)) return m;
  return null;
}

type Listener = () => void;

class Store {
  private data: SaveData = load();
  private listeners = new Set<Listener>();

  get = (): SaveData => this.data;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  update(patch: Partial<SaveData> | ((d: SaveData) => Partial<SaveData>)) {
    const p = typeof patch === 'function' ? patch(this.data) : patch;
    this.data = { ...this.data, ...p };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage may be blocked in iframes – ignore */
    }
    this.listeners.forEach((l) => l());
  }

  reset() {
    this.data = defaults();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l());
  }

  // -------- shop actions ---------
  buyRocket(): boolean {
    const d = this.data;
    if (d.rocket >= 3) return false;
    const cost = ROCKET_COSTS[d.rocket];
    if (d.coins < cost) return false;
    this.update({ coins: d.coins - cost, rocket: d.rocket + 1 });
    return true;
  }

  buyBumper(): boolean {
    const d = this.data;
    if (d.bumper >= 2) return false;
    const cost = BUMPER_COSTS[d.bumper];
    if (d.coins < cost) return false;
    this.update({ coins: d.coins - cost, bumper: d.bumper + 1 });
    return true;
  }

  buyNeon(id: string, cost: number): boolean {
    const d = this.data;
    if (d.neonOwned.includes(id)) return true;
    if (d.coins < cost) return false;
    this.update({ coins: d.coins - cost, neonOwned: [...d.neonOwned, id], neon: id });
    return true;
  }

  // -------- daily / milestone ---------
  claimDaily(): number {
    const st = dailyStatus(this.data);
    if (!st.available) return 0;
    this.update({ coins: this.data.coins + st.coins, lastDaily: Date.now(), dailyStreak: st.day });
    return st.coins;
  }

  claimMilestone(at: number): number {
    const m = MILESTONES.find((x) => x.at === at);
    if (!m || this.data.claimedMilestones.includes(at) || !milestoneAchieved(this.data, m)) return 0;
    this.update({ coins: this.data.coins + m.coins, claimedMilestones: [...this.data.claimedMilestones, at] });
    return m.coins;
  }

  // -------- car collection ---------
  /** supercar indices unlockable by total star count */
  availableCars(): number[] {
    const stars = totalStars(this.data);
    return SUPERCARS.map((c, i) => (stars >= carStarReq(c.tier) ? i : -1)).filter((i) => i >= 0);
  }

  claimCar(i: number): boolean {
    const car = SUPERCARS[i];
    if (!car) return false;
    const d = this.data;
    if (d.carsOwned.includes(i)) return true;
    if (totalStars(d) < carStarReq(car.tier)) return false;
    this.update({ carsOwned: [...d.carsOwned, i], carEquipped: i });
    return true;
  }

  equipCar(i: number) {
    if (this.data.carsOwned.includes(i)) this.update({ carEquipped: i });
  }
}

export const store = new Store();
