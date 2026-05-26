/* React-friendly adapter over the verbatim legacy detailed engine.
   The engine's `collectDetailedSetup` / `collectDetailedPreferences`
   / `addFixedBlock` / `addDetailedTask` read values from DOM <input>s.
   This adapter bypasses that by writing directly into `detailedState`,
   then calls the real engine functions for scheduling/keyword/priority. */

import {
  detailedState, detailedKeys, defaultDetailedSetup, defaultDetailedPreferences,
  loadDetailedPlannerState, saveDetailedDraft, saveGeneratedDetailedPlan,
  generateDetailedPlan as engineGenerateDetailedPlan,
  toggleDetailedBlockComplete, clearDetailedPlanner, isDetailedPlanLocked,
  normalizeDetailedTasks, calculateDetailedPriorityScore, priorityLevelFromScore,
  rangesOverlap, normalizedEndMinutes,
  getDetailedProgressForDate, applyDetailedProgressToDay, applyDetailedProgressToAllDays,
  getDetailedDayByDate, getNextDetailedPlanDate, isDateInsideDetailedPlan,
  isDetailedDateCompleted, areAllDetailedPlanDaysCompleted,
  getActiveDetailedTrackDate, canTrackDetailedDate, canPreviewDetailedDate,
  buildDueReminderMessagesForDate, buildDueReminderMessagesForPlan,
} from "./detailed-engine";
import { uniqueId } from "./engine";

export {
  detailedState, detailedKeys, isDetailedPlanLocked, toggleDetailedBlockComplete,
  getDetailedProgressForDate, getDetailedDayByDate, getNextDetailedPlanDate,
  isDateInsideDetailedPlan, isDetailedDateCompleted, areAllDetailedPlanDaysCompleted,
  getActiveDetailedTrackDate, canTrackDetailedDate, canPreviewDetailedDate,
  buildDueReminderMessagesForDate, buildDueReminderMessagesForPlan,
};

export function ensureLoaded() {
  if (typeof window === "undefined") return;
  // Re-load whenever the current user changes so module-level state from a
  // previously logged-in user does not leak into the new user's session.
  const u = (() => {
    try { return window.localStorage.getItem("calmCampusCurrentUser"); } catch { return null; }
  })();
  const w: any = window as any;
  if (w.__ccDetailedLoadedFor === u && detailedState.setup) return;
  // Reset in-memory detailed planner state, then load this user's scoped data.
  detailedState.setup = null;
  detailedState.fixedBlocks = [];
  detailedState.tasks = [];
  detailedState.preferences = null;
  detailedState.generatedPlan = null;
  detailedState.progress = {};
  detailedState.lockedDates = {};
  detailedState.feedback = {};
  detailedState.feedbackDate = null;
  detailedState.previewDate = null;
  detailedState.previewReturnStep = null;
  detailedState.currentStep = "setup";
  detailedState.lastTimetableStep = "day";
  try { loadDetailedPlannerState(); } catch {}
  w.__ccDetailedLoadedFor = u;
}

export function setSetup(patch: Partial<{ scope: string; startDate: string; endDate: string; startTime: string; endTime: string }>) {
  detailedState.setup = { ...(detailedState.setup || defaultDetailedSetup()), ...patch };
  if (detailedState.setup.scope === "Today Only") detailedState.setup.endDate = detailedState.setup.startDate;
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.setup, JSON.stringify(detailedState.setup));
}

export function setPreferences(patch: Partial<{ intensity: string; includeBuffer: boolean; bestFocus: string; sessionLength: string; breakPreference: string }>) {
  detailedState.preferences = { ...(detailedState.preferences || defaultDetailedPreferences()), ...patch };
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.preferences, JSON.stringify(detailedState.preferences));
}

export function addFixed(block: { title: string; startTime: string; endTime: string; days: string[]; category: string }) {
  if (!block.title || !block.startTime || !block.endTime) return false;
  if (normalizedEndMinutes(block.startTime, block.endTime) <= 0) return false;
  detailedState.fixedBlocks.push({
    id: uniqueId(),
    title: block.title,
    startTime: block.startTime,
    endTime: block.endTime,
    days: block.days.length ? block.days : ["Mon","Tue","Wed","Thu","Fri"],
    category: block.category || "Custom",
    type: "fixed",
    locked: true,
  });
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.fixed, JSON.stringify(detailedState.fixedBlocks));
  return true;
}

