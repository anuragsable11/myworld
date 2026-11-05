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

function wake(): AudioContext | null {
  if (!audio) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    audio = new Context();
    output = audio.createGain();
    output.gain.value = 0.55;
    output.connect(audio.destination);
  }
  if (audio.state !== 'running') void audio.resume();
  return audio;
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    if (enabled) wake();
  };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true });
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

function tone(
  c: AudioContext,
  { freq, to, type = 'sine', at = 0, attack = 0.005, decay = 0.15, gain = 0.2 }: { freq: number; to?: number; type?: OscillatorType; at?: number; attack?: number; decay?: number; gain?: number },
) {
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(env);
  env.connect(output!);
  osc.start(t);
  osc.stop(t + attack + decay + 0.03);
}

/** Filtered noise, its pitch sweeping from one frequency to another: whooshes. */
function noise(c: AudioContext, { duration, from, to, gain, q = 0.8 }: { duration: number; from: number; to: number; gain: number; q?: number }) {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, Math.round(c.sampleRate * 0.8), c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime;
  const source = c.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
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
  source.start(t);
  source.stop(t + duration + 0.03);
}

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
