import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedLayout, BackButton, useApp } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";
import { useEffect, useMemo, useReducer, useState } from "react";
import { playSound, bumpStreak, todayStr } from "@/lib/storage";
import { playPlannerSound } from "@/lib/plannerSounds";
import * as planner from "@/lib/legacy-planner/detailed-adapter";


export const Route = createFileRoute("/planner/detailed")({
  head: () => ({ meta: [{ title: "Detailed Planner — CalmCampus" }] }),
  component: () => <ProtectedLayout><DetailedPage /></ProtectedLayout>,
});

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const;
const FIXED_CATEGORIES = ["Class","College","Travel","Gym","Lunch","Dinner","Sleep","Tuition","Work","Family","Exam","Lab","Prayer","Appointment","Commute","Other"];
const TASK_TYPES = ["Study","Exam Prep","Assignment","Project","Revision","Practice","Reading","Lab","Record","Presentation","Other"];
const INTENSITIES = ["Light","Balanced","Intense"] as const;
const FOCUS_TIMES = ["Morning","Afternoon","Night"] as const;
const SESSION_LENGTHS = ["30 min","50 min","90 min"] as const;
const BREAK_PREFS = ["Frequent","Normal","Minimal"] as const;
const STEPS = ["Setup","Fixed","Tasks","Preferences","Review"] as const;

type Step = "setup" | "fixed" | "tasks" | "prefs" | "review" | "week" | "day" | "feedback";

function useForceRender() {
  const [, force] = useReducer((x) => x + 1, 0);
  return force as () => void;
}

