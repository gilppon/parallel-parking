/**
 * Procedural WebAudio sound engine – no asset files needed.
 * Engine hum, tyre screech, rocket whoosh, and (most importantly) the
 * ridiculously over-the-top car alarm.
 */
class AudioFx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private screechGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private boostOsc: OscillatorNode | null = null;

  muted = false;
  private adMuted = false;

  /** Must be invoked from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted || this.adMuted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);

    // white noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.buildContinuous();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyMaster();
  }

  setAdMuted(m: boolean) {
    this.adMuted = m;
    this.applyMaster();
  }

  // ---- Background music: neon night-drive groove, no assets ----
  // Reuses tone(), which already routes through master (muted/adMuted-safe).
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

  /** Idempotent. Call from a user gesture; AudioContext requires one. */
  startMusic() {
    this.unlock();
    if (!this.ctx || !this.master) return;
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
    }
    if (this.musicTimer !== null) return;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.musicTick(), 150);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private musicTick() {
    // Never schedule while muted, ad-muted, hidden, or suspended; tails fade.
    if (this.muted || this.adMuted || document.hidden || !this.musicGain) return;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const dest = this.musicGain;
    const s = this.musicStep++ % 32;
    // Driving 16th-note bassline in A minor, sawtooth and low.
    const bass = [55.0, 55.0, 55.0, 65.41, 55.0, 55.0, 82.41, 65.41,
      55.0, 55.0, 55.0, 65.41, 73.42, 65.41, 55.0, 49.0];
    const b = bass[s % 16];
    if (b !== undefined) this.tone('sawtooth', b, b, 0, 0.13, 0.05, dest);
    // Neon arp lead every other step, two octaves up.
    if (s % 2 === 0) {
      const arp = [440.0, 523.25, 659.25, 880.0, 659.25, 523.25, 587.33, 659.25];
      const f = arp[(s >> 1) % 8];
      if (f !== undefined) this.tone('square', f, f, 0, 0.11, 0.028, dest);
    }
    // Sparkle octave on each bar start.
    if (s % 16 === 0) this.tone('sine', 880.0, 880.0, 0, 0.3, 0.03, dest);
  }

  private applyMaster() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted || this.adMuted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    }
  }

  private noiseSource(loop = true) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    return src;
  }

  private buildContinuous() {
    const ctx = this.ctx!;
    // engine
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master!);
    this.engineOsc1.start();
    this.engineOsc2.start();

    // screech
    const sn = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 6;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    sn.connect(bp);
    bp.connect(this.screechGain);
    this.screechGain.connect(this.master!);
    sn.start();

    // booster
    const bn = this.noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0;
    bn.connect(lp);
    this.boostOsc = ctx.createOscillator();
    this.boostOsc.type = 'sawtooth';
    this.boostOsc.frequency.value = 70;
    const og = ctx.createGain();
    og.gain.value = 0.35;
    this.boostOsc.connect(og);
    og.connect(lp);
    lp.connect(this.boostGain);
    this.boostGain.connect(this.master!);
    bn.start();
    this.boostOsc.start();
  }

  /** speedNorm 0..1+, throttle 0..1 */
  updateDriving(speedNorm: number, throttle: number, drift: number, boosting: boolean, active: boolean) {
    if (!this.ctx || !this.engineGain) return;
    const t = this.ctx.currentTime;
    const f = 48 + speedNorm * 120 + throttle * 26 + (boosting ? 40 : 0);
    this.engineOsc1!.frequency.setTargetAtTime(f, t, 0.05);
    this.engineOsc2!.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engineFilter!.frequency.setTargetAtTime(340 + speedNorm * 700 + throttle * 300, t, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.1 + throttle * 0.05 + speedNorm * 0.05 : 0, t, 0.08);
    this.screechGain!.gain.setTargetAtTime(active ? Math.min(0.2, Math.max(0, drift - 0.18) * 0.32) : 0, t, 0.04);
    this.boostGain!.gain.setTargetAtTime(active && boosting ? 0.32 : 0, t, 0.05);
    this.boostOsc!.frequency.setTargetAtTime(boosting ? 90 : 60, t, 0.1);
  }

  silenceDriving() {
    this.updateDriving(0, 0, 0, false, false);
  }

  // ---------------------- one shots ----------------------
  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    start: number,
    dur: number,
    vol: number,
    dest?: AudioNode
  ) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest ?? this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noiseBurst(start: number, dur: number, freq: number, vol: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + start;
    const src = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** purchase / unlock success chime */
  buy() {
    this.coin();
    this.tone('square', 880, 1320, 0.1, 0.06, 0.12);
  }

  click() {
    this.tone('square', 660, 880, 0, 0.06, 0.08);
  }

  coin() {
    this.tone('square', 988, 988, 0, 0.07, 0.09);
    this.tone('square', 1319, 1319, 0.07, 0.16, 0.09);
  }

  deny() {
    this.tone('sawtooth', 200, 120, 0, 0.18, 0.12);
  }

  tick(urgent: boolean) {
    this.tone('square', urgent ? 1100 : 780, urgent ? 1100 : 780, 0, 0.06, urgent ? 0.11 : 0.06);
  }

  bump(intensity: number) {
    const v = Math.min(1, Math.max(0.15, intensity));
    this.noiseBurst(0, 0.16, 420, 0.5 * v);
    this.tone('sine', 140, 50, 0, 0.18, 0.4 * v);
  }

  boing() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t0);
    o.frequency.exponentialRampToValueAtTime(520, t0 + 0.08);
    o.frequency.exponentialRampToValueAtTime(220, t0 + 0.5);
    lfo.frequency.value = 26;
    lg.gain.value = 60;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    o.connect(g);
    g.connect(this.master!);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 0.6);
    lfo.stop(t0 + 0.6);
  }

  honk(start = 0, dur = 0.22) {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    g.connect(this.master!);
    this.tone('sawtooth', 392, 392, start, dur, 0.17, g);
    this.tone('sawtooth', 494, 494, start, dur, 0.17, g);
  }

  /** The ridiculous alarm: cartoon boing + honks + wailing siren + falling slide-whistle. */
  alarm() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    this.boing();
    this.noiseBurst(0, 0.25, 700, 0.6);

    // siren with a tinny filter
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.8;
    const sg = ctx.createGain();
    sg.gain.value = 0.9;
    bp.connect(sg);
    sg.connect(this.master!);

    const t0 = ctx.currentTime + 0.12;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    let t = t0;
    let hi = false;
    while (t < t0 + 1.5) {
      o.frequency.setValueAtTime(hi ? 1180 : 640, t);
      o.frequency.linearRampToValueAtTime(hi ? 640 : 1180, t + 0.14);
      hi = !hi;
      t += 0.14;
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.03);
    g.gain.setValueAtTime(0.22, t0 + 1.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.55);
    o.connect(g);
    g.connect(bp);
    o.start(t0);
    o.stop(t0 + 1.6);

    // honks
    this.honk(0.15, 0.2);
    this.honk(0.45, 0.2);
    this.honk(0.75, 0.32);
    // sad slide whistle
    this.tone('sine', 1900, 180, 1.05, 0.55, 0.2);
  }

  timeout() {
    this.tone('sawtooth', 320, 300, 0, 0.3, 0.16);
    this.tone('sawtooth', 240, 200, 0.32, 0.5, 0.16);
    this.tone('sine', 900, 120, 0.8, 0.5, 0.15);
  }

  success() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => {
      this.tone('square', n, n, i * 0.09, 0.22, 0.09);
      this.tone('triangle', n * 2, n * 2, i * 0.09, 0.22, 0.05);
    });
    this.honk(0.5, 0.12);
    this.honk(0.68, 0.3);
  }

  rocketIgnite() {
    this.noiseBurst(0, 0.5, 2400, 0.35);
  }

  springBumper() {
    this.boing();
    this.tone('triangle', 300, 700, 0, 0.15, 0.2);
  }
}

export const audio = new AudioFx();
