import type {
  SingleBlock, GeneratedDayBlock, DetailedSetup, FixedBlock,
  DetailedTask, DetailedPreferences,
} from "./storage";

/* ============================================================
   CalmCampus Planner Engine (ported from legacy planner brain)
   - Overnight time math
   - Subject + keyword detection
   - Phase-based task labels & study methods
   - Intensity profiles for Single + Detailed
   - Break cleanup (no leading / trailing / adjacent breaks)
   - Relative priority spread (avoids "everything is High")
   ============================================================ */

export type Activity = "Study" | "Assignment" | "Mixed";
export type Intensity = "Easy" | "Normal" | "Push";

const pad = (n: number) => String(n).padStart(2, "0");
export function fmtTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
export function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
/** Returns [startMin, endMin] where endMin > startMin (adds 1440 if overnight). */
export function overnightWindow(startStr: string, endStr: string): [number, number] {
  const s = parseTime(startStr);
  let e = parseTime(endStr);
  if (e <= s) e += 1440;
  return [s, e];
}

/* ---------------- SUBJECT / KEYWORD DETECTION ---------------- */

type Subject =
  | "Math" | "Physics" | "Chemistry" | "Biology" | "English"
  | "Programming" | "Business" | "Theory" | "General";

const SUBJECT_KEYWORDS: Array<[Subject, string[]]> = [
  ["Math", ["math","maths","mathematics","algebra","calculus","trigonometry","trig","geometry","statistics","probability","equation","formula","numerical","numericals","integration","derivative"]],
  ["Physics", ["physics","phy","mechanics","optics","electricity","magnetism","thermodynamics","waves","kinematics"]],
  ["Chemistry", ["chemistry","chem","organic","inorganic","reaction","periodic","stoichiometry"]],
  ["Biology", ["biology","bio","anatomy","physiology","botany","zoology","genetics","ecology"]],
  ["English", ["english","eng","essay","letter","email","grammar","literature","poem","comprehension","writing","answer writing"]],
  ["Programming", ["programming","coding","code","java","javascript","python","html","css","sql","dbms","data structures","dsa","algorithm","leetcode","lab program","practical","record","c++","cpp"]],
  ["Business", ["accounts","accounting","finance","business","economics","management","marketing","balance sheet","ratio"]],
  ["Theory", ["history","civics","constitution","law","sociology","psychology","theory","notes","political"]],
];

const DELIVERABLE_KEYWORDS = {
  assignment: ["assignment","report","submission","draft","writeup","write-up","write up","final copy"],
  project:    ["project","build","prototype","capstone","mini project"],
  presentation: ["presentation","ppt","slides","deck"],
  lab:        ["lab","record","practical","experiment"],
  exam:       ["exam","test","quiz","internal","finals","midterm","viva","lab exam"],
  revision:   ["revision","revise","recap","review"],
  reading:    ["reading","read","chapter","textbook"],
};

export type DeliverableType = keyof typeof DELIVERABLE_KEYWORDS | "study";

export function detectSubject(name: string): Subject {
  const n = (name || "").toLowerCase();
  for (const [subj, kws] of SUBJECT_KEYWORDS) {
    if (kws.some(k => n.includes(k))) return subj;
  }
  return "General";
}
export function detectDeliverable(name: string, category?: string): DeliverableType {
  const n = (name || "").toLowerCase();
  const c = (category || "").toLowerCase();
  for (const [type, kws] of Object.entries(DELIVERABLE_KEYWORDS)) {
    if (kws.some(k => n.includes(k) || c.includes(k))) return type as DeliverableType;
  }
  return "study";
}

