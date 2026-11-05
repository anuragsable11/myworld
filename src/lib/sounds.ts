/**
 * Cartoon sound effects, synthesised with the Web Audio API: nothing to download or license, and
 * they play on the audio thread, so they never hold up the globe. Browsers only allow sound after a
 * tap, so the audio context starts (or wakes up again) on taps. Sounds can be turned off with the
 * speaker button or in the About dialog.
 */

const KEY = 'atlas:sound';

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();
const listeners = new Set<() => void>();

export const soundEnabled = () => enabled;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // The choice simply isn't remembered.
  }
  listeners.forEach((fn) => fn());
}

export function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let audio: AudioContext | null = null;
let output: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let reverb: GainNode | null = null;

/** Sets up the audio output (suspended until a touch or key press lets it play). */
function create(): AudioContext | null {
  if (!audio) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    try {
      audio = new Context();
    } catch {
      return null;
    }
    output = audio.createGain();
    output.gain.value = 0.55;
    // A gentle compressor glues layered sounds together and keeps loud moments from clipping.
    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 10;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    output.connect(compressor);
    compressor.connect(audio.destination);
  }
  return audio;
}

/** A small room for sounds that should ring: a convolver fed with fading noise, built once. */
function reverbBus(c: AudioContext): AudioNode {
  if (!reverb) {
    const length = Math.round(c.sampleRate * 1.4);
    const impulse = c.createBuffer(2, length, c.sampleRate);
    const fade = Math.pow(0.001, 1 / length); // down to -60 dB by the end
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      let level = 1;
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * level;
        level *= fade;
      }
    }
    const convolver = c.createConvolver();
    convolver.buffer = impulse;
    reverb = c.createGain();
    reverb.gain.value = 0.9;
    reverb.connect(convolver);
    convolver.connect(output!);
  }
  return reverb;
}

function wake(): AudioContext | null {
  const context = create();
  if (context && context.state !== 'running') Promise.resolve(context.resume()).catch(() => {});
  return context;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    if (enabled) wake();
  };
  // Touches only count as permission to play once the finger lifts.
  for (const type of ['pointerdown', 'pointerup', 'keydown'] as const) window.addEventListener(type, unlock, { capture: true, passive: true });

  // Setting up audio holds the main thread for tens of milliseconds on a phone. Do it once the page
  // has settled rather than at the first touch, where it would stall whatever that touch starts (a
  // drag of the globe, the sheet sliding up). Only on touch screens: desktops are quick, and some
  // desktop browsers flag audio that's set up before a click.
  const prepare = () => {
    const idle = (window as unknown as { requestIdleCallback?: (fn: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    const run = () => {
      if (!enabled || document.hidden) return;
      const context = create();
      if (context) reverbBus(context);
    };
    window.setTimeout(() => (idle ? idle(run, { timeout: 3000 }) : run()), 1500);
  };
  if (window.matchMedia?.('(pointer: coarse)').matches) {
    if (document.readyState === 'complete') prepare();
    else window.addEventListener('load', prepare, { once: true });
  }
}

/**
 * The context to play on, or null for silence. Sounds that answer a tap may wake the context;
 * sounds started by an animation only play once it's already running, so they never pile up
 * waiting for permission and then all play at once.
 */
function ready(fromTap: boolean): AudioContext | null {
  if (!enabled || document.hidden) return null;
  const context = fromTap ? wake() : audio;
  return context && (fromTap || context.state === 'running') ? context : null;
}

interface ToneOptions {
  freq: number;
  /** Glides to this pitch. */
  to?: number;
  type?: OscillatorType;
  at?: number;
  attack?: number;
  decay?: number;
  gain?: number;
  /** How much of it rings in the room (0–1). */
  wet?: number;
  /** A low-pass filter closing from one frequency to another: softer, warmer notes. */
  lowpass?: [number, number];
}

function send(c: AudioContext, from: AudioNode, wet: number) {
  if (wet <= 0) return;
  const amount = c.createGain();
  amount.gain.value = wet;
  from.connect(amount);
  amount.connect(reverbBus(c));
}

function tone(c: AudioContext, { freq, to, type = 'sine', at = 0, attack = 0.005, decay = 0.15, gain = 0.2, wet = 0, lowpass }: ToneOptions) {
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  let last: AudioNode = osc;
  if (lowpass) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(lowpass[0], t);
    filter.frequency.exponentialRampToValueAtTime(lowpass[1], t + attack + decay);
    osc.connect(filter);
    last = filter;
  }
  last.connect(env);
  env.connect(output!);
  send(c, env, wet);
  osc.start(t);
  osc.stop(t + attack + decay + 0.03);
}

/** Filtered noise, its pitch sweeping from one frequency to another: whooshes, thuds and rumbles. */
function noise(
  c: AudioContext,
  {
    duration,
    from,
    to,
    gain,
    q = 0.8,
    at = 0,
    kind = 'bandpass',
    wet = 0,
  }: { duration: number; from: number; to: number; gain: number; q?: number; at?: number; kind?: BiquadFilterType; wet?: number },
) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, Math.round(c.sampleRate * 1.2), c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const source = c.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = kind;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + duration);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + duration * 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(filter);
  filter.connect(env);
  env.connect(output!);
  send(c, env, wet);
  source.start(t);
  source.stop(t + duration + 0.03);
}

