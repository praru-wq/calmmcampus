// Central cozy sound helper for CalmCampus.
// - Respects the user's Sound On/Off setting (read live from storage).
// - Uses Web Audio with soft sine/triangle tones only.
// - Per-kind cooldown to prevent stacking / spam.
// - Never throws; never blocks any UI action.
// - Initializes AudioContext lazily — first real play occurs after a user
//   gesture (click/submit), so the browser autoplay policy is respected.

import { getCurrentUser } from "@/lib/storage";

export type AppSoundKind =
  | "tap"
  | "open"
  | "select"
  | "next"
  | "save"
  | "generate"
  | "lock"
  | "tick"
  | "complete"
  | "incomplete"
  | "warning"
  | "delete"
  | "send"
  | "reply"
  | "clear"
  | "softMode"
  | "timerBell";

let _ctx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  try {
    const C = (window.AudioContext || (window as any).webkitAudioContext);
    if (!C) return null;
    _ctx = new C();
    return _ctx;
  } catch { return null; }
}

function soundOn(): boolean {
  try { return !!getCurrentUser()?.data.settings.sound; } catch { return false; }
}

const _last: Record<string, number> = {};
const COOLDOWN_MS: Record<AppSoundKind, number> = {
  tap: 120, open: 180, select: 140, next: 200, save: 180,
  generate: 350, lock: 250, tick: 90, complete: 500, incomplete: 500,
  warning: 200, delete: 250, send: 150, reply: 180, clear: 250,
  softMode: 250, timerBell: 400,
};

function canPlay(kind: AppSoundKind): boolean {
  const now = Date.now();
  const prev = _last[kind] || 0;
  if (now - prev < (COOLDOWN_MS[kind] ?? 150)) return false;
  _last[kind] = now;
  return true;
}

interface ToneOpts {
  freq: number;
  dur: number;
  vol: number;
  type?: OscillatorType;
  attack?: number;
  release?: number;
  slideTo?: number;
  delay?: number;
}

function tone(c: AudioContext, o: ToneOpts) {
  const t0 = c.currentTime + (o.delay || 0);
  const type: OscillatorType = o.type || "sine";
  const attack = o.attack ?? 0.025;
  const release = o.release ?? 0.18;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) {
    try { osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + o.dur); } catch {}
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur + release);
  osc.connect(gain); gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + release + 0.05);
}