/* Phases per subject + deliverable */
function phasesFor(subject: Subject, deliv: DeliverableType): string[] {
  if (deliv === "assignment") return ["Research","Outline","Draft","Edit","Final Review"];
  if (deliv === "project")    return ["Plan","Build","Test","Refine","Wrap Up"];
  if (deliv === "presentation") return ["Outline","Slide Draft","Visuals","Rehearsal","Final Polish"];
  if (deliv === "lab")        return ["Setup","Observation","Writeup","Diagram","Final Review"];
  if (deliv === "reading")    return ["Skim","Active Read","Notes","Active Recall","Summary"];
  if (deliv === "revision")   return ["Quick Recap","Active Recall","Mistake Review","Mini Test","Final Recall"];

  // study / exam paths by subject
  switch (subject) {
    case "Math":
    case "Physics":
      return ["Concept Learning","Formula Review","Worked Examples","Timed Practice","Mistake Review","Final Recall"];
    case "Chemistry":
      return ["Concept Learning","Reaction Practice","Numericals","Active Recall","Mistake Review","Final Recall"];
    case "Biology":
      return ["Concept Learning","Diagrams","Active Recall","Past Questions","Final Recall"];
    case "English":
      return ["Reading","Answer Writing","Grammar Practice","Essay Draft","Final Review"];
    case "Programming":
      return ["Concept Review","Code Practice","Debug & Test","Past Problems","Final Recall"];
    case "Business":
      return ["Concept Review","Numericals","Case Practice","Active Recall","Final Recall"];
    case "Theory":
      return ["Read & Highlight","Short Notes","Active Recall","Past Questions","Final Recall"];
    default:
      return ["Concept Learning","Deep Study","Practice","Active Recall","Final Recall"];
  }
}

export function labelForTask(name: string, category: string | undefined, phaseIndex: number): string {
  const subject = detectSubject(name);
  const deliv = detectDeliverable(name, category);
  const phases = phasesFor(subject, deliv);
  const phase = phases[phaseIndex % phases.length];
  const head =
    deliv === "assignment" ? "Assignment" :
    deliv === "project" ? "Project" :
    deliv === "presentation" ? "Presentation" :
    deliv === "lab" ? "Lab" :
    subject === "General" ? (name || "Study") : subject;
  return `${head} — ${phase}`;
}

export function methodsForPrefs(prefs: DetailedPreferences | null, intensity?: "Light"|"Balanced"|"Intense"): string[] {
  const out = new Set<string>(["Timeboxing","Priority Based Planning"]);
  if (prefs?.method === "active-recall") out.add("Active Recall");
  if (prefs?.method === "spaced") out.add("Spaced Practice");
  if (prefs?.method === "interleaving") out.add("Interleaving");
  if (prefs?.method === "pomodoro") out.add("Pomodoro");
  if (intensity === "Light") { out.add("Spaced Repetition"); out.add("Kaizen"); }
  if (intensity === "Balanced") { out.add("Pomodoro"); out.add("Interleaving"); }
  if (intensity === "Intense") { out.add("Deep Work"); out.add("Gongbu"); }
  out.add("Worked Examples"); out.add("Mistake Review");
  return Array.from(out);
}

/* ============================================================
   SINGLE PLANNER
   ============================================================ */

const STUDY_FLOW: { name: string; w: number }[] = [
  { name: "Concept Learning", w: 20 },
  { name: "Deep Study", w: 30 },
  { name: "Practice Problems", w: 20 },
  { name: "Active Recall", w: 15 },
  { name: "Weak Area Review", w: 10 },
  { name: "Final Recall", w: 5 },
];
const ASSIGN_FLOW: { name: string; w: number }[] = [
  { name: "Understand Assignment", w: 10 },
  { name: "Research", w: 20 },
  { name: "Plan Structure", w: 10 },
  { name: "Write Draft", w: 35 },
  { name: "Edit & Improve", w: 15 },
  { name: "Final Review", w: 10 },
];
const TOTAL: Record<Intensity, number> = { Easy: 180, Normal: 360, Push: 540 };
const MAX_BLOCK: Record<Intensity, number> = { Easy: 45, Normal: 60, Push: 90 };

/** Interleave two flows alternately, half-weights, like the old interleavePlannerTasks. */
function interleaveFlows(a: { name: string; w: number }[], b: { name: string; w: number }[]) {
  const out: { name: string; w: number }[] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i]) out.push({ name: a[i].name, w: a[i].w / 2 });
    if (b[i]) out.push({ name: b[i].name, w: b[i].w / 2 });
  }
  return out;
}

