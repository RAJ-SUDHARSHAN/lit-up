/**
 * Sound effects, fully synthesized via Web Audio API. No asset files,
 * no network fetch — every clip is a few oscillators and an envelope.
 *
 * Why synthesized? It keeps the bundle tiny, removes audio licensing
 * concerns, and lets the game work fully offline. The aesthetic ends
 * up clean and slightly synth-y, which suits the minimal table look.
 *
 * The mute state is reactive (Svelte 5 rune) and persisted to
 * localStorage so the player's choice survives a reload.
 */

const STORAGE_KEY = "lit-up:muted";

export type SoundName =
  | "deal"      // game just started, cards being dealt
  | "ask"       // you clicked a card to send an ask
  | "success"   // an ask succeeded (any player)
  | "fail"      // an ask failed (any player)
  | "declare"   // a set was declared
  | "turn"      // your turn just started
  | "win";      // game ended with a winner

class SoundEngine {
  private ctx: AudioContext | null = null;

  /** Reactive mute state. Components read `sound.muted` to drive the icon. */
  muted = $state<boolean>(readPersistedMute());

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(STORAGE_KEY, m ? "1" : "0");
    } catch {
      // Storage may be disabled; the state still applies for this session.
    }
    if (m && this.ctx) {
      // Drop scheduled events on mute-down.
      try { this.ctx.suspend(); } catch { /* ignore */ }
    } else if (!m && this.ctx?.state === "suspended") {
      try { this.ctx.resume(); } catch { /* ignore */ }
    }
  }

  toggle(): void {
    this.setMuted(!this.muted);
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (name) {
      case "deal":    this.deal(ctx, t); break;
      case "ask":     this.ask(ctx, t); break;
      case "success": this.success(ctx, t); break;
      case "fail":    this.fail(ctx, t); break;
      case "declare": this.declare(ctx, t); break;
      case "turn":    this.turn(ctx, t); break;
      case "win":     this.win(ctx, t); break;
    }
  }

  // ── Lifecycle ────────────────────────────────────────────

  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        const Klass = window.AudioContext
          ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Klass) return null;
        this.ctx = new Klass();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      // Browsers require a user gesture before allowing audio. The first
      // play attempt after a click resumes the context.
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  // ── Helpers ──────────────────────────────────────────────

  /**
   * Schedule a single oscillator with an ADSR-ish envelope. Returns when
   * the sound completes so callers can chain.
   */
  private tone(
    ctx: AudioContext,
    start: number,
    freq: number,
    duration: number,
    type: OscillatorType = "sine",
    peak = 0.18,
    glide?: number,
  ): number {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glide !== undefined) {
      o.frequency.exponentialRampToValueAtTime(glide, start + duration);
    }

    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + duration + 0.05);
    return start + duration;
  }

  /** Filtered white-noise burst, useful for "card whoosh" textures. */
  private noise(
    ctx: AudioContext,
    start: number,
    duration: number,
    centerFreq = 3000,
    peak = 0.12,
  ): void {
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = centerFreq;
    filter.Q.value = 1.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  // ── Individual sounds ────────────────────────────────────

  /** "Deal" — three short whooshes simulating a riffle. */
  private deal(ctx: AudioContext, t: number): void {
    for (let i = 0; i < 3; i++) {
      this.noise(ctx, t + i * 0.09, 0.08, 2200 + i * 400, 0.14);
    }
  }

  /** "Ask" — soft upward blip when the player picks a card. */
  private ask(ctx: AudioContext, t: number): void {
    this.tone(ctx, t, 440, 0.09, "sine", 0.12, 660);
  }

  /** "Success" — bright C-E-G arpeggio. */
  private success(ctx: AudioContext, t: number): void {
    const freqs = [523.25, 659.25, 783.99]; // C5 E5 G5
    freqs.forEach((f, i) => this.tone(ctx, t + i * 0.06, f, 0.22, "sine", 0.16));
  }

  /** "Fail" — descending sawtooth thud. */
  private fail(ctx: AudioContext, t: number): void {
    this.tone(ctx, t, 220, 0.32, "sawtooth", 0.14, 110);
  }

  /** "Declare" — short fanfare; major triad + a fifth on top. */
  private declare(ctx: AudioContext, t: number): void {
    this.tone(ctx, t,        523.25, 0.55, "triangle", 0.14); // C5
    this.tone(ctx, t,        659.25, 0.55, "triangle", 0.10); // E5
    this.tone(ctx, t,        783.99, 0.55, "triangle", 0.08); // G5
    this.tone(ctx, t + 0.18, 1046.5, 0.45, "triangle", 0.10); // C6 flourish
  }

  /** "Turn" — gentle bell, two harmonics. */
  private turn(ctx: AudioContext, t: number): void {
    this.tone(ctx, t, 880, 0.45, "sine", 0.12);
    this.tone(ctx, t, 1320, 0.4, "sine", 0.06);
  }

  /** "Win" — short ascending melody. */
  private win(ctx: AudioContext, t: number): void {
    const melody = [
      [523.25, 0.18], // C5
      [659.25, 0.18], // E5
      [783.99, 0.18], // G5
      [1046.5, 0.42], // C6 hold
    ] as const;
    let cursor = t;
    for (const [f, dur] of melody) {
      this.tone(ctx, cursor, f, dur + 0.05, "triangle", 0.16);
      cursor += dur;
    }
  }
}

function readPersistedMute(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export const sound = new SoundEngine();