function render(kind: AppSoundKind, c: AudioContext) {
  switch (kind) {
    case "tap":
      tone(c, { freq: 320, dur: 0.06, vol: 0.06, type: "sine" });
      return;
    case "open":
      tone(c, { freq: 420, slideTo: 620, dur: 0.18, vol: 0.07, type: "sine" });
      tone(c, { freq: 880, dur: 0.14, vol: 0.04, type: "triangle", delay: 0.05 });
      return;
    case "select":
      tone(c, { freq: 660, dur: 0.10, vol: 0.07, type: "sine" });
      tone(c, { freq: 990, dur: 0.14, vol: 0.04, type: "sine", delay: 0.02 });
      return;
    case "next":
      tone(c, { freq: 520, slideTo: 780, dur: 0.18, vol: 0.08, type: "sine" });
      return;
    case "save":
      tone(c, { freq: 620, dur: 0.10, vol: 0.08, type: "sine" });
      tone(c, { freq: 820, dur: 0.14, vol: 0.05, type: "triangle", delay: 0.05 });
      return;
    case "generate":
      [880, 1100, 1320].forEach((f, i) =>
        tone(c, { freq: f, dur: 0.16, vol: 0.07, type: "sine", delay: i * 0.07 }));
      return;
    case "lock":
      tone(c, { freq: 380, dur: 0.08, vol: 0.08, type: "triangle" });
      tone(c, { freq: 740, dur: 0.20, vol: 0.06, type: "sine", delay: 0.07 });
      return;
    case "tick":
      tone(c, { freq: 780, dur: 0.07, vol: 0.07, type: "sine" });
      tone(c, { freq: 1050, dur: 0.08, vol: 0.04, type: "sine", delay: 0.02 });
      return;
    case "complete":
      [523, 659, 784, 988].forEach((f, i) =>
        tone(c, { freq: f, dur: 0.22, vol: 0.10, type: "sine", delay: i * 0.10 }));
      return;
    case "incomplete":
      tone(c, { freq: 520, dur: 0.22, vol: 0.07, type: "sine" });
      tone(c, { freq: 440, dur: 0.30, vol: 0.06, type: "sine", delay: 0.14 });
      return;
    case "warning":
      tone(c, { freq: 360, dur: 0.18, vol: 0.07, type: "triangle" });
      tone(c, { freq: 300, dur: 0.22, vol: 0.05, type: "sine", delay: 0.10 });
      return;
    case "delete":
      tone(c, { freq: 520, slideTo: 260, dur: 0.30, vol: 0.07, type: "sine" });
      return;
    case "send":
      tone(c, { freq: 560, slideTo: 820, dur: 0.12, vol: 0.06, type: "sine" });
      return;
    case "reply":
      tone(c, { freq: 720, dur: 0.10, vol: 0.06, type: "sine" });
      tone(c, { freq: 980, dur: 0.12, vol: 0.04, type: "triangle", delay: 0.04 });
      return;
    case "clear":
      tone(c, { freq: 620, slideTo: 220, dur: 0.32, vol: 0.06, type: "sine" });
      return;
    case "softMode":
      [820, 1100, 1320, 1560].forEach((f, i) =>
        tone(c, { freq: f, dur: 0.14, vol: 0.05, type: "sine", delay: i * 0.06 }));
      return;
    case "timerBell":
      tone(c, { freq: 880, dur: 0.30, vol: 0.10, type: "sine" });
      tone(c, { freq: 1320, dur: 0.40, vol: 0.07, type: "sine", delay: 0.06 });
      return;
  }
}

/** Play a cozy app sound. Safe to call anywhere — silently no-ops when sound
 *  is off, audio is unsupported, or the kind is on cooldown. */
export function playAppSound(kind: AppSoundKind): void {
  try {
    if (!soundOn()) return;
    if (!canPlay(kind)) return;
    const c = ctx(); if (!c) return;
    if (c.state === "suspended") { try { void c.resume(); } catch {} }
    render(kind, c);
  } catch {
    // never break app actions
  }
}

// ---- Auth-page sound layer ------------------------------------------------
// The main playAppSound() reads the *logged-in* user's sound setting. On the
// Login / Register pages there is no current user, so that helper would stay
// silent. playAuthSound() uses a tiny separate localStorage flag
// (`cc_auth_sound`, default ON) so the auth screens still feel cozy, while
// reusing the same render + cooldown engine.

export type AuthSoundKind =
  | "inputFocus"
  | "tap"
  | "authSwitch"
  | "authSubmit"
  | "authWelcome"
  | "error"
  | "softMode";

const AUTH_TO_APP: Record<AuthSoundKind, AppSoundKind> = {
  inputFocus: "tick",
  tap: "tap",
  authSwitch: "next",
  authSubmit: "send",
  authWelcome: "complete",
  error: "warning",
  softMode: "softMode",
};

function authSoundOn(): boolean {
  try {
    // If a user is logged in, respect their setting first.
    const u = getCurrentUser();
    if (u) return !!u.data.settings.sound;
    if (typeof window === "undefined") return false;
    const v = window.localStorage.getItem("cc_auth_sound");
    return v === null ? true : v === "1";
  } catch { return false; }
}

export function playAuthSound(kind: AuthSoundKind): void {
  try {
    if (!authSoundOn()) return;
    const mapped = AUTH_TO_APP[kind];
    if (!canPlay(mapped)) return;
    const c = ctx(); if (!c) return;
    if (c.state === "suspended") { try { void c.resume(); } catch {} }
    render(mapped, c);
  } catch {
    // never break auth actions
  }
}
