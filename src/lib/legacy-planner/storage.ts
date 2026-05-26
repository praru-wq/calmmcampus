/* Legacy Single Planner storage adapter — preserves exact legacy keys. */
import type { SinglePlan } from "./engine";
import { localToday } from "./engine";

export const singlePlannerKeys = {
  saved: "singlePlannerSaved",
  locked: "singlePlannerLocked",
  plan: "singlePlannerPlan",
  progress: "singlePlannerProgress",
  date: "singlePlannerDate",
  result: "singlePlannerResult",
  resultDate: "singlePlannerResultDate",
  legacyPlan: "calmCampusSinglePlan",
  legacyProgress: "calmCampusTimeTracking",
} as const;

function isBrowser() { return typeof window !== "undefined" && !!window.localStorage; }

export function loadSinglePlan(): SinglePlan | null {
  if (!isBrowser()) return null;
  const savedDate = localStorage.getItem(singlePlannerKeys.date);
  const today = localToday();
  const raw = localStorage.getItem(singlePlannerKeys.plan)
    || localStorage.getItem(singlePlannerKeys.legacyPlan);
  if (!raw) return null;
  try {
    const plan = JSON.parse(raw) as SinglePlan;
    if (savedDate && savedDate !== today && plan.date !== today) return null;
    return plan;
  } catch { return null; }
}

export function saveSinglePlan(plan: SinglePlan): void {
  if (!isBrowser()) return;
  const progress = {
    totalBlocks: plan.blocks.length,
    completedBlocks: plan.blocks.filter(b => b.completed).length,
    completedBlockIds: plan.blocks.filter(b => b.completed).map(b => b.id),
    completionPercentage: plan.blocks.length
      ? Math.round((plan.blocks.filter(b => b.completed).length / plan.blocks.length) * 100)
      : 0,
  };
  localStorage.setItem(singlePlannerKeys.saved, String(!!plan.locked));
  localStorage.setItem(singlePlannerKeys.locked, String(!!plan.locked));
  localStorage.setItem(singlePlannerKeys.plan, JSON.stringify(plan));
  localStorage.setItem(singlePlannerKeys.progress, JSON.stringify(progress));
  localStorage.setItem(singlePlannerKeys.date, plan.date || localToday());
  localStorage.setItem(singlePlannerKeys.legacyPlan, JSON.stringify(plan));
  localStorage.setItem(singlePlannerKeys.legacyProgress, JSON.stringify(progress));
}

export function clearSinglePlan(): void {
  if (!isBrowser()) return;
  Object.values(singlePlannerKeys).forEach(k => localStorage.removeItem(k));
}

export function getPlannerResultForToday(): { type: "completed" | "incomplete"; date: string } | null {
  if (!isBrowser()) return null;
  const type = localStorage.getItem(singlePlannerKeys.result);
  const date = localStorage.getItem(singlePlannerKeys.resultDate);
  if (!type || !date || date !== localToday()) return null;
  return { type: type as "completed" | "incomplete", date };
}

export function savePlannerResult(type: "completed" | "incomplete"): void {
  if (!isBrowser()) return;
  localStorage.setItem(singlePlannerKeys.result, type);
  localStorage.setItem(singlePlannerKeys.resultDate, localToday());
}