function DetailedPage() {
  const { user, confirm, toast } = useApp();
  const nav = useNavigate();
  const rerender = useForceRender();
  const [step, setStep] = useState<Step>("setup");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Load from legacy localStorage once.
  useEffect(() => {
    planner.ensureLoaded();
    const plan = planner.getPlan();
    if (plan?.days?.length) {
      const today = todayStr();
      // If today is completed, show feedback page; else go to week or track.
      if (planner.isDetailedDateCompleted(today) && planner.isDateInsideDetailedPlan(today)) {
        setSelectedDate(today);
        setStep("feedback");
      } else if (planner.isDetailedPlanLocked()) {
        const active = planner.getActiveDetailedTrackDate() || plan.days[0]?.date;
        setSelectedDate(active);
        setStep("day");
      } else {
        setSelectedDate(plan.days[0]?.date);
        setStep("week");
      }
    }
    rerender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  // Surgical helper: deletes only the current Detailed Planner data, then
  // returns the user to the fresh setup step. Used by Week/Day/Feedback views.
  const handleDeleteCurrentDetailedPlan = async () => {
    playPlannerSound("warning");
    const ok = await confirm({
      title: "Delete current detailed plan?",
      body: "This will remove your generated Detailed Planner schedule, tracking progress, locked days, and feedback. You can create a new Detailed Planner after this.",
      confirmText: "Delete Plan",
      danger: true,
    });
    if (!ok) { playPlannerSound("tap"); return; }
    planner.resetEverything();
    setSelectedDate(null);
    setEditing(false);
    setStep("setup");
    rerender();
    playPlannerSound("delete");
    toast("Detailed plan deleted. You can start fresh.", "info");
  };

  if (step === "setup") return <SetupStep onNext={() => { playPlannerSound("next"); setStep("fixed"); }} />;
  if (step === "fixed") return <FixedStep onBack={() => { playPlannerSound("tap"); setStep("setup"); }} onNext={() => { playPlannerSound("next"); setStep("tasks"); }} />;
  if (step === "tasks") return <TasksStep onBack={() => { playPlannerSound("tap"); setStep("fixed"); }} onNext={() => { playPlannerSound("next"); setStep("prefs"); }} />;
  if (step === "prefs") return <PrefsStep onBack={() => { playPlannerSound("tap"); setStep("tasks"); }} onNext={() => { playPlannerSound("next"); setStep("review"); }} />;
  if (step === "review") return (
    <ReviewStep
      onBack={() => { playPlannerSound("tap"); setStep("prefs"); }}
      onGenerate={async () => {
        if ((planner.detailedState.tasks || []).length === 0) { playPlannerSound("warning"); toast("Add at least one task first.", "error"); return; }
        let plan: any = null;
        try { plan = planner.generatePlan(); }
        catch (err) { console.error("[detailed] generate failed:", err); }
        if (!plan?.days?.length) {
          playPlannerSound("warning");
          toast("Couldn't generate this plan yet. Check if your days are fully blocked or add more available time.", "error");
          return;
        }
        bumpStreak(); playSound("save"); playPlannerSound("generate");
        toast("Detailed plan generated ✨", "success");
        setSelectedDate(plan.days[0].date);
        setStep("week");
      }}
      onDelete={async () => {
        playPlannerSound("warning");
        const ok = await confirm({ title: "Delete detailed plan?", body: "Clears setup, tasks, preferences, and the generated plan.", confirmText: "Delete", danger: true });
        if (!ok) { playPlannerSound("tap"); return; }
        planner.resetEverything();
        rerender();
        setStep("setup");
        playPlannerSound("delete");
        toast("Plan cleared", "info");
      }}
    />
  );
  if (step === "week") return (
    <WeekView
      onPick={(date: string) => { playPlannerSound("next"); setSelectedDate(date); setEditing(false); setStep("day"); }}
      onBackToReview={() => { playPlannerSound("tap"); setStep("review"); }}
      onStartNew={async () => {
        playPlannerSound("warning");
        const ok = await confirm({ title: "Start a new plan?", body: "This clears the current detailed plan.", confirmText: "Start new", danger: true });
        if (!ok) { playPlannerSound("tap"); return; }
        planner.resetEverything(); rerender(); setStep("setup");
        playPlannerSound("next");
      }}
      onDeleteCurrent={handleDeleteCurrentDetailedPlan}
    />
  );
  if (step === "day" && selectedDate) return (
    <DayView
      date={selectedDate}
      editing={editing}
      onBack={() => { playPlannerSound("tap"); setEditing(false); setStep("week"); }}
      onToggleEdit={() => { playPlannerSound("tap"); setEditing((e) => !e); }}
      onChange={rerender}
      onLock={async () => {
        playPlannerSound("warning");
        const ok = await confirm({ title: "Save & lock this plan?", body: "Locked days can be tracked but not edited. Fixed blocks always stay locked." });
        if (!ok) { playPlannerSound("tap"); return; }
        planner.lockAllPlanDates();
        setEditing(false);
        playSound("save");
        playPlannerSound("lock");
        toast("Plan locked 🔒", "success");
        rerender();
      }}
      onEndDay={async () => {
        playPlannerSound("warning");
        const ok = await confirm({ title: "End this day?", body: "We'll record what you finished and show feedback." });
        if (!ok) { playPlannerSound("tap"); return; }
        const prog = planner.getProgressForDate(selectedDate);
        const complete = (prog.completed || 0) >= (prog.total || 0) - 1; // gentle threshold
        planner.saveFeedback(selectedDate, { complete });
        playSound("chime");
        playPlannerSound(complete ? "complete" : "incomplete");
        setStep("feedback");
      }}
      onDeleteCurrent={handleDeleteCurrentDetailedPlan}
    />
  );
  if (step === "feedback" && selectedDate) return (
    <FeedbackView
      date={selectedDate}
      onBackHome={() => { playPlannerSound("tap"); nav({ to: "/dashboard" }); }}
      onViewTomorrow={() => {
        const next = planner.getNextDetailedPlanDate(selectedDate);
        if (next) { playPlannerSound("next"); setSelectedDate(next); setStep("day"); }
        else { playPlannerSound("warning"); toast("No next plan day.", "info"); }
      }}
      onStartNew={async () => {
        playPlannerSound("warning");
        const ok = await confirm({ title: "Start a new plan?", body: "Clears the current detailed plan.", confirmText: "Start new", danger: true });
        if (!ok) { playPlannerSound("tap"); return; }
        planner.resetEverything(); rerender(); setStep("setup");
        playPlannerSound("next");
      }}
      onDeleteCurrent={handleDeleteCurrentDetailedPlan}
    />
  );

  return null;
}

/* =========================  shared shell  ========================= */

function StepShell({
  title, sub, stepIndex, children, onBack, onNext, nextLabel = "Next", nextDisabled = false, foxPose = "study" as const,
  extraButtons,
}: any) {
  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <BackButton onClick={onBack} label="Back" />
      <div className="flex gap-1 mb-3">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full"
            style={{ background: i <= stepIndex ? "var(--rose)" : "var(--blush)" }} />
        ))}
      </div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl font-display">{title}</h1>
          <p className="text-muted-foreground text-sm">{sub}</p>
        </div>
        <div className="hidden md:block animate-floaty"><Fox pose={foxPose} size={110} /></div>
      </div>
      <div className="card-cozy p-6">{children}</div>
      <div className="flex flex-wrap justify-end mt-4 gap-2">
        {extraButtons}
        {onBack && <button className="btn-ghost" onClick={onBack}>← Back</button>}
        {onNext && <button className="btn-rose" onClick={onNext} disabled={nextDisabled}>{nextLabel} →</button>}
      </div>
    </div>
  );
}

/* =========================  STEP 1 · SETUP  ========================= */

