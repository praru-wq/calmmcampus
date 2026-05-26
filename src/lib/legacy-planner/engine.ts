/* ============================================================
   CalmCampus — Legacy Single Planner engine (verbatim TS port)
   Ported 1:1 from legacy script.js (lines ~800–1640).
   Function names, formulas, weights, constants and labels are
   preserved exactly. Only DOM/localStorage side effects are
   stripped — this module is pure.
   ============================================================ */

export type Activity = "Study" | "Assignment" | "Mixed";
export type Intensity = "Easy" | "Normal" | "Push";
export type StartChoice = "Now" | "30" | "Pick";
export type BlockType = "Deep" | "Medium" | "Light" | "Break";
export type BlockCategory = "study" | "break";

export interface PlanBlock {
  id: string;
  category: BlockCategory;
  type: BlockType;
  task: string;
  label: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  completed: boolean;
}

export interface SinglePlan {
  activity: Activity;
  intensity: Intensity;
  startTime: string;
  endTime: string;
  date: string;
  locked: boolean;
  edited?: boolean;
  savedAt?: string;
  blocks: PlanBlock[];
}

// ---------------- utilities (verbatim) ----------------

export function uniqueId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function timeToMinutes(time: string): number {
  if (!time || typeof time !== "string" || !time.includes(":")) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const minutes = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function displayTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getStartTime(start: StartChoice, pickedTime?: string): string {
  const now = new Date();
  if (start === "30") now.setMinutes(now.getMinutes() + 30);
  if (start === "Pick" && pickedTime) return pickedTime;
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// ---------------- flow / schedule (verbatim) ----------------

interface FlowTask { name: string; weight: number; category: BlockCategory; }

function plannerTask(name: string, weight: number): FlowTask {
  return { name, weight, category: "study" };
}

export function getSinglePlannerFlow(activity: Activity): FlowTask[] {
  const flows = {
    Study: [
      plannerTask("Concept Learning", 20),
      plannerTask("Deep Study", 30),
      plannerTask("Practice Problems", 20),
      plannerTask("Active Recall", 15),
      plannerTask("Weak Area Review", 10),
      plannerTask("Revision", 5),
    ],
    Assignment: [
      plannerTask("Understand Assignment", 10),
      plannerTask("Research", 20),
      plannerTask("Plan Structure", 10),
      plannerTask("Write Draft", 35),
      plannerTask("Edit & Improve", 15),
      plannerTask("Final Review", 10),
    ],
  };
  if (activity === "Mixed") return interleavePlannerTasks(flows.Study, flows.Assignment);
  return (flows as any)[activity] || flows.Study;
}

function interleavePlannerTasks(studyTasks: FlowTask[], assignmentTasks: FlowTask[]): FlowTask[] {
  const mixed: FlowTask[] = [];
  const maxLen = Math.max(studyTasks.length, assignmentTasks.length);
  for (let i = 0; i < maxLen; i++) {
    if (studyTasks[i]) mixed.push({ ...studyTasks[i], weight: studyTasks[i].weight / 2 });
    if (assignmentTasks[i]) mixed.push({ ...assignmentTasks[i], weight: assignmentTasks[i].weight / 2 });
  }
  return mixed;
}

function distributeWeightedStudyTime(taskSequence: FlowTask[], totalStudyTime: number): number[] {
  const totalWeight = taskSequence.reduce((s, t) => s + t.weight, 0);
  const durations = taskSequence.map(t => Math.floor((totalStudyTime * t.weight) / totalWeight));
  durations[durations.length - 1] += totalStudyTime - durations.reduce((s, d) => s + d, 0);
  return durations;
}

function splitOversizedTasks(taskSequence: FlowTask[], durations: number[], maxBlockDuration: number) {
  const out: (FlowTask & { duration: number })[] = [];
  taskSequence.forEach((task, index) => {
    const duration = durations[index];
    const partCount = Math.ceil(duration / maxBlockDuration);
    if (partCount <= 1) { out.push({ ...task, duration }); return; }
    const basePart = Math.floor(duration / partCount);
    let remainder = duration - basePart * partCount;
    for (let p = 1; p <= partCount; p++) {
      const partDuration = basePart + (remainder > 0 ? 1 : 0);
      remainder -= 1;
      out.push({ ...task, name: `${task.name} (Part ${p})`, duration: partDuration });
    }
  });
  return out;
}

function assignRelativeTypes<T extends { duration: number }>(taskSequence: T[]): (T & { type: BlockType })[] {
  const durations = taskSequence.map(t => t.duration);
  const ranked = durations.map((duration, index) => ({ duration, index }))
    .sort((a, b) => b.duration - a.duration || a.index - b.index);
  const deepCount = Math.ceil(taskSequence.length * 0.3);
  const lightCount = Math.ceil(taskSequence.length * 0.3);
  const types: BlockType[] = Array(taskSequence.length).fill("Medium");
  ranked.slice(0, deepCount).forEach(item => { types[item.index] = "Deep"; });
  ranked.slice(-lightCount).forEach(item => { types[item.index] = "Light"; });
  return taskSequence.map((task, index) => ({ ...task, type: types[index] }));
}

function calculateCognitiveType(_duration: number, predefinedType?: BlockType): BlockType {
  return predefinedType || "Medium";
}

interface ScheduleItem { name: string; category: BlockCategory; duration: number; type: BlockType; }

export function buildSinglePlannerSchedule(activity: Activity, intensity: Intensity): ScheduleItem[] {
  const totalStudyTime = ({ Easy: 180, Normal: 360, Push: 540 } as const)[intensity];
  const maxBlockDuration = ({ Easy: 45, Normal: 60, Push: 90 } as const)[intensity];
  const taskSequence = getSinglePlannerFlow(activity);
  const durations = distributeWeightedStudyTime(taskSequence, totalStudyTime);
  const splitTasks = splitOversizedTasks(taskSequence, durations, maxBlockDuration);
  const typedTasks = assignRelativeTypes(splitTasks);
  const schedule: ScheduleItem[] = [];
  typedTasks.forEach(task => {
    schedule.push({ name: task.name, category: "study", duration: task.duration, type: task.type });
    schedule.push({ name: "Break", category: "break", duration: Math.max(1, Math.round(task.duration * 0.15)), type: "Break" });
  });
  // Legacy rule: trailing break removed so we never end on a break.
  if (schedule.length && schedule[schedule.length - 1].category === "break") schedule.pop();
  return schedule;
}

export function buildSinglePlan(activity: Activity, intensity: Intensity, startTime: string): SinglePlan {
  const start = timeToMinutes(startTime);
  const schedule = buildSinglePlannerSchedule(activity, intensity);
  let cursor = start;
  const blocks: PlanBlock[] = schedule.map((item, index) => {
    const blockStart = cursor;
    const blockEnd = cursor + item.duration;
    cursor = blockEnd;
    return {
      id: `block_${index + 1}`,
      category: item.category,
      type: item.category === "break" ? "Break" : calculateCognitiveType(item.duration, item.type),
      task: item.name,
      label: item.name,
      startTime: minutesToTime(blockStart),
      endTime: minutesToTime(blockEnd),
      completed: false,
    };
  });
  return {
    activity, intensity, startTime,
    endTime: minutesToTime(cursor),
    date: localToday(),
    locked: false,
    blocks,
  };
}

// ---------------- block / metrics helpers (verbatim) ----------------

export function blockMinutes(block: PlanBlock): number {
  let start = timeToMinutes(block.startTime);
  let end = timeToMinutes(block.endTime);
  if (end <= start) end += 1440;
  return end - start;
}

export function totalFocusMinutes(plan: SinglePlan | null): number {
  if (!plan) return 0;
  return plan.blocks
    .filter(b => b.category !== "break" && b.type !== "Break")
    .reduce((s, b) => s + blockMinutes(b), 0);
}

export function totalBreakMinutes(plan: SinglePlan | null): number {
  if (!plan) return 0;
  return plan.blocks
    .filter(b => b.category === "break" || b.type === "Break")
    .reduce((s, b) => s + blockMinutes(b), 0);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return `${h}h ${m}m`;
}

export interface SingleMetrics {
  totalBlocks: number;
  completedBlocks: number;
  completionPercentage: number;
  totalStudyTime: number;
  completedStudyTime: number;
}

export function singleMetrics(plan: SinglePlan | null): SingleMetrics {
  if (!plan) return { totalBlocks: 0, completedBlocks: 0, completionPercentage: 0, totalStudyTime: 0, completedStudyTime: 0 };
  const totalBlocks = plan.blocks.length;
  const completedBlocks = plan.blocks.filter(b => b.completed).length;
  const totalStudyTime = totalFocusMinutes(plan);
  const completedStudyTime = plan.blocks
    .filter(b => b.completed && b.category !== "break" && b.type !== "Break")
    .reduce((s, b) => s + blockMinutes(b), 0);
  return {
    totalBlocks,
    completedBlocks,
    completionPercentage: totalBlocks ? Math.round((completedBlocks / totalBlocks) * 100) : 0,
    totalStudyTime,
    completedStudyTime,
  };
}

export function typeText(block: PlanBlock): BlockType {
  if (block.category === "break") return "Break";
  return block.type || calculateCognitiveType(blockMinutes(block));
}

export function recomputeSingleTimes(plan: SinglePlan): void {
  let cursor = timeToMinutes(plan.startTime);
  const planDuration = plan.blocks.reduce((s, b) => s + blockMinutes(b), 0);
  const hardEnd = timeToMinutes(plan.startTime) + planDuration;
  plan.blocks.forEach((block, index) => {
    const remainingBlocks = plan.blocks.length - index;
    const maxEnd = hardEnd - Math.max(0, remainingBlocks - 1) * 5;
    const category: BlockCategory = block.category || (block.type === "Break" ? "break" : "study");
    const duration = block.startTime && block.endTime ? blockMinutes(block) : (category === "study" ? 30 : 10);
    const next = index === plan.blocks.length - 1 ? hardEnd : Math.min(cursor + duration, maxEnd);
    block.startTime = minutesToTime(cursor);
    block.endTime = minutesToTime(next);
    block.category = category;
    block.task = block.task || block.label;
    block.label = block.task;
    block.type = category === "break" ? "Break" : calculateCognitiveType(next - cursor, block.type);
    cursor = next;
  });
  plan.endTime = minutesToTime(hardEnd);
}
