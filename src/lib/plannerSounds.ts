// Cozy, low-volume Web Audio sound effects for the Planner experience only.
// Soft sine/triangle tones with fade in/out. Respects the existing Sound On/Off
// setting from storage. Silent if audio is blocked or unsupported. Includes a
// per-kind cooldown to avoid stacking. Never throws — always fails silently.

import { getCurrentUser } from "@/lib/storage";

export type PlannerSoundKind =
  | "tap"        // back / cancel / minor secondary action
  | "select"     // selecting an option card / chip
  | "next"       // moving to a major next step
  | "save"       // add / save / save changes
  | "generate"   // successful plan generation
  | "lock"       // save & lock
  | "tick"       // checking a trackable block
  | "complete"   // day complete / 100%
  | "incomplete" // gentle supportive tone on partial finish
  | "warning"    // validation issue / opening destructive confirm
  | "delete";    // confirmed deletion

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

// Per-kind cooldown to prevent spam / stacking.
const _last: Record<string, number> = {};
const COOLDOWN_MS: Record<PlannerSoundKind, number> = {
  tap: 120,
  select: 140,
  next: 200,
  save: 180,
  generate: 350,
  lock: 250,
  tick: 90,
  complete: 500,
  incomplete: 500,
  warning: 200,
  delete: 250,
};

function canPlay(kind: PlannerSoundKind): boolean {
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
  const type = o.type || "sine";
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

function render(kind: PlannerSoundKind, c: AudioContext) {
  switch (kind) {
    case "tap":
      tone(c, { freq: 460, dur: 0.05, vol: 0.06, type: "sine" });
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
  }
}

/** Play a planner sound. Safe to call from anywhere — silently no-ops when
 *  sound is off, audio is unsupported, or the kind is on cooldown. */
export function playPlannerSound(kind: PlannerSoundKind): void {
  try {
    if (!soundOn()) return;
    if (!canPlay(kind)) return;
    const c = ctx(); if (!c) return;
    if (c.state === "suspended") { try { void c.resume(); } catch {} }
    render(kind, c);
  } catch {
    // never break planner actions
  }
}