export function deleteFixed(id: string) {
  detailedState.fixedBlocks = detailedState.fixedBlocks.filter((b: any) => b.id !== id);
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.fixed, JSON.stringify(detailedState.fixedBlocks));
}

export function fixedOverlaps(): string[] {
  const overlaps: string[] = [];
  detailedState.fixedBlocks.forEach((a: any, i: number) => {
    detailedState.fixedBlocks.slice(i + 1).forEach((b: any) => {
      if (a.days.some((d: string) => b.days.includes(d)) && rangesOverlap(a, b)) overlaps.push(`${a.title} overlaps ${b.title}`);
    });
  });
  return overlaps;
}

export function addTask(t: { taskName: string; taskType: string; dueDate: string; difficulty: number; preparedness: number }) {
  if (!t.taskName || !t.dueDate) return false;
  const difficulty = Math.max(0, Math.min(10, Number(t.difficulty) || 0));
  const preparedness = Math.max(0, Math.min(100, Number(t.preparedness) || 0));
  detailedState.tasks.push({
    id: uniqueId(),
    taskName: t.taskName,
    taskType: t.taskType || "Study",
    dueDate: t.dueDate,
    difficulty,
    preparedness,
    priorityScore: calculateDetailedPriorityScore(difficulty, preparedness),
    priorityLevel: priorityLevelFromScore(calculateDetailedPriorityScore(difficulty, preparedness)),
  });
  normalizeDetailedTasks();
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.tasks, JSON.stringify(detailedState.tasks));
  return true;
}

export function deleteTask(id: string) {
  detailedState.tasks = detailedState.tasks.filter((t: any) => t.id !== id);
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.tasks, JSON.stringify(detailedState.tasks));
}

export function generatePlan() {
  try { saveDetailedDraft(); } catch {}
  try { engineGenerateDetailedPlan(); } catch (e) { /* engine throws on stubbed nav helpers, plan still saved */ console.warn("[detailed] gen warn", e); }
  try { finalizeAndValidatePlan(detailedState.generatedPlan); } catch (e) { console.warn("[detailed] finalize warn", e); }
  try { saveGeneratedDetailedPlan(); } catch {}
  return detailedState.generatedPlan;
}

export function lockDay(date: string) {
  detailedState.lockedDates = { ...(detailedState.lockedDates || {}), [date]: true };
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.lockedDates, JSON.stringify(detailedState.lockedDates));
}

export function resetEverything() {
  clearDetailedPlanner();
}

/* ---------- read helpers ---------- */
export function getPlan(): any { return detailedState.generatedPlan; }
export function getDays(): any[] { return detailedState.generatedPlan?.days || []; }
export function getDay(date: string): any { return getDetailedDayByDate(date); }
export function getMethods(): string[] {
  const plan = detailedState.generatedPlan;
  return plan?.scienceMethodsUsed || plan?.methods || [];
}
export function getWarnings(): string[] { return detailedState.generatedPlan?.warnings || []; }
export function getDueRemindersForDate(date: string): string[] {
  return buildDueReminderMessagesForDate(date, detailedState.tasks || []) || [];
}

/* ---------- progress / tracking ---------- */
export function getProgressForDate(date: string) {
  const day = getDay(date);
  if (day) applyDetailedProgressToDay(day);
  const p = getDetailedProgressForDate(date);
  return { ...p, completedSet: new Set<string>(p.completedBlocks || []) };
}
export function isBlockComplete(date: string, blockId: string) {
  const p = getDetailedProgressForDate(date);
  return (p.completedBlocks || []).includes(blockId);
}
export function toggleBlock(date: string, blockId: string) {
  if (!canTrackDetailedDate(date)) return false;
  const checked = !isBlockComplete(date, blockId);
  toggleDetailedBlockComplete(blockId, date, checked);
  return true;
}

/* ---------- locks / dates ---------- */
export function isDateLocked(date: string) { return !!(detailedState.lockedDates || {})[date]; }
export function lockAllPlanDates() {
  const dates = (detailedState.generatedPlan?.days || []).map((d: any) => d.date);
  const map = { ...(detailedState.lockedDates || {}) };
  dates.forEach((d: string) => { map[d] = true; });
  detailedState.lockedDates = map;
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.lockedDates, JSON.stringify(map));
  saveGeneratedDetailedPlan();
}

