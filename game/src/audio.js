// WebAudio synthesized effects: no audio files, everything is an oscillator
// or filtered noise burst. The context is created lazily on the first user
// gesture (browsers block audio before that). M toggles mute.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      try { this.ctx.resume(); } catch { /* headless: audio may stay suspended */ }
    }
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // A short tone with a pitch slide and an exponential decay.
  tone({ freq = 440, to = null, dur = 0.12, type = 'sine', vol = 0.5, delay = 0 }) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // A burst of filtered noise (hits, buzzes, stings).
  noise({ dur = 0.15, vol = 0.4, freq = 1200, q = 1, delay = 0 }) {
    if (this.muted || !this.ensure()) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  sting() {
    this.noise({ dur: 0.09, vol: 0.5, freq: 2600, q: 2 });
    this.tone({ freq: 880, to: 220, dur: 0.09, type: 'sawtooth', vol: 0.22 });
  }

  stingEmpty() {
    this.tone({ freq: 160, to: 110, dur: 0.08, type: 'square', vol: 0.18 });
  }

  kill(comboTier) {
    // Pitch climbs with the combo tier: a kill at x5 sounds brighter than x1.
    const base = 520 + comboTier * 60;
    this.tone({ freq: base, to: base * 1.6, dur: 0.1, type: 'triangle', vol: 0.4 });
    this.tone({ freq: base * 2, dur: 0.07, type: 'sine', vol: 0.18, delay: 0.03 });
  }

  pollen() {
    this.tone({ freq: 1046, dur: 0.1, type: 'sine', vol: 0.35 });
    this.tone({ freq: 1568, dur: 0.14, type: 'sine', vol: 0.3, delay: 0.06 });
  }

  hurt() {
    this.tone({ freq: 220, to: 55, dur: 0.28, type: 'square', vol: 0.4 });
    this.noise({ dur: 0.2, vol: 0.35, freq: 300, q: 0.8 });
  }

  hiveHeal() {
    this.tone({ freq: 523, dur: 0.12, type: 'sine', vol: 0.3 });
    this.tone({ freq: 659, dur: 0.12, type: 'sine', vol: 0.3, delay: 0.08 });
    this.tone({ freq: 784, dur: 0.2, type: 'sine', vol: 0.3, delay: 0.16 });
  }

  bossRoar() {
    this.tone({ freq: 180, to: 60, dur: 0.7, type: 'sawtooth', vol: 0.5 });
    this.noise({ dur: 0.6, vol: 0.3, freq: 220, q: 0.6 });
  }

  bossDie() {
    this.tone({ freq: 440, to: 880, dur: 0.25, type: 'triangle', vol: 0.4 });
    this.tone({ freq: 660, to: 1320, dur: 0.25, type: 'triangle', vol: 0.35, delay: 0.15 });
    this.noise({ dur: 0.4, vol: 0.3, freq: 900, q: 1 });
  }

  dayClear() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.35, delay: i * 0.09 }));
  }

  upgradePick() {
    this.tone({ freq: 784, dur: 0.1, type: 'triangle', vol: 0.35 });
    this.tone({ freq: 1175, dur: 0.18, type: 'triangle', vol: 0.35, delay: 0.07 });
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.28, type: 'triangle', vol: 0.35, delay: i * 0.16 }));
  }

  victory() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.35, delay: i * 0.11 }));
    this.tone({ freq: 2093, dur: 0.5, type: 'sine', vol: 0.25, delay: 0.7 });
  }

  click() {
    this.tone({ freq: 660, dur: 0.05, type: 'sine', vol: 0.25 });
  }
}
