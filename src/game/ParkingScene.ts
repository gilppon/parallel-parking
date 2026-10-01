import Phaser from 'phaser';
import { audio } from './AudioFx';
import { bridge } from './bridge';
import { formatPrice, LEVELS, SUPERCARS } from './levels';
import { ParkingSensorLogic, type ParkingReport } from './ParkingSensorLogic';
import { PhysicsCarController } from './PhysicsCarController';
import { poki } from './PokiService';
import { BUMPER_LEVELS, ROCKET_LEVELS, store } from './save';
import { ensureCarTexture, ensureFxTextures, TEX_SCALE } from './textures';
import {
  CAR_L,
  CAR_W,
  NEON_COLORS,
  PAINTS,
  WORLD_H,
  WORLD_W,
  type HudState,
  type InputState,
  type LevelDef,
  type MatterBody,
  type ParkedCarDef,
  type ResultPayload,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MBody: any = (Phaser.Physics.Matter as any).Matter.Body;

const STEP_MS = 1000 / 60;
const FONT = '"Black Han Sans", "Arial Black", "Apple SD Gothic Neo", sans-serif';

interface ParkedEntry {
  def: ParkedCarDef;
  body: MatterBody;
  sprite: Phaser.GameObjects.Image;
}

type Phase = HudState['phase'];

const CRASH_LINES = [
  'BEEP BEEP!! {car} is screaming bloody murder',
  'The owner of {car} watched the whole thing from the window…',
  'Alarm volume MAX! The whole block woke up',
  'The insurance adjuster has already arrived',
  'It was not the bumper that got scraped. It was your bank balance',
  '{car}: "So what just hit my front bumper…?"',
];
const PILLAR_LINES = [
  "You don't avoid pillars… you orbit them",
  'Concrete pillar wins! You lose!',
  'The pillar did not move first',
];
const TIME_LINES = [
  '⏰ TIME UP! TOW-AWAY NOTICE ISSUED!',
  '⏰ Missed the 10s cut… the tow truck is already rolling',
  '⏰ The car behind you honked so hard it got out to look',
];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsvToHex(h: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const q = 1 - f;
  const m = i % 6;
  const [r, g, b] = [
    [1, f, 0],
    [q, 1, 0],
    [0, 1, f],
    [0, q, 1],
    [f, 0, 1],
    [1, 0, q],
  ][m];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export class ParkingScene extends Phaser.Scene {
  private phase: Phase = 'idle';
  private paused = false;
  private levelIndex = 0;
  private level!: LevelDef;

  private car!: PhysicsCarController;
  private sensor!: ParkingSensorLogic;
  private report: ParkingReport | null = null;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private unsubs: (() => void)[] = [];

  private levelObjs: Phaser.GameObjects.GameObject[] = [];
  private levelBodies: MatterBody[] = [];
  private parked: ParkedEntry[] = [];

  private carSprite!: Phaser.GameObjects.Image;
  private glowSprite!: Phaser.GameObjects.Image;
  private lightGlows: Phaser.GameObjects.Image[] = [];
  private zoneGfx!: Phaser.GameObjects.Graphics;
  private zoneLabel!: Phaser.GameObjects.Text;
  private tireRT!: Phaser.GameObjects.RenderTexture;

  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private flame!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confetti!: Phaser.GameObjects.Particles.ParticleEmitter;

  private accumulator = 0;
  private timeLeft = 10;
  private lastTickSec = 99;
  private prevSpeed = 0;
  private bumperCharges = 0;
  private bumperMax = 0;
  private bumperThreshold = 0;
  private prevWheels: { x: number; y: number }[] | null = null;
  private hudAcc = 0;
  private restartToken = 0;
  private sessionFails = 0;
  private lastInput: InputState = { left: false, right: false, up: false, down: false, handbrake: false, boost: false };

  private pendingCrash: { body: MatterBody; x: number; y: number } | null = null;
  private pendingBounce: { nx: number; ny: number; speed: number; body: MatterBody; x: number; y: number } | null = null;

  constructor() {
    super('ParkingScene');
  }

  // ------------------------------------------------------------------ lifecycle
  create() {
    this.cameras.main.setBackgroundColor('#0b0d12');
    ensureFxTextures(this);
    this.buildEmitters();
    this.add.image(WORLD_W / 2, WORLD_H / 2, 'vignette').setDepth(20);

    const kb = this.input.keyboard!;
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE,SHIFT');
    this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,SHIFT,E,R,ENTER') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;

    this.matter.world.on('collisionstart', this.onCollision, this);

    this.unsubs.push(
      bridge.on('cmd:preview', (i) => this.loadLevel(i, 'idle')),
      bridge.on('cmd:start', (i) => this.startPlay(i)),
      bridge.on('cmd:restart', () => this.restartNow()),
      bridge.on('cmd:pause', (p) => {
        this.paused = p;
        if (p) audio.silenceDriving();
      }),
      bridge.on('cmd:loadout', () => this.refreshLoadout())
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
    });

    this.loadLevel(0, 'idle');
  }

  private buildEmitters() {
    this.smoke = this.add
      .particles(0, 0, 'smoke', {
        emitting: false,
        lifespan: { min: 450, max: 900 },
        speed: { min: 4, max: 22 },
        scale: { start: 0.35, end: 1.15 },
        alpha: { start: 0.42, end: 0 },
        rotate: { min: 0, max: 360 },
      })
      .setDepth(7);
    this.flame = this.add
      .particles(0, 0, 'flame', {
        emitting: false,
        lifespan: { min: 150, max: 280 },
        scale: { start: 0.9, end: 0.08 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
      })
      .setDepth(5);
    this.sparks = this.add
      .particles(0, 0, 'spark', {
        emitting: false,
        lifespan: { min: 250, max: 650 },
        speed: { min: 120, max: 460 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.2, end: 0 },
        blendMode: 'ADD',
      })
      .setDepth(8);
    this.confetti = this.add
      .particles(0, 0, 'confetti', {
        emitting: false,
        lifespan: 1900,
        speed: { min: 200, max: 560 },
        angle: { min: -155, max: -25 },
        gravityY: 460,
        rotate: { min: 0, max: 360 },
        scale: { start: 1.3, end: 0.8 },
        alpha: { start: 1, end: 0 },
        tint: [0xff2d75, 0x22e6ff, 0xffd400, 0x7dff2a, 0xffffff],
      })
      .setDepth(30);
  }

  // ------------------------------------------------------------------ level building
  private clearLevel() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.levelObjs.forEach((o) => o.destroy());
    this.levelObjs = [];
    this.lightGlows = [];
    this.levelBodies.forEach((b) => this.matter.world.remove(b));
    this.levelBodies = [];
    this.parked = [];
    this.pendingCrash = null;
    this.pendingBounce = null;
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.levelObjs.push(o);
    return o;
  }

  private loadLevel(index: number, mode: 'idle' | 'play') {
    this.restartToken++;
    this.clearLevel();
    this.levelIndex = Phaser.Math.Clamp(index, 0, LEVELS.length - 1);
    const lv = (this.level = LEVELS[this.levelIndex]);
    const save = store.get();

    this.drawBackground(lv);
    this.tireRT = this.track(this.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0, 0).setDepth(1));

    // zone
    this.zoneGfx = this.track(this.add.graphics().setDepth(2));
    this.zoneLabel = this.track(
      this.add
        .text(lv.zone.x, lv.zone.y, 'P', { fontFamily: FONT, fontSize: '46px', color: '#eaffef' })
        .setOrigin(0.5)
        .setAlpha(0.32)
        .setDepth(2)
    );

    // static walls (soft: thud only)
    lv.walls.forEach((w) => {
      const b = this.matter.add.rectangle(w.x, w.y, w.w, w.h, { isStatic: true, label: 'wall', friction: 0 });
      this.levelBodies.push(b);
    });

    // pillars (fatal)
    lv.pillars.forEach((p) => {
      const b = this.matter.add.circle(p.x, p.y, p.r, { isStatic: true, label: 'pillar', friction: 0 });
      this.levelBodies.push(b);
      const s = this.track(this.add.image(p.x, p.y, 'pillar').setDepth(5).setDisplaySize(p.r * 2.5, p.r * 2.5));
      void s;
    });

    // parked supercars (fatal)
    lv.parked.forEach((def) => {
      const key = ensureCarTexture(this, def.color);
      const sprite = this.track(
        this.add.image(def.x, def.y, key).setRotation(def.angle).setScale(1 / TEX_SCALE).setDepth(4)
      );
      const body = this.matter.add.rectangle(def.x, def.y, CAR_L, CAR_W, {
        isStatic: true,
        angle: def.angle,
        label: 'parked',
        chamfer: { radius: 8 },
        friction: 0,
      });
      (body as unknown as { carInfo: ParkedCarDef }).carInfo = def;
      this.levelBodies.push(body);
      this.parked.push({ def, body, sprite });
    });

    // player
    const rocket = ROCKET_LEVELS[save.rocket];
    const bump = BUMPER_LEVELS[save.bumper];
    this.bumperMax = bump?.charges ?? 0;
    this.bumperThreshold = bump?.threshold ?? 0;
    this.bumperCharges = this.bumperMax;

    const pbody = this.matter.add.rectangle(lv.start.x, lv.start.y, CAR_L, CAR_W, {
      label: 'player',
      chamfer: { radius: 8 },
      frictionAir: 0,
      friction: 0,
      frictionStatic: 0,
      restitution: 0.1,
      density: 0.004,
      angle: lv.start.angle,
    });
    this.levelBodies.push(pbody);
    this.car = new PhysicsCarController(pbody, rocket);
    this.car.reset(lv.start.x, lv.start.y, lv.start.angle);

    this.buildPlayerVisuals();

    this.sensor = new ParkingSensorLogic(lv.zone, {
      angleTolDeg: lv.angleTolDeg,
      holdTime: 0.8,
      maxSpeed: 16,
      tolPx: 1.5,
    });
    this.report = null;
    this.timeLeft = lv.timeLimit;
    this.lastTickSec = 99;
    this.prevSpeed = 0;
    this.prevWheels = null;
    this.accumulator = 0;
    this.phase = mode === 'play' ? 'ready' : 'idle';
    this.cameras.main.resetFX();
    this.syncVisuals(0);
    this.emitHud(true);
  }

  private buildPlayerVisuals() {
    const save = store.get();
    // Use the equipped supercar's colour as the default (paint overrides it)
    const car = SUPERCARS[save.carEquipped];
    const paint =
      PAINTS.find((p) => p.id === save.paint) ??
      PAINTS[0] ??
      { id: 'default', color: car?.color ?? '#ffffff' };
    const key = ensureCarTexture(this, paint.color ?? car?.color ?? '#ffffff', true);

    this.glowSprite = this.track(
      this.add
        .image(0, 0, 'underglow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(3)
        .setVisible(false)
    );
    this.carSprite = this.track(this.add.image(0, 0, key).setScale(1 / TEX_SCALE).setDepth(6));

    // head / tail light glows
    this.lightGlows = [];
    const defs: [number, number, number, number][] = [
      [47, -11, 0xfff2b0, 0.5],
      [47, 11, 0xfff2b0, 0.5],
      [-49, -12, 0xff2030, 0.0],
      [-49, 12, 0xff2030, 0.0],
    ];
    defs.forEach(([, , tint, a]) => {
      const g = this.track(
        this.add.image(0, 0, 'lightglow').setBlendMode(Phaser.BlendModes.ADD).setDepth(6.5).setTint(tint).setAlpha(a)
      );
      this.lightGlows.push(g);
    });
  }

  private refreshLoadout() {
    // re-apply paint/neon/rocket/bumper in idle previews
    if (this.phase === 'idle' || this.phase === 'ready') {
      this.loadLevel(this.levelIndex, this.phase === 'ready' ? 'play' : 'idle');
    }
  }

  private drawBackground(lv: LevelDef) {
    const g = this.track(this.add.graphics().setDepth(0));
    const garage = lv.theme === 'garage';
    const rnd = mulberry32(lv.id * 977 + 13);

    g.fillStyle(garage ? 0x34363c : 0x2a2e35, 1).fillRect(0, 0, WORLD_W, WORLD_H);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle(rnd() < 0.5 ? 0x000000 : 0xffffff, 0.025 + rnd() * 0.05);
      g.fillRect(rnd() * WORLD_W, rnd() * WORLD_H, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    // faint tar cracks
    g.lineStyle(1, 0x000000, 0.25);
    for (let i = 0; i < 10; i++) {
      let x = rnd() * WORLD_W;
      let y = 110 + rnd() * 400;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += (rnd() - 0.3) * 40;
        y += (rnd() - 0.5) * 30;
        g.lineTo(x, y);
      }
      g.strokePath();
    }

    const hasBottomCurb = lv.walls.some((w) => w.w > WORLD_W && w.y - w.h / 2 > 400 && w.y - w.h / 2 < 650);
    const topWall = lv.walls.find((w) => w.y < 120 && w.w > WORLD_W);
    const isBay = lv.zone.angle !== 0;

    // road markings
    if (!isBay) {
      const topEdge = lv.parked.some((p) => p.y < 200) ? 150 : 96;
      const mid = (topEdge + 499) / 2;
      g.fillStyle(garage ? 0xffffff : 0xffcf33, garage ? 0.16 : 0.32);
      for (let x = 30; x < WORLD_W; x += 90) g.fillRect(x, mid - 2, 46, 4);
      // lane line at parking edge
      g.fillStyle(0xffffff, 0.35).fillRect(0, 498, WORLD_W, 2);
      if (garage) {
        g.fillStyle(0xffffff, 0.13);
        for (let x = 220; x < WORLD_W; x += 300) {
          g.fillTriangle(x, mid - 30, x, mid + 30, x + 44, mid);
        }
      }
    } else {
      g.fillStyle(0xffffff, 0.3).fillRect(0, 210, WORLD_W, 2);
      g.fillStyle(0xffcf33, 0.22);
      for (let x = 30; x < WORLD_W; x += 90) g.fillRect(x, 452, 46, 4);
      if (garage) {
        g.fillStyle(0xffffff, 0.13);
        for (let x = 240; x < WORLD_W; x += 320) g.fillTriangle(x, 422, x, 484, x + 44, 453);
      }
    }

    // top wall (buildings)
    if (topWall) {
      const bottom = topWall.y + topWall.h / 2;
      g.fillStyle(garage ? 0x1f2126 : 0x181b23, 1).fillRect(0, 0, WORLD_W, bottom);
      for (let x = 0; x < WORLD_W; x += 96) {
        const shade = garage ? 0x272a31 : 0x20242f;
        g.fillStyle(shade, 1).fillRect(x + 3, 4, 90, bottom - 14);
        for (let wx = 0; wx < 2; wx++) {
          for (let wy = 0; wy < 2; wy++) {
            const lit = rnd() < 0.55;
            g.fillStyle(lit ? 0xffd88a : 0x0d0f14, lit ? 0.78 : 0.8);
            g.fillRect(x + 14 + wx * 40, 12 + wy * 34, 28, 20);
          }
        }
      }
      // sidewalk lip
      g.fillStyle(garage ? 0xffd21f : 0x8b909c, 1).fillRect(0, bottom - 8, WORLD_W, 8);
      if (garage) {
        g.fillStyle(0x111111, 1);
        for (let x = 0; x < WORLD_W; x += 40) g.fillRect(x, bottom - 8, 20, 8);
      }
      g.fillStyle(0x000000, 0.35).fillRect(0, bottom, WORLD_W, 4);
    }

    // bottom sidewalk / curb
    if (hasBottomCurb) {
      const top = 556;
      g.fillStyle(garage ? 0x4a4c55 : 0x7a7f8b, 1).fillRect(0, top, WORLD_W, WORLD_H - top);
      g.lineStyle(1, 0x000000, 0.14);
      for (let x = 0; x < WORLD_W; x += 64) g.lineBetween(x, top, x, WORLD_H);
      for (let y = top + 40; y < WORLD_H; y += 40) g.lineBetween(0, y, WORLD_W, y);
      g.fillStyle(garage ? 0xffd21f : 0xd0d4dc, 1).fillRect(0, top - 1, WORLD_W, 5);
      if (garage) {
        g.fillStyle(0x111111, 1);
        for (let x = 0; x < WORLD_W; x += 40) g.fillRect(x, top - 1, 20, 5);
      }
      g.fillStyle(0x000000, 0.35).fillRect(0, top + 4, WORLD_W, 5);
      // trees / planters
      if (!garage) {
        for (let x = 120; x < WORLD_W; x += 260) {
          g.fillStyle(0x000000, 0.3).fillCircle(x + 5, 640 + 6, 34);
          g.fillStyle(0x1b5e3a, 1).fillCircle(x, 640, 32);
          g.fillStyle(0x2f8f57, 1).fillCircle(x - 6, 634, 22);
          g.fillStyle(0x49b874, 0.8).fillCircle(x - 10, 630, 10);
        }
      } else {
        g.fillStyle(0xffffff, 0.5);
        for (let x = 60; x < WORLD_W; x += 260) g.fillRect(x, 640, 90, 6);
      }
    } else {
      // bay levels: lower area is drivable, add dark edge
      g.fillStyle(garage ? 0x1f2126 : 0x181b23, 1).fillRect(0, 700, WORLD_W, 20);
      g.fillStyle(garage ? 0xffd21f : 0x8b909c, 1).fillRect(0, 696, WORLD_W, 5);
    }

    // garage ceiling stripes
    if (garage) {
      g.fillStyle(0x000000, 0.12);
      for (let x = 0; x < WORLD_W; x += 160) g.fillRect(x, 0, 6, WORLD_H);
    }
  }

  // ------------------------------------------------------------------ input
  private readInput(): InputState {
    const k = this.keys;
    const t = bridge.touch;
    return {
      left: k.LEFT.isDown || k.A.isDown || t.left,
      right: k.RIGHT.isDown || k.D.isDown || t.right,
      up: k.UP.isDown || k.W.isDown || t.up,
      down: k.DOWN.isDown || k.S.isDown || t.down,
      handbrake: k.SPACE.isDown || t.handbrake,
      boost: k.SHIFT.isDown || k.E.isDown || t.boost,
    };
  }

  private anyInput(i: InputState) {
    return i.left || i.right || i.up || i.down || i.handbrake || i.boost;
  }

  // ------------------------------------------------------------------ flow control
  private startPlay(index: number) {
    poki.gameplayStop();
    this.loadLevel(index, 'play');
  }

  private restartNow() {
    if (this.phase === 'idle') return;
    poki.gameplayStop();
    this.loadLevel(this.levelIndex, 'play');
  }

  private beginRun() {
    this.phase = 'running';
    poki.gameplayStart();
    this.emitHud(true);
  }

  private async scheduleRestart(delayMs: number) {
    const token = ++this.restartToken;
    await new Promise<void>((resolve) => this.time.delayedCall(delayMs, () => resolve()));
    if (token !== this.restartToken) return;
    if (this.sessionFails > 0 && this.sessionFails % 4 === 0) {
      await poki.commercialBreak();
      if (token !== this.restartToken) return;
    }
    this.loadLevel(this.levelIndex, 'play');
  }

  // ------------------------------------------------------------------ collisions
  private onCollision(event: { pairs: unknown[] }) {
    if (this.phase !== 'running' && this.phase !== 'ready') return;
    const player = this.car.state.body;
    for (const raw of event.pairs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pair = raw as any;
      const A = pair.bodyA as MatterBody;
      const B = pair.bodyB as MatterBody;
      let other: MatterBody;
      if (A.label === 'player') other = B;
      else if (B.label === 'player') other = A;
      else continue;

      const supports = (pair.collision?.supports ?? []) as ({ x: number; y: number } | null)[];
      const sup = supports.find((s) => s && Number.isFinite(s.x)) ?? player.position;
      const cx = sup.x as number;
      const cy = sup.y as number;
      const speed = this.prevSpeed;

      if (other.label === 'wall') {
        if (speed > 70) {
          audio.bump(speed / 380);
          this.cameras.main.shake(80, 0.0018);
          this.sparks.explode(Math.min(8, Math.round(speed / 60)), cx, cy);
        }
        continue;
      }

      // fatal obstacle
      if (this.bumperCharges > 0 && speed < this.bumperThreshold) {
        if (!this.pendingBounce && !this.pendingCrash) {
          const nx = player.position.x - other.position.x;
          const ny = player.position.y - other.position.y;
          this.pendingBounce = { nx, ny, speed, body: other, x: cx, y: cy };
        }
      } else if (!this.pendingCrash) {
        this.pendingBounce = null;
        this.pendingCrash = { body: other, x: cx, y: cy };
      }
    }
  }

  private handlePending() {
    if (this.pendingCrash) {
      const c = this.pendingCrash;
      this.pendingCrash = null;
      this.pendingBounce = null;
      this.crash(c.body, c.x, c.y);
      return;
    }
    if (this.pendingBounce) {
      const p = this.pendingBounce;
      this.pendingBounce = null;
      const len = Math.hypot(p.nx, p.ny) || 1;
      const out = 140 + p.speed * 0.9;
      const body = this.car.state.body;
      MBody.setVelocity(body, { x: ((p.nx / len) * out) / 60, y: ((p.ny / len) * out) / 60 });
      MBody.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
      this.bumperCharges = Math.max(0, this.bumperCharges - 1);
      audio.springBumper();
      this.cameras.main.shake(120, 0.004);
      this.sparks.explode(10, p.x, p.y);
      this.popText(p.x, p.y - 20, 'BOING!', '#22e6ff');
      bridge.emit('banner', {
        id: Date.now(),
        text: `🌀 SPRING BUMPER! ${this.bumperCharges} left`,
        tone: 'info',
      });
      const ring = this.track(this.add.circle(p.x, p.y, 8).setStrokeStyle(4, 0x22e6ff).setDepth(9));
      this.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
      const entry = this.parked.find((e) => e.body === p.body);
      if (entry) this.wobble(entry.sprite, 4);
    }
  }

  private wobble(sprite: Phaser.GameObjects.Image, amp: number) {
    const x0 = sprite.x;
    this.tweens.add({
      targets: sprite,
      x: { from: x0 - amp, to: x0 + amp },
      duration: 45,
      yoyo: true,
      repeat: 7,
      onComplete: () => sprite.setX(x0),
    });
  }

  private popText(x: number, y: number, str: string, color: string) {
    const t = this.track(
      this.add
        .text(x, y, str, { fontFamily: FONT, fontSize: '38px', color, stroke: '#000000', strokeThickness: 7 })
        .setOrigin(0.5)
        .setDepth(25)
    );
    this.tweens.add({
      targets: t,
      y: y - 70,
      scale: { from: 0.6, to: 1.25 },
      alpha: { from: 1, to: 0 },
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private crash(other: MatterBody, x: number, y: number) {
    this.phase = 'fail';
    poki.gameplayStop();
    audio.silenceDriving();
    audio.alarm();
    this.sessionFails++;
    store.update((d) => ({ fails: d.fails + 1 }));

    const info = (other as unknown as { carInfo?: ParkedCarDef }).carInfo;
    let message: string;
    let bill: string | undefined;
    if (info) {
      message = pick(CRASH_LINES).replace('{car}', info.name);
      bill = `Repair bill ${formatPrice(info.price * 0.22)}!`;
    } else {
      message = pick(PILLAR_LINES);
      bill = 'Bumper repair $0.3M!';
    }

    const cam = this.cameras.main;
    cam.shake(520, 0.013);
    cam.flash(300, 255, 40, 40);
    this.sparks.explode(30, x, y);
    this.popText(x, y - 24, pick(['CRASH!!', 'BEEP BEEP!', 'BONK!!', 'AAGH!']), '#ff3b3b');
    this.startAlarmFlash(other);
    const entry = this.parked.find((e) => e.body === other);
    if (entry) this.wobble(entry.sprite, 5);

    const payload: ResultPayload = {
      kind: 'fail-crash',
      levelIndex: this.levelIndex,
      timeLeft: this.timeLeft,
      stars: 0,
      perfect: false,
      coins: 0,
      angleErrDeg: this.report?.angleErrDeg ?? 0,
      overflowCm: this.report?.overflowCm ?? 0,
      carName: info?.name ?? 'Concrete Pillar',
      bill,
      message,
      fails: this.sessionFails,
    };
    bridge.emit('result', payload);
    this.emitHud(true);
    void this.scheduleRestart(1700);
  }

  private startAlarmFlash(hit: MatterBody) {
    const near = this.parked.filter(
      (p) => Phaser.Math.Distance.Between(p.def.x, p.def.y, hit.position.x, hit.position.y) < 320
    );
    const glows: Phaser.GameObjects.Image[] = [];
    near.forEach((p) => {
      const c = Math.cos(p.def.angle);
      const s = Math.sin(p.def.angle);
      for (const [lx, ly] of [
        [46, -12],
        [46, 12],
        [-48, -13],
        [-48, 13],
      ]) {
        const g = this.track(
          this.add
            .image(p.def.x + lx * c - ly * s, p.def.y + lx * s + ly * c, 'lightglow')
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(6.4)
            .setTint(0xffa200)
            .setAlpha(0)
            .setScale(0.85)
        );
        glows.push(g);
      }
    });
    let n = 0;
    this.time.addEvent({
      delay: 110,
      repeat: 15,
      callback: () => {
        const on = n % 2 === 0;
        glows.forEach((g) => {
          g.setAlpha(on ? 1 : 0.05);
          g.setTint(n % 4 < 2 ? 0xffa200 : 0xffffff);
        });
        n++;
      },
    });
  }

  private timeUp() {
    this.phase = 'fail';
    poki.gameplayStop();
    audio.silenceDriving();
    audio.timeout();
    this.sessionFails++;
    store.update((d) => ({ fails: d.fails + 1 }));
    this.cameras.main.flash(300, 255, 180, 0);
    const b = this.car.state.body;
    this.popText(b.position.x, b.position.y - 40, 'TIME UP!', '#ffb020');
    bridge.emit('result', {
      kind: 'fail-time',
      levelIndex: this.levelIndex,
      timeLeft: 0,
      stars: 0,
      perfect: false,
      coins: 0,
      angleErrDeg: this.report?.angleErrDeg ?? 0,
      overflowCm: this.report?.overflowCm ?? 0,
      message: pick(TIME_LINES),
      fails: this.sessionFails,
    });
    this.emitHud(true);
    void this.scheduleRestart(1500);
  }

  private win() {
    this.phase = 'success';
    poki.gameplayStop();
    audio.silenceDriving();
    audio.success();
    this.car.state.isParkedCorrectly = true;
    const body = this.car.state.body;
    MBody.setVelocity(body, { x: 0, y: 0 });
    MBody.setAngularVelocity(body, 0);

    const lv = this.level;
    const r = this.report!;
    const tl = this.timeLeft;
    const stars = tl >= 5 ? 3 : tl >= 2.5 ? 2 : 1;
    const perfect = Math.abs(r.angleErrDeg) <= 1.5;
    const bonus = Math.round((1 - Math.min(1, Math.abs(r.angleErrDeg) / lv.angleTolDeg)) * 60);
    const coins = lv.reward + Math.round(tl * 20) + bonus + (perfect ? 50 : 0);

    store.update((d) => {
      const stars2 = d.stars.slice();
      stars2[this.levelIndex] = Math.max(stars2[this.levelIndex], stars);
      const best = d.best.slice();
      best[this.levelIndex] = Math.max(best[this.levelIndex] ?? 0, tl);
      return {
        coins: d.coins + coins,
        stars: stars2,
        best,
        unlocked: Math.max(d.unlocked, Math.min(LEVELS.length - 1, this.levelIndex + 1)),
        // Crash-free run this time → bump the PERFECT counter
        perfects: this.sessionFails === 0 ? d.perfects + 1 : d.perfects,
      };
    });

    const cam = this.cameras.main;
    cam.flash(260, 60, 255, 140);
    const cx = body.position.x;
    const cy = body.position.y;
    this.confetti.explode(60, cx, cy);
    this.time.delayedCall(180, () => this.confetti.explode(50, cx - 120, cy));
    this.time.delayedCall(320, () => this.confetti.explode(50, cx + 120, cy));
    this.popText(cx, cy - 30, perfect ? 'PERFECT!' : 'PARKED!', '#7dff2a');

    const payload: ResultPayload = {
      kind: 'success',
      levelIndex: this.levelIndex,
      timeLeft: tl,
      stars,
      perfect,
      coins,
      angleErrDeg: r.angleErrDeg,
      overflowCm: r.overflowCm,
      message: perfect ? 'Legendary valet! The angle looks ruler-straight' : 'Clean park! The supercar owner is applauding',
      fails: this.sessionFails,
    };
    this.emitHud(true);
    this.time.delayedCall(1100, () => bridge.emit('result', payload));
  }

  // ------------------------------------------------------------------ main loop
  update(_time: number, delta: number) {
    // restart shortcut
    if (Phaser.Input.Keyboard.JustDown(this.keys.R) && this.phase !== 'idle') this.restartNow();
    if (
      this.phase === 'fail' &&
      (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE))
    ) {
      this.restartNow();
    }

    if (!this.paused) {
      const input = this.readInput();
      this.lastInput = input;
      this.accumulator += Math.min(delta, 50);
      while (this.accumulator >= STEP_MS) {
        this.fixedStep(STEP_MS / 1000, input);
        this.accumulator -= STEP_MS;
      }
    }
    this.syncVisuals(_time);
    this.hudAcc += delta;
    if (this.hudAcc > 50) {
      this.hudAcc = 0;
      this.emitHud(false);
    }
  }

  private fixedStep(dt: number, input: InputState) {
    if (this.phase !== 'ready' && this.phase !== 'running') return;
    if (this.phase === 'ready' && this.anyInput(input)) this.beginRun();

    this.car.step(dt, input);
    this.prevSpeed = this.car.speed;
    this.matter.world.step(STEP_MS);
    this.handlePending();
    if (this.phase !== 'running' && this.phase !== 'ready') return;

    this.car.measure();
    const b = this.car.state.body;
    this.report = this.sensor.update(dt, b.position.x, b.position.y, b.angle, this.car.speed);

    if (this.phase === 'running') {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      const sec = Math.ceil(this.timeLeft);
      if (sec !== this.lastTickSec && sec <= 3 && sec > 0) {
        audio.tick(sec === 1);
      }
      this.lastTickSec = sec;
      if (this.report.parked) {
        this.win();
      } else if (this.timeLeft <= 0) {
        this.timeUp();
      }
    }
  }

  // ------------------------------------------------------------------ visuals
  private syncVisuals(time: number) {
    if (!this.car) return;
    const b = this.car.state.body;
    const x = b.position.x;
    const y = b.position.y;
    const a = b.angle;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const at = (lx: number, ly: number) => ({ x: x + lx * c - ly * s, y: y + lx * s + ly * c });

    this.carSprite.setPosition(x, y).setRotation(a);

    // neon underglow
    const save = store.get();
    const neon = NEON_COLORS[save.neon] ?? NEON_COLORS.none;
    if (neon.color === null) {
      this.glowSprite.setVisible(false);
    } else {
      const col = neon.color === 'rainbow' ? hsvToHex((time / 2200) % 1) : neon.color;
      this.glowSprite
        .setVisible(true)
        .setTint(col)
        .setPosition(x, y)
        .setRotation(a)
        .setAlpha(0.8 + 0.2 * Math.sin(time / 180));
    }

    // head / tail lights
    const braking = this.lastInput.down || this.lastInput.handbrake;
    const pts = [at(47, -11), at(47, 11), at(-49, -12), at(-49, 12)];
    this.lightGlows.forEach((g, i) => {
      g.setPosition(pts[i].x, pts[i].y);
      if (i >= 2) g.setAlpha(braking && (this.phase === 'running' || this.phase === 'ready') ? 0.95 : 0.0);
    });

    // drifting effects
    const running = this.phase === 'running' || this.phase === 'ready';
    const drift = this.car.state.driftFactor;
    const speed = this.car.speed;
    const drifting = running && drift > 0.3 && speed > 55;
    if (drifting) {
      const wheels = [at(-31, -18), at(-31, 18)];
      if (this.prevWheels) {
        let began = false;
        wheels.forEach((w, i) => {
          const p0 = this.prevWheels![i];
          const d = Math.hypot(w.x - p0.x, w.y - p0.y);
          if (d > 0.5 && d < 60) {
            if (!began) {
              this.tireRT.beginDraw();
              began = true;
            }
            const n = Math.ceil(d / 2.5);
            for (let k = 1; k <= n; k++) {
              const t = k / n;
              this.tireRT.batchDraw('tirem', p0.x + (w.x - p0.x) * t - 4, p0.y + (w.y - p0.y) * t - 4, 0.3);
            }
          }
        });
        if (began) this.tireRT.endDraw();
      }
      this.prevWheels = wheels;
      if (Math.random() < 0.7) {
        wheels.forEach((w) => this.smoke.emitParticleAt(w.x, w.y, 1));
      }
    } else {
      this.prevWheels = null;
    }

    // rocket flame
    if (running && this.car.boosting) {
      const tail = at(-54, 0);
      for (let i = 0; i < 3; i++) {
        const p = this.flame.emitParticleAt(tail.x + (Math.random() - 0.5) * 6, tail.y + (Math.random() - 0.5) * 6, 1);
        if (p) {
          const sp = 220 + Math.random() * 160;
          p.velocityX = -c * sp + (Math.random() - 0.5) * 60;
          p.velocityY = -s * sp + (Math.random() - 0.5) * 60;
        }
      }
      if (Math.random() < 0.5) this.smoke.emitParticleAt(tail.x, tail.y, 1);
    }

    this.drawZone(time);

    // audio
    audio.updateDriving(
      speed / 400,
      this.lastInput.up ? 1 : 0,
      drift,
      this.car.boosting,
      running && !this.paused
    );
  }

  private drawZone(time: number) {
    const g = this.zoneGfx;
    if (!g) return;
    g.clear();
    const z = this.level.zone;
    const r = this.report;
    const pulse = 0.5 + 0.5 * Math.sin(time / 260);
    let col = 0x38ff7a;
    let fillA = 0.14 + pulse * 0.08;
    let hold = 0;
    if (r) {
      hold = r.holdProgress;
      if (r.inside && r.aligned) {
        col = 0x9dff3a;
        fillA = 0.3 + hold * 0.4;
      } else if (r.inside) {
        col = 0xffd21f;
        fillA = 0.26;
      }
    }
    const c = Math.cos(z.angle);
    const s = Math.sin(z.angle);
    const pts = (
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as [number, number][]
    ).map(([sx, sy]) => {
      const lx = (sx * z.w) / 2;
      const ly = (sy * z.h) / 2;
      return { x: z.x + lx * c - ly * s, y: z.y + lx * s + ly * c };
    });
    g.fillStyle(col, fillA).fillPoints(pts, true);
    g.lineStyle(3, col, 0.55 + pulse * 0.4).strokePoints(pts, true);
    // corner ticks
    g.lineStyle(5, col, 1);
    pts.forEach((p, i) => {
      const n = pts[(i + 1) % 4];
      const pr = pts[(i + 3) % 4];
      const l1 = Math.hypot(n.x - p.x, n.y - p.y) || 1;
      const l2 = Math.hypot(pr.x - p.x, pr.y - p.y) || 1;
      const k = 16;
      g.beginPath();
      g.moveTo(p.x + ((n.x - p.x) / l1) * k, p.y + ((n.y - p.y) / l1) * k);
      g.lineTo(p.x, p.y);
      g.lineTo(p.x + ((pr.x - p.x) / l2) * k, p.y + ((pr.y - p.y) / l2) * k);
      g.strokePath();
    });
    if (hold > 0) {
      g.lineStyle(6, 0xffffff, hold);
      g.strokePoints(pts, true);
    }
    this.zoneLabel.setAlpha(this.report?.inside ? 0.12 : 0.3 + pulse * 0.15);
  }

  private emitHud(_force: boolean) {
    if (!this.car) return;
    const r = this.report;
    const hud: HudState = {
      phase: this.phase,
      timeLeft: this.timeLeft,
      timeLimit: this.level.timeLimit,
      speedKmh: this.car.speed * 0.162,
      drift: this.car.state.driftFactor,
      fuel: this.car.fuel,
      fuelMax: this.car.fuelMax,
      hasRocket: this.car.fuelMax > 0,
      bumperCharges: this.bumperCharges,
      bumperMax: this.bumperMax,
      parkProgress: r?.holdProgress ?? 0,
      inZone: r?.inside ?? false,
      aligned: r?.aligned ?? false,
      overflowCm: r?.overflowCm ?? 0,
      angleErrDeg: r?.angleErrDeg ?? 0,
      levelIndex: this.levelIndex,
    };
    bridge.emit('hud', hud);
  }
}