/* ---------- block editing (pre-lock) ---------- */
export function updateBlock(date: string, blockId: string, patch: any) {
  if (isDetailedPlanLocked()) return false;
  const day = getDay(date); if (!day) return false;
  const b = (day.blocks || []).find((x: any) => x.id === blockId);
  if (!b || b.locked || b.type === "fixed") return false;
  Object.assign(b, patch);
  try { finalizeAndValidatePlan(detailedState.generatedPlan); } catch {}
  saveGeneratedDetailedPlan();
  return true;
}
export function removeBlock(date: string, blockId: string) {
  if (isDetailedPlanLocked()) return false;
  const day = getDay(date); if (!day) return false;
  const b = (day.blocks || []).find((x: any) => x.id === blockId);
  if (!b || b.locked || b.type === "fixed") return false;
  day.blocks = day.blocks.filter((x: any) => x.id !== blockId);
  try { finalizeAndValidatePlan(detailedState.generatedPlan); } catch {}
  saveGeneratedDetailedPlan();
  return true;
}
export function addCustomBlock(date: string, block: { startTime: string; endTime: string; label: string; type?: string }) {
  if (isDetailedPlanLocked()) return false;
  const day = getDay(date); if (!day) return false;
  day.blocks.push({
    id: uniqueId(), date, logicalDate: date,
    type: block.type || "study", label: block.label, task: block.label,
    startTime: block.startTime, endTime: block.endTime,
    priority: "Medium", priorityLevel: "Medium",
    completed: false, locked: false,
  });
  day.blocks.sort((a: any, b: any) => (a.startTime || "").localeCompare(b.startTime || ""));
  try { finalizeAndValidatePlan(detailedState.generatedPlan); } catch {}
  saveGeneratedDetailedPlan();
  return true;
}

/* ---------- feedback ---------- */
export function getFeedback(date: string) { return (detailedState.feedback || {})[date] || null; }
export function saveFeedback(date: string, payload: any) {
  const day = getDay(date);
  if (day) applyDetailedProgressToDay(day);
  const blocks: any[] = day?.blocks || [];
  const tp = getTrackableProgress(date);
  const completed = tp.done;
  const total = tp.total;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const completedIds = tp.completedSet;
  const focus = blocks
    .filter(b => isDetailedTrackableBlock(b) && completedIds.has(b.id))
    .reduce((s, b) => s + blockMinutes(b), 0);
  // Breaks are visible rest time, not tickable tasks — count scheduled break minutes.
  const breaks = blocks
    .filter(b => _normType(b) === "break")
    .reduce((s, b) => s + blockMinutes(b), 0);
  detailedState.feedback = { ...(detailedState.feedback || {}), [date]: { ...payload, completed, total, percent, focus, breaks, date } };
  if (typeof window !== "undefined") localStorage.setItem(detailedKeys.feedback, JSON.stringify(detailedState.feedback));
}
function blockMinutes(b: any): number {
  const [sh, sm] = String(b.startTime || "0:0").split(":").map(Number);
  const [eh, em] = String(b.endTime || "0:0").split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  return mins;
}

/* ---------- review counts ---------- */
export function priorityCountsFromTasks() {
  const out = { High: 0, Medium: 0, Low: 0 };
  (detailedState.tasks || []).forEach((t: any) => {
    const lvl = t.priorityLevel || priorityLevelFromScore(t.priorityScore || 0);
    if (lvl in out) (out as any)[lvl]++;
  });
  return out;
}

/* =====================================================================
   Polish helpers — trackable rule, gap finalizer, validation, totals,
   smart notes, overload summary. Pure UI/QA layer over the legacy
   engine; does NOT change scheduling/priority formulas.
   ===================================================================== */

function _t2m(t?: string): number {
  if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}
