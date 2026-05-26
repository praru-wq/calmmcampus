import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout, BackButton, useApp } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";
import { useEffect, useMemo, useState } from "react";
import {
  buildSinglePlan, displayTime, formatDuration, getStartTime, recomputeSingleTimes,
  singleMetrics, totalFocusMinutes, totalBreakMinutes, typeText,
  type Activity, type BlockType, type Intensity, type PlanBlock, type SinglePlan, type StartChoice,
} from "@/lib/legacy-planner/engine";
import {
  clearSinglePlan, getPlannerResultForToday, loadSinglePlan, saveSinglePlan, savePlannerResult,
} from "@/lib/legacy-planner/storage";
import { bumpStreak, playSound } from "@/lib/storage";
import { playPlannerSound } from "@/lib/plannerSounds";


export const Route = createFileRoute("/planner/single")({
  head: () => ({ meta: [{ title: "Single Planner — CalmCampus" }] }),
  component: () => <ProtectedLayout><SinglePlannerPage /></ProtectedLayout>,
});

type Step = "setup" | "plan" | "edit" | "locked" | "tracking" | "complete";

// ---------- small UI atoms ----------

function Stepper({ step }: { step: number }) {
  const labels = ["Setup", "Plan", "Edit", "Track", "Complete"];
  return (
    <div className="flex items-center gap-2 my-5">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2 flex-1">
          <div className="grid place-items-center w-7 h-7 rounded-full text-xs font-bold transition-colors"
               style={{ background: i <= step ? "var(--gradient-rose)" : "var(--blush)", color: i <= step ? "white" : "var(--rose)" }}>
            {i + 1}
          </div>
          <span className="text-xs hidden sm:inline" style={{ color: i <= step ? "var(--foreground)" : "var(--muted-foreground)" }}>{l}</span>
          {i < labels.length - 1 && <div className="flex-1 h-0.5" style={{ background: i < step ? "var(--rose)" : "var(--blush)" }} />}
        </div>
      ))}
    </div>
  );
}

function Choice({ active, label, hint, onClick, icon }: { active: boolean; label: string; hint?: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={() => { playPlannerSound("select"); onClick(); }} className="card-cozy text-left px-4 py-3 transition-all"
      style={{ outline: active ? "3px solid var(--rose)" : "3px solid transparent", background: active ? "var(--blush)" : "var(--card)" }}>
      <div className="flex items-center gap-2 font-semibold">{icon && <span>{icon}</span>}{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </button>
  );
}


function ProgressRing({ value, size = 140 }: { value: number; size?: number }) {
  const r = (size - 18) / 2; const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} stroke="oklch(0.92 0.04 20)" strokeWidth="12" fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#sgrad)" strokeWidth="12" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (c * value) / 100}
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,.9,.25,1)" }} />
      <defs><linearGradient id="sgrad" x1="0" x2="1"><stop offset="0" stopColor="oklch(0.82 0.14 10)" /><stop offset="1" stopColor="oklch(0.78 0.13 350)" /></linearGradient></defs>
      <text x="50%" y="46%" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="24" fontWeight="700" fill="oklch(0.4 0.1 15)">{Math.round(value)}%</text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="10" fill="oklch(0.5 0.05 20)">Completed</text>
    </svg>
  );
}

