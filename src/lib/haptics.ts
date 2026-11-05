/**
 * Short vibrations for touch feedback, like a native app. Android browsers support the Vibration
 * API. Safari on iPhone doesn't, but since iOS 18 toggling a switch control gives a light tap, which
 * is the most a web page can do there. People can turn vibration off in the About dialog.
 */

const KEY = 'atlas:haptics';

const isIOS =
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const hapticsSupported = canVibrate || isIOS;

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();
const listeners = new Set<() => void>();

export const hapticsEnabled = () => enabled;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // The choice simply isn't remembered.
  }
  listeners.forEach((fn) => fn());
}

export function subscribeHaptics(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let iosSwitch: HTMLLabelElement | null = null;

/** iOS plays a haptic tap whenever a switch control is toggled. */
function iosTap() {
  if (!iosSwitch) {
    iosSwitch = document.createElement('label');
    iosSwitch.ariaHidden = 'true';
    iosSwitch.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    iosSwitch.append(input);
    document.body.append(iosSwitch);
  }
  iosSwitch.click();
}

function buzz(pattern: number | number[]) {
  if (!enabled) return;
  if (canVibrate) navigator.vibrate(pattern);
  else if (isIOS) {
    // An iPhone can only tap: one tap for each burst of the pattern.
    const bursts = typeof pattern === 'number' ? [pattern] : pattern;
    let at = 0;
    bursts.forEach((ms, i) => {
      if (i % 2 === 0) window.setTimeout(iosTap, at);
      at += ms;
    });
  }
}

export const haptics = {
  /** A light tick for buttons and tabs. */
  tap: () => buzz(8),
  /** Choosing a country. */
  select: () => buzz(14),
  /** One notch of the globe turning, under a finger or in a shuffle. */
  notch: () => buzz(9),
  /** A shuffle on the flat map: a rattle that slows down, like a rolled dice. */
  roll: () => buzz([6, 110, 6, 130, 6, 170, 6, 230, 6]),
  /** The globe settling on its country: a firm bump and a small echo. */
  land: () => buzz([28, 70, 14]),
  /** A cartoon character jumping. */
  hop: () => buzz([10, 50, 10]),
  /** A right answer in the quiz: two quick taps and a happy buzz. */
  correct: () => buzz([35, 45, 35, 45, 110]),
  /** A wrong answer: a long, heavy double buzz. */
  wrong: () => buzz([120, 70, 120, 70, 260]),
  /** Three or more right in a row: a drum roll. */
  combo: () => buzz([25, 30, 25, 30, 25, 30, 25, 30, 160]),
  /** A new level in the quiz. */
  levelUp: () => buzz([40, 60, 40, 60, 160]),
  /** The impossible question arriving: a heavy rumble. */
  danger: () => buzz([90, 50, 90, 50, 90, 50, 380]),
  /** The final score: the better the round, the bigger the celebration. */
  win: (score: number) => buzz(score >= 9 ? [50, 50, 50, 50, 50, 50, 320] : score >= 6 ? [40, 60, 40, 60, 200] : [70, 90, 180]),
  /** A star on the results. */
  star: () => buzz(30),
  /** The 50/50 hint. */
  hint: () => buzz([20, 40, 20]),
};