export function generateSinglePlan(activity: Activity, intensity: Intensity, startTime: string): SingleBlock[] {
  const flow =
    activity === "Study" ? STUDY_FLOW :
    activity === "Assignment" ? ASSIGN_FLOW :
    interleaveFlows(STUDY_FLOW, ASSIGN_FLOW);

  const total = TOTAL[intensity];
  const max = MAX_BLOCK[intensity];
  const totalWeight = flow.reduce((s, t) => s + t.w, 0);
  const durations = flow.map(t => Math.max(15, Math.floor((total * t.w) / totalWeight)));
  const used = durations.reduce((a, b) => a + b, 0);
  if (durations.length) durations[durations.length - 1] += total - used;

  // split oversized
  const tasks: { name: string; dur: number }[] = [];
  flow.forEach((t, i) => {
    const d = durations[i];
    if (d <= max) tasks.push({ name: t.name, dur: d });
    else {
      const parts = Math.ceil(d / max);
      const per = Math.floor(d / parts);
      const leftover = d - per * parts;
      for (let p = 0; p < parts; p++) {
        tasks.push({ name: `${t.name} (Part ${p + 1})`, dur: per + (p === parts - 1 ? leftover : 0) });
      }
    }
  });

  // type assignment by relative duration
  const sorted = tasks.map((t, i) => ({ ...t, i })).sort((a, b) => b.dur - a.dur);
  const topCut = Math.ceil(sorted.length * 0.3);
  const lowCut = sorted.length - Math.ceil(sorted.length * 0.3);
  const typeMap = new Map<number, "Deep" | "Medium" | "Light">();
  sorted.forEach((t, idx) => {
    typeMap.set(t.i, idx < topCut ? "Deep" : idx >= lowCut ? "Light" : "Medium");
  });

  // place blocks + breaks (overnight-safe via fmtTime wrapping)
  let cursor = parseTime(startTime);
  const blocks: SingleBlock[] = [];
  let id = 1;
  tasks.forEach((t, i) => {
    const start = cursor;
    const end = cursor + t.dur;
    blocks.push({
      id: `block_${id++}`, category: "study",
      type: typeMap.get(i) || "Medium",
      task: t.name, label: t.name,
      startTime: fmtTime(start), endTime: fmtTime(end), completed: false,
    });
    cursor = end;
    const brk = Math.max(5, Math.min(t.dur, Math.round(t.dur * 0.15)));
    if (i < tasks.length - 1) {
      blocks.push({
        id: `block_${id++}`, category: "break", type: "Break",
        task: "Break", label: "Take a rest", startTime: fmtTime(cursor),
        endTime: fmtTime(cursor + brk), completed: false,
      });
      cursor += brk;
    }
  });

  return cleanBreaks(blocks);
}

/** Remove leading break, trailing break, and merge back-to-back breaks. */
function cleanBreaks<T extends { category?: string; type?: string }>(blocks: T[]): T[] {
  let out = blocks.slice();
  // strip leading breaks
  while (out.length && (out[0].category === "break" || out[0].type === "Break")) out.shift();
  // strip trailing breaks
  while (out.length && (out[out.length - 1].category === "break" || out[out.length - 1].type === "Break")) out.pop();
  // collapse adjacent breaks: keep first
  const filtered: T[] = [];
  for (const b of out) {
    const isBreak = b.category === "break" || b.type === "Break";
    const lastIsBreak = filtered.length && (filtered[filtered.length - 1].category === "break" || filtered[filtered.length - 1].type === "Break");
    if (isBreak && lastIsBreak) continue;
    filtered.push(b);
  }
  return filtered;
}

export function resolveStartTime(start: "Now" | "30 min later" | "Pick time", picked?: string) {
  const now = new Date();
  if (start === "Pick time" && picked) return picked;
  let mins = now.getHours() * 60 + now.getMinutes();
  if (start === "30 min later") mins += 30;
  return fmtTime(mins);
}

