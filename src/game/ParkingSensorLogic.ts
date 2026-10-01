import { CAR_L, CAR_W, PX_TO_CM, type ZoneDef } from './types';

export interface ParkingReport {
  /** 0..4 corners within tolerance of the zone */
  cornersInside: number;
  /** 0..1 fraction of the car body (sampled) inside the zone */
  coverage: number;
  /** signed angle error to the zone axis, mod 180° */
  angleErrDeg: number;
  /** worst overflow of any corner outside the zone, px / cm */
  overflowPx: number;
  overflowCm: number;
  inside: boolean;
  aligned: boolean;
  still: boolean;
  /** 0..1 how long the car has been "perfectly settled" */
  holdProgress: number;
  /** true once the hold timer completes */
  parked: boolean;
}

export interface SensorOptions {
  angleTolDeg: number;
  holdTime: number;
  maxSpeed: number;
  /** slack in px allowed when testing "inside" */
  tolPx: number;
}

const DEG = 180 / Math.PI;

/**
 * ParkingSensorLogic – pure geometry: is the car fully inside the (rotated)
 * parking zone, straight enough, and standing still long enough?
 */
export class ParkingSensorLogic {
  private hold = 0;
  private samples: { lx: number; ly: number }[] = [];

  constructor(
    private zone: ZoneDef,
    private opts: SensorOptions
  ) {
    // sample grid in car-local space for the coverage estimate
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 5; j++) {
        this.samples.push({
          lx: (i / 8 - 0.5) * CAR_L,
          ly: (j / 4 - 0.5) * CAR_W,
        });
      }
    }
  }

  reset() {
    this.hold = 0;
  }

  /** Returns the 4 world-space corners of the car. */
  static corners(x: number, y: number, angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const hl = CAR_L / 2;
    const hw = CAR_W / 2;
    return [
      [hl, -hw],
      [hl, hw],
      [-hl, hw],
      [-hl, -hw],
    ].map(([lx, ly]) => ({ x: x + lx * c - ly * s, y: y + lx * s + ly * c }));
  }

  private toZone(px: number, py: number) {
    const z = this.zone;
    const dx = px - z.x;
    const dy = py - z.y;
    const c = Math.cos(z.angle);
    const s = Math.sin(z.angle);
    return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
  }

  update(dt: number, x: number, y: number, angle: number, speed: number): ParkingReport {
    const z = this.zone;
    const o = this.opts;

    // corners
    let inside = 0;
    let worst = 0;
    for (const p of ParkingSensorLogic.corners(x, y, angle)) {
      const l = this.toZone(p.x, p.y);
      const ox = Math.max(0, Math.abs(l.lx) - z.w / 2);
      const oy = Math.max(0, Math.abs(l.ly) - z.h / 2);
      const over = Math.max(ox, oy);
      worst = Math.max(worst, over);
      if (over <= o.tolPx) inside++;
    }

    // coverage
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let cov = 0;
    for (const sm of this.samples) {
      const wx = x + sm.lx * c - sm.ly * s;
      const wy = y + sm.lx * s + sm.ly * c;
      const l = this.toZone(wx, wy);
      if (Math.abs(l.lx) <= z.w / 2 + o.tolPx && Math.abs(l.ly) <= z.h / 2 + o.tolPx) cov++;
    }
    const coverage = cov / this.samples.length;

    // angle error modulo 180°
    let diff = angle - z.angle;
    diff = ((((diff + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2;
    const angleErrDeg = diff * DEG;

    const isInside = inside === 4;
    const aligned = Math.abs(angleErrDeg) <= o.angleTolDeg;
    const still = speed <= o.maxSpeed;

    if (isInside && aligned && still) this.hold = Math.min(o.holdTime, this.hold + dt);
    else this.hold = Math.max(0, this.hold - dt * 2.5);

    return {
      cornersInside: inside,
      coverage,
      angleErrDeg,
      overflowPx: worst,
      overflowCm: worst * PX_TO_CM,
      inside: isInside,
      aligned,
      still,
      holdProgress: this.hold / o.holdTime,
      parked: this.hold >= o.holdTime,
    };
  }
}
