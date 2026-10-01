import Phaser from 'phaser';
import { CAR_L, CAR_W } from './types';

/** Canvas oversampling for crisp cars; sprites are scaled by 1/TEX_SCALE. */
export const TEX_SCALE = 2;
const PAD = 14;

function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f >= 1) {
    const k = f - 1;
    r = r + (255 - r) * k;
    g = g + (255 - g) * k;
    b = b + (255 - b) * k;
  } else {
    r *= f;
    g *= f;
    b *= f;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export const carTexKey = (color: string, player = false) => `car_${player ? 'p_' : ''}${color}`;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draws a top-down supercar (nose → +x) into a canvas texture. */
export function ensureCarTexture(scene: Phaser.Scene, color: string, player = false): string {
  const key = carTexKey(color, player);
  if (scene.textures.exists(key)) return key;

  const W = (CAR_L + PAD * 2) * TEX_SCALE;
  const H = (CAR_W + PAD * 2) * TEX_SCALE;
  const tex = scene.textures.createCanvas(key, W, H)!;
  const ctx = tex.getContext();
  ctx.translate(W / 2, H / 2);
  ctx.scale(TEX_SCALE, TEX_SCALE);

  // soft ground shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 10 * TEX_SCALE;
  ctx.shadowOffsetY = 3 * TEX_SCALE;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  rr(ctx, -CAR_L / 2 + 4, -CAR_W / 2 + 3, CAR_L - 8, CAR_W - 6, 10);
  ctx.fill();
  ctx.restore();

  // wheels
  ctx.fillStyle = '#0b0b0d';
  for (const wx of [-31, 31]) {
    for (const wy of [-1, 1]) {
      rr(ctx, wx - 10, wy < 0 ? -CAR_W / 2 - 1.5 : CAR_W / 2 - 7, 20, 8.5, 3);
      ctx.fill();
    }
  }

  // body
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-42, -23);
    ctx.lineTo(18, -23);
    ctx.bezierCurveTo(37, -23, 50, -14, 50, -6);
    ctx.lineTo(50, 6);
    ctx.bezierCurveTo(50, 14, 37, 23, 18, 23);
    ctx.lineTo(-42, 23);
    ctx.quadraticCurveTo(-50, 23, -50, 14);
    ctx.lineTo(-50, -14);
    ctx.quadraticCurveTo(-50, -23, -42, -23);
    ctx.closePath();
  };
  const grad = ctx.createLinearGradient(0, -23, 0, 23);
  grad.addColorStop(0, shade(color, 0.7));
  grad.addColorStop(0.3, shade(color, 1.18));
  grad.addColorStop(0.55, shade(color, 1.05));
  grad.addColorStop(1, shade(color, 0.68));
  body();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.stroke();

  // hood vents + centre stripe
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, 26, -14, 12, 5, 2);
  ctx.fill();
  rr(ctx, 26, 9, 12, 5, 2);
  ctx.fill();
  if (player) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-46, -3, 92, 2.2);
    ctx.fillRect(-46, 0.8, 92, 2.2);
  }

  // windshield
  ctx.fillStyle = 'rgba(14,22,34,0.95)';
  ctx.beginPath();
  ctx.moveTo(23, -15.5);
  ctx.lineTo(6, -18);
  ctx.lineTo(6, 18);
  ctx.lineTo(23, 15.5);
  ctx.closePath();
  ctx.fill();
  // glare
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(21, -12);
  ctx.lineTo(10, -14);
  ctx.lineTo(10, -6);
  ctx.lineTo(19, -5);
  ctx.closePath();
  ctx.fill();

  // roof
  const roof = ctx.createLinearGradient(0, -17, 0, 17);
  roof.addColorStop(0, shade(color, 0.85));
  roof.addColorStop(0.5, shade(color, 1.12));
  roof.addColorStop(1, shade(color, 0.8));
  ctx.fillStyle = roof;
  rr(ctx, -20, -17, 26, 34, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // rear glass
  ctx.fillStyle = 'rgba(14,22,34,0.95)';
  ctx.beginPath();
  ctx.moveTo(-21, -15);
  ctx.lineTo(-33, -13);
  ctx.lineTo(-33, 13);
  ctx.lineTo(-21, 15);
  ctx.closePath();
  ctx.fill();

  // mirrors
  ctx.fillStyle = shade(color, 0.7);
  rr(ctx, 8, -27, 6, 4.5, 1.5);
  ctx.fill();
  rr(ctx, 8, 22.5, 6, 4.5, 1.5);
  ctx.fill();

  // spoiler
  ctx.fillStyle = '#111';
  rr(ctx, -50, -20, 6, 40, 2);
  ctx.fill();

  // headlights
  ctx.fillStyle = '#fff8cf';
  ctx.beginPath();
  ctx.moveTo(48, -11);
  ctx.lineTo(41, -17);
  ctx.lineTo(39, -12);
  ctx.lineTo(46, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(48, 11);
  ctx.lineTo(41, 17);
  ctx.lineTo(39, 12);
  ctx.lineTo(46, 6);
  ctx.closePath();
  ctx.fill();

  // tail lights
  ctx.fillStyle = '#ff2436';
  ctx.fillRect(-50, -18, 2.6, 10);
  ctx.fillRect(-50, 8, 2.6, 10);
  ctx.fillStyle = '#ff9aa4';
  ctx.fillRect(-50, -15, 1.4, 4);
  ctx.fillRect(-50, 11, 1.4, 4);

  tex.refresh();
  return key;
}

/** All small FX textures (smoke, sparks, flame, tyre mark, glow, pillar…). */
export function ensureFxTextures(scene: Phaser.Scene) {
  const t = scene.textures;

  const radial = (key: string, size: number, stops: [number, string][]) => {
    if (t.exists(key)) return;
    const c = t.createCanvas(key, size, size)!;
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    c.refresh();
  };

  radial('smoke', 48, [
    [0, 'rgba(235,235,235,0.9)'],
    [0.5, 'rgba(200,200,200,0.35)'],
    [1, 'rgba(180,180,180,0)'],
  ]);
  radial('flame', 40, [
    [0, 'rgba(255,255,230,1)'],
    [0.35, 'rgba(255,190,60,0.95)'],
    [0.7, 'rgba(255,80,20,0.5)'],
    [1, 'rgba(255,40,0,0)'],
  ]);
  radial('spark', 16, [
    [0, 'rgba(255,255,255,1)'],
    [0.5, 'rgba(255,230,120,0.9)'],
    [1, 'rgba(255,180,0,0)'],
  ]);
  radial('lightglow', 64, [
    [0, 'rgba(255,255,255,0.95)'],
    [0.4, 'rgba(255,255,255,0.35)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  radial('tirem', 8, [
    [0, 'rgba(8,8,8,0.9)'],
    [0.7, 'rgba(8,8,8,0.7)'],
    [1, 'rgba(8,8,8,0)'],
  ]);

  if (!t.exists('vignette')) {
    const w = 1280;
    const h = 720;
    const c = t.createCanvas('vignette', w, h)!;
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.68);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    c.refresh();
  }

  if (!t.exists('confetti')) {
    const c = t.createCanvas('confetti', 10, 6)!;
    const ctx = c.getContext();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 10, 6);
    c.refresh();
  }

  // neon underglow: blurred rounded rect (tinted at runtime)
  if (!t.exists('underglow')) {
    const w = CAR_L + 90;
    const h = CAR_W + 90;
    const c = t.createCanvas('underglow', w, h)!;
    const ctx = c.getContext();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 34;
    ctx.fillStyle = '#ffffff';
    rr(ctx, w / 2 - CAR_L / 2 + 6, h / 2 - CAR_W / 2 + 4, CAR_L - 12, CAR_W - 8, 14);
    ctx.fill();
    ctx.fill();
    c.refresh();
  }

  // concrete pillar with hazard ring
  if (!t.exists('pillar')) {
    const s = 96;
    const c = t.createCanvas('pillar', s, s)!;
    const ctx = c.getContext();
    ctx.translate(s / 2, s / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // hazard stripes
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.fillStyle = i % 2 ? '#111' : '#ffd21f';
      ctx.arc(0, 0, 38, (i / 16) * Math.PI * 2, ((i + 1) / 16) * Math.PI * 2);
      ctx.arc(0, 0, 30, ((i + 1) / 16) * Math.PI * 2, (i / 16) * Math.PI * 2, true);
      ctx.closePath();
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-8, -8, 2, 0, 0, 30);
    g.addColorStop(0, '#d9d9dc');
    g.addColorStop(1, '#8b8b90');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.fill();
    c.refresh();
  }
}
