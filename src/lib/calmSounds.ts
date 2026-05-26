// Soft Web Audio engine scoped to Quick Calm Tools.
// Respects the user's sound setting (read live from storage on each call).
import { getCurrentUser } from "@/lib/storage";
import boxBreathingMp3 from "@/assets/box-breathing.mp3";

let _ctx: AudioContext | null = null;
let _ambientNodes: { stop: () => void } | null = null;
let _noiseBuffer: AudioBuffer | null = null;
let _breathAudio: HTMLAudioElement | null = null;
const _active = new Set<{ stop: () => void }>();


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

/** Must be called from a user gesture (click) so audio actually plays. */
export async function resumeAudio(): Promise<void> {
  const c = ctx(); if (!c) return;
  try { if (c.state !== "running") await c.resume(); } catch {}
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (_noiseBuffer) return _noiseBuffer;
  const len = c.sampleRate * 2;
  const b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  // pink-ish noise (filtered white)
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.5;
  }
  _noiseBuffer = b;
  return b;
}

function track(node: { stop: () => void }) {
  _active.add(node);
}
function untrack(node: { stop: () => void }) {
  _active.delete(node);
}

function soundOn() {
  return !!getCurrentUser()?.data.settings.sound;
}

function envTone(opts: {
  freq: number; dur: number; type?: OscillatorType;
  vol?: number; attack?: number; release?: number;
  slideTo?: number;
}) {
  if (!soundOn()) return;
  const c = ctx(); if (!c) return;
  const { freq, dur } = opts;
  const type = opts.type || "sine";
  const vol = opts.vol ?? 0.18;
  const attack = opts.attack ?? 0.04;
  const release = opts.release ?? 0.25;
  const t0 = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + release + 0.05);
  const handle = { stop: () => { try { o.stop(); } catch {} } };
  track(handle);
  setTimeout(() => untrack(handle), (dur + release + 0.1) * 1000);
}

/** Soft airy whoosh built from filtered noise. Direction "in" rises, "out" falls. */
function whoosh(direction: "in" | "out", durSec: number, peakVol = 0.32) {
  if (!soundOn()) return;
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  const fStart = direction === "in" ? 320 : 1600;
  const fEnd = direction === "in" ? 1600 : 320;
  bp.frequency.setValueAtTime(fStart, t0);
  bp.frequency.exponentialRampToValueAtTime(fEnd, t0 + durSec);

  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 180;

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  if (direction === "in") {
    // build up then ease off near end
    g.gain.exponentialRampToValueAtTime(peakVol, t0 + durSec * 0.65);
    g.gain.exponentialRampToValueAtTime(peakVol * 0.7, t0 + durSec * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec + 0.25);
  } else {
    // quick swell, long fall
    g.gain.exponentialRampToValueAtTime(peakVol, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(peakVol * 0.55, t0 + durSec * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec + 0.3);
  }

  src.connect(bp); bp.connect(hp); hp.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + durSec + 0.4);
  const handle = { stop: () => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(0.0001, c.currentTime); src.stop(); } catch {} } };
  track(handle);
  setTimeout(() => untrack(handle), (durSec + 0.5) * 1000);
}

export const calmSfx = {
  click() { envTone({ freq: 520, dur: 0.05, vol: 0.12 }); },
  pop() { envTone({ freq: 720, dur: 0.08, vol: 0.14 }); envTone({ freq: 1080, dur: 0.05, vol: 0.08 }); },
  chime() { envTone({ freq: 880, dur: 0.18, vol: 0.16 }); envTone({ freq: 1320, dur: 0.25, vol: 0.12 }); },
  sparkle() { [1200,1600,2000].forEach((f,i)=>setTimeout(()=>envTone({ freq: f, dur: 0.12, vol: 0.1 }), i*70)); },
  /** Deprecated phase whooshes — kept as no-ops; breathing now uses the custom MP3. */
  inhale(_dur = 4) { /* no-op: handled by box-breathing MP3 */ },
  hold(_dur = 4) { /* no-op */ },
  exhale(_dur = 4) { /* no-op */ },
  holdEmpty(_dur = 4) { /* no-op */ },
  shimmer() { [600,800,1000,1300].forEach((f,i)=>setTimeout(()=>envTone({ freq: f, dur: 0.2, vol: 0.08 }), i*80)); },
  bloom() { envTone({ freq: 600, slideTo: 1200, dur: 0.4, vol: 0.14 }); },
  success() { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>envTone({ freq: f, dur: 0.25, vol: 0.16 }), i*110)); },
  boop() { envTone({ freq: 380, dur: 0.08, vol: 0.14 }); },
  tap() { envTone({ freq: 280, dur: 0.04, vol: 0.1 }); },
};

