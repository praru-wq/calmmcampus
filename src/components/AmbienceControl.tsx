import React, { useEffect, useRef, useState } from "react";
import { useAmbience } from "@/lib/audio/AmbienceProvider";

export function AmbienceControl() {
  const { track, on, volume, isPlaying, needsUnlock, setTrack, setOn, setVolume, tryUnlock, tracks } = useAmbience();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = tracks.find(t => t.id === track);
  const showHint = on && needsUnlock && !isPlaying;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        className="btn-ghost !py-2 !px-3 flex items-center gap-1.5"
        onClick={() => { setOpen(v => !v); tryUnlock(); }}
        aria-label="Ambience"
        title="Study ambience"
      >
        <span>🎧</span>
        <span className="hidden sm:inline">Ambience</span>
        {showHint && <span className="hidden md:inline text-[10px] opacity-70">· tap to play</span>}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-72 z-50 p-4 rounded-2xl animate-fade-up"
          style={{
            background: "color-mix(in oklab, var(--card) 96%, transparent)",
            border: "1px solid color-mix(in oklab, var(--rose) 18%, transparent)",
            boxShadow: "var(--shadow-soft, 0 10px 30px rgba(180,120,140,0.18))",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-display text-base" style={{ color: "var(--rose)" }}>Study Ambience</div>
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {on
              ? <>Now playing: <span style={{ color: "var(--rose)" }}>{current?.label}</span>{showHint ? " · tap to play" : ""}</>
              : <>Ambience off</>}
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setOn(false)}
              className="flex items-center gap-2 px-2 py-2 rounded-xl text-sm text-left transition-colors"
              style={{ background: !on ? "var(--blush)" : "transparent" }}
            >
              <span className="w-4 h-4 rounded-full border flex items-center justify-center"
                    style={{ borderColor: "var(--rose)" }}>
                {!on && <span className="w-2 h-2 rounded-full" style={{ background: "var(--rose)" }} />}
              </span>
              Off
            </button>
            {tracks.map(t => {
              const active = on && track === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTrack(t.id)}
                  className="flex items-center gap-2 px-2 py-2 rounded-xl text-sm text-left transition-colors"
                  style={{ background: active ? "var(--blush)" : "transparent" }}
                >
                  <span className="w-4 h-4 rounded-full border flex items-center justify-center"
                        style={{ borderColor: "var(--rose)" }}>
                    {active && <span className="w-2 h-2 rounded-full" style={{ background: "var(--rose)" }} />}
                  </span>
                  <span className="flex-1">{t.label}</span>
                  {active && isPlaying && <span className="text-xs" style={{ color: "var(--rose)" }}>♪</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs">🔉</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="flex-1 accent-[var(--rose)]"
              aria-label="Ambience volume"
            />
            <span className="text-xs">🔊</span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground text-center">
            Pauses during breathing sessions
          </div>
        </div>
      )}
    </div>
  );
}