/** Musical notes, in Hz. */
const NOTE = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
  C7: 2093,
} as const;

/** A bell: a few inharmonic partials fading at different speeds, ringing in the room. */
function bell(c: AudioContext, freq: number, { at = 0, decay = 0.6, gain = 0.12, wet = 0.3 } = {}) {
  (
    [
      [1, 1],
      [2, 0.3],
      [2.76, 0.16],
      [5.4, 0.05],
    ] as const
  ).forEach(([ratio, level], i) => tone(c, { freq: freq * ratio, at, attack: 0.003, decay: decay / (1 + i * 0.9), gain: gain * level, wet }));
}

/** A bright, brassy note for fanfares. */
function horn(c: AudioContext, freq: number, { at = 0, decay = 0.3, gain = 0.07, wet = 0.25 } = {}) {
  tone(c, { freq, type: 'sawtooth', at, attack: 0.025, decay, gain, lowpass: [2600, 900], wet });
  tone(c, { freq: freq * 1.005, type: 'square', at, attack: 0.025, decay, gain: gain * 0.35, lowpass: [1800, 700], wet });
}

/** The quiz's four answers each have their own note. */
const ANSWER_NOTES = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5];

/** One click of a prize wheel; the pitch varies a little so a run of them sounds lively. */
function click(c: AudioContext, at = 0) {
  tone(c, { freq: 1500 + Math.random() * 350, to: 950, type: 'triangle', at, attack: 0.002, decay: 0.035, gain: 0.08 });
}