function SetupStep({ onNext }: { onNext: () => void }) {
  const s = (planner.detailedState.setup || {}) as any;
  const t = todayStr();
  const initialScope = s.scope === "Multiple Days" || (s.endDate && s.startDate && s.endDate !== s.startDate) ? "Multiple Days" : "Today Only";
  const [scope, setScope] = useState<"Today Only" | "Multiple Days">(initialScope);
  const [startDate, setStartDate] = useState<string>(s.startDate || t);
  const [endDate, setEndDate] = useState<string>(s.endDate || s.startDate || t);
  const [startTime, setStartTime] = useState<string>(s.startTime || "09:00");
  const [endTime, setEndTime] = useState<string>(s.endTime || "21:00");

  const overnight = parseTime(endTime) <= parseTime(startTime);
  const valid = !!startDate && !!startTime && !!endTime && (scope === "Today Only" || (endDate >= startDate));

  return (
    <StepShell
      title="Let's build your plan foundation"
      sub="Tell us the basics so we can plan smart for you."
      stepIndex={0}
      nextDisabled={!valid}
      onNext={() => {
        planner.setSetup({ scope, startDate, endDate: scope === "Today Only" ? startDate : endDate, startTime, endTime });
        onNext();
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm font-medium sm:col-span-2">Plan Scope
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(["Today Only","Multiple Days"] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => { playPlannerSound("select"); setScope(opt); }} className="btn-ghost"
                style={{ background: scope === opt ? "var(--blush)" : undefined, borderColor: scope === opt ? "var(--rose)" : undefined }}>
                {opt}
              </button>
            ))}
          </div>
        </label>
        <label className="text-sm font-medium">Start Date
          <input type="date" className="input-cozy mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="text-sm font-medium">End Date
          <input type="date" className="input-cozy mt-1" value={endDate} disabled={scope === "Today Only"}
            onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Daily Start Time
          <input type="time" className="input-cozy mt-1" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="text-sm font-medium">Daily End Time
          <input type="time" className="input-cozy mt-1" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
        {overnight && (
          <div className="sm:col-span-2 text-xs px-3 py-2 rounded-md" style={{ background: "var(--lavender)" }}>
            Late-night plan detected — we'll schedule overnight. Try to rest too, sleep matters.
          </div>
        )}
      </div>
    </StepShell>
  );
}

/* =========================  STEP 2 · FIXED  ========================= */

function FixedStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const rerender = useForceRender();
  const list: any[] = planner.detailedState.fixedBlocks || [];
  const [form, setForm] = useState<{ title: string; category: string; startTime: string; endTime: string; days: string[] }>({
    title: "", category: "Class", startTime: "11:00", endTime: "12:00",
    days: ["Mon","Tue","Wed","Thu","Fri"],
  });
  const overlaps = planner.fixedOverlaps();

  const toggleDay = (d: string) => { playPlannerSound("select"); setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] })); };
  const add = () => {
    if (!form.title.trim()) { playPlannerSound("warning"); return; }
    const ok = planner.addFixed(form);
    if (!ok) { playPlannerSound("warning"); return; }
    setForm({ ...form, title: "" });
    rerender();
    playPlannerSound("save");
  };
  const remove = (id: string) => { planner.deleteFixed(id); rerender(); playPlannerSound("delete"); };


  return (
    <StepShell title="Add your fixed commitments" sub="Times you can't study — class, gym, meals, sleep, commute…" stepIndex={1} onBack={onBack} onNext={onNext}>
      <div className="grid sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-end">
        <input className="input-cozy" placeholder="Title (e.g. Physics Lecture)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select className="input-cozy" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {FIXED_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input type="time" className="input-cozy" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <input type="time" className="input-cozy" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        <button className="btn-rose" type="button" onClick={add}>+ Add</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DAYS.map((d) => (
          <button key={d} type="button" onClick={() => toggleDay(d)} className="chip"
            style={{ background: form.days.includes(d) ? "var(--rose)" : "var(--blush)", color: form.days.includes(d) ? "white" : undefined }}>
            {d}
          </button>
        ))}
      </div>

      {overlaps.length > 0 && (
        <div className="mt-3 text-xs px-3 py-2 rounded-md" style={{ background: "color-mix(in oklab, var(--destructive) 12%, var(--card))" }}>
          Heads up: {overlaps.join(" · ")}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {list.length === 0 && <div className="text-center text-sm text-muted-foreground py-4">No fixed commitments yet — totally fine.</div>}
        {list.map((f: any) => (
          <div key={f.id} className="card-cozy p-3 flex items-center gap-3" style={{ background: "var(--blush)" }}>
            <div className="flex-1">
              <b>{f.title}</b>
              <span className="chip ml-2 !py-0.5 !px-2 text-[10px]" style={{ background: "var(--lavender)" }}>{f.category}</span>
              <span className="text-xs text-muted-foreground ml-2">{(f.days || []).join(", ")} · {f.startTime}–{f.endTime}</span>
            </div>
            <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => remove(f.id)}>Remove</button>
          </div>
        ))}
      </div>
    </StepShell>
  );
}