/* ============================================================
   DETAILED PLANNER
   ============================================================ */

function fmtYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
/** Inclusive local date range. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const [sy,sm,sd] = start.split("-").map(Number);
  const [ey,em,ed] = end.split("-").map(Number);
  const s = new Date(sy, sm-1, sd);
  const e = new Date(ey, em-1, ed);
  if (e < s) return [start];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) out.push(fmtYmd(d));
  return out;
}
function daysUntil(dateStr: string, from: string) {
  const [ay,am,ad] = dateStr.split("-").map(Number);
  const [by,bm,bd] = from.split("-").map(Number);
  const a = new Date(ay, am-1, ad).getTime();
  const b = new Date(by, bm-1, bd).getTime();
  return Math.max(1, Math.ceil((a - b) / 86400000));
}

interface RankedTask extends DetailedTask {
  subject: Subject;
  deliv: DeliverableType;
  rawPriority: number;
  displayPriority: "High" | "Medium" | "Low";
  emergency: boolean;
  phaseIdx: number;
}

/** Spread priority across Low/Med/High by quantile when raw scores are too clustered. */
function assignDisplayPriority(ranked: { rawPriority: number; emergency: boolean }[]): ("High"|"Medium"|"Low")[] {
  if (ranked.length === 0) return [];
  const scores = ranked.map(r => r.rawPriority);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const spread = max - min;
  // Absolute thresholds when there is real spread
  const out = ranked.map(r => {
    if (r.emergency) return "High" as const;
    if (spread < 60) return "Medium" as const; // tighten temporarily; fixed below
    return r.rawPriority >= 240 ? "High" : r.rawPriority >= 90 ? "Medium" : "Low";
  });
  // Relative spread: ensure at least one Low and one High when 3+ tasks exist
  if (ranked.length >= 3) {
    const idxSorted = ranked.map((r,i)=>({i, s:r.rawPriority})).sort((a,b)=>b.s-a.s);
    const topN = Math.max(1, Math.floor(ranked.length / 3));
    const botN = Math.max(1, Math.floor(ranked.length / 3));
    idxSorted.slice(0, topN).forEach(({i}) => { if (!out[i]) out[i] = "High"; if (out[i] === "Low") out[i] = "Medium"; });
    idxSorted.slice(-botN).forEach(({i}) => { if (!ranked[i].emergency && out[i] !== "High") out[i] = "Low"; });
    // Middle = Medium when not assigned
    idxSorted.slice(topN, idxSorted.length - botN).forEach(({i}) => { if (!ranked[i].emergency) out[i] = "Medium"; });
  }
  return out;
}

function rankTasks(tasks: DetailedTask[], from: string): RankedTask[] {
  const enriched = tasks.map(t => {
    const days = daysUntil(t.due, from);
    const gap = 100 - Math.max(0, Math.min(100, t.preparedness));
    const diff = Math.max(0, Math.min(10, t.difficulty));
    const rawPriority = (diff * gap) / days;
    const emergency = days <= 1 && (gap >= 50 || diff >= 7);
    return {
      ...t,
      subject: detectSubject(t.name),
      deliv: detectDeliverable(t.name, t.category),
      rawPriority,
      emergency,
      phaseIdx: 0,
    } as RankedTask;
  });
  const display = assignDisplayPriority(enriched);
  enriched.forEach((t, i) => { t.displayPriority = display[i] || "Medium"; });
  return enriched.sort((a, b) => {
    if (a.emergency !== b.emergency) return a.emergency ? -1 : 1;
    const da = daysUntil(a.due, from); const db = daysUntil(b.due, from);
    if (da !== db) return da - db;
    return b.rawPriority - a.rawPriority;
  });
}