/** Stop only phase sounds (legacy) without killing ambient. Also stops session MP3. */
export function stopPhaseSounds() {
  _active.forEach((n) => { try { n.stop(); } catch {} });
  _active.clear();
  stopBreathingSession();
}

/** Hard stop every active sound (used when user toggles Sound Off). */
export function stopAllSounds() {
  _active.forEach((n) => { try { n.stop(); } catch {} });
  _active.clear();
  stopBreathingSession();
  stopCozyAmbient();
}

/* ============ Box Breathing Session Audio (custom MP3) ============ */
function ensureBreathAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (_breathAudio) return _breathAudio;
  try {
    const a = new Audio(boxBreathingMp3);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0.4;
    _breathAudio = a;
    return a;
  } catch { return null; }
}

function dispatchBreath(ev: "start" | "end") {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new Event(`calmcampus:breath:${ev}`)); } catch {}
}

export function startBreathingSession() {
  dispatchBreath("start");
  if (!soundOn()) return;
  const a = ensureBreathAudio(); if (!a) return;
  try {
    a.currentTime = 0;
    a.volume = 0.4;
    void a.play();
  } catch {}
}
export function pauseBreathingSession() {
  if (!_breathAudio) return;
  try { _breathAudio.pause(); } catch {}
}
export function resumeBreathingSession() {
  if (!soundOn()) return;
  if (!_breathAudio) return;
  try { void _breathAudio.play(); } catch {}
}
export function stopBreathingSession() {
  dispatchBreath("end");
  if (!_breathAudio) return;
  try { _breathAudio.pause(); _breathAudio.currentTime = 0; } catch {}
}


export function startCozyAmbient() {
  if (!soundOn()) return;
  stopCozyAmbient();
  const c = ctx(); if (!c) return;
  const t0 = c.currentTime;
  const nodes: any[] = [];
  [220, 277, 330].forEach((f, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.025, t0 + 2 + i * 0.5);
    o.connect(g); g.connect(c.destination);
    o.start(t0);
    nodes.push({ o, g });
  });
  _ambientNodes = {
    stop: () => {
      const tt = c.currentTime;
      nodes.forEach(({ o, g }) => {
        try {
          g.gain.cancelScheduledValues(tt);
          g.gain.setValueAtTime(g.gain.value, tt);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.6);
          o.stop(tt + 0.7);
        } catch {}
      });
    },
  };
}

export function stopCozyAmbient() {
  if (_ambientNodes) { try { _ambientNodes.stop(); } catch {} _ambientNodes = null; }
}

// Sidecar storage for calm progress (points, garden, rewards) per user.
export interface CalmProgress {
  points: number;
  garden: number; // flowers grown
  fogPct: number; // 0..100 reduction
  rewards: string[];
}
const KEY = (u: string) => `calmcampus:calm:${u}`;

export function loadCalm(username: string): CalmProgress {
  if (typeof localStorage === "undefined") return { points: 0, garden: 0, fogPct: 0, rewards: [] };
  try {
    const raw = localStorage.getItem(KEY(username));
    if (raw) return { points: 0, garden: 0, fogPct: 0, rewards: [], ...JSON.parse(raw) };
  } catch {}
  return { points: 0, garden: 0, fogPct: 0, rewards: [] };
}
export function saveCalm(username: string, p: CalmProgress) {
  try { localStorage.setItem(KEY(username), JSON.stringify(p)); } catch {}
  window.dispatchEvent(new Event("calmcampus:update"));
}
export function addCalm(username: string, opts: { points?: number; garden?: number; fog?: number; reward?: string }) {
  const p = loadCalm(username);
  p.points += opts.points || 0;
  p.garden = Math.min(24, p.garden + (opts.garden || 0));
  p.fogPct = Math.min(100, Math.max(0, p.fogPct + (opts.fog || 0)));
  if (opts.reward && !p.rewards.includes(opts.reward)) p.rewards.push(opts.reward);
  saveCalm(username, p);
  return p;
}