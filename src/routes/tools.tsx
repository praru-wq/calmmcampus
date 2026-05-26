import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout, BackButton, useApp } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { todayStr, updateCurrentUserData } from "@/lib/storage";
import { calmSfx, startCozyAmbient, stopCozyAmbient, loadCalm, addCalm, resumeAudio, stopPhaseSounds, startBreathingSession, pauseBreathingSession, prepareBreathingSessionAudio, restartBreathingSession, resumeBreathingSession, type CalmProgress } from "@/lib/calmSounds";

/* ============ BOX BREATHING ENGINE ============
 * Single timestamp-based source of truth shared by every breathing UI:
 * Main Breathe With Me, Motivate comfort breathing, Emergency breathing.
 * Phases are exactly 4000ms each. progress (0..1) drives every visual smoothly
 * via requestAnimationFrame, so eyelids, body, tummy glow, petal ring, and
 * countdown all stay locked to the same clock — no drift, no slideshow feel.
 */
export type BoxPhaseIdx = 0 | 1 | 2 | 3; // inhale, holdFull, exhale, holdEmpty
const BOX_PHASE_NAMES = ["Inhale", "Hold", "Exhale", "Pause"] as const;
const BOX_PHASE_DUR = 4000;

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/** Continuous 0 (empty) -> 1 (full) breath value across all 4 phases. */
function breathValue(idx: BoxPhaseIdx, t: number) {
  if (idx === 0) return easeInOut(t);
  if (idx === 1) return 1;
  if (idx === 2) return 1 - easeInOut(t);
  return 0;
}

interface BoxBreathingState {
  phaseIdx: BoxPhaseIdx;
  progress: number;     // 0..1 within current phase
  remaining: number;    // ceil seconds left in phase (4..1)
  round: number;        // 0-indexed
  breath: number;       // 0..1 continuous breath fullness
}

interface UseBoxBreathingOpts {
  totalRounds: number;
  paused?: boolean;
  withSound?: boolean;
  onComplete?: () => void;
  restartKey?: number;  // bump to force a full reset
}