export const sounds = {
  /** A soft pop for buttons and tabs. */
  pop() {
    const c = ready(true);
    if (c) tone(c, { freq: 430, to: 860, decay: 0.08, gain: 0.16 });
  },
  /** Choosing a country: a bright two-note boop. */
  select() {
    const c = ready(true);
    if (!c) return;
    tone(c, { freq: 660, type: 'triangle', decay: 0.09, gain: 0.14 });
    tone(c, { freq: 990, type: 'triangle', at: 0.07, decay: 0.15, gain: 0.14 });
  },
  /** One notch of the globe turning under a finger or in a shuffle. */
  tick() {
    const c = ready(false);
    if (c) click(c);
  },
  /** A shuffle setting off. */
  whoosh() {
    const c = ready(true);
    if (c) noise(c, { duration: 0.5, from: 300, to: 2400, gain: 0.22 });
  },
  /** A shuffle on the flat map: clicks that slow down, like a rolled dice (matches haptics.roll). */
  roll() {
    const c = ready(true);
    if (c) [0, 0.116, 0.252, 0.428, 0.664].forEach((at) => click(c, at));
  },
  /** Landing on a country: a cheerful rising chime. */
  land() {
    const c = ready(false);
    if (!c) return;
    [784, 1047, 1319].forEach((freq, i) => {
      tone(c, { freq, type: 'triangle', at: i * 0.075, decay: 0.42, gain: 0.13 });
      tone(c, { freq: freq * 2, at: i * 0.075, decay: 0.25, gain: 0.04 });
    });
  },
  /** Choosing one of the quiz's answers: a soft pluck, each answer its own note. */
  option(index: number) {
    const c = ready(true);
    if (!c) return;
    const f = ANSWER_NOTES[index % ANSWER_NOTES.length];
    tone(c, { freq: f * 1.5, to: f, attack: 0.004, decay: 0.16, gain: 0.16, wet: 0.12 });
    tone(c, { freq: f * 3, type: 'triangle', attack: 0.002, decay: 0.05, gain: 0.03 });
  },
  /** A right answer: two bright bells and a sparkle. Each answer in a row rings a little higher. */
  correct(streak = 1) {
    const c = ready(true);
    if (!c) return;
    const lift = Math.pow(2, Math.min(Math.max(streak - 1, 0), 7) / 12);
    bell(c, NOTE.C6 * lift, { decay: 0.4, gain: 0.14, wet: 0.25 });
    bell(c, NOTE.G6 * lift, { at: 0.09, decay: 0.85, gain: 0.15, wet: 0.35 });
    for (let i = 0; i < 6; i++) tone(c, { freq: 2800 + Math.random() * 2000, at: 0.14 + i * 0.04, attack: 0.002, decay: 0.07, gain: 0.025, wet: 0.5 });
  },
  /** A wrong answer: a soft "womp womp" over a muffled thud. */
  wrong() {
    const c = ready(true);
    if (!c) return;
    noise(c, { duration: 0.16, from: 260, to: 90, gain: 0.3, kind: 'lowpass', q: 0.6 });
    (
      [
        [247, 220, 0, 0.2],
        [196, 147, 0.22, 0.42],
      ] as const
    ).forEach(([freq, to, at, decay]) => {
      tone(c, { freq, to, type: 'sawtooth', at, attack: 0.02, decay, gain: 0.07, lowpass: [1400, 300] });
      tone(c, { freq, to, type: 'triangle', at, attack: 0.02, decay, gain: 0.12 });
    });
  },
  /** Three or more right in a row: a quick run of rising bells after the chime. */
  combo(streak: number) {
    const c = ready(true);
    if (!c) return;
    [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].slice(0, Math.min(4, streak - 1)).forEach((f, i) => bell(c, f, { at: 0.35 + i * 0.07, decay: 0.35, gain: 0.08, wet: 0.4 }));
  },
  /** A new level: a whoosh, a rising bell arpeggio and a ringing chord. */
  levelUp() {
    const c = ready(true);
    if (!c) return;
    noise(c, { duration: 0.35, from: 500, to: 3500, gain: 0.1 });
    const chord = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
    chord.forEach((f, i) => bell(c, f, { at: 0.05 + i * 0.075, decay: 0.3, gain: 0.11, wet: 0.3 }));
    chord.forEach((f) => tone(c, { freq: f, type: 'triangle', at: 0.36, attack: 0.03, decay: 0.9, gain: 0.04, wet: 0.5 }));
  },
  /** The impossible question arriving: a deep boom, a rumble and an uneasy chord. */
  danger() {
    const c = ready(true);
    if (!c) return;
    tone(c, { freq: 96, to: 36, attack: 0.005, decay: 1.1, gain: 0.34, wet: 0.25 });
    noise(c, { duration: 0.9, from: 420, to: 60, gain: 0.26, kind: 'lowpass', q: 0.5 });
    [130.81, 185, 277.18].forEach((freq) => tone(c, { freq, type: 'sawtooth', at: 0.08, attack: 0.1, decay: 1.3, gain: 0.03, lowpass: [900, 220], wet: 0.45 }));
  },
  /** The final score: a fanfare that grows with it, or a gentle jingle for a tough round. */
  fanfare(score: number) {
    const c = ready(true);
    if (!c) return;
    if (score < 6) {
      (
        [
          [NOTE.E5, 0],
          [NOTE.D5, 0.16],
          [NOTE.C5, 0.32],
          [NOTE.G5, 0.52],
        ] as const
      ).forEach(([f, at]) => bell(c, f, { at, decay: 0.45, gain: 0.1, wet: 0.35 }));
      return;
    }
    const tune: (readonly [number, number, number])[] =
      score >= 9
        ? [
            [NOTE.G5, 0, 0.12],
            [NOTE.G5, 0.13, 0.12],
            [NOTE.G5, 0.26, 0.12],
            [NOTE.C6, 0.4, 0.22],
            [NOTE.E6, 0.64, 0.14],
            [NOTE.G6, 0.8, 0.7],
          ]
        : [
            [NOTE.G5, 0, 0.14],
            [NOTE.C6, 0.16, 0.14],
            [NOTE.E6, 0.32, 0.14],
            [NOTE.G6, 0.5, 0.6],
          ];
    for (const [f, at, decay] of tune) {
      horn(c, f, { at, decay });
      bell(c, f, { at, decay: decay + 0.2, gain: 0.05 });
    }
    const end = tune[tune.length - 1][1];
    [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f) => tone(c, { freq: f, type: 'triangle', at: end, attack: 0.03, decay: 1.1, gain: 0.05, wet: 0.5 }));
    if (score >= 9) for (let i = 0; i < 8; i++) bell(c, NOTE.C6 * Math.pow(2, i / 7), { at: end + 0.1 + i * 0.05, decay: 0.25, gain: 0.04, wet: 0.6 });
  },
  /** A star appearing on the quiz results; the third rings highest. */
  star(index: number) {
    const c = ready(false);
    if (!c) return;
    const f = [NOTE.E6, NOTE.G6, NOTE.C7][index] ?? NOTE.C7;
    bell(c, f, { decay: 0.6, gain: 0.13, wet: 0.4 });
    tone(c, { freq: f / 2, type: 'triangle', decay: 0.25, gain: 0.05 });
  },
  /** Points counting up. */
  count() {
    const c = ready(false);
    if (c) tone(c, { freq: 1900 + Math.random() * 200, type: 'square', attack: 0.001, decay: 0.025, gain: 0.025, lowpass: [3500, 2500] });
  },
  /** Two wrong answers vanishing (the 50/50 hint): poof! */
  poof() {
    const c = ready(true);
    if (!c) return;
    noise(c, { duration: 0.3, from: 2400, to: 300, gain: 0.22 });
    tone(c, { freq: 900, to: 300, attack: 0.003, decay: 0.12, gain: 0.08 });
  },
  /** Moving on to the next question: a short swish. */
  swish() {
    const c = ready(true);
    if (c) noise(c, { duration: 0.2, from: 700, to: 3200, gain: 0.08, q: 1.2 });
  },
  /** A cartoon character jumping: boing! */
  boing() {
    const c = ready(true);
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.42);
    // A wobble that dies away, like a spring settling
    const wobble = c.createOscillator();
    const depth = c.createGain();
    wobble.frequency.value = 16;
    depth.gain.setValueAtTime(70, t);
    depth.gain.exponentialRampToValueAtTime(1, t + 0.42);
    wobble.connect(depth);
    depth.connect(osc.frequency);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(env);
    env.connect(output!);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + 0.47);
    wobble.stop(t + 0.47);
  },
};
