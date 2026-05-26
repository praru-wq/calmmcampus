// Global ambience audio system for CalmCampus.
// One HTMLAudioElement, looped, with per-user preferences.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { useApp } from "@/components/AppShell";

export type AmbienceTrackId = "daydream" | "enchanted" | "rainy-cafe";

export interface AmbienceTrack {
  id: AmbienceTrackId;
  label: string;
  src: string;
}

export const AMBIENCE_TRACKS: AmbienceTrack[] = [
  { id: "daydream",   label: "Daydream",   src: "/audio/ambience/daydream.mp3" },
  { id: "enchanted",  label: "Enchanted",  src: "/audio/ambience/enchanted.mp3" },
  { id: "rainy-cafe", label: "Rainy Café", src: "/audio/ambience/rainy-cafe.mp3" },
];

interface AmbiencePrefs {
  track: AmbienceTrackId;
  on: boolean;
  volume: number; // 0..1
}

const DEFAULT_PREFS: AmbiencePrefs = { track: "daydream", on: true, volume: 0.3 };

function prefsKey(userId: string) {
  return `calmcampus_ambience_preferences_${userId}`;
}
function loadPrefs(userId: string): AmbiencePrefs {
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw);
    return {
      track: AMBIENCE_TRACKS.some(t => t.id === p.track) ? p.track : DEFAULT_PREFS.track,
      on: typeof p.on === "boolean" ? p.on : DEFAULT_PREFS.on,
      volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : DEFAULT_PREFS.volume,
    };
  } catch { return { ...DEFAULT_PREFS }; }
}
function savePrefs(userId: string, p: AmbiencePrefs) {
  try { localStorage.setItem(prefsKey(userId), JSON.stringify(p)); } catch { }
}

interface AmbienceCtx {
  ready: boolean;
  track: AmbienceTrackId;
  on: boolean;
  volume: number;
  isPlaying: boolean;
  needsUnlock: boolean;
  setTrack: (t: AmbienceTrackId) => void;
  setOn: (on: boolean) => void;
  setVolume: (v: number) => void;
  tryUnlock: () => void;
  tracks: AmbienceTrack[];
}

const Ctx = createContext<AmbienceCtx | null>(null);

export function useAmbience() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AmbienceProvider missing");
  return v;
}

export function AmbienceProvider({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useApp();
  const userId = user?.profile.username ?? null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pausedForSessionRef = useRef(false);
  const wasOnBeforeSessionRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);

  const [prefs, setPrefs] = useState<AmbiencePrefs>(DEFAULT_PREFS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [ready, setReady] = useState(false);

  // Lazy-create single audio element
  const ensureAudio = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.loop = true;
    a.preload = "auto";
    a.volume = DEFAULT_PREFS.volume;
    a.addEventListener("ended", () => {
      // Fallback in case loop fails — restart from 0
      try { a.currentTime = 0; void a.play(); } catch { }
    });
    a.addEventListener("play", () => setIsPlaying(true));
    a.addEventListener("pause", () => setIsPlaying(false));
    audioRef.current = a;
    return a;
  }, []);

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); a.currentTime = 0; } catch { }
    setIsPlaying(false);
  }, []);

  const playCurrent = useCallback((p: AmbiencePrefs) => {
    if (!p.on) return;
    const a = ensureAudio(); if (!a) return;
    const trackSrc = AMBIENCE_TRACKS.find(t => t.id === p.track)?.src;
    if (!trackSrc) return;
    const fullSrc = new URL(trackSrc, window.location.origin).toString();
    if (a.src !== fullSrc) {
      a.src = trackSrc;
    }
    a.loop = true;
    a.volume = p.volume;
    const promise = a.play();
    if (promise && typeof promise.then === "function") {
      promise.then(() => setNeedsUnlock(false))
             .catch(() => setNeedsUnlock(true));
    }
  }, [ensureAudio]);

  // Load prefs when user changes
  useEffect(() => {
    if (!hydrated) return;
    // Switched user (or logged out)
    if (currentUserRef.current && currentUserRef.current !== userId) {
      stopAudio();
      pausedForSessionRef.current = false;
      wasOnBeforeSessionRef.current = false;
    }
    currentUserRef.current = userId;
    if (!userId) {
      const p = { ...DEFAULT_PREFS };
      setPrefs(p);
      setReady(true);
      setNeedsUnlock(false);
      // Try playing the default daydream track even before login
      if (p.on) setTimeout(() => playCurrent(p), 0);
      return;
    }
    const p = loadPrefs(userId);
    setPrefs(p);
    setReady(true);
    // Attempt to start
    if (p.on) {
      // Defer so audio element exists
      setTimeout(() => playCurrent(p), 0);
    }
  }, [userId, hydrated, stopAudio, playCurrent]);

  // Persist prefs whenever they change (but only for a real user)
  useEffect(() => {
    if (!ready || !userId) return;
    savePrefs(userId, prefs);
  }, [prefs, userId, ready]);

  // Keep volume in sync live
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = prefs.volume;
  }, [prefs.volume]);

  // Listen for breathing session events
  useEffect(() => {
    const onBreathStart = () => {
      const a = audioRef.current;
      wasOnBeforeSessionRef.current = prefs.on && !!a && !a.paused;
      pausedForSessionRef.current = true;
      if (a) { try { a.pause(); } catch { } }
    };
    const onBreathEnd = () => {
      if (!pausedForSessionRef.current) return;
      pausedForSessionRef.current = false;
      if (wasOnBeforeSessionRef.current && prefs.on && userId) {
        const a = ensureAudio(); if (!a) return;
        try { void a.play(); } catch { }
      }
    };
    window.addEventListener("calmcampus:breath:start", onBreathStart);
    window.addEventListener("calmcampus:breath:end", onBreathEnd);
    return () => {
      window.removeEventListener("calmcampus:breath:start", onBreathStart);
      window.removeEventListener("calmcampus:breath:end", onBreathEnd);
    };
  }, [prefs.on, userId, ensureAudio]);

  // First user interaction unlocks audio if it was blocked
  useEffect(() => {
    if (!needsUnlock) return;
    const handler = () => {
      if (prefs.on) playCurrent(prefs);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [needsUnlock, prefs, userId, playCurrent]);

  const setTrack = useCallback((t: AmbienceTrackId) => {
    setPrefs(prev => {
      const next = { ...prev, track: t, on: true };
      stopAudio();
      setTimeout(() => playCurrent(next), 0);
      return next;
    });
  }, [stopAudio, playCurrent]);

  const setOn = useCallback((on: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, on };
      if (!on) stopAudio();
      else setTimeout(() => playCurrent(next), 0);
      return next;
    });
  }, [stopAudio, playCurrent]);

  const setVolume = useCallback((v: number) => {
    setPrefs(prev => ({ ...prev, volume: Math.min(1, Math.max(0, v)) }));
  }, []);

  const tryUnlock = useCallback(() => {
    playCurrent(prefs);
  }, [playCurrent, prefs]);

  const value = useMemo<AmbienceCtx>(() => ({
    ready, track: prefs.track, on: prefs.on, volume: prefs.volume,
    isPlaying, needsUnlock, setTrack, setOn, setVolume, tryUnlock,
    tracks: AMBIENCE_TRACKS,
  }), [ready, prefs, isPlaying, needsUnlock, setTrack, setOn, setVolume, tryUnlock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