/** Build free segments inside a logical day window, subtracting fixed commitments. */
function freeSegmentsForDay(
  dayStartMin: number, dayEndMin: number,
  fixedToday: { start: number; end: number; name: string }[]
): { start: number; end: number }[] {
  const segs: { start: number; end: number }[] = [];
  let cur = dayStartMin;
  for (const f of fixedToday) {
    const fs = Math.max(f.start, dayStartMin);
    const fe = Math.min(f.end, dayEndMin);
    if (fs > cur) segs.push({ start: cur, end: Math.min(fs, dayEndMin) });
    cur = Math.max(cur, fe);
    if (cur >= dayEndMin) break;
  }
  if (cur < dayEndMin) segs.push({ start: cur, end: dayEndMin });
  return segs.filter(s => s.end - s.start >= 20);
}

/** Map fixed block to minute window relative to logical day start. Supports overnight days. */
function fixedToLogical(f: FixedBlock, logicalDayStartAbs: number): { start: number; end: number; name: string } | null {
  const fs = parseTime(f.start);
  let fe = parseTime(f.end);
  if (fe <= fs) fe += 1440;
  // Logical day start abs is offset from midnight (could be > 1440 for next day).
  // We map a fixed block to the closest 24-hour translation that overlaps the window.
  // For simplicity, try same-day and next-day offsets.
  return { start: fs, end: fe, name: f.name };
}

function pickByFocus(
  segStart: number, segEnd: number,
  queue: RankedTask[],
  remaining: Map<string, number>,
  focus: DetailedPreferences["focus"],
  order: DetailedPreferences["order"]
): RankedTask | null {
  // Filter to those with remaining minutes
  const live = queue.filter(t => (remaining.get(t.id) || 0) > 0);
  if (live.length === 0) return null;
  const mid = (segStart + segEnd) / 2;
  const hour = (((mid % 1440) + 1440) % 1440) / 60;
  // Determine if this slot is "ideal" for high-effort work
  const isMorning = hour >= 6 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 17;
  const isNight = hour >= 17 || hour < 6;
  let hardSlot = focus === "morning" ? isMorning
                : focus === "afternoon" ? isAfternoon
                : focus === "evening" ? isNight
                : true;
  // hardest-first by default; reversed if user asked easiest-first
  const sorted = [...live].sort((a, b) => b.rawPriority - a.rawPriority);
  if (order === "easiest-first") sorted.reverse();
  if (hardSlot) return sorted[0];
  // Off-peak: prefer easier work
  return sorted[sorted.length - 1];
}

function breakLenForIntensity(prefs: DetailedPreferences | null): number {
  if (!prefs) return 10;
  if (prefs.breakStyle === "long") return 15;
  if (prefs.breakStyle === "pomodoro") return 5;
  return 10;
}
function sessionLenForIntensity(prefs: DetailedPreferences | null): number {
  if (!prefs) return 45;
  return Math.max(20, Math.min(prefs.sessionLength || 45, 90));
}