/* =========================  STEP 3 · TASKS  ========================= */

function TasksStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const rerender = useForceRender();
  const list: any[] = planner.detailedState.tasks || [];
  const t = todayStr();
  const [form, setForm] = useState<{ taskName: string; taskType: string; dueDate: string; difficulty: number; preparedness: number }>({
    taskName: "", taskType: "Study", dueDate: t, difficulty: 5, preparedness: 50,
  });
  const add = () => {
    if (!form.taskName.trim()) { playPlannerSound("warning"); return; }
    const ok = planner.addTask(form);
    if (!ok) { playPlannerSound("warning"); return; }
    setForm({ ...form, taskName: "" });
    rerender();
    playPlannerSound("save");
  };
  const remove = (id: string) => { planner.deleteTask(id); rerender(); playPlannerSound("delete"); };



  return (
    <StepShell title="Add your academic tasks" sub="Be specific — we'll schedule them smartly." stepIndex={2} onBack={onBack} onNext={onNext} nextDisabled={list.length === 0} foxPose="books">
      <div className="grid sm:grid-cols-2 gap-2 items-end">
        <label className="text-sm sm:col-span-2">Task name
          <input className="input-cozy mt-1" placeholder="e.g. Math - Chapter 5 (Matrices)" value={form.taskName} onChange={(e) => setForm({ ...form, taskName: e.target.value })} />
        </label>
        <label className="text-sm">Task type
          <select className="input-cozy mt-1" value={form.taskType} onChange={(e) => setForm({ ...form, taskType: e.target.value })}>
            {TASK_TYPES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm">Due date
          <input type="date" className="input-cozy mt-1" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </label>
        <label className="text-sm">Difficulty (0–10)
          <input type="range" min={0} max={10} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: clamp(+e.target.value, 0, 10) })} className="w-full" />
          <span className="text-xs">{form.difficulty}</span>
        </label>
        <label className="text-sm">Preparedness (0–100%)
          <input type="range" min={0} max={100} value={form.preparedness} onChange={(e) => setForm({ ...form, preparedness: clamp(+e.target.value, 0, 100) })} className="w-full" />
          <span className="text-xs">{form.preparedness}%</span>
        </label>
        <button className="btn-rose sm:col-span-2" type="button" onClick={add}>+ Add task</button>
      </div>
      <div className="mt-4 space-y-2">
        {list.map((tk: any) => {
          const lvl = tk.priorityLevel || "Medium";
          const bg = lvl === "High" ? "var(--rose)" : lvl === "Low" ? "var(--mint)" : "var(--peach)";
          return (
            <div key={tk.id} className="card-cozy p-3 flex items-center gap-3">
              <div className="flex-1">
                <b>{tk.taskName}</b>{" "}
                <span className="text-xs text-muted-foreground">{tk.taskType} · due {tk.dueDate} · diff {tk.difficulty} · prep {tk.preparedness}%</span>
              </div>
              <span className="chip" style={{ background: bg, color: "white" }}>{lvl}</span>
              <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => remove(tk.id)}>Remove</button>
            </div>
          );
        })}
      </div>
    </StepShell>
  );
}

/* =========================  STEP 4 · PREFS  ========================= */

function PrefsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const p = (planner.detailedState.preferences || {}) as any;
  const [intensity, setIntensity] = useState<string>(p.intensity || "Balanced");
  const [bestFocus, setBestFocus] = useState<string>(p.bestFocus || "Morning");
  const [sessionLength, setSessionLength] = useState<string>(p.sessionLength || "50 min");
  const [breakPreference, setBreakPreference] = useState<string>(p.breakPreference || "Normal");
  const [includeBuffer, setIncludeBuffer] = useState<boolean>(!!p.includeBuffer);

  return (
    <StepShell title="Your preferences, your perfect plan" sub="Help us match the plan to your natural rhythm." stepIndex={3} onBack={onBack}
      onNext={() => { planner.setPreferences({ intensity, bestFocus, sessionLength, breakPreference, includeBuffer }); onNext(); }}
      foxPose="card"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        {INTENSITIES.map((opt) => (
          <button key={opt} type="button" onClick={() => { playPlannerSound("select"); setIntensity(opt); }} className="card-cozy p-4 text-center"
            style={{ background: intensity === opt ? "var(--blush)" : undefined, borderColor: intensity === opt ? "var(--rose)" : undefined }}>
            <div className="font-semibold">{opt}</div>
            <div className="text-xs text-muted-foreground">
              {opt === "Light" && "Ease into study, shorter sessions"}
              {opt === "Balanced" && "Balanced & steady progress"}
              {opt === "Intense" && "Deep focus, longer sessions"}
            </div>
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label className="text-sm">Best Focus Time
          <select className="input-cozy mt-1" value={bestFocus} onChange={(e) => setBestFocus(e.target.value)}>
            {FOCUS_TIMES.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="text-sm">Focus Session Length
          <select className="input-cozy mt-1" value={sessionLength} onChange={(e) => setSessionLength(e.target.value)}>
            {SESSION_LENGTHS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="text-sm">Break Preference
          <select className="input-cozy mt-1" value={breakPreference} onChange={(e) => setBreakPreference(e.target.value)}>
            {BREAK_PREFS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="text-sm flex items-center gap-3 mt-2">
          <input type="checkbox" checked={includeBuffer} onChange={(e) => setIncludeBuffer(e.target.checked)} />
          Include small buffer between blocks
        </label>
      </div>
    </StepShell>
  );
}

/* =========================  STEP 5 · REVIEW  ========================= */

function ReviewStep({ onBack, onGenerate, onDelete }: any) {
  const s = (planner.detailedState.setup || {}) as any;
  const p = (planner.detailedState.preferences || {}) as any;
  const tasks: any[] = planner.detailedState.tasks || [];
  const fixed: any[] = planner.detailedState.fixedBlocks || [];
  const counts = planner.priorityCountsFromTasks();
  const methods = methodsForPrefs(p);

  return (
    <StepShell title="Review your plan inputs" sub="Almost there! Check everything before we create your plan." stepIndex={4} onBack={onBack} foxPose="proud"
      extraButtons={<button className="btn-ghost" onClick={onDelete}>Delete plan</button>}
      onNext={onGenerate} nextLabel="Generate My Plan ✨" nextDisabled={tasks.length === 0}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="card-cozy p-4" style={{ background: "var(--blush)" }}>
          <div className="text-xs text-muted-foreground">Plan Foundation</div>
          <div className="font-semibold">{s.scope || "Today Only"}</div>
          <div className="text-xs">{s.startDate} → {s.endDate || s.startDate}</div>
          <div className="text-xs">Daily: {s.startTime}–{s.endTime}</div>
        </div>
        <div className="card-cozy p-4" style={{ background: "var(--lavender)" }}>
          <div className="text-xs text-muted-foreground">Fixed Events ({fixed.length})</div>
          <ul className="text-xs mt-1 space-y-0.5">
            {fixed.slice(0, 4).map((f) => <li key={f.id}>{f.title} <span className="text-muted-foreground">({(f.days || []).join(",")} {f.startTime}–{f.endTime})</span></li>)}
            {fixed.length > 4 && <li>+{fixed.length - 4} more…</li>}
          </ul>
        </div>
        <div className="card-cozy p-4" style={{ background: "var(--mint)" }}>
          <div className="text-xs text-muted-foreground">Academic Tasks ({tasks.length})</div>
          <ul className="text-xs mt-1 space-y-0.5">
            {tasks.slice(0, 6).map((t) => <li key={t.id}>{t.taskName} <span className="text-muted-foreground">({t.priorityLevel})</span></li>)}
            {tasks.length > 6 && <li>+{tasks.length - 6} more…</li>}
          </ul>
        </div>
        <div className="card-cozy p-4" style={{ background: "var(--peach)" }}>
          <div className="text-xs text-muted-foreground">Preferences</div>
          <div className="font-semibold">{p.intensity} · {p.bestFocus}</div>
          <div className="text-xs">{p.sessionLength} · {p.breakPreference} breaks</div>
          <div className="text-xs">{p.includeBuffer ? "Buffer included" : "No buffer"}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip" style={{ background: "var(--rose)", color: "white" }}>High: {counts.High}</span>
        <span className="chip" style={{ background: "var(--peach)" }}>Medium: {counts.Medium}</span>
        <span className="chip" style={{ background: "var(--mint)" }}>Low: {counts.Low}</span>
      </div>
      <MethodsCard methods={methods} />
    </StepShell>
  );
}

/* =========================  WEEK / DAY  ========================= */

function DeleteCurrentPlanButton({ onClick }: { onClick: () => void }) {
  // Soft danger / blush — secondary, smaller weight than primary CTAs.
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-medium rounded-full px-3 py-1.5 border transition-colors hover:opacity-90"
      style={{
        background: "color-mix(in oklab, var(--rose) 18%, var(--card))",
        borderColor: "color-mix(in oklab, var(--rose) 35%, transparent)",
        color: "color-mix(in oklab, var(--rose) 75%, var(--foreground))",
      }}
      title="Delete the current Detailed Planner plan"
    >
      Delete Current Detailed Plan
    </button>
  );
}

function WeekView({ onPick, onBackToReview, onStartNew, onDeleteCurrent }: any) {
  const days = planner.getDays();
  const methods = planner.getMethods().length ? planner.getMethods() : methodsForPrefs(planner.detailedState.preferences || {});
  const warnings = planner.getWarnings();
  const allDone = planner.areAllDetailedPlanDaysCompleted();
  const locked = planner.isDetailedPlanLocked();
  const today = todayStr();
  const smartNotes = planner.getSmartNotes();
  const overload = planner.getOverloadSummary();

  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBackToReview} label={locked ? "Back" : "Back to review"} />
      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <div>
          <h1 className="text-3xl font-display">Your study plan is ready! ✨</h1>
          <p className="text-muted-foreground text-sm">{days[0]?.date} — {days[days.length - 1]?.date}</p>
        </div>
        <div className="max-w-md w-full"><MethodsCard methods={methods} compact /></div>
      </div>
      {smartNotes.length > 0 && (
        <div className="card-cozy p-4 mb-3" style={{ background: "var(--blush)" }}>
          <div className="font-semibold mb-1">Smart planning notes</div>
          <ul className="text-sm list-disc pl-5 space-y-0.5">{smartNotes.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="card-cozy p-3 mb-3" style={{ background: "color-mix(in oklab, var(--peach) 60%, var(--card))" }}>
          <b>Heads up:</b>
          <ul className="text-sm list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {overload.items.length > 0 && (
        <div className="card-cozy p-4 mb-3" style={{ background: "color-mix(in oklab, var(--destructive) 10%, var(--card))" }}>
          <div className="font-semibold mb-1">Some work could not fit</div>
          <ul className="text-sm list-disc pl-5 space-y-0.5">
            {overload.items.map((it, i) => <li key={i}>{it.taskName}: ~{fmtMins(it.missingMins)}</li>)}
          </ul>
          <div className="text-xs text-muted-foreground mt-2">Try extending your end time, lowering intensity, or adding another day.</div>
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {days.map((day: any) => {
          const tp = planner.getTrackableProgress(day.date);
          const totals = planner.getDayTotals(day);
          const blocks: any[] = day.blocks || [];
          const total = tp.total;
          const done = tp.done;
          const dayLocked = planner.isDateLocked(day.date);
          const dueShort = planner.getDueTodayShort(day.date);
          const completedFor = planner.isDetailedDateCompleted(day.date);
          const status = day.date < today ? (completedFor ? "Completed" : "Missed")
            : day.date === today ? (dayLocked ? "Track today" : "Ready")
            : dayLocked ? "Preview only" : "Upcoming";
          const statusBg = status === "Completed" ? "var(--mint)"
            : status === "Missed" ? "color-mix(in oklab, var(--destructive) 25%, var(--card))"
            : status === "Track today" ? "var(--rose)"
            : "var(--lavender)";
          const statusFg = (status === "Track today") ? "white" : undefined;
          return (
            <button key={day.date} onClick={() => onPick(day.date)} className="card-cozy p-4 text-left hover:-translate-y-1 transition-transform">
              <div className="flex justify-between items-center gap-2">
                <div className="font-semibold">{new Date(day.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
                <span className="chip text-[10px]" style={{ background: statusBg, color: statusFg }}>{status}</span>
              </div>
              {dueShort.length > 0 && (
                <div className="text-[10px] mt-1 px-2 py-1 rounded-md" style={{ background: "var(--peach)" }}>
                  Due today: {dueShort.join(", ")}
                </div>
              )}
              <div className="mt-2 space-y-1">
                {blocks.slice(0, 7).map((b) => (
                  <div key={b.id} className="text-xs flex items-center gap-2">
                    <span className="font-mono text-[10px] w-20 text-muted-foreground">{b.startTime}–{b.endTime}</span>
                    <span className="flex-1 truncate font-medium">{b.label || b.task}</span>
                    <span className="chip !py-0.5 !px-1.5 text-[10px]" style={{ background: typeColor(b.type) }}>{shortType(b.type)}</span>
                  </div>
                ))}
                {blocks.length > 7 && <div className="text-xs text-muted-foreground">+ {blocks.length - 7} more</div>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                <span className="chip" style={{ background: "var(--mint)" }}>Focus {fmtMins(totals.focus)}</span>
                <span className="chip" style={{ background: "var(--blush)" }}>Break {fmtMins(totals.breaks)}</span>
                <span className="chip" style={{ background: "var(--lavender)" }}>Tasks {done}/{total}</span>
              </div>
              <div className="mt-3 flex gap-1 items-center">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--blush)" }}>
                  <div className="h-1.5 rounded-full" style={{ background: "var(--rose)", width: `${total ? (done / total) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{done}/{total}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 justify-end items-center">
        {onDeleteCurrent && <DeleteCurrentPlanButton onClick={onDeleteCurrent} />}
        {allDone && <button className="btn-rose" onClick={onStartNew}>Start new plan</button>}
      </div>

    </div>
  );
}

function DayView({ date, editing, onBack, onToggleEdit, onChange, onLock, onEndDay, onDeleteCurrent }: any) {
  const day = planner.getDay(date);
  const locked = planner.isDateLocked(date);
  const today = todayStr();
  const isFuture = date > today;
  const isPast = date < today;
  const canTrack = planner.canTrackDetailedDate(date);
  const completedFor = planner.isDetailedDateCompleted(date);
  const blocks: any[] = day?.blocks || [];
  const tp = planner.getTrackableProgress(date);
  const completed = tp.done;
  const totalTrackable = tp.total;
  const pct = totalTrackable ? Math.round((completed / totalTrackable) * 100) : 0;
  const dueNotes = planner.getDueRemindersForDate(date);
  const statusLabel = isFuture ? "Preview only"
    : completedFor ? "Completed"
    : locked ? "Track today"
    : "Edit before locking";
  const statusBg = statusLabel === "Completed" ? "var(--mint)"
    : statusLabel === "Track today" ? "var(--rose)"
    : statusLabel === "Preview only" ? "var(--lavender)"
    : "var(--peach)";
  const statusFg = statusLabel === "Track today" ? "white" : undefined;

  const toggle = (id: string) => {
    if (!canTrack) return;
    const blocks: any[] = (day as any)?.blocks || [];
    const cur = blocks.find((b: any) => b.id === id);
    const becomingChecked = cur ? !cur.completed : false;
    planner.toggleBlock(date, id);
    playPlannerSound(becomingChecked ? "tick" : "tap");
    onChange?.();
  };
  const edit = (id: string, patch: any) => { planner.updateBlock(date, id, patch); onChange?.(); };
  const remove = (id: string) => { planner.removeBlock(date, id); onChange?.(); playPlannerSound("delete"); };


  if (!day) {
    return <div className="card-cozy p-6 max-w-3xl mx-auto text-center text-sm text-muted-foreground">No plan for this date.</div>;
  }

  return (
    <div className="animate-fade-up">
      <BackButton onClick={onBack} label="Back to week" />
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-display">Plan for {new Date(date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h1>
            <span className="chip" style={{ background: statusBg, color: statusFg }}>{statusLabel}</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {isFuture ? "Tracking opens on this day." : completedFor ? "This day is complete." : locked ? "Tick off blocks as you go." : "Adjust then lock to start tracking."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {onDeleteCurrent && <DeleteCurrentPlanButton onClick={onDeleteCurrent} />}
          {!locked && !isFuture && !isPast && <button className="btn-ghost" onClick={onToggleEdit}>{editing ? "Done editing" : "Edit day"}</button>}
          {!locked && <button className="btn-rose" onClick={onLock}>Save & lock 🔒</button>}
          {canTrack && !completedFor && <button className="btn-rose" onClick={onEndDay}>End day</button>}
        </div>
      </div>
      {dueNotes.length > 0 && (
        <div className="card-cozy p-4 mt-4" style={{ background: "var(--peach)" }}>
          <div className="font-semibold mb-0.5">Due reminders</div>
          <div className="text-sm">{dueNotes.join(" · ")}</div>
        </div>
      )}
      <div className="grid lg:grid-cols-[1fr_auto] gap-5 mt-5">
        <div className="card-cozy p-4 space-y-2">
          {blocks.map((b: any) => {
            const isDone = tp.completedSet.has(b.id);
            const trackableBlock = planner.isDetailedTrackableBlock(b);
            const bg = b.type === "fixed" ? "var(--lavender)"
              : b.type === "break" ? "var(--mint)"
              : b.type === "buffer" ? "var(--blush)"
              : isDone ? "oklch(0.92 0.06 145)" : "var(--card)";
            return (
              <div key={b.id} className="card-cozy p-3 flex items-center gap-3" style={{ background: bg }}>
                {editing && b.type !== "fixed" ? (
                  <>
                    <input type="time" className="input-cozy !py-1.5 w-28" value={b.startTime || ""} onChange={(e) => edit(b.id, { startTime: e.target.value })} />
                    <input type="time" className="input-cozy !py-1.5 w-28" value={b.endTime || ""} onChange={(e) => edit(b.id, { endTime: e.target.value })} />
                    <input className="input-cozy !py-1.5 flex-1" value={b.label || b.task || ""} onChange={(e) => edit(b.id, { label: e.target.value, task: e.target.value })} />
                    <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => remove(b.id)}>✕</button>
                  </>
                ) : (
                  <>
                    <div className="text-xs font-mono w-28 text-muted-foreground">{b.startTime}–{b.endTime}</div>
                    <div className="flex-1">
                      <div className="font-medium">{b.label || b.task}</div>
                      <div className="text-xs text-muted-foreground">
                        {shortType(b.type)}{b.priority ? ` · ${b.priority} priority` : ""}{b.phase ? ` · ${b.phase}` : ""}
                      </div>
                    </div>
                    {trackableBlock && (
                      <button
                        onClick={() => toggle(b.id)}
                        disabled={!canTrack}
                        title={!canTrack ? "Tracking opens on this day." : "Mark done"}
                        className="w-7 h-7 rounded-full grid place-items-center disabled:opacity-40"
                        style={{ background: isDone ? "var(--rose)" : "var(--blush)", color: "white" }}
                      >
                        {isDone ? "✓" : ""}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <aside className="card-cozy p-5 self-start text-center min-w-[240px]">
          <Fox pose={pct === 100 ? "cheer" : "study"} size={130} />
          <div className="mt-1 font-display text-2xl">{pct}%</div>
          <div className="text-xs text-muted-foreground">{completed} of {totalTrackable} done</div>
          {isFuture && <div className="mt-3 text-xs text-muted-foreground">Tracking opens on this day.</div>}
          {completedFor && <div className="mt-3 chip">Day complete</div>}
        </aside>
      </div>
    </div>
  );
}

/* =========================  FEEDBACK  ========================= */

function FeedbackView({ date, onBackHome, onViewTomorrow, onStartNew, onDeleteCurrent }: any) {
  const fb = planner.getFeedback(date) || { completed: 0, total: 0, percent: 0, focus: 0, breaks: 0, complete: false };
  const next = planner.getNextDetailedPlanDate(date);
  const isAllDone = planner.areAllDetailedPlanDaysCompleted();

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      <BackButton onClick={onBackHome} label="Back to Dashboard" />
      <div className="card-cozy p-6 text-center">
        <Fox pose={fb.complete ? "cheer" : "study"} size={150} />
        <h1 className="text-3xl font-display mt-2">Day complete! Well done 🌸</h1>
        <p className="text-muted-foreground text-sm">Here's how your day went on {date}.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Stat label="Progress" value={`${fb.percent || 0}%`} bg="var(--blush)" />
          <Stat label="Completed" value={`${fb.completed || 0}/${fb.total || 0} blocks`} bg="var(--lavender)" />
          <Stat label="Focus Time" value={fmtMins(fb.focus || 0)} bg="var(--mint)" />
          <Stat label="Break Time" value={fmtMins(fb.breaks || 0)} bg="var(--peach)" />
        </div>
        <div className="mt-5 text-sm" style={{ background: "var(--blush)", padding: "10px 14px", borderRadius: 12 }}>
          {fb.complete
            ? "You stayed consistent and made great progress today. Small steps, big future!"
            : "Some blocks didn't get finished — that's okay. We've gently moved a bit of unfinished work into tomorrow."}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 justify-center items-center">
          {next && <button className="btn-rose" onClick={onViewTomorrow}>View Tomorrow's Plan</button>}
          {isAllDone && <button className="btn-rose" onClick={onStartNew}>Start New Plan</button>}
          <button className="btn-ghost" onClick={onBackHome}>Back to Dashboard</button>
          {onDeleteCurrent && <DeleteCurrentPlanButton onClick={onDeleteCurrent} />}
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value, bg }: { label: string; value: string; bg: string }) {
  return (
    <div className="card-cozy p-3" style={{ background: bg }}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-xl">{value}</div>
    </div>
  );
}

/* =========================  helpers  ========================= */

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo)); }
function parseTime(t: string) { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function fmtMins(m: number) { if (!m) return "0m"; const h = Math.floor(m / 60); const r = m % 60; return h ? `${h}h ${r}m` : `${r}m`; }
function typeColor(t?: string) {
  const s = String(t || "").toLowerCase();
  if (s === "fixed") return "var(--lavender)";
  if (s === "break") return "var(--mint)";
  if (s === "buffer") return "var(--blush)";
  return "var(--peach)";
}
function shortType(t?: string) {
  const s = String(t || "study").toLowerCase();
  if (s === "fixed") return "fixed";
  if (s === "break") return "break";
  if (s === "buffer") return "buffer";
  if (["heavy","medium","light"].includes(s)) return s;
  return "study";
}
function methodsForPrefs(p: any): string[] {
  const i = String(p?.intensity || "Balanced");
  if (i === "Light") return ["Spaced Repetition", "Kaizen Pacing"];
  if (i === "Intense") return ["Deep Work (Gongbu)", "Hardest-First"];
  return ["Pomodoro", "Interleaving", "Active Recall"];
}

function MethodsCard({ methods, compact = false }: { methods: string[]; compact?: boolean }) {
  const uniq = Array.from(new Set((methods || []).filter(Boolean)));
  if (!uniq.length) return null;
  return (
    <div className={"card-cozy " + (compact ? "p-3" : "p-4")} style={{ background: "var(--blush)" }}>
      <div className={"font-semibold " + (compact ? "text-sm mb-1" : "mb-2")}>Study methods used</div>
      <div className="flex flex-wrap gap-1.5">
        {uniq.map((m) => (
          <span key={m} className="chip text-[11px]" style={{ background: "white" }}>{m}</span>
        ))}
      </div>
    </div>
  );
}