function typeBg(t: BlockType) {
  if (t === "Break") return "var(--lavender)";
  if (t === "Deep") return "var(--rose)";
  if (t === "Light") return "var(--peach)";
  return "var(--mint)";
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-cozy px-4 py-2 text-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

// ---------- main page ----------

function SinglePlannerPage() {
  const { confirm, toast, refresh } = useApp();
  const [plan, setPlan] = useState<SinglePlan | null>(null);
  const [step, setStep] = useState<Step>("setup");
  const [setupStep, setSetupStep] = useState(0); // 0..2
  const [activity, setActivity] = useState<Activity>("Study");
  const [intensity, setIntensity] = useState<Intensity>("Normal");
  const [startChoice, setStartChoice] = useState<StartChoice>("Now");
  const [pickedTime, setPickedTime] = useState("09:00");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from legacy storage
  useEffect(() => {
    const loaded = loadSinglePlan();
    if (loaded) {
      setPlan(loaded);
      const result = getPlannerResultForToday();
      if (result) setStep("complete");
      else if (loaded.locked) setStep("tracking");
      else setStep("plan");
    }
    setHydrated(true);
  }, []);

  // Persist on every plan mutation
  useEffect(() => { if (plan) saveSinglePlan(plan); }, [plan]);

  const mutate = (fn: (p: SinglePlan) => void) => setPlan(prev => {
    if (!prev) return prev;
    const next: SinglePlan = JSON.parse(JSON.stringify(prev));
    fn(next);
    return next;
  });

  // ----- generate -----
  const generate = () => {
    const startTime = getStartTime(startChoice, pickedTime);
    const fresh = buildSinglePlan(activity, intensity, startTime);
    setPlan(fresh);
    setStep("plan");
    playSound("pop");
    playPlannerSound("generate");
  };

  // ----- lock -----
  const lockPlan = async () => {
    if (!plan) return;
    playPlannerSound("warning");
    const ok = await confirm({ title: "Lock this plan?", body: "Once locked, you can't edit it again today. You can still track and finish it." });
    if (!ok) { playPlannerSound("tap"); return; }
    mutate(p => { p.locked = true; p.savedAt = new Date().toISOString(); });
    setStep("tracking");
    bumpStreak(); refresh(); playSound("save"); playPlannerSound("lock"); toast("Plan locked. Go gently. 🔒", "success");
  };

  // ----- track toggle -----
  const toggleBlock = (id: string) => {
    if (!plan || !plan.locked) return;
    const cur = plan.blocks.find(x => x.id === id);
    const becomingChecked = cur ? !cur.completed : false;
    mutate(p => {
      const b = p.blocks.find(x => x.id === id); if (b) b.completed = !b.completed;
    });
    playSound("click");
    playPlannerSound(becomingChecked ? "tick" : "tap");
  };


  // ----- finish day -----
  const finishDay = async () => {
    if (!plan) return;
    const allDone = plan.blocks.every(b => b.completed);
    const now = new Date(); const end = new Date();
    const [eh, em] = plan.endTime.split(":").map(Number); end.setHours(eh, em, 0, 0);
    if (allDone) {
      savePlannerResult("completed");
      setStep("complete"); playSound("chime"); playPlannerSound("complete");
      return;
    }
    if (now > end) {
      savePlannerResult("incomplete");
      setStep("complete"); playPlannerSound("incomplete"); return;
    }
    playPlannerSound("warning");
    const ok = await confirm({
      title: "Finish anyway?",
      body: `You completed ${plan.blocks.filter(b => b.completed).length} / ${plan.blocks.length} blocks. You can still mark the day done.`,
      confirmText: "Finish anyway",
    });
    if (!ok) { playPlannerSound("tap"); return; }
    savePlannerResult("incomplete");
    setStep("complete");
    playPlannerSound("incomplete");
  };

  const startNewPlan = async () => {
    playPlannerSound("warning");
    const ok = await confirm({
      title: "Start a new plan?", body: "This replaces today's plan with a fresh one. Your feedback for today will be cleared.",
      confirmText: "Start new", danger: true,
    });
    if (!ok) { playPlannerSound("tap"); return; }
    clearSinglePlan(); setPlan(null); setStep("setup"); setSetupStep(0); refresh();
    playPlannerSound("next");
    toast("Fresh start ✨", "success");
  };

  const deletePlan = async () => {
    playPlannerSound("warning");
    const ok = await confirm({ title: "Delete today's plan?", body: "This removes the locked plan and progress.", confirmText: "Delete", danger: true });
    if (!ok) { playPlannerSound("tap"); return; }
    clearSinglePlan(); setPlan(null); setStep("setup"); setSetupStep(0); refresh();
    playPlannerSound("delete");
    toast("Plan deleted", "info");
  };


  if (!hydrated) return null;

  // ============ RENDER ============
  if (step === "complete") return <CompletePage plan={plan} onStartNew={startNewPlan} onBack={() => setStep("tracking")} />;
  if (step === "tracking" && plan?.locked) return (
    <TrackingPage plan={plan} onToggle={toggleBlock} onFinish={finishDay} onDelete={deletePlan} onEditAttempt={() => toast("Plan is locked for today 🔒", "info")} />
  );
  if ((step === "plan" || step === "edit") && plan) return (
    <PlanPreviewPage plan={plan} editing={step === "edit"} setEditing={(b) => setStep(b ? "edit" : "plan")}
      mutate={mutate} onLock={lockPlan} onRegen={() => { clearSinglePlan(); setPlan(null); setStep("setup"); setSetupStep(0); }} />
  );

  // SETUP
  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <BackButton label="Back to plans" />
      <div className="text-center">
        <h1 className="text-3xl font-display">Let's plan your perfect day ✨</h1>
        <p className="text-muted-foreground text-sm mt-1">Answer a few questions to get started.</p>
      </div>
      <Stepper step={setupStep} />
      <div className="card-cozy p-6 mt-3">
        {setupStep === 0 && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3 font-semibold mb-1">What are you doing today?</div>
            <Choice active={activity === "Study"} icon="📘" label="Study" onClick={() => setActivity("Study")} />
            <Choice active={activity === "Assignment"} icon="📝" label="Assignment" onClick={() => setActivity("Assignment")} />
            <Choice active={activity === "Mixed"} icon="🔀" label="Mixed" onClick={() => setActivity("Mixed")} />
          </div>
        )}
        {setupStep === 1 && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3 font-semibold mb-1">How intense should today be?</div>
            <Choice active={intensity === "Easy"} icon="🌿" label="Easy" hint="Light & steady (3h)" onClick={() => setIntensity("Easy")} />
            <Choice active={intensity === "Normal"} icon="😊" label="Normal" hint="Balanced day (6h)" onClick={() => setIntensity("Normal")} />
            <Choice active={intensity === "Push"} icon="🔥" label="Push me" hint="Go all in (9h)" onClick={() => setIntensity("Push")} />
          </div>
        )}
        {setupStep === 2 && (
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-3 font-semibold mb-1">When should we start?</div>
            <Choice active={startChoice === "Now"} icon="⏱" label="Now" onClick={() => setStartChoice("Now")} />
            <Choice active={startChoice === "30"} icon="🕐" label="In 30 mins" onClick={() => setStartChoice("30")} />
            <Choice active={startChoice === "Pick"} icon="📅" label="Pick time" onClick={() => setStartChoice("Pick")} />
            {startChoice === "Pick" && (
              <label className="sm:col-span-3 text-sm font-medium">
                Start at <input type="time" className="input-cozy mt-1" value={pickedTime} onChange={(e) => setPickedTime(e.target.value)} />
              </label>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between mt-4">
        <button className="btn-ghost" disabled={setupStep === 0} onClick={() => { playPlannerSound("tap"); setSetupStep(s => s - 1); }}>← Back</button>
        {setupStep < 2
          ? <button className="btn-rose" onClick={() => { playPlannerSound("next"); setSetupStep(s => s + 1); }}>Next →</button>

          : <button className="btn-rose" onClick={generate}>Generate My Plan ✨</button>}
      </div>
    </div>
  );
}

// ---------- Plan preview / edit page ----------

function PlanPreviewPage({ plan, editing, setEditing, mutate, onLock, onRegen }: {
  plan: SinglePlan; editing: boolean; setEditing: (b: boolean) => void;
  mutate: (fn: (p: SinglePlan) => void) => void; onLock: () => void; onRegen: () => void;
}) {
  const focus = totalFocusMinutes(plan);
  return (
    <div className="animate-fade-up">
      <BackButton label="Back" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display">Your Plan for Today</h1>
          <div className="flex gap-2 flex-wrap mt-2">
            <span className="chip" style={{ background: "var(--blush)" }}>{plan.activity}</span>
            <span className="chip" style={{ background: "var(--mint)" }}>{plan.intensity}</span>
            <span className="chip" style={{ background: "var(--peach)" }}>Start: {displayTime(plan.startTime)}</span>
            <span className="chip" style={{ background: "var(--lavender)" }}>End: {displayTime(plan.endTime)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onRegen}>Regenerate</button>
          <button className="btn-ghost" onClick={() => setEditing(!editing)}>{editing ? "Done editing" : "✎ Edit Plan"}</button>
          <button className="btn-rose" onClick={onLock}>Save & Lock 🔒</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] gap-6 mt-5">
        <div className="card-cozy p-5">
          <div className="space-y-2">
            {plan.blocks.map((b, idx) => (
              <div key={b.id} className="card-cozy p-3 flex items-center gap-3" style={{ background: b.category === "break" ? "color-mix(in oklab, var(--mint) 35%, var(--card))" : "var(--card)" }}>
                <div className="text-xs font-mono w-36 text-muted-foreground">{displayTime(b.startTime)} – {displayTime(b.endTime)}</div>
                {editing ? (
                  <input className="input-cozy flex-1" value={b.task}
                    onChange={(e) => mutate(p => { const x = p.blocks[idx]; x.task = e.target.value; x.label = e.target.value; })} />
                ) : (
                  <div className="flex-1 font-medium">{b.task}</div>
                )}
                {editing ? (
                  <select className="input-cozy" value={typeText(b)}
                    onChange={(e) => mutate(p => {
                      const x = p.blocks[idx];
                      const t = e.target.value as BlockType;
                      x.type = t; x.category = t === "Break" ? "break" : "study";
                    })}>
                    {(["Deep", "Medium", "Light", "Break"] as BlockType[]).map(t => <option key={t}>{t}</option>)}
                  </select>
                ) : (
                  <span className="chip text-white" style={{ background: typeBg(typeText(b)) }}>{typeText(b)}</span>
                )}
                {editing && plan.blocks.length > 1 && (
                  <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => mutate(p => {
                    p.blocks = p.blocks.filter(x => x.id !== b.id); recomputeSingleTimes(p);
                  })}>✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside className="card-cozy p-5 self-start text-center min-w-[240px]">
          <Fox pose="proud" size={150} />
          <div className="mt-2 font-display text-lg">Plan Summary</div>
          <div className="mt-3 space-y-2">
            <StatPill label="Blocks" value={String(plan.blocks.length)} />
            <StatPill label="Focus Time" value={formatDuration(focus)} />
            <StatPill label="Break Time" value={formatDuration(totalBreakMinutes(plan))} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- Tracking page (locked) ----------

function TrackingPage({ plan, onToggle, onFinish, onDelete, onEditAttempt }: {
  plan: SinglePlan; onToggle: (id: string) => void; onFinish: () => void; onDelete: () => void; onEditAttempt: () => void;
}) {
  const m = singleMetrics(plan);
  return (
    <div className="animate-fade-up">
      <BackButton label="Back to plans" />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display">Track Your Progress 🔒</h1>
          <p className="text-muted-foreground text-sm">
            Today · {new Date(plan.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} · {plan.activity} · {plan.intensity}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onEditAttempt}>✎ Edit (locked)</button>
          <button className="btn-ghost" onClick={onDelete}>Delete plan</button>
          <button className="btn-rose" onClick={onFinish}>Complete Day</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] gap-6 mt-5">
        <div className="card-cozy p-5">
          <div className="space-y-2">
            {plan.blocks.map(b => (
              <BlockRow key={b.id} block={b} checked={b.completed} onToggle={() => onToggle(b.id)} />
            ))}
          </div>
        </div>
        <aside className="card-cozy p-5 self-start text-center min-w-[260px]">
          <ProgressRing value={m.completionPercentage} />
          <div className="mt-3 text-sm font-medium">{m.completedBlocks} / {m.totalBlocks} blocks completed</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <StatPill label="Focus" value={formatDuration(m.completedStudyTime)} />
            <StatPill label="Of" value={formatDuration(m.totalStudyTime)} />
          </div>
          <div className="card-cozy mt-4 p-3 text-xs text-muted-foreground" style={{ background: "var(--blush)" }}>
            You're doing great! Consistency beats perfection. Keep going 🌷
          </div>
        </aside>
      </div>
    </div>
  );
}

function BlockRow({ block, checked, onToggle }: { block: PlanBlock; checked: boolean; onToggle: () => void }) {
  const t = typeText(block);
  return (
    <button onClick={onToggle} className="w-full text-left card-cozy p-3 flex items-center gap-3 transition-all"
      style={{ background: checked ? "color-mix(in oklab, var(--mint) 40%, var(--card))" : "var(--card)" }}>
      <div className="w-6 h-6 rounded-md grid place-items-center text-xs font-bold"
           style={{ background: checked ? "var(--rose)" : "var(--blush)", color: "white" }}>{checked ? "✓" : ""}</div>
      <div className="text-xs font-mono w-36 text-muted-foreground">{displayTime(block.startTime)} – {displayTime(block.endTime)}</div>
      <div className="flex-1 font-medium">{block.task}</div>
      <span className="chip text-white" style={{ background: typeBg(t) }}>{t}</span>
    </button>
  );
}

// ---------- Completion feedback ----------

function CompletePage({ plan, onStartNew, onBack }: { plan: SinglePlan | null; onStartNew: () => void; onBack: () => void }) {
  const m = singleMetrics(plan);
  const result = getPlannerResultForToday();
  const isCompleted = result?.type === "completed" || m.completionPercentage === 100;

  const completedMessages = useMemo(() => [
    "You completed everything today. That is discipline.",
    "You followed through completely. That matters.",
    "You stayed consistent. Good work.",
    "You finished your plan fully. Keep going.",
    "You did exactly what you planned.",
  ], []);
  const incompleteMessages = useMemo(() => [
    "You didn't complete your plan today, but that's okay. Tomorrow is another chance.",
    "You made some progress. Let's try again tomorrow.",
    "It wasn't perfect, but you showed up. That matters.",
    "Some things were left undone. Let's bounce back tomorrow.",
    "You tried today. Tomorrow you'll do better.",
  ], []);

  const message = (isCompleted ? completedMessages : incompleteMessages)[Math.floor(Math.random() * 5)];

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <BackButton label="Back" onClick={onBack} />
      <div className="card-cozy p-8 text-center" style={{ background: isCompleted ? "linear-gradient(180deg, var(--blush), var(--card))" : "linear-gradient(180deg, var(--lavender), var(--card))" }}>
        <div className="mx-auto"><Fox pose={isCompleted ? "cheer" : "sleepy"} size={140} /></div>
        <h1 className="text-3xl font-display mt-2">{isCompleted ? "All Done! 🎉" : "Not Fully Done, But That's Okay 🌷"}</h1>
        <p className="text-muted-foreground mt-1">{isCompleted ? "You completed your plan!" : "You made progress today."}</p>
        <div className="mt-6 grid place-items-center"><ProgressRing value={m.completionPercentage} size={160} /></div>
        <div className="mt-4 text-sm">{m.completedBlocks} / {m.totalBlocks} Blocks Completed</div>
        <div className="mt-3 grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <StatPill label="Focus Time" value={formatDuration(m.completedStudyTime)} />
          <StatPill label={isCompleted ? "Break Time" : "Pending"} value={isCompleted ? formatDuration(totalBreakMinutes(plan)) : String(m.totalBlocks - m.completedBlocks)} />
        </div>
        <div className="card-cozy mt-5 p-3 text-sm" style={{ background: "var(--blush)" }}>{message}</div>
        <div className="mt-5 flex gap-2 justify-center flex-wrap">
          <button className="btn-ghost" onClick={onBack}>View Feedback</button>
          <button className="btn-rose" onClick={onStartNew}>Start New Plan ✨</button>
        </div>
      </div>
    </div>
  );
}
