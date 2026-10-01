import Phaser from 'phaser';
import { type CarPhysicsBody, type InputState, type MatterBody } from './types';
import { type RocketStats } from './save';

// Phaser bundles Matter 0.20 – grab the raw lib for the Body helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Body: any = (Phaser.Physics.Matter as any).Matter.Body;

export interface CarTuning {
  /** engine acceleration (px/s²) */
  accel: number;
  /** braking deceleration (px/s²) */
  brake: number;
  maxFwd: number;
  maxRev: number;
  /** longitudinal decay when coasting (1/s) */
  rollDrag: number;
  /** constant coasting deceleration (px/s²) */
  coastDecel: number;
  /** lateral velocity decay rate with tyres gripping (1/s) */
  gripNormal: number;
  /** lateral decay with rear wheels locked (handbrake) */
  gripHandbrake: number;
  /** extra longitudinal decay while the handbrake is held (1/s) */
  handbrakeDrag: number;
  wheelBase: number;
  maxSteer: number;
  steerRate: number;
  steerReturn: number;
  /** how fast the yaw rate follows the target (1/s) */
  yawResponse: number;
  /** oversteer multiplier under handbrake */
  handbrakeOversteer: number;
  boostDrain: number;
  boostRegen: number;
}

export const DEFAULT_TUNING: CarTuning = {
  accel: 430,
  brake: 950,
  maxFwd: 400,
  maxRev: 220,
  rollDrag: 1.15,
  coastDecel: 150,
  gripNormal: 10.5,
  gripHandbrake: 0.85,
  handbrakeDrag: 0.7,
  wheelBase: 58,
  maxSteer: 0.66,
  steerRate: 4.2,
  steerReturn: 6.5,
  yawResponse: 13,
  handbrakeOversteer: 1.55,
  boostDrain: 42,
  boostRegen: 7,
};

const STEP_HZ = 60;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Top-down "arcade-sim" car model driven on top of a Matter.js rigid body.
 *
 * The body handles collisions/restitution; this controller rewrites the
 * velocity every fixed step from a tyre-grip model:
 *   • split velocity into forward / lateral components
 *   • forward: engine, brake, drag, rocket boost
 *   • lateral: exponential grip decay (drops massively with the handbrake)
 *   • yaw: bicycle-model steering  ω = v/L · tan(δ), oversteer under handbrake
 */
export class PhysicsCarController {
  readonly state: CarPhysicsBody;
  tuning: CarTuning;

  fuel = 0;
  fuelMax = 0;
  boosting = false;
  throttle = 0;

  speed = 0; // px/s
  forwardSpeed = 0;
  lateralSpeed = 0;

  private rocket: RocketStats | null;
  private grip: number;
  private boostCooldown = 0;
  private lastDir = 1;

  constructor(body: MatterBody, rocket: RocketStats | null, tuning: CarTuning = DEFAULT_TUNING) {
    this.tuning = tuning;
    this.rocket = rocket;
    this.grip = tuning.gripNormal;
    this.state = { body, steeringAngle: 0, driftFactor: 0, isParkedCorrectly: false };
    this.setRocket(rocket);
  }

  setRocket(rocket: RocketStats | null) {
    this.rocket = rocket;
    this.fuelMax = rocket?.fuel ?? 0;
    this.fuel = this.fuelMax;
  }

  reset(x: number, y: number, angle: number) {
    const b = this.state.body;
    Body.setPosition(b, { x, y }, false);
    Body.setAngle(b, angle, false);
    Body.setVelocity(b, { x: 0, y: 0 });
    Body.setAngularVelocity(b, 0);
    this.state.steeringAngle = 0;
    this.state.driftFactor = 0;
    this.state.isParkedCorrectly = false;
    this.grip = this.tuning.gripNormal;
    this.fuel = this.fuelMax;
    this.boosting = false;
    this.boostCooldown = 0;
    this.speed = this.forwardSpeed = this.lateralSpeed = 0;
    this.lastDir = 1;
  }