export function generateDetailedPlan(
  setup: DetailedSetup,
  fixedBlocks: FixedBlock[],
  tasks: DetailedTask[],
  prefs: DetailedPreferences,
) {
  const dates = setup.scope === "Today Only"
    ? [setup.startDate]
    : dateRange(setup.startDate, setup.endDate);
  const warnings: string[] = [];
  const overnight = parseTime(setup.dailyEnd) <= parseTime(setup.dailyStart);
  if (overnight) warnings.push("Late-night plan detected. Sleep matters too, so keep this realistic.");

  const ranked = rankTasks(tasks, setup.startDate);
  // Estimate remaining work per task
  const remaining = new Map<string, number>(
    ranked.map(t => [t.id, Math.max(20, t.duration || 60)])
  );
  const sessionLen = sessionLenForIntensity(prefs);
  const breakLen = breakLenForIntensity(prefs);
  const phaseProgress = new Map<string, number>();

  const days: { date: string; blocks: GeneratedDayBlock[] }[] = [];

  for (const date of dates) {
    const blocks: GeneratedDayBlock[] = [];
    const [dayStart, dayEnd] = overnightWindow(setup.dailyStart, setup.dailyEnd);
    // Fixed blocks scoped to this date (legacy storage uses date string match)
    const fixedToday = fixedBlocks
      .filter(f => f.date === date)
      .map(f => fixedToLogical(f, dayStart)!)
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);

    // Render fixed visually using their natural HH:MM (display only)
    fixedBlocks.filter(f => f.date === date).forEach((f, i) => {
      blocks.push({
        id: `${date}_fixed_${i}`, date, start: f.start, end: f.end,
        label: f.name, type: "fixed",
      });
    });

    const segments = freeSegmentsForDay(dayStart, dayEnd, fixedToday);
    // Eligible queue: skip tasks past their due date (only schedule prep up to due date - 1)
    const eligible = ranked.filter(t => {
      const due = daysUntil(t.due, date);
      return due >= 1; // schedule strictly before due date when possible
    });
    // If nothing eligible but tasks exist with due date == this date, allow emergency same-day prep
    const queue = eligible.length ? eligible
      : ranked.filter(t => (remaining.get(t.id) || 0) > 0);

    let id = 0;
    let lastWasStudy = false;
    for (const seg of segments) {
      let t = seg.start;
      lastWasStudy = false;
      while (t + 20 <= seg.end) {
        const chosen = pickByFocus(seg.start, seg.end, queue, remaining, prefs.focus, prefs.order);
        if (!chosen) break;
        const rem = remaining.get(chosen.id) || 0;
        const avail = seg.end - t;
        const len = Math.min(sessionLen, rem, avail);
        if (len < 20) break;
        const phaseIdx = phaseProgress.get(chosen.id) || 0;
        const label = labelForTask(chosen.name, chosen.category, phaseIdx);
        blocks.push({
          id: `${date}_s_${id++}`, date,
          start: fmtTime(t), end: fmtTime(t + len),
          label, type: "study",
          priority: chosen.displayPriority,
          completed: false,
        });
        remaining.set(chosen.id, rem - len);
        phaseProgress.set(chosen.id, phaseIdx + 1);
        t += len;
        lastWasStudy = true;
        // break only if more work remains in segment AND queue has more time
        const stillWork = Array.from(remaining.values()).some(v => v > 0);
        if (stillWork && t + breakLen + 20 <= seg.end) {
          blocks.push({
            id: `${date}_b_${id++}`, date,
            start: fmtTime(t), end: fmtTime(t + breakLen),
            label: "Break", type: "break",
          });
          t += breakLen;
          lastWasStudy = false;
        }
      }
      // If segment ended with a trailing break we just placed, the next iteration's clean step removes it.
    }

    // Sort by start time (handle overnight by translating < dayStart to +1440)
    blocks.sort((a, b) => {
      const aa = parseTime(a.start) + (parseTime(a.start) < parseTime(setup.dailyStart) && overnight ? 1440 : 0);
      const bb = parseTime(b.start) + (parseTime(b.start) < parseTime(setup.dailyStart) && overnight ? 1440 : 0);
      return aa - bb;
    });
    days.push({ date, blocks: cleanBreaks(blocks) });
  }

  // Warnings for unscheduled work
  for (const t of ranked) {
    const left = remaining.get(t.id) || 0;
    if (left > 0) warnings.push(`Not all of "${t.name}" fits — ${left} min left over.`);
  }

  return { days, warnings, methods: methodsForPrefs(prefs) };
}

/** Expose ranked tasks for the Review/Tasks UI so it can show meaningful priority. */
export function rankedTasksForUI(tasks: DetailedTask[], fromDate: string) {
  return rankTasks(tasks, fromDate).map(t => ({
    id: t.id,
    displayPriority: t.displayPriority,
    subject: t.subject,
    deliv: t.deliv,
    emergency: t.emergency,
  }));
}

/* ---------------- Due reminders (banner only, not blocks) ---------------- */

export function dueRemindersForDate(tasks: DetailedTask[], date: string): string[] {
  return tasks.filter(t => t.due === date).map(t => `${t.name} is due today.`);
}