function _m2t(min: number): string {
  const x = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(x / 60), m = x % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function _blockMins(b: any): number {
  let s = _t2m(b.startTime), e = _t2m(b.endTime);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  if (e <= s) e += 1440; // overnight
  return Math.max(0, e - s);
}
function _normType(b: any): string {
  return String(b?.type || "").toLowerCase();
}

/** Public rule: which blocks count as student-actionable. */
export function isDetailedTrackableBlock(b: any): boolean {
  if (!b) return false;
  const t = _normType(b);
  if (t === "fixed" || b?.locked) return false;
  if (t === "break") return false;
  return true; // study, buffer, assignment, project, etc.
}

function _preferredBreakMins(): number {
  const pref = String((detailedState.preferences || {} as any).breakPreference || "Normal");
  if (pref === "Frequent") return 10;
  if (pref === "Minimal") return 5;
  return 10;
}

/** Insert visible Break / Buffer blocks for every meaningful internal gap. */
function finalizeDetailedDayGaps(day: any) {
  if (!day || !Array.isArray(day.blocks)) return;
  // Sort by start time (handle overnight by absolute index falling back to startTime).
  day.blocks.sort((a: any, b: any) => (a.startTime || "").localeCompare(b.startTime || ""));
  const cleaned = day.blocks.filter((b: any) => {
    if (!b) return false;
    const t = _normType(b);
    // Drop previously generated gap-filler blocks; we will re-insert.
    if ((b.source === "gap-finalizer") && (t === "break" || t === "buffer")) return false;
    if (_blockMins(b) <= 0 && t !== "fixed") return false;
    return true;
  });
  cleaned.sort((a: any, b: any) => (a.startTime || "").localeCompare(b.startTime || ""));

  const out: any[] = [];
  const prefBreak = _preferredBreakMins();

  for (let i = 0; i < cleaned.length; i++) {
    const cur = cleaned[i];
    out.push(cur);
    const nxt = cleaned[i + 1];
    if (!nxt) break;

    const curEnd = _t2m(cur.endTime);
    const nxtStart = _t2m(nxt.startTime);
    if (!Number.isFinite(curEnd) || !Number.isFinite(nxtStart)) continue;
    let gap = nxtStart - curEnd;
    if (gap < 0) gap += 1440;
    if (gap < 5) continue;

    const curT = _normType(cur);
    const nxtT = _normType(nxt);
    // Skip gaps that touch fixed-commitment edges — those are real life buffer time, not study breaks.
    if (curT === "fixed" || nxtT === "fixed") continue;
    // Don't double up breaks.
    if (curT === "break" || nxtT === "break") continue;

    const gapStart = cur.endTime;
    if (gap <= prefBreak + 4) {
      out.push(_mkGapBlock(day.date, "break", gapStart, _m2t(curEnd + gap)));
    } else {
      out.push(_mkGapBlock(day.date, "break", gapStart, _m2t(curEnd + prefBreak)));
      out.push(_mkGapBlock(day.date, "buffer", _m2t(curEnd + prefBreak), _m2t(curEnd + gap)));
    }
  }

  day.blocks = out;
}

function _mkGapBlock(date: string, kind: "break" | "buffer", startTime: string, endTime: string) {
  const id = `gap_${kind}_${date}_${startTime}_${endTime}`.replace(/[^a-z0-9_-]+/gi, "");
  const isBreak = kind === "break";
  return {
    id, date, logicalDate: date,
    type: kind,
    label: isBreak ? "Break" : "Buffer / Catch Up",
    task: isBreak ? "Break" : "Buffer / Catch Up",
    title: isBreak ? "Break" : "Buffer / Catch Up",
    phase: isBreak ? "Break" : "Buffer",
    energy: isBreak ? "Break" : "Buffer",
    priority: isBreak ? "Break" : "Buffer",
    priorityLevel: isBreak ? "Break" : "Buffer",
    displayPriorityLevel: isBreak ? "Break" : "Buffer",
    startTime, endTime,
    completed: false,
    locked: false,
    generated: true,
    source: "gap-finalizer",
  };
}

/** Strip first/last break, back-to-back breaks, zero/negative blocks. */
function validateAndPolishDay(day: any) {
  if (!day || !Array.isArray(day.blocks)) return;
  let bs: any[] = day.blocks.filter((b: any) => b && _blockMins(b) > 0);
  bs.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  // strip leading breaks (and gap-buffers right at start)
  while (bs.length) {
    const t = _normType(bs[0]);
    if (t === "break" || (t === "buffer" && bs[0]?.source === "gap-finalizer")) bs.shift();
    else break;
  }
  // strip trailing breaks (and trailing gap-buffer)
  while (bs.length) {
    const last = bs[bs.length - 1];
    const t = _normType(last);
    if (t === "break" || (t === "buffer" && last?.source === "gap-finalizer")) bs.pop();
    else break;
  }
  // back-to-back breaks → keep the first
  const dedup: any[] = [];
  for (const b of bs) {
    const prev = dedup[dedup.length - 1];
    if (prev && _normType(prev) === "break" && _normType(b) === "break") continue;
    dedup.push(b);
  }
  day.blocks = dedup;
}

export function finalizeAndValidatePlan(plan: any) {
  if (!plan || !Array.isArray(plan.days)) return;
  for (const day of plan.days) {
    finalizeDetailedDayGaps(day);
    validateAndPolishDay(day);
  }
}

/* ---------- per-day totals & counts (single source of truth) ---------- */

export function getDayTotals(day: any) {
  const blocks: any[] = day?.blocks || [];
  let focus = 0, breaks = 0, fixedMins = 0;
  let trackableTotal = 0;
  for (const b of blocks) {
    const mins = _blockMins(b);
    const t = _normType(b);
    if (t === "fixed") fixedMins += mins;
    else if (t === "break") breaks += mins;
    else focus += mins;
    if (isDetailedTrackableBlock(b)) trackableTotal++;
  }
  return { focus, breaks, fixedMins, trackableTotal };
}

export function getTrackableProgress(date: string) {
  const day = getDay(date);
  if (day) applyDetailedProgressToDay(day);
  const blocks: any[] = day?.blocks || [];
  const prog = getDetailedProgressForDate(date);
  const completedIds = new Set<string>(prog.completedBlocks || []);
  const trackable = blocks.filter(isDetailedTrackableBlock);
  const done = trackable.filter((b) => completedIds.has(b.id)).length;
  return { done, total: trackable.length, completedSet: completedIds };
}

/* ---------- smart notes ---------- */

export function getSmartNotes(): string[] {
  const plan = detailedState.generatedPlan;
  if (!plan) return [];
  const prefs: any = detailedState.preferences || {};
  const setup: any = detailedState.setup || {};
  const out: string[] = [];
  const days: any[] = plan.days || [];

  // Packed day if average focus utilization > 75% of available window.
  if (days.length) {
    const avg = days.reduce((s, d) => s + getDayTotals(d).focus, 0) / days.length;
    if (avg >= 240) out.push("Packed day: tiny breaks only — stay focused, you've got this.");
  }
  // Overnight detection.
  const s = _t2m(setup.startTime || "09:00");
  const e = _t2m(setup.endTime || "21:00");
  if (Number.isFinite(s) && Number.isFinite(e) && e <= s) out.push("Overnight plan — try to rest too, sleep matters.");

  if (prefs.bestFocus === "Night") out.push("Night focus selected: harder work is placed later in the day.");
  if (prefs.bestFocus === "Morning") out.push("Morning focus selected: harder work is front-loaded.");
  if (prefs.bestFocus === "Afternoon") out.push("Afternoon focus selected: peak blocks land mid-day.");

  if ((detailedState.fixedBlocks || []).length) out.push("Fixed commitments protected — we scheduled around them.");
  if (prefs.intensity === "Intense") out.push("Intense mode: breaks are shorter to keep momentum.");

  // Due-today reminder.
  const today = (new Date()).toISOString().slice(0, 10);
  const dueToday = (detailedState.tasks || []).filter((t: any) => t.dueDate === today);
  if (dueToday.length) out.push(`Due today: ${dueToday.map((t: any) => t.taskName).join(", ")}.`);

  // Multi-day → spaced practice claim.
  if (days.length >= 3) out.push("Spaced practice used across multiple days for better retention.");

  return Array.from(new Set(out));
}

/** Compare required task minutes to what got scheduled; return shortfalls. */
export function getOverloadSummary(): { items: { taskName: string; missingMins: number }[] } {
  const plan = detailedState.generatedPlan;
  if (!plan?.days) return { items: [] };
  const scheduled: Record<string, number> = {};
  for (const day of plan.days) for (const b of (day.blocks || [])) {
    if (b?.taskId) scheduled[b.taskId] = (scheduled[b.taskId] || 0) + _blockMins(b);
  }
  const items: { taskName: string; missingMins: number }[] = [];
  for (const t of (detailedState.tasks || [])) {
    // Heuristic required minutes (engine-agnostic): difficulty × 20 + (100 - prep) × 0.6
    const required = Math.max(30, Math.round((Number(t.difficulty) || 0) * 20 + (100 - (Number(t.preparedness) || 0)) * 0.6));
    const have = scheduled[t.id] || 0;
    const missing = required - have;
    if (missing >= 30) items.push({ taskName: t.taskName, missingMins: missing });
  }
  return { items };
}

/** Short list of due-today task names for compact week-card pill. */
export function getDueTodayShort(date: string): string[] {
  return (detailedState.tasks || []).filter((t: any) => t.dueDate === date).map((t: any) => t.taskName);
}