function useBoxBreathing({ totalRounds, paused, withSound, onComplete, restartKey = 0 }: UseBoxBreathingOpts): BoxBreathingState {
  const [state, setState] = useState<BoxBreathingState>({ phaseIdx: 0, progress: 0, remaining: 4, round: 0, breath: 0 });
  const phaseStartRef = useRef<number>(0);
  const phaseIdxRef = useRef<BoxPhaseIdx>(0);
  const roundRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const didMountRestartRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Session audio: a single looping MP3 drives the whole breathing session.
  // No per-phase generated sounds — Hold and Pause are visually calm and silent
  // (except for whatever the MP3 itself contains).

  // Reset on restartKey change.
  useEffect(() => {
    doneRef.current = false;
    phaseIdxRef.current = 0;
    roundRef.current = 0;
    phaseStartRef.current = performance.now();
    pausedAtRef.current = null;
    setState({ phaseIdx: 0, progress: 0, remaining: 4, round: 0, breath: 0 });
    if (withSound) {
      if (didMountRestartRef.current) restartBreathingSession();
      didMountRestartRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  // Pause / resume bookkeeping (shift phaseStart by the paused duration).
  useEffect(() => {
    if (paused) {
      pausedAtRef.current = performance.now();
      if (withSound) pauseBreathingSession();
    } else if (pausedAtRef.current != null) {
      const delta = performance.now() - pausedAtRef.current;
      phaseStartRef.current += delta;
      pausedAtRef.current = null;
      if (withSound) resumeBreathingSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(() => {
    if (withSound) startBreathingSession();
    return () => { if (withSound) stopPhaseSounds(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withSound]);

  useEffect(() => {
    phaseStartRef.current = performance.now();


    const tick = () => {
      if (doneRef.current) return;
      if (pausedAtRef.current != null) { rafRef.current = requestAnimationFrame(tick); return; }
      const now = performance.now();
      const elapsed = now - phaseStartRef.current;
      if (elapsed >= BOX_PHASE_DUR) {
        // Advance phase
        let nextIdx = ((phaseIdxRef.current + 1) % 4) as BoxPhaseIdx;
        let nextRound = roundRef.current;
        if (nextIdx === 0) nextRound = roundRef.current + 1;
        if (nextRound >= totalRounds) {
          doneRef.current = true;
          stopPhaseSounds();
          setState({ phaseIdx: 3, progress: 1, remaining: 0, round: roundRef.current, breath: 0 });
          onCompleteRef.current?.();
          return;
        }
        phaseIdxRef.current = nextIdx;
        roundRef.current = nextRound;
        phaseStartRef.current = now;
        // MP3 keeps playing/looping across phase transitions — no per-phase sounds.
      }
      const t = Math.min(1, (performance.now() - phaseStartRef.current) / BOX_PHASE_DUR);
      const remaining = Math.max(1, Math.ceil((BOX_PHASE_DUR - (performance.now() - phaseStartRef.current)) / 1000));
      setState({
        phaseIdx: phaseIdxRef.current,
        progress: t,
        remaining,
        round: roundRef.current,
        breath: breathValue(phaseIdxRef.current, t),
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey]);

  return state;
}


export const Route = createFileRoute("/tools")({
  head: () => ({ meta: [{ title: "Quick Calm Tools — CalmCampus" }] }),
  component: () => <ProtectedLayout><ToolsPage /></ProtectedLayout>,
});

type Screen =
  | "home"
  | "breathe-intro" | "breathe" | "breathe-end"
  | "ground-intro" | "ground" | "ground-end"
  | "motivate" | "motivate-detail"
  | "emergency" | "emergency-breathe" | "emergency-end"
  | "garden" | "closet";

function markDone(key: "breathe"|"ground"|"motivate") {
  const today = todayStr();
  updateCurrentUserData((d) => {
    d.quickToolsProgress[today] = { ...(d.quickToolsProgress[today]||{}), [key]: true };
  });
}

function ToolsPage() {
  const [screen, setScreen] = useState<Screen>("home");
  const { user } = useApp();
  const username = user?.profile.username || "";
  const [calm, setCalm] = useState<CalmProgress>(() => loadCalm(username));
  useEffect(() => { setCalm(loadCalm(username)); }, [username]);
  const [emotion, setEmotion] = useState<string>("lazy");

  // Stop ambient when leaving the tools page entirely
  useEffect(() => () => { stopCozyAmbient(); }, []);

  const reward = (opts: { points?: number; garden?: number; fog?: number; reward?: string }) => {
    setCalm(addCalm(username, opts));
  };

  const go = (s: Screen) => { calmSfx.click(); setScreen(s); };
  const goSilent = (s: Screen) => setScreen(s);

  switch (screen) {
    case "breathe-intro": return <BreatheIntro onYes={()=>goSilent("breathe")} onNo={()=>goSilent("home")} />;
    case "breathe": return <BreatheSession onDone={()=>{ markDone("breathe"); reward({ points: 30, garden: 1, fog: -10 }); goSilent("breathe-end"); }} onExit={()=>goSilent("home")} />;
    case "breathe-end": return <BreatheEnd onBack={()=>goSilent("home")} onRetry={()=>goSilent("breathe")} />;
    case "ground-intro": return <GroundIntro onYes={()=>goSilent("ground")} onNo={()=>goSilent("home")} />;
    case "ground": return <GroundSession onDone={()=>{ markDone("ground"); reward({ points: 50, garden: 2, fog: -20 }); goSilent("ground-end"); }} onExit={()=>goSilent("home")} />;
    case "ground-end": return <GroundEnd onBack={()=>goSilent("home")} />;
    case "motivate": return <MotivateChoose onPick={(id)=>{ goSilent("motivate-detail"); setPickedEmotion(id); }} onBack={()=>goSilent("home")} />;
    case "motivate-detail": return <MotivateDetail emotionId={emotion} onDone={()=>{ markDone("motivate"); reward({ points: 20, garden: 1 }); goSilent("home"); }} onBack={()=>goSilent("motivate")} onEmergency={()=>goSilent("emergency")} />;
    case "emergency": return <EmergencyIntro onBreathe={()=>goSilent("emergency-breathe")} onBack={()=>goSilent("home")} />;
    case "emergency-breathe": return <EmergencyBreathe onDone={()=>{ reward({ points: 15, fog: -10 }); goSilent("emergency-end"); }} onExit={()=>goSilent("home")} />;
    case "emergency-end": return <EmergencyEnd onBack={()=>goSilent("home")} />;
    case "garden": return <GardenScreen calm={calm} onBack={()=>goSilent("home")} />;
    case "closet": return <ClosetScreen calm={calm} onBack={()=>goSilent("home")} onUnlock={(r)=>{ reward({ reward: r }); }} />;
    default: return <Home calm={calm} go={go} />;
  }

  // local picked emotion (lifted out)
  function setPickedEmotion(id: string) { setEmotion(id); }
}

/* ============ HOME ============ */
function Home({ calm, go }: { calm: CalmProgress; go: (s: Screen) => void }) {
  const { user } = useApp();
  const today = todayStr();
  const qt = user?.data.quickToolsProgress[today] || {};
  return (
    <div className="animate-fade-up">
      <BackButton />
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 mb-6"
        style={{ background: "linear-gradient(135deg, var(--blush), var(--lavender) 60%, var(--mint))" }}>
        <Petals />
        <div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-display leading-tight">Quick Calm Tools 🌸</h1>
            <p className="text-muted-foreground mt-2 text-base md:text-lg max-w-md">Tiny guided resets for stressful student moments — done together with Foxy.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="chip">🌷 Calm points · {calm.points}</span>
              <span className="chip">🌿 Garden · {calm.garden}/24</span>
              <span className="chip">☁️ Anxiety cloud · {calm.fogPct <= 0 ? `${Math.abs(calm.fogPct)}% cleared` : `${calm.fogPct}%`}</span>
            </div>
          </div>
          <div className="relative w-44 h-44 md:w-56 md:h-56 grid place-items-center">
            <div className="absolute inset-0 rounded-full"
              style={{ background: "radial-gradient(circle, oklch(0.9 0.08 350 / .6), transparent 70%)", animation: "floaty 4s ease-in-out infinite" }} />
            <Fox pose="cheer" size={200} className="relative animate-floaty" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ToolCard color="var(--mint)" pose="breathe" title="Breathe With Me" sub="Slow your body down." btn="Start Breathing" done={!!qt.breathe} onClick={()=>go("breathe-intro")} />
        <ToolCard color="var(--lavender)" pose="sit" title="Ground Me" sub="Come back to the present." btn="Start Grounding" done={!!qt.ground} onClick={()=>go("ground-intro")} />
        <ToolCard color="var(--blush)" pose="card" title="Motivate Me" sub="A soft push when it’s hard." btn="Give Me Strength" done={!!qt.motivate} onClick={()=>go("motivate")} />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <div className="card-cozy p-5">
          <h4 className="text-sm font-semibold mb-2">Today’s calm moments</h4>
          <div className="flex gap-2 flex-wrap">
            <span className="chip">{qt.breathe?"✓":"○"} Breathing</span>
            <span className="chip">{qt.ground?"✓":"○"} Grounding</span>
            <span className="chip">{qt.motivate?"✓":"○"} Motivation</span>
          </div>
          <button className="btn-ghost mt-4" onClick={()=>go("garden")}>🌿 Open Calm Garden →</button>
        </div>
        <div className="card-cozy p-5 flex items-center gap-3" style={{ background: "var(--blush)" }}>
          <Fox pose="card" size={70} />
          <div>
            <div className="font-display text-base">Tip from Foxy</div>
            <div className="text-sm text-muted-foreground">Progress is progress 🌸 Even one breath counts.</div>
          </div>
        </div>
        <button className="card-cozy p-5 text-left hover:-translate-y-0.5 transition-transform"
          style={{ background: "linear-gradient(135deg, oklch(0.9 0.05 320), oklch(0.92 0.06 5))" }}
          onClick={()=>go("emergency")}>
          <div className="text-sm font-semibold">Feeling overwhelmed?</div>
          <div className="font-display text-xl mt-1">I need help right now 🤍</div>
          <div className="text-xs text-muted-foreground mt-1">Soft emergency mode with Foxy.</div>
        </button>
      </div>
    </div>
  );
}

function ToolCard({ color, pose, title, sub, btn, done, onClick }:{
  color: string; pose: any; title: string; sub: string; btn: string; done: boolean; onClick: ()=>void;
}) {
  return (
    <button onClick={onClick} className="card-cozy p-6 text-left transition-all hover:-translate-y-1 group relative overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${color}, var(--card))` }}>
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-50 transition-transform group-hover:scale-110"
        style={{ background: "radial-gradient(circle, oklch(1 0 0 / .6), transparent 70%)" }} />
      <div className="relative flex justify-between items-start">
        <div className="transition-transform group-hover:-translate-y-1"><Fox pose={pose} size={110} /></div>
        {done && <span className="chip">✓ Done today</span>}
      </div>
      <h3 className="text-xl font-display mt-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-3">{sub}</p>
      <span className="btn-rose">{btn} →</span>
    </button>
  );
}

function Petals() {
  const items = Array.from({ length: 14 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((_,i)=>{
        const left = (i*7)%100, delay = (i%6)*0.7, size = 8 + (i%4)*4;
        return (
          <span key={i} className="absolute" style={{
            left: `${left}%`, top: `-20px`, width: size, height: size, borderRadius: "50%",
            background: i%3? "oklch(0.92 0.08 350 / .8)" : "oklch(0.95 0.06 50 / .8)",
            animation: `petalFall ${10 + (i%5)*2}s linear ${delay}s infinite`,
            filter: "blur(.3px)",
          }} />
        );
      })}
      <style>{`@keyframes petalFall {
        0% { transform: translate(0,0) rotate(0); opacity: 0; }
        10% { opacity: .9; }
        100% { transform: translate(30px, 360px) rotate(360deg); opacity: 0; }
      }`}</style>
    </div>
  );
}

/* ============ BREATHE ============ */
function BreatheIntro({ onYes, onNo }: { onYes: ()=>void; onNo: ()=>void }) {
  useEffect(() => { calmSfx.chime(); }, []);
  return (
    <div className="animate-fade-up">
      <BackButton onClick={onNo} label="Back to tools" />
      <div className="relative rounded-3xl p-6 md:p-10 overflow-hidden grid md:grid-cols-2 gap-6 items-center"
        style={{ background: "linear-gradient(135deg, var(--blush), var(--cream))" }}>
        <Petals />
        <div className="relative grid place-items-center">
          <div className="absolute w-64 h-64 rounded-full" style={{ background: "radial-gradient(circle, oklch(0.92 0.08 5 / .6), transparent 70%)", animation: "floaty 3s ease-in-out infinite" }} />
          <Fox pose="breathe" size={230} className="relative animate-floaty" />
        </div>
        <div className="relative">
          <Bubble>Hey... your heart seems fast. Mine too sometimes.</Bubble>
          <Bubble delay={500}>Want to slow down together?</Bubble>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button className="btn-rose" onClick={async ()=>{ await resumeAudio(); await prepareBreathingSessionAudio(); calmSfx.boop(); onYes(); }}>Yes, let’s do it 🤍</button>
            <button className="btn-ghost" onClick={onNo}>Maybe later</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ children, delay=0 }: { children: React.ReactNode; delay?: number }) {
  const [show, setShow] = useState(delay===0);
  useEffect(()=>{ if (delay) { const t=setTimeout(()=>{ setShow(true); calmSfx.pop(); }, delay); return ()=>clearTimeout(t); } else { calmSfx.pop(); } }, []);
  if (!show) return null;
  return (
    <div className="card-cozy p-4 mt-3 inline-block animate-fade-up max-w-sm" style={{ background: "var(--card)" }}>
      <p className="font-display text-lg leading-snug">{children}</p>
    </div>
  );
}

const BREATHE_LINES = [
  "Good. Stay with Foxy.",
  "Tiny breath, tiny win.",
  "You are safe in this moment.",
  "Let the air leave slowly.",
  "One more soft round.",
];

function BreatheSession({ onDone, onExit }: { onDone: ()=>void; onExit: ()=>void }) {
  const totalRounds = 4;
  const [paused, setPaused] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => { resumeAudio(); }, []);
  useEffect(() => () => { stopPhaseSounds(); }, []);

  const state = useBoxBreathing({
    totalRounds, paused, withSound: true, restartKey,
    onComplete: () => {
      if (doneRef.current) return;
      doneRef.current = true;
      stopCozyAmbient();
      calmSfx.success();
      onDone();
    },
  });

  const phaseName = BOX_PHASE_NAMES[state.phaseIdx];
  const displayRound = Math.min(totalRounds, state.round + 1);

  return (
    <div className="animate-fade-up">
      <BackButton onClick={()=>{ stopPhaseSounds(); stopCozyAmbient(); onExit(); }} label="Back to tools" />
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-display">Follow my tummy</h1>
        <p className="text-muted-foreground text-sm">Box breathing · Round {displayRound} of {totalRounds}</p>
      </div>

      <div className="relative mx-auto my-6" style={{ maxWidth: 560 }}>
        <div className="relative grid place-items-center" style={{ height: "clamp(360px, 58vw, 480px)" }}>
          <PetalRing breath={state.breath} phaseIdx={state.phaseIdx} />
          <PhaseChip side="top"    active={state.phaseIdx===0} label="Inhale" sub="4s" />
          <PhaseChip side="right"  active={state.phaseIdx===1} label="Hold"   sub="4s" />
          <PhaseChip side="bottom" active={state.phaseIdx===2} label="Exhale" sub="4s" />
          <PhaseChip side="left"   active={state.phaseIdx===3} label="Pause"  sub="4s" />
          <BreathingFox phaseIdx={state.phaseIdx} breath={state.breath} remaining={state.remaining} />
        </div>

        <p className="text-center font-display text-lg mt-2">{BREATHE_LINES[state.round % BREATHE_LINES.length]}</p>
        <p className="text-center text-sm text-muted-foreground">Your exam can wait for one breath.</p>

        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <button className="btn-ghost" onClick={async ()=>{ await resumeAudio(); calmSfx.tap(); setPaused(p=>!p); }}>{paused?"▶ Resume":"⏸ Pause"}</button>
          <button className="btn-ghost" onClick={()=>{ doneRef.current = false; setPaused(false); setRestartKey(k=>k+1); }}>↻ Restart</button>
          <button className="btn-rose" onClick={()=>{ stopPhaseSounds(); stopCozyAmbient(); onDone(); }}>End Session</button>
        </div>

        <div className="flex gap-2 justify-center mt-3">
          {Array.from({length: totalRounds}).map((_,i)=>(
            <span key={i} className="text-lg transition-all" style={{ opacity: i<=state.round?1:.35, transform: i<=state.round?"scale(1)":"scale(.85)" }}>🌸</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Petal ring driven continuously by breath fullness (0..1). */
function PetalRing({ breath, phaseIdx }: { breath: number; phaseIdx: BoxPhaseIdx }) {
  const N = 18;
  const shimmer = phaseIdx === 1;
  const scale = 0.85 + breath * 0.25; // 0.85 .. 1.10
  return (
    <div className="absolute rounded-full pointer-events-none"
      style={{
        width: "clamp(280px, 48vw, 380px)",
        height: "clamp(280px, 48vw, 380px)",
        transform: `scale(${scale})`,
        filter: shimmer ? "drop-shadow(0 0 22px oklch(0.92 0.1 350 / .6))" : `drop-shadow(0 0 ${8 + breath*10}px oklch(0.92 0.08 350 / .35))`,
      }}>
      {Array.from({length: N}).map((_,i)=>{
        const a = (i/N) * 360;
        return (
          <span key={i} className="absolute left-1/2 top-1/2"
            style={{
              width: 18, height: 18, borderRadius: "50%",
              background: i%3===0 ? "oklch(0.85 0.13 10 / .9)" : i%3===1? "oklch(0.92 0.08 320 / .8)" : "oklch(0.92 0.1 50 / .8)",
              transform: `translate(-50%, -50%) rotate(${a}deg) translateY(calc(-1 * clamp(140px, 24vw, 190px)))`,
              boxShadow: "0 0 14px oklch(0.85 0.15 10 / .35)",
              animation: shimmer ? `petalShimmer 1.8s ease-in-out infinite ${(i%6)*0.08}s` : "none",
            }}/>
        );
      })}
      <div className="absolute inset-0 rounded-full" style={{
        background: "radial-gradient(circle, transparent 55%, oklch(0.95 0.08 350 / .35) 70%, transparent 78%)",
      }}/>
      <style>{`@keyframes petalShimmer { 0%,100% { opacity:.85; } 50% { opacity:1; filter: brightness(1.25); } }`}</style>
    </div>
  );
}

/** Wrapper that keeps the original BreatheSession API tidy. */
function BreathingFox(props: { phaseIdx: BoxPhaseIdx; breath: number; remaining: number }) {
  return <RiggedFox {...props} showCount />;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Fully rigged Foxy driven by a continuous `breath` value (0 = empty, 1 = full)
 * and the current `phaseIdx`. Every part (body, head, ears, tail, tummy glow,
 * eyelids, mouth, cheeks, aura) is interpolated each frame — no CSS transitions
 * snapping between phases, so the whole loop reads as one continuous animation.
 */
function RiggedFox({ phaseIdx, breath, remaining, showCount = true, size = 240 }:{
  phaseIdx: BoxPhaseIdx; breath: number; remaining?: number; showCount?: boolean; size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const hoodieId = `${uid}-bf-hoodie`;
  const furId = `${uid}-bf-fur`;
  const tummyId = `${uid}-bf-tummy`;
  const cheekId = `${uid}-bf-cheek`;
  const isHoldFull  = phaseIdx === 1;
  const isHoldEmpty = phaseIdx === 3;

  // Subtle idle pulse during the two holds so Foxy never freezes.
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => { setPulse(Math.sin((performance.now() - start) / 600) * 0.5 + 0.5); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // All values interpolated from continuous `breath` so transitions vanish.
  const bodyScaleY  = lerp(1.00, 1.10, breath);
  const bodyScaleX  = lerp(1.00, 1.05, breath);
  const bodyY       = lerp(0,    -8,   breath);
  const headY       = lerp(0,    -10,  breath);
  const earTilt     = lerp(0,    -6,   breath);
  const tummyScale  = lerp(0.85, 1.45, breath) + (isHoldFull ? pulse * 0.05 : 0);
  const tummyAlpha  = lerp(0.35, 1.00, breath) + (isHoldFull ? pulse * 0.05 : 0);
  const cheekAlpha  = lerp(0.40, 0.95, breath);
  // Eyelids: closed when breath full, open when empty. Real scaleY motion.
  const eyelid      = breath;
  // Slight tail sway driven by breath direction.
  const tailRot     = phaseIdx === 0 ? lerp(0,-8,breath) : phaseIdx === 2 ? lerp(8,0,breath) : (isHoldFull ? -8 : 0);
  // Sparkles bloom only during hold-full.
  const sparkleAlpha = isHoldFull ? (0.6 + pulse * 0.4) : 0;
  // Mouth opacities (cross-fade only mouth — never eyes).
  const mouthInhale  = phaseIdx === 0 ? Math.min(1, breath * 2) : 0;
  const mouthExhale  = phaseIdx === 2 ? Math.min(1, breath * 2) : 0;
  const mouthNeutral = 1 - Math.max(mouthInhale, mouthExhale);

  const phaseName = BOX_PHASE_NAMES[phaseIdx];

  return (
    <div className="relative grid place-items-center" style={{ width: size + 20, height: size + 30, transform: `translateY(${bodyY * 0.4}px)` }}>
      {/* aura — continuous */}
      <div className="absolute rounded-full pointer-events-none" style={{
        width: size, height: size,
        background: "radial-gradient(circle, oklch(0.95 0.1 20 / .55), transparent 70%)",
        filter: `blur(${4 + breath * 6}px)`,
        transform: `scale(${0.88 + breath * 0.22})`,
        opacity: 0.55 + breath * 0.35,
      }} />

      <svg viewBox="0 0 240 280" width={size} height={size} aria-label={`Foxy ${phaseName}`} style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={hoodieId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="oklch(0.86 0.1 5)" />
            <stop offset="1" stopColor="oklch(0.76 0.13 5)" />
          </linearGradient>
          <linearGradient id={furId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="oklch(0.82 0.13 45)" />
            <stop offset="1" stopColor="oklch(0.72 0.16 35)" />
          </linearGradient>
          <radialGradient id={tummyId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="oklch(0.97 0.14 25 / 1)" />
            <stop offset="0.5" stopColor="oklch(0.9 0.16 350 / .7)" />
            <stop offset="1" stopColor="oklch(0.9 0.16 350 / 0)" />
          </radialGradient>
          <radialGradient id={cheekId} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="oklch(0.82 0.2 15 / .9)" />
            <stop offset="1" stopColor="oklch(0.82 0.2 15 / 0)" />
          </radialGradient>
        </defs>

        {/* TAIL */}
        <g style={{ transform: `rotate(${tailRot}deg)`, transformOrigin: "60px 220px" }}>
          <path d="M60,220 Q20,210 18,180 Q34,196 60,200 Z" fill={`url(#${furId})`} />
          <path d="M22,188 Q28,180 38,184" stroke="oklch(0.95 0.04 70)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>

        {/* BODY */}
        <g style={{ transform: `scale(${bodyScaleX}, ${bodyScaleY})`, transformOrigin: "120px 240px" }}>
          <ellipse cx="120" cy="220" rx="82" ry="48" fill={`url(#${hoodieId})`} />
          <path d="M52,168 Q120,108 188,168 Q172,188 120,188 Q68,188 52,168Z" fill={`url(#${hoodieId})`} />
          <path d="M68,170 Q120,128 172,170 Q150,178 120,178 Q90,178 68,170Z" fill="oklch(0.66 0.14 5)" opacity="0.5" />

          {/* TUMMY GLOW — continuous */}
          <g style={{
            transform: `translate(120px, 232px) scale(${tummyScale}) translate(-120px,-232px)`,
            opacity: Math.min(1, tummyAlpha),
          }}>
            <circle cx="120" cy="232" r="42" fill={`url(#${tummyId})`} />
          </g>

          <path d="M120,236 q-9,-10 -16,-3 q-5,5 0,11 q5,6 16,12 q11,-6 16,-12 q5,-6 0,-11 q-7,-7 -16,3 z"
                fill="oklch(0.98 0.04 25)" opacity="0.9" />
        </g>

        {/* HEAD */}
        <g style={{ transform: `translate(0px, ${headY}px)` }}>
          <g style={{ transform: `rotate(${earTilt}deg)`, transformOrigin: "82px 70px" }}>
            <path d="M70,82 L60,40 L100,72 Z" fill={`url(#${furId})`} />
            <path d="M75,76 L70,52 L92,72 Z" fill="oklch(0.55 0.16 30)" />
          </g>
          <g style={{ transform: `rotate(${-earTilt}deg)`, transformOrigin: "158px 70px" }}>
            <path d="M170,82 L180,40 L140,72 Z" fill={`url(#${furId})`} />
            <path d="M165,76 L170,52 L148,72 Z" fill="oklch(0.55 0.16 30)" />
          </g>

          <ellipse cx="120" cy="120" rx="62" ry="56" fill={`url(#${furId})`} />
          <path d="M80,118 Q120,170 160,118 Q140,148 120,148 Q100,148 80,118 Z" fill="oklch(0.97 0.02 70)" />
          <ellipse cx="120" cy="138" rx="34" ry="22" fill="oklch(0.97 0.02 70)" />

          <ellipse cx="86"  cy="138" rx="14" ry="9" fill={`url(#${cheekId})`} style={{ opacity: cheekAlpha }} />
          <ellipse cx="154" cy="138" rx="14" ry="9" fill={`url(#${cheekId})`} style={{ opacity: cheekAlpha }} />

          {/* EYES — pupils always rendered */}
          <g>
            <ellipse cx="104" cy="130" rx="5.5" ry="6.5" fill="oklch(0.2 0.04 20)" />
            <circle  cx="106" cy="128" r="1.6" fill="white" />
            <ellipse cx="136" cy="130" rx="5.5" ry="6.5" fill="oklch(0.2 0.04 20)" />
            <circle  cx="138" cy="128" r="1.6" fill="white" />
          </g>
          {/* EYELIDS — fur-colored covers that scale from the top down.
              Driven by continuous breath: 0 (open) -> 1 (closed). */}
          <g>
            <ellipse cx="104" cy="130" rx="7" ry="7.5" fill={`url(#${furId})`}
                     style={{ transformBox: "fill-box", transformOrigin: "center top", transform: `scaleY(${eyelid})` }} />
            <ellipse cx="136" cy="130" rx="7" ry="7.5" fill={`url(#${furId})`}
                     style={{ transformBox: "fill-box", transformOrigin: "center top", transform: `scaleY(${eyelid})` }} />
            <path d="M97,131 Q104,135 111,131"  stroke="oklch(0.3 0.06 25)" strokeWidth="1.6" fill="none" strokeLinecap="round" style={{ opacity: eyelid }} />
            <path d="M129,131 Q136,135 143,131" stroke="oklch(0.3 0.06 25)" strokeWidth="1.6" fill="none" strokeLinecap="round" style={{ opacity: eyelid }} />
          </g>

          <ellipse cx="120" cy="146" rx="4" ry="3" fill="oklch(0.3 0.05 20)" />

          {/* MOUTH — cross-fade between three subtle shapes */}
          <path d="M114,154 Q120,160 126,154" stroke="oklch(0.3 0.05 20)" strokeWidth="2.2" fill="none" strokeLinecap="round" style={{ opacity: mouthNeutral }} />
          <path d="M116,154 Q120,159 124,154" stroke="oklch(0.3 0.05 20)" strokeWidth="2.2" fill="none" strokeLinecap="round" style={{ opacity: mouthInhale }} />
          <ellipse cx="120" cy="156" rx="3.2" ry="4.2" fill="oklch(0.35 0.06 20)" style={{ opacity: mouthExhale * 0.9 }} />
        </g>

        {/* PAWS */}
        <g style={{ transform: `translate(0px, ${lerp(0,-2,breath)}px)` }}>
          <ellipse cx="86"  cy="246" rx="14" ry="10" fill={`url(#${furId})`} />
          <ellipse cx="154" cy="246" rx="14" ry="10" fill={`url(#${furId})`} />
        </g>

        {/* SPARKLES — bloom on hold-full */}
        <g style={{ opacity: sparkleAlpha }}>
          {[ [40,60], [200,50], [30,150], [210,160], [50,250], [195,245] ].map(([x,y],i)=>(
            <path key={i} d={`M${x},${y} l3,7 l7,3 l-7,3 l-3,7 l-3,-7 l-7,-3 l7,-3 z`}
                  fill="oklch(0.92 0.12 80)"
                  style={{ animation: isHoldFull ? `bfSparkle 1.8s ease-in-out ${i*0.14}s infinite` : "none" }} />
          ))}
        </g>

        {/* EXHALE breath puffs */}
        {phaseIdx === 2 && (
          <g>
            {[0,0.6,1.2].map((d,i)=>(
              <circle key={i} cx={120} cy={156} r={5} fill="oklch(0.98 0.02 220 / .85)"
                      style={{ animation: `bfPuff 2.6s ease-out ${d}s infinite`, filter: "blur(1.2px)" }} />
            ))}
          </g>
        )}

        {/* HOLD-EMPTY soft low shimmer dot */}
        {isHoldEmpty && (
          <circle cx={120} cy={232} r={6 + pulse * 4} fill="oklch(0.95 0.06 200 / .35)" style={{ filter: "blur(2px)" }} />
        )}
      </svg>

      {/* Countdown bubble (timestamp-derived) */}
      {showCount && remaining != null && (
        <div className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-sm font-semibold"
          style={{ top: -8, background: "var(--card)", boxShadow: "var(--shadow-soft)", color: "var(--rose)" }}>
          {remaining} · {phaseName}
        </div>
      )}

      <style>{`
        @keyframes bfSparkle { 0%,100% { opacity:.2; transform: scale(.7); } 50% { opacity:1; transform: scale(1.15); } }
        @keyframes bfPuff    { 0% { opacity:0; transform: translate(0,0) scale(.5); } 25% { opacity:.9; } 100% { opacity:0; transform: translate(0,38px) scale(1.6); } }
      `}</style>
    </div>
  );
}

/**
 * Self-cycling rigged Foxy for comfort screens (Motivate softer help, Emergency intro).
 * Uses the same box-breathing engine but without sound; loops gently forever.
 */
function AutoBreathingFox({ size = 220 }: { size?: number; pattern?: any }) {
  const state = useBoxBreathing({ totalRounds: 10_000, withSound: false });
  return <RiggedFox phaseIdx={state.phaseIdx} breath={state.breath} showCount={false} size={size} />;
}

function PhaseChip({ side, active, label, sub }: { side: "left"|"right"|"bottom"|"top"; active: boolean; label: string; sub: string }) {
  const pos: React.CSSProperties =
    side==="left"   ? { left: 0,     top: "50%", transform: "translateY(-50%)" }
  : side==="right"  ? { right: 0,    top: "50%", transform: "translateY(-50%)" }
  : side==="top"    ? { left: "50%", top: 0,     transform: "translateX(-50%)" }
                    : { left: "50%", bottom: 0,  transform: "translateX(-50%)" };
  return (
    <div className="absolute card-cozy px-3 py-2 text-center transition-all"
      style={{
        ...pos,
        background: active ? "var(--gradient-rose)" : "var(--card)",
        color: active ? "var(--primary-foreground)" : "var(--foreground)",
        boxShadow: active ? "var(--shadow-glow)" : "var(--shadow-soft)",
        transform: `${pos.transform} scale(${active?1.1:1})`,
      }}>
      <div className="font-display text-lg leading-none">{label}</div>
      <div className="text-xs opacity-80">{sub}</div>
    </div>
  );
}

function BreatheEnd({ onBack, onRetry }: { onBack: ()=>void; onRetry: ()=>void }) {
  return (
    <div className="animate-fade-up grid md:grid-cols-2 gap-6 items-center">
      <div className="relative rounded-3xl overflow-hidden p-6 grid place-items-center"
        style={{ background: "linear-gradient(135deg, var(--mint), var(--blush))" }}>
        <Petals />
        <Fox pose="proud" size={240} className="relative animate-floaty" />
      </div>
      <div>
        <h2 className="text-3xl font-display">That was good. Your shoulders softer? 🌸</h2>
        <p className="text-muted-foreground mt-2">You did 5 cycles · Calm points +30</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-rose" onClick={()=>{ calmSfx.boop(); onBack(); }}>Yes 🤍</button>
          <button className="btn-ghost" onClick={onRetry}>Not really — one more round</button>
        </div>
      </div>
    </div>
  );
}

/* ============ GROUND ============ */
function GroundIntro({ onYes, onNo }: { onYes: ()=>void; onNo: ()=>void }) {
  useEffect(()=>{ calmSfx.chime(); }, []);
  return (
    <div className="animate-fade-up">
      <BackButton onClick={onNo} label="Back to tools" />
      <div className="relative rounded-3xl p-6 md:p-10 overflow-hidden grid md:grid-cols-2 gap-6 items-center"
        style={{ background: "linear-gradient(135deg, oklch(0.85 0.05 280), oklch(0.92 0.04 320))" }}>
        <Fog opacity={0.55} />
        <div className="relative grid place-items-center">
          <Fox pose="sleepy" size={220} className="relative animate-floaty" />
        </div>
        <div className="relative">
          <Bubble>I got lost in the stress fog again...</Bubble>
          <Bubble delay={600}>Can you help me come back?</Bubble>
          <div className="mt-4 flex gap-2 flex-wrap">
            <button className="btn-rose" onClick={()=>{ startCozyAmbient(); onYes(); }}>Yes, I’ll help 🌿</button>
            <button className="btn-ghost" onClick={onNo}>Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fog({ opacity }: { opacity: number }) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity, transition: "opacity .8s ease" }}>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(at 30% 40%, oklch(0.9 0.02 280 / .9), transparent 60%), radial-gradient(at 70% 60%, oklch(0.92 0.03 320 / .9), transparent 60%)",
        filter: "blur(8px)",
      }} />
    </div>
  );
}

const GROUND_STEPS: { n:number; title:string; hint:string; items:string[] }[] = [
  { n:5, title:"Find 5 things you can see", hint:"Tap things you can spot around you.", items:["Notebook","Water bottle","Pen","Book","Bag","Chair"] },
  { n:4, title:"Find 4 things you can feel", hint:"Touch each one as you tap.", items:["Wall","Table","Backpack","Shoe","Tree","Chair"] },
  { n:3, title:"Listen carefully. What do you hear?", hint:"Even silence is okay.", items:["Fan","Birds","Traffic","Clock","Wind","Typing"] },
  { n:2, title:"Notice 2 things you can smell", hint:"Take a soft sniff.", items:["Coffee","Rain","Book pages","Soap","Flowers"] },
  { n:1, title:"Take 1 slow breath with Foxy", hint:"Breathe in… and out.", items:["One soft breath"] },
];

function GroundSession({ onDone, onExit }: { onDone: ()=>void; onExit: ()=>void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const s = GROUND_STEPS[step];
  const need = s.n;

  useEffect(()=>{
    if (picked.length >= need) {
      calmSfx.shimmer();
      const t = setTimeout(()=>{
        if (step+1 >= GROUND_STEPS.length) { stopCozyAmbient(); calmSfx.success(); onDone(); }
        else { setStep(step+1); setPicked([]); }
      }, 800);
      return ()=>clearTimeout(t);
    }
  }, [picked, step]);

  const fogOpacity = Math.max(0.05, 0.55 - step*0.12);
  const progress = (step + picked.length/need) / GROUND_STEPS.length;

  return (
    <div className="animate-fade-up">
      <BackButton onClick={()=>{ stopCozyAmbient(); onExit(); }} label="Back to tools" />
      <div className="relative rounded-3xl overflow-hidden p-5 md:p-8"
        style={{ background: `linear-gradient(135deg, oklch(${0.85 + step*0.02} 0.06 ${280 - step*20}), oklch(0.95 0.05 ${50 + step*10}))` }}>
        <Fog opacity={fogOpacity} />
        <div className="relative text-center">
          <div className="mx-auto mb-2 h-2 rounded-full overflow-hidden" style={{ width: "min(320px, 90%)", background: "oklch(1 0 0 / .5)" }}>
            <div className="h-full transition-all" style={{ width: `${progress*100}%`, background: "var(--gradient-rose)" }} />
          </div>
          <p className="chip">Step {step+1} of {GROUND_STEPS.length}</p>
          <h1 className="text-2xl md:text-3xl font-display mt-2">{s.title}</h1>
          <p className="text-sm text-muted-foreground">{s.hint}</p>

          <div className="flex flex-wrap justify-center gap-3 my-6">
            {s.items.map((it)=>{
              const isPicked = picked.includes(it);
              return (
                <button key={it} disabled={isPicked}
                  onClick={()=>{ if (!isPicked) { setPicked(p=>[...p, it]); calmSfx.pop(); } }}
                  className="card-cozy px-4 py-3 transition-all text-sm font-medium"
                  style={{
                    background: isPicked ? "var(--gradient-rose)" : "var(--card)",
                    color: isPicked ? "var(--primary-foreground)" : "var(--foreground)",
                    transform: isPicked ? "scale(1.05)" : "scale(1)",
                    boxShadow: isPicked ? "var(--shadow-glow)" : "var(--shadow-soft)",
                  }}>
                  {isPicked?"✓ ":""}{it}
                </button>
              );
            })}
          </div>

          <div className="relative grid place-items-center">
            <Fox pose={step>=3?"cheer":step>=1?"sit":"sleepy"} size={140} />
            <div className="absolute -right-2 top-0 hidden md:block">
              <div className="card-cozy px-3 py-2 text-xs" style={{ background: "var(--card)" }}>
                {step===0 && "Great, let’s keep going 🌸"}
                {step===1 && "You’re doing amazing."}
                {step===2 && "The fog is clearing."}
                {step===3 && "I’m coming back now."}
                {step===4 && "I can see the garden again."}
              </div>
            </div>
          </div>

          {/* growing flowers */}
          <div className="flex gap-2 justify-center mt-4">
            {Array.from({length: GROUND_STEPS.length}).map((_,i)=>(
              <span key={i} className="text-xl transition-all" style={{ opacity: i<step?1:.3, transform: i<step?"scale(1.1)":"scale(.9)" }}>🌼</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GroundEnd({ onBack }: { onBack: ()=>void }) {
  return (
    <div className="animate-fade-up grid md:grid-cols-2 gap-6 items-center">
      <div className="relative rounded-3xl overflow-hidden p-6 grid place-items-center"
        style={{ background: "linear-gradient(135deg, var(--mint), var(--peach))" }}>
        <Petals />
        <Fox pose="cheer" size={240} className="relative animate-floaty" />
      </div>
      <div>
        <h2 className="text-3xl font-display">You did it! 🎉</h2>
        <p className="text-muted-foreground mt-2">You brought me back from the stress fog. Calm points +50 · Stress fog cleared.</p>
        <button className="btn-rose mt-4" onClick={onBack}>Back to Foxy Forest →</button>
      </div>
    </div>
  );
}

/* ============ MOTIVATE ============ */
const MOTIV: { id:string; label:string; emoji:string; sub:string; message:string; action:string }[] = [
  { id:"lazy", label:"I feel lazy", emoji:"😴", sub:"I don’t want to start", message:"Lazy doesn’t mean you’re bad. Your brain just needs a tiny start.", action:"Sit up, drink water, and open the subject page." },
  { id:"scared", label:"I feel scared", emoji:"😟", sub:"I’m worried about exams", message:"Scared means it’s important to you. You’re not alone.", action:"Open your notebook and write the first topic you need to study." },
  { id:"behind", label:"I feel behind", emoji:"😞", sub:"I feel like I’m not enough", message:"Behind doesn’t mean finished. We only need the next small step.", action:"Write the one chapter you can start with." },
  { id:"procr", label:"I keep procrastinating", emoji:"🌀", sub:"I get distracted easily", message:"You’re avoiding a heavy feeling. Let’s make it lighter.", action:"Set a 5-minute timer and only read the heading." },
  { id:"overwhelm", label:"I feel overwhelmed", emoji:"🌪️", sub:"Too many thoughts at once", message:"Too many thoughts can freeze your body. We’ll pick one thing.", action:"Write only 3 tasks. Circle the easiest one." },
  { id:"exam", label:"I have exam stress", emoji:"📚", sub:"My exam is soon", message:"Exam fear is loud, but you can still move softly.", action:"Write one question you can revise right now." },
  { id:"start", label:"I cannot start", emoji:"🚪", sub:"Starting feels heavy", message:"Starting is the hardest door. We only need to touch the handle.", action:"Open the material. No studying yet. Just open it." },
  { id:"giveup", label:"I feel like giving up", emoji:"🤍", sub:"It’s a lot today", message:"Pause. You don’t have to win the whole day. Stay with me for one tiny step.", action:"Take one breath and write one line." },
];

function MotivateChoose({ onPick, onBack }: { onPick: (id:string)=>void; onBack: ()=>void }) {
  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBack} label="Back to tools" />
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-start">
        <div>
          <h1 className="text-3xl font-display">What is making studying hard right now?</h1>
          <p className="text-muted-foreground">Tap whatever feels closest. Foxy will meet you there.</p>
          <div className="grid sm:grid-cols-2 gap-2 mt-5">
            {MOTIV.map(o=>(
              <button key={o.id} onClick={()=>{ calmSfx.pop(); onPick(o.id); }}
                className="card-cozy p-4 text-left hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{o.emoji}</span>
                  <div>
                    <div className="font-medium">{o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="card-cozy p-5 hidden md:flex flex-col items-center" style={{ background: "var(--blush)" }}>
          <Fox pose="card" size={150} />
          <p className="font-display mt-2 text-center">I’m here for you. You’re not alone 🤍</p>
        </div>
      </div>
    </div>
  );
}

function MotivateDetail({ emotionId, onDone, onBack, onEmergency }:{
  emotionId: string; onDone: ()=>void; onBack: ()=>void; onEmergency: ()=>void;
}) {
  const [id, setId] = useState(emotionId || "lazy");
  const opt = MOTIV.find(o=>o.id===id) || MOTIV[0];
  const poseFor: Record<string, any> = { lazy:"sleepy", scared:"sleepy", behind:"sit", procr:"card", overwhelm:"sleepy", exam:"study", start:"point", giveup:"sleepy" };
  const comfortIds = new Set(["scared","overwhelm","giveup","behind"]);
  const useComfort = comfortIds.has(id);
  const [missionDone, setMissionDone] = useState(false);

  if (missionDone) {
    return (
      <div className="animate-fade-up grid md:grid-cols-2 gap-6 items-center">
        <div className="relative rounded-3xl overflow-hidden p-6 grid place-items-center"
          style={{ background: "linear-gradient(135deg, var(--blush), var(--cream))" }}>
          <Petals />
          <Fox pose="cheer" size={240} className="relative animate-floaty" />
        </div>
        <div>
          <h2 className="text-3xl font-display">Yay! You did it 🎉</h2>
          <p className="text-muted-foreground mt-2">Exam Courage +1 · You are stronger than you think.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="btn-rose" onClick={()=>{ calmSfx.success(); onDone(); }}>Back to tools</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBack} label="Back to options" />
      <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
        <div className="relative rounded-3xl overflow-hidden p-5 grid place-items-center"
          style={{ background: "linear-gradient(135deg, var(--blush), var(--lavender))", minWidth: 240, minHeight: 260 }}>
          {useComfort
            ? <AutoBreathingFox size={210} pattern={[4,2,6]} />
            : <Fox pose={poseFor[id] || "card"} size={200} className="animate-floaty" />}
        </div>
        <div>
          <span className="chip">{opt.emoji} {opt.label}</span>
          <Bubble>{opt.message}</Bubble>
          <div className="card-cozy p-5 mt-3" style={{ background: "var(--blush)" }}>
            <div className="text-xs text-muted-foreground">Your tiny mission</div>
            <div className="font-display text-xl mt-1">{opt.action}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-rose" onClick={()=>{ calmSfx.boop(); setMissionDone(true); }}>I did it ✓</button>
              <button className="btn-ghost" onClick={()=>{
                const others = MOTIV.filter(o=>o.id!==id);
                const nxt = others[Math.floor(Math.random()*others.length)].id;
                setId(nxt); calmSfx.pop();
              }}>Give me another tiny step</button>
              <button className="btn-ghost" onClick={onEmergency}>I need softer help 🤍</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ EMERGENCY ============ */
function NightScene() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(180deg, oklch(0.28 0.06 270), oklch(0.22 0.05 280))" }}>
      {Array.from({length: 40}).map((_,i)=>{
        const left=(i*7.3)%100, top=(i*11.7)%80, size= 1 + (i%4);
        return <span key={i} className="absolute rounded-full" style={{
          left:`${left}%`, top:`${top}%`, width:size, height:size, background:"oklch(1 0 0 / .8)",
          animation:`twinkle ${2 + (i%4)}s ease-in-out ${i*0.1}s infinite`,
        }}/>;
      })}
      <style>{`@keyframes twinkle { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
    </div>
  );
}

function EmergencyIntro({ onBreathe, onBack }: { onBreathe: ()=>void; onBack: ()=>void }) {
  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBack} label="Back to tools" />
      <div className="relative rounded-3xl overflow-hidden p-6 md:p-10 min-h-[420px] grid md:grid-cols-2 items-center gap-6">
        <NightScene />
        <div className="relative grid place-items-center py-4">
          <div className="absolute w-72 h-72 rounded-full" style={{ background: "radial-gradient(circle, oklch(0.85 0.1 60 / .35), transparent 70%)" }}/>
          <AutoBreathingFox size={240} pattern={[4,3,6]} />
        </div>
        <div className="relative text-cream" style={{ color: "oklch(0.98 0.02 80)" }}>
          <div className="card-cozy p-4 inline-block" style={{ background: "oklch(1 0 0 / .12)", color: "inherit", borderColor: "oklch(1 0 0 / .2)" }}>
            <p className="font-display text-xl">It’s okay. Let’s stop and breathe first.</p>
          </div>
          <div className="mt-4">
            <button className="btn-rose" onClick={async ()=>{ await resumeAudio(); await prepareBreathingSessionAudio(); calmSfx.boop(); onBreathe(); }}>Breathe with Foxy 🤍</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmergencyBreathe({ onDone, onExit }: { onDone: ()=>void; onExit: ()=>void }) {
  const totalRounds = 3;
  const doneRef = useRef(false);
  useEffect(() => { resumeAudio(); }, []);
  useEffect(() => () => { stopPhaseSounds(); }, []);
  const state = useBoxBreathing({
    totalRounds, withSound: true,
    onComplete: () => {
      if (doneRef.current) return;
      doneRef.current = true;
      stopCozyAmbient(); calmSfx.chime(); onDone();
    },
  });
  const phaseName = BOX_PHASE_NAMES[state.phaseIdx];

  return (
    <div className="animate-fade-up">
      <BackButton onClick={()=>{ stopPhaseSounds(); stopCozyAmbient(); onExit(); }} label="Back to tools" />
      <div className="relative rounded-3xl overflow-hidden p-6 pb-10 min-h-[560px]">
        <NightScene />
        <div className="relative grid place-items-center gap-2" style={{ color: "oklch(0.98 0.02 80)" }}>
          <p className="text-sm opacity-80">Round {Math.min(totalRounds, state.round + 1)} of {totalRounds} · Box breathing</p>
          <div className="relative grid place-items-center my-2">
            <RiggedFox phaseIdx={state.phaseIdx} breath={state.breath} remaining={state.remaining} showCount={false} size={220} />
          </div>
          <div className="font-display text-3xl">{phaseName}</div>
          <div className="font-display text-5xl">{state.remaining}</div>
          <button className="btn-rose mt-4" onClick={()=>{ stopPhaseSounds(); stopCozyAmbient(); onDone(); }}>I feel safer</button>
        </div>
      </div>
    </div>
  );
}

function EmergencyEnd({ onBack }: { onBack: ()=>void }) {
  return (
    <div className="animate-fade-up text-center max-w-md mx-auto py-8">
      <Fox pose="proud" size={200} />
      <h2 className="text-2xl font-display mt-2">You stayed with me 🤍</h2>
      <p className="text-muted-foreground">You did one of the bravest things. Rest a moment, then take one tiny step.</p>
      <button className="btn-rose mt-4" onClick={onBack}>Back to tools</button>
    </div>
  );
}

/* ============ GARDEN ============ */
function GardenScreen({ calm, onBack }: { calm: CalmProgress; onBack: ()=>void }) {
  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBack} label="Back to tools" />
      <h1 className="text-3xl font-display text-center">Your Calm Garden 🌷</h1>
      <div className="relative rounded-3xl overflow-hidden mt-4 p-6"
        style={{ background: "linear-gradient(180deg, var(--cream), var(--mint))" }}>
        <Petals />
        <div className="relative grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 min-h-[180px] items-end">
          {Array.from({length: 24}).map((_,i)=>(
            <div key={i} className="text-2xl text-center transition-all"
              style={{ opacity: i<calm.garden?1:0.2, transform: i<calm.garden?"translateY(0)":"translateY(8px)" }}>
              {i%4===0?"🌸":i%4===1?"🌼":i%4===2?"🌷":"🌿"}
            </div>
          ))}
        </div>
        <div className="relative flex flex-wrap gap-3 mt-4">
          <span className="chip">🌷 Calm points · {calm.points}</span>
          <span className="chip">🌿 Garden · {calm.garden}/24</span>
          <span className="chip">☁️ Fog · {calm.fogPct}%</span>
        </div>
      </div>
      <div className="mt-4 text-center">
        <Fox pose="cheer" size={150} />
        <p className="text-muted-foreground">Every breath plants a flower.</p>
      </div>
    </div>
  );
}

function ClosetScreen({ calm, onBack, onUnlock }:{ calm: CalmProgress; onBack:()=>void; onUnlock:(r:string)=>void }) {
  const items = [
    { id:"flower-crown", emoji:"💐", name:"Flower Crown", cost:60 },
    { id:"study-glasses", emoji:"👓", name:"Study Glasses", cost:120 },
    { id:"sleepy-hoodie", emoji:"🧥", name:"Sleepy Hoodie", cost:180 },
    { id:"grad-cap", emoji:"🎓", name:"Grad Cap", cost:260 },
    { id:"cozy-scarf", emoji:"🧣", name:"Cozy Scarf", cost:140 },
    { id:"honey-mug", emoji:"🍯", name:"Honey Mug", cost:80 },
  ];
  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBack} label="Back to tools" />
      <h1 className="text-3xl font-display text-center">Foxy’s Closet</h1>
      <p className="text-center text-muted-foreground">Collect cute things with calm points · {calm.points} 🌷</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        {items.map(it=>{
          const unlocked = calm.rewards.includes(it.id);
          const canUnlock = calm.points >= it.cost && !unlocked;
          return (
            <div key={it.id} className="card-cozy p-4 text-center" style={{ background: unlocked?"var(--blush)":"var(--card)" }}>
              <div className="text-3xl">{it.emoji}</div>
              <div className="font-medium mt-1">{it.name}</div>
              <div className="text-xs text-muted-foreground">{unlocked?"Unlocked ✓":`${it.cost} pts`}</div>
              {!unlocked && (
                <button className="btn-rose mt-2 !py-1.5 !px-3 text-sm" disabled={!canUnlock}
                  onClick={()=>{ calmSfx.sparkle(); onUnlock(it.id); }}>
                  {canUnlock?"Unlock":"Locked"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