  /** Called once per fixed physics step, BEFORE world.step(). */
  step(dt: number, input: InputState) {
    const t = this.tuning;
    const b = this.state.body;

    const a = b.angle as number;
    const hx = Math.cos(a);
    const hy = Math.sin(a);
    const rx = -hy;
    const ry = hx;

    const vel = Body.getVelocity(b) as { x: number; y: number };
    let vx = vel.x * STEP_HZ;
    let vy = vel.y * STEP_HZ;
    let vF = vx * hx + vy * hy;
    let vL = vx * rx + vy * ry;

    const up = input.up ? 1 : 0;
    const down = input.down ? 1 : 0;
    const steerIn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const hb = input.handbrake;
    this.throttle = up;

    // ---------------- longitudinal ----------------
    const tractionScale = hb ? 0.35 : 1;
    if (up && !down) {
      if (vF < 0) vF += t.brake * dt;
      else if (vF < t.maxFwd) vF = Math.min(t.maxFwd, vF + t.accel * tractionScale * dt);
    } else if (down && !up) {
      if (vF > 8) vF -= t.brake * (hb ? 0.6 : 1) * dt;
      else vF = Math.max(-t.maxRev, vF - t.accel * 0.8 * tractionScale * dt);
    } else {
      // rolling resistance: constant + proportional so the car settles quickly
      const mag = Math.max(0, Math.abs(vF) - t.coastDecel * dt);
      vF = Math.sign(vF) * mag * Math.exp(-t.rollDrag * dt);
    }
    if (hb) vF *= Math.exp(-t.handbrakeDrag * dt);

    // ---------------- rocket booster ----------------
    this.boosting = false;
    if (this.rocket) {
      if (input.boost && this.fuel > 0) {
        this.boosting = true;
        this.fuel = Math.max(0, this.fuel - t.boostDrain * dt);
        this.boostCooldown = 0.9;
        // thrust along the nose, rear-wheel slip permitting
        vF += this.rocket.thrust * dt * (vF < -20 ? 1.4 : 1);
        vF = Math.min(vF, this.rocket.maxSpeed);
      } else {
        this.boostCooldown = Math.max(0, this.boostCooldown - dt);
        if (this.boostCooldown <= 0 && this.fuel < this.fuelMax) {
          this.fuel = Math.min(this.fuelMax, this.fuel + t.boostRegen * dt);
        }
      }
    }
    // bleed off over-speed once the rocket stops
    if (!this.boosting && vF > t.maxFwd) vF -= (vF - t.maxFwd) * 1.6 * dt;

    // ---------------- lateral grip ----------------
    const slipLoad = clamp((Math.abs(vL) - 130) / 220, 0, 1); // tyres let go when overloaded
    const targetGrip = hb ? t.gripHandbrake : t.gripNormal * (1 - 0.55 * slipLoad);
    // grip returns faster than it goes away
    const gripRate = targetGrip > this.grip ? 10 : 30;
    this.grip += (targetGrip - this.grip) * (1 - Math.exp(-gripRate * dt));
    vL *= Math.exp(-this.grip * dt);

    if (Math.abs(vF) > 3) this.lastDir = Math.sign(vF);

    // ---------------- steering ----------------
    const speedAbs = Math.abs(vF);
    const steerLimit = t.maxSteer / (1 + speedAbs / 320);
    const target = steerIn * steerLimit;
    const st = this.state.steeringAngle;
    const rate = steerIn !== 0 ? t.steerRate : t.steerReturn;
    const diff = target - st;
    this.state.steeringAngle = st + clamp(diff, -rate * dt, rate * dt);

    let vRef = vF;
    if (hb) vRef = vF + this.lastDir * Math.abs(vL) * 0.45; // keep rotating while sliding
    let yawTarget = (vRef / t.wheelBase) * Math.tan(this.state.steeringAngle);
    if (hb) yawTarget *= t.handbrakeOversteer;
    if (Math.abs(vF) < 6 && !hb) yawTarget *= Math.abs(vF) / 6;

    const w = (Body.getAngularVelocity(b) as number) * STEP_HZ;
    const nw = w + (yawTarget - w) * (1 - Math.exp(-t.yawResponse * dt));

    // ---------------- recompose ----------------
    // Note: heading used for recompose is the *current* one; the body rotates
    // during the step so the velocity vector lags behind → natural drift.
    vx = hx * vF + rx * vL;
    vy = hy * vF + ry * vL;

    if (!input.up && !input.down && !this.boosting && Math.hypot(vx, vy) < 4) {
      vx = 0;
      vy = 0;
    }

    Body.setVelocity(b, { x: vx / STEP_HZ, y: vy / STEP_HZ });
    Body.setAngularVelocity(b, nw / STEP_HZ);

    this.forwardSpeed = vF;
    this.lateralSpeed = vL;
    this.speed = Math.hypot(vx, vy);
    const rawDrift = clamp(Math.abs(vL) / 170, 0, 1);
    this.state.driftFactor += (rawDrift - this.state.driftFactor) * 0.25;
  }

  /** Current world-space velocity of the body in px/s (post physics step). */
  measure() {
    const b = this.state.body;
    const v = Body.getVelocity(b) as { x: number; y: number };
    this.speed = Math.hypot(v.x, v.y) * STEP_HZ;
    return { x: v.x * STEP_HZ, y: v.y * STEP_HZ };
  }
}
