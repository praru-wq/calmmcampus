/* eslint-disable */
// @ts-nocheck
/* CalmCampus — Legacy Detailed Planner engine (verbatim TS port)
   Ported from script.js lines 1641-5400. DOM render functions
   removed; pure scheduling/keyword/priority/state/feedback logic kept. */

import { timeToMinutes, minutesToTime, uniqueId as engineUniqueId, localToday as engineLocalToday } from './engine';

const localToday = engineLocalToday;
const uniqueId = engineUniqueId;

// DOM stubs — legacy code only mutated DOM for warnings & form sync.
// React UI manages all of that, so safe selectors return null/no-op.
const _docFallback: any = {
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => ({ textContent: '', style: {}, addEventListener: () => {}, appendChild: () => {}, classList: { add(){}, remove(){}, toggle(){} } }),
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  addEventListener: () => {},
};
// Legacy code uses bare identifiers `document`, `window`, `localStorage`.
// We can't redeclare those names with `const` in this module (TDZ would break
// `typeof` checks above), so we capture globals via globalThis and alias.
const _g: any = globalThis as any;
const document: any = (typeof _g.document !== 'undefined') ? _g.document : _docFallback;
const window: any = (typeof _g.window !== 'undefined') ? _g.window : {};
const localStorage: any = (typeof _g.window !== 'undefined' && _g.window.localStorage)
  ? _g.window.localStorage
  : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// Shared planner state used by single planner — minimal stub.
const plannerState: any = { isLocked:false, hasGeneratedPlan:false, hasSavedPlan:false, currentStep:'setup', history:[], data:{ mode:null,intensity:null,startTime:null,generatedPlan:[],completedBlocks:[] } };

// DOM-update helpers stubbed so legacy `renderXxx` survivors no-op safely.
function setValue(_id: string, _v: any) {}
function setChecked(_id: string, _v: any) {}
function showPage(_id: string) {}
function goToStep(_step: string) {}
function showLockedTodayMessage() {}
function syncPlannerStateFromPlan() {}
function escapeHTML(v: any){ return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }

// Render/navigation stubs — legacy code calls these after mutating state.
// React UI drives all rendering, so these become no-ops.
function showDetailedReviewError(_msg: string) {}
function navigateDetailed(_step: string) {}
function renderDetailedTrack(_date?: string) {}
function renderFixedOverlapWarning() { return false; }
function clearDetailedNavigationState() {}

/* ============================================================
   Detailed Planner
   ============================================================ */
export const detailedKeys = {
  draft: 'detailedPlannerDraft',
  setup: 'detailedPlannerSetup',
  fixed: 'detailedPlannerFixedBlocks',
  tasks: 'detailedPlannerTasks',
  preferences: 'detailedPlannerPreferences',
  generated: 'detailedPlannerGeneratedPlan',
  progress: 'detailedPlannerProgress',
  lockedDates: 'detailedPlannerLockedDates',
  feedback: 'detailedPlannerFeedback',
  currentStep: 'detailedPlannerCurrentStep'
};
const detailedStepPages = {
  setup: 'detailedSetupPage',
  fixed: 'detailedFixedPage',
  tasks: 'detailedTasksPage',
  preferences: 'detailedPreferencesPage',
  review: 'detailedReviewPage',
  week: 'detailedWeekPage',
  day: 'detailedDayPage',
  edit: 'detailedEditPage',
  lock: 'detailedLockPage',
  track: 'detailedTrackPage',
  feedback: 'detailedFeedbackPage'
};
const detailedBack = {
  setup: 'plannerModePage',
  fixed: 'setup',
  tasks: 'fixed',
  preferences: 'tasks',
  review: 'preferences',
  week: 'review',
  day: 'week',
  edit: 'day',
  lock: 'day',
  track: 'week',
  feedback: 'dashboardPage'
};
export const detailedState: any = {
  setup: null,
  fixedBlocks: [],
  tasks: [],
  preferences: null,
  generatedPlan: null,
  progress: {},
  lockedDates: {},
  feedback: {},
  feedbackDate: null,
  previewDate: null,
  previewReturnStep: null,
  currentStep: 'setup',
  selectedDate: localToday(),
  lastTimetableStep: 'day'
};
export const lockedAllowedDetailedSteps = ['track', 'feedback'];
export const lockedBlockedDetailedSteps = ['setup', 'fixed', 'tasks', 'preferences', 'review', 'week', 'day', 'edit', 'lock'];
let pendingDetailedLeaveTarget = null;
let detailedPlannerGenerated = false;

export var isDetailedPlanLocked: any = function isDetailedPlanLocked() {
  return !!detailedState.generatedPlan?.days?.length && Object.values(detailedState.lockedDates || {}).some(Boolean);
}

export var loadDetailedPlannerState: any = function loadDetailedPlannerState() {
  detailedState.setup = JSON.parse(localStorage.getItem(detailedKeys.setup) || 'null') || defaultDetailedSetup();
  detailedState.fixedBlocks = JSON.parse(localStorage.getItem(detailedKeys.fixed) || '[]');
  detailedState.tasks = JSON.parse(localStorage.getItem(detailedKeys.tasks) || '[]');
  detailedState.preferences = JSON.parse(localStorage.getItem(detailedKeys.preferences) || 'null') || defaultDetailedPreferences();
  detailedState.generatedPlan = JSON.parse(localStorage.getItem(detailedKeys.generated) || 'null');
  normalizeDetailedPlan();
  detailedPlannerGenerated = !!detailedState.generatedPlan?.days?.length;
  window.detailedPlannerGenerated = detailedPlannerGenerated;
  detailedState.progress = JSON.parse(localStorage.getItem(detailedKeys.progress) || '{}');
  detailedState.lockedDates = JSON.parse(localStorage.getItem(detailedKeys.lockedDates) || '{}');
  detailedState.feedback = JSON.parse(localStorage.getItem(detailedKeys.feedback) || '{}');
  detailedState.currentStep = localStorage.getItem(detailedKeys.currentStep) || 'setup';
  detailedState.selectedDate = detailedState.generatedPlan?.days?.[0]?.date || localToday();
  applyDetailedProgressToAllDays();
}

export var normalizeDetailedPlan: any = function normalizeDetailedPlan() {
  if (!detailedState.generatedPlan?.days) return;
  detailedState.generatedPlan.days.forEach(day => {
    day.blocks = (day.blocks || []).map(block => {
      const oldType = block.type;
      if (oldType === 'Break') return { ...block, type: 'break', task: block.task || 'Break', phase: 'Break', priority: 'Break', priorityLevel: 'Break', energy: 'Break' };
      if (oldType === 'Buffer') return { ...block, type: 'buffer', task: block.task || 'Buffer / Catch Up', phase: 'Buffer', priority: 'Buffer', priorityLevel: 'Buffer', energy: 'Buffer' };
      if (oldType === 'fixed' || block.priorityLevel === 'Fixed') return { ...block, type: 'fixed', task: block.task || block.label, phase: block.phase || block.category || 'Fixed', priority: 'Fixed', priorityLevel: 'Fixed', energy: 'Fixed', locked: true };
      if (['Heavy', 'Medium', 'Light'].includes(oldType)) {
        const visiblePriority = block.displayPriorityLevel || block.priorityLevel || block.priority || 'Low';
        return { ...block, type: 'study', energy: oldType, priority: visiblePriority, priorityLevel: visiblePriority, displayPriorityLevel: ['High', 'Medium', 'Low'].includes(visiblePriority) ? visiblePriority : undefined };
      }
      return block;
    });
    cleanDetailedDayBlocks(day);
  });
  refreshDetailedPlanBlocks();
}

export var defaultDetailedSetup: any = function defaultDetailedSetup() {
  return {
    scope: 'Today Only',
    startDate: localToday(),
    endDate: localToday(),
    startTime: '09:00',
    endTime: '21:00'
  };
}

export var defaultDetailedPreferences: any = function defaultDetailedPreferences() {
  return {
    intensity: 'Balanced',
    includeBuffer: false,
    bestFocus: 'Morning',
    sessionLength: '50 min',
    breakPreference: 'Normal'
  };
}

export var collectDetailedSetup: any = function collectDetailedSetup() {
  const stored = JSON.parse(localStorage.getItem(detailedKeys.setup) || 'null') || {};
  const prev = detailedState.setup || {};
  detailedState.setup = {
    scope: document.getElementById('detailScope')?.value || prev.scope || stored.scope || 'Today Only',
    startDate: document.getElementById('detailStartDate')?.value || prev.startDate || stored.startDate || localToday(),
    endDate: document.getElementById('detailEndDate')?.value || prev.endDate || stored.endDate || localToday(),
    startTime: document.getElementById('detailStartTime')?.value || prev.startTime || stored.startTime || stored.dailyStartTime || stored.dailyStart || '09:00',
    endTime: document.getElementById('detailEndTime')?.value || prev.endTime || stored.endTime || stored.dailyEndTime || stored.dailyEnd || '21:00'
  };
  if (detailedState.setup.scope === 'Today Only') detailedState.setup.endDate = detailedState.setup.startDate;
}

export var normalizeDetailedSetup: any = function normalizeDetailedSetup() {
  const stored = JSON.parse(localStorage.getItem(detailedKeys.setup) || 'null') || {};
  const source = { ...stored, ...(detailedState.setup || {}) };
  const setup = {
    scope: source.scope || 'Today Only',
    startDate: source.startDate || localToday(),
    endDate: source.endDate || source.startDate || localToday(),
    startTime: source.startTime || source.dailyStartTime || source.dailyStart || '09:00',
    endTime: source.endTime || source.dailyEndTime || source.dailyEnd || '21:00'
  };
  if (setup.scope === 'Today Only') setup.endDate = setup.startDate;
  detailedState.setup = setup;
  localStorage.setItem(detailedKeys.setup, JSON.stringify(setup));
  return setup;
}

export var collectDetailedPreferences: any = function collectDetailedPreferences() {
  if (!document.getElementById('detailedPreferencesPage')?.classList.contains('active') && detailedState.preferences) return;
  const active = document.querySelector('[data-detail-group="intensity"] .detail-choice.active');
  detailedState.preferences = {
    intensity: active?.dataset.value || detailedState.preferences?.intensity || 'Balanced',
    includeBuffer: document.getElementById('includeBuffer') ? !!document.getElementById('includeBuffer').checked : !!detailedState.preferences?.includeBuffer,
    bestFocus: document.getElementById('bestFocus')?.value || detailedState.preferences?.bestFocus || 'Morning',
    sessionLength: document.getElementById('sessionLength')?.value || detailedState.preferences?.sessionLength || '50 min',
    breakPreference: document.getElementById('breakPreference')?.value || detailedState.preferences?.breakPreference || 'Normal'
  };
}

export var saveDetailedDraft: any = function saveDetailedDraft() {
  collectDetailedSetup();
  collectDetailedPreferences();
  normalizeDetailedTasks();
  localStorage.setItem(detailedKeys.draft, 'true');
  localStorage.setItem(detailedKeys.setup, JSON.stringify(detailedState.setup));
  localStorage.setItem(detailedKeys.fixed, JSON.stringify(detailedState.fixedBlocks));
  localStorage.setItem(detailedKeys.tasks, JSON.stringify(detailedState.tasks));
  localStorage.setItem(detailedKeys.preferences, JSON.stringify(detailedState.preferences));
  localStorage.setItem(detailedKeys.currentStep, detailedState.currentStep);
}

export var saveGeneratedDetailedPlan: any = function saveGeneratedDetailedPlan() {
  validateGeneratedDetailedPlan();
  applyDetailedProgressToAllDays();
  refreshDetailedPlanBlocks();
  localStorage.setItem(detailedKeys.generated, JSON.stringify(detailedState.generatedPlan));
}

export function saveDetailedProgress(date = detailedState.selectedDate || getActiveDetailedTrackDate() || localToday()) {
  const day = getDetailedDayByDate(date);
  if (!day) return;
  ensureDetailedBlockTrackingIds(day);
  const blocks = day.blocks || [];
  const completedBlocks = blocks.filter(block => block.completed).map(block => block.id);
  const completed = completedBlocks.length;
  detailedState.progress[day.date] = {
    completed,
    total: blocks.length,
    completedIds: completedBlocks,
    completedBlocks,
    percent: blocks.length ? Math.round((completed / blocks.length) * 100) : 0
  };
  localStorage.setItem(detailedKeys.progress, JSON.stringify(detailedState.progress));
}

export var getDetailedProgressForDate: any = function getDetailedProgressForDate(date) {
  if (!detailedState.progress || typeof detailedState.progress !== 'object') detailedState.progress = {};
  if (!detailedState.progress[date]) {
    detailedState.progress[date] = { completed: 0, total: 0, completedIds: [], completedBlocks: [], percent: 0 };
  }
  const progress = detailedState.progress[date];
  if (!Array.isArray(progress.completedBlocks)) progress.completedBlocks = Array.isArray(progress.completedIds) ? [...progress.completedIds] : [];
  if (!Array.isArray(progress.completedIds)) progress.completedIds = [...progress.completedBlocks];
  return progress;
}

export var stableDetailedBlockId: any = function stableDetailedBlockId(block, date) {
  if (block.id) return block.id;
  const title = block.label || block.task || block.taskName || 'block';
  return [date, block.startTime, block.endTime, title, block.type || block.energy || 'block']
    .join('_')
    .replace(/[^a-z0-9_-]+/gi, '');
}

export var ensureDetailedBlockTrackingIds: any = function ensureDetailedBlockTrackingIds(day) {
  if (!day?.blocks) return;
  day.blocks.forEach(block => {
    block.id = stableDetailedBlockId(block, day.date);
  });
}

export var applyDetailedProgressToDay: any = function applyDetailedProgressToDay(day) {
  if (!day) return;
  ensureDetailedBlockTrackingIds(day);
  const existingProgress = detailedState.progress?.[day.date];
  const hasSavedCompletionList = !!existingProgress && (Array.isArray(existingProgress.completedBlocks) || Array.isArray(existingProgress.completedIds));
  if (!existingProgress && !(day.blocks || []).some(block => block.completed)) {
    day.blocks = (day.blocks || []).map(block => ({ ...block, completed: false }));
    return;
  }
  const progress = getDetailedProgressForDate(day.date);
  const saved = new Set(hasSavedCompletionList ? progress.completedBlocks : (day.blocks || []).filter(block => block.completed).map(block => block.id));
  day.blocks = (day.blocks || []).map(block => ({ ...block, completed: saved.has(block.id) }));
}

export var applyDetailedProgressToAllDays: any = function applyDetailedProgressToAllDays() {
  (detailedState.generatedPlan?.days || []).forEach(applyDetailedProgressToDay);
}

export var toggleDetailedBlockComplete: any = function toggleDetailedBlockComplete(blockId, date, checked) {
  if (!canTrackDetailedDate(date)) {
    renderDetailedTrack(date);
    return;
  }
  const day = getDetailedDayByDate(date);
  if (!day) return;
  applyDetailedProgressToDay(day);
  const block = (day.blocks || []).find(item => item.id === blockId);
  if (!block) return;
  block.completed = checked;
  const progress = getDetailedProgressForDate(day.date);
  const completed = new Set(progress.completedBlocks);
  if (checked) completed.add(block.id);
  else completed.delete(block.id);
  progress.completedBlocks = Array.from(completed);
  progress.completedIds = [...progress.completedBlocks];
  progress.total = day.blocks.length;
  progress.completed = progress.completedBlocks.length;
  progress.percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  localStorage.setItem(detailedKeys.progress, JSON.stringify(detailedState.progress));
  saveGeneratedDetailedPlan();
  renderDetailedTrack(day.date);
}

export var clearDetailedPlanner: any = function clearDetailedPlanner() {
  Object.values(detailedKeys).forEach(key => localStorage.removeItem(key));
  detailedState.setup = defaultDetailedSetup();
  detailedState.fixedBlocks = [];
  detailedState.tasks = [];
  detailedState.preferences = defaultDetailedPreferences();
  detailedState.generatedPlan = null;
  detailedState.progress = {};
  detailedState.lockedDates = {};
  detailedState.feedback = {};
  detailedState.currentStep = 'setup';
  detailedState.selectedDate = localToday();
  detailedPlannerGenerated = false;
  window.detailedPlannerGenerated = false;
}

export var hasUnsavedDetailedGeneratedPlan: any = function hasUnsavedDetailedGeneratedPlan() {
  return !!detailedState.generatedPlan?.days?.length && !isDetailedPlanLocked() && !detailedState.feedback[localToday()];
}

export var validateDetailedStep: any = function validateDetailedStep(step) {
  if (step === 'setup') {
    collectDetailedSetup();
    const warning = document.getElementById('detailSetupWarning');
    const start = timeToMinutes(detailedState.setup.startTime);
    let end = timeToMinutes(detailedState.setup.endTime);
    if (end <= start) end += 1440;
    const valid = !!detailedState.setup.startTime && !!detailedState.setup.endTime && end > start && detailedState.setup.endDate >= detailedState.setup.startDate;
    if (warning) warning.textContent = !valid ? 'Please use a valid date range and time window.' : timeToMinutes(detailedState.setup.endTime) <= start ? 'Late night plans can affect sleep. Try to rest too.' : '';
    return valid;
  }
  if (step === 'fixed') return !renderFixedOverlapWarning();
  if (step === 'tasks') {
    const warning = document.getElementById('taskWarning');
    const valid = detailedState.tasks.length > 0;
    if (warning) warning.textContent = valid ? '' : 'Add at least one complete task before continuing.';
    return valid;
  }
  return true;
}

export var addFixedBlock: any = function addFixedBlock() {
  const title = document.getElementById('fixedTitle')?.value.trim();
  const startTime = document.getElementById('fixedStart')?.value;
  const endTime = document.getElementById('fixedEnd')?.value;
  const days = Array.from(document.getElementById('fixedDays')?.selectedOptions || []).map(option => option.value);
  const category = document.getElementById('fixedCategory')?.value || 'Custom';
  if (!title || !startTime || !endTime || normalizedEndMinutes(startTime, endTime) <= timeToMinutes(startTime)) {
    document.getElementById('fixedOverlapWarning').textContent = 'Add a title and a valid time range.';
    return;
  }
  detailedState.fixedBlocks.push({
    id: uniqueId(),
    title,
    startTime,
    endTime,
    days: days.length ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    category,
    type: 'fixed',
    locked: true
  });
  saveDetailedDraft();
  renderFixedBlocks();
}

export var rangesOverlap: any = function rangesOverlap(a, b) {
  if (a.actualStartISO && a.actualEndISO && b.actualStartISO && b.actualEndISO) {
    return new Date(a.actualStartISO) < new Date(b.actualEndISO) && new Date(b.actualStartISO) < new Date(a.actualEndISO);
  }
  const aStart = Number.isFinite(a.startMinute) ? a.startMinute : timeToMinutes(a.startTime);
  const aEnd = Number.isFinite(a.endMinute) ? a.endMinute : normalizedEndMinutes(a.startTime, a.endTime);
  const bStart = Number.isFinite(b.startMinute) ? b.startMinute : timeToMinutes(b.startTime);
  const bEnd = Number.isFinite(b.endMinute) ? b.endMinute : normalizedEndMinutes(b.startTime, b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export var normalizedEndMinutes: any = function normalizedEndMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 1440;
  return end;
}

export var addDetailedTask: any = function addDetailedTask() {
  const taskName = document.getElementById('taskDetailedName')?.value.trim();
  const taskType = document.getElementById('taskDetailedType')?.value;
  const dueDate = document.getElementById('taskDetailedDue')?.value;
  const difficultyInput = document.getElementById('taskDetailedDifficulty');
  const preparednessInput = document.getElementById('taskDetailedPreparedness');
  const difficulty = Math.min(10, Math.max(0, Number(difficultyInput?.value)));
  const preparedness = Math.min(100, Math.max(0, Number(preparednessInput?.value)));
  const hasDifficulty = difficultyInput?.value !== '';
  const hasPreparedness = preparednessInput?.value !== '';
  const valid = taskName && taskType && dueDate && hasDifficulty && hasPreparedness && Number.isFinite(difficulty) && Number.isFinite(preparedness);
  if (!valid) {
    document.getElementById('taskWarning').textContent = 'Add a task name, task type, due date, difficulty, and preparedness.';
    return;
  }
  if (difficultyInput) difficultyInput.value = difficulty;
  if (preparednessInput) preparednessInput.value = preparedness;
  const prepStart = detailedState.setup?.startDate || localToday();
  const lastPrepDate = taskLastPrepDate(dueDate, prepStart);
  const daysLeft = Math.max(1, inclusiveDateDiff(prepStart, lastPrepDate) + 1);
  const priorityFields = withDetailedPriorityFields({ difficulty, preparedness, dueDate, selectedType: taskType, taskType, daysLeft, estimatedMinutes: 120, availableMinutesBeforeDeadline: 120 });
  detailedState.tasks.push({
    id: uniqueId(),
    taskName,
    taskType,
    dueDate,
    daysLeft,
    difficulty,
    preparedness,
    lastPrepDate,
    urgent: lastPrepDate === dueDate,
    ...priorityFields
  });
  normalizeDetailedTasks();
  localStorage.setItem(detailedKeys.tasks, JSON.stringify(detailedState.tasks));
  ['taskDetailedName', 'taskDetailedDifficulty', 'taskDetailedPreparedness'].forEach(id => setValue(id, ''));
  saveDetailedDraft();
  renderDetailedTasks();
}

export var normalizeDetailedTasks: any = function normalizeDetailedTasks() {
  const stored = JSON.parse(localStorage.getItem(detailedKeys.tasks) || '[]');
  const source = detailedState.tasks?.length ? detailedState.tasks : stored;
  detailedState.tasks = applyRelativeDisplayPriority((Array.isArray(source) ? source : []).map(task => {
    const dueDate = task.dueDate || '';
    const difficulty = Math.min(10, Math.max(0, Number.isFinite(Number(task.difficulty)) ? Number(task.difficulty) : 5));
    const preparedness = Math.min(100, Math.max(0, Number.isFinite(Number(task.preparedness)) ? Number(task.preparedness) : 50));
    const prepStart = detailedState.setup?.startDate || localToday();
    const lastPrepDate = taskLastPrepDate(dueDate, prepStart);
    const calculatedDaysLeft = inclusiveDateDiff(prepStart, lastPrepDate) + 1;
    const daysLeft = Math.max(1, Number.isFinite(calculatedDaysLeft) ? calculatedDaysLeft : 1);
    const id = task.id || uniqueId();
    const priorityFields = withDetailedPriorityFields({ ...task, id, difficulty, preparedness, dueDate, selectedType: task.taskType || 'Study', taskType: task.taskType || 'Study', daysLeft, estimatedMinutes: task.estimatedMinutes || 120, availableMinutesBeforeDeadline: task.availableMinutesBeforeDeadline || 120 });
    return {
      ...priorityFields,
      id,
      taskName: task.taskName || 'Study Task',
      taskType: task.taskType || 'Study',
      dueDate,
      daysLeft,
      difficulty,
      preparedness,
      lastPrepDate,
      urgent: lastPrepDate === dueDate
    };
  }));
  localStorage.setItem(detailedKeys.tasks, JSON.stringify(detailedState.tasks));
  return detailedState.tasks;
}

export var calculateDetailedPriorityScore: any = function calculateDetailedPriorityScore(difficulty, preparedness) {
  const preparednessGap = 100 - preparedness;
  const difficultyPressure = difficulty * 10;
  return (preparednessGap * 0.55) + (difficultyPressure * 0.45);
}

export var priorityLevelFromScore: any = function priorityLevelFromScore(score) {
  if (score >= 70) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

export var priorityCounts: any = function priorityCounts() {
  normalizeDetailedTasks();
  return detailedState.tasks.reduce((acc, task) => {
    acc[task.priorityLevel] += 1;
    return acc;
  }, { High: 0, Medium: 0, Low: 0 });
}

export var generateDetailedPlan: any = function generateDetailedPlan() {
  try {
    // Always collect from DOM first, then normalize from localStorage fallbacks
    collectDetailedSetup();
    normalizeDetailedSetup();
    normalizeDetailedTasks();
    collectDetailedPreferences();

    const setup = detailedState.setup;
    const tasks = detailedState.tasks;

    // Ensure startTime and endTime are always valid strings
    if (!setup.startTime || !setup.startTime.includes(':')) setup.startTime = '09:00';
    if (!setup.endTime || !setup.endTime.includes(':')) setup.endTime = '21:00';
    if (!setup.startDate) setup.startDate = localToday();
    if (!setup.endDate) setup.endDate = setup.startDate;

    const startMinutes = timeToMinutes(setup.startTime);
    let endMinutes = timeToMinutes(setup.endTime);
    if (endMinutes <= startMinutes) endMinutes += 1440;
    const hasValidSetup = endMinutes > startMinutes;
    const hasTasks = Array.isArray(tasks) && tasks.length > 0;
    console.log('Detailed setup used:', setup);
    console.log('Detailed tasks used:', tasks);
    if (!hasValidSetup || !hasTasks) {
      showDetailedReviewError(hasTasks ? 'Could not generate plan. Please check your tasks and time settings.' : 'Add at least one task before generating your plan.');
      return;
    }
    const dates = buildDateRange(setup.startDate, setup.endDate);
    if (!dates.length) throw new Error('No valid dates');
    const days = generateDetailedSchedule(dates, tasks);
    detailedState.generatedPlan = {
      createdAt: new Date().toISOString(),
      setup: { ...setup },
      preferences: { ...detailedState.preferences },
      days,
      blocks: []
    };
    detailedPlannerGenerated = true;
    window.detailedPlannerGenerated = true;
    refreshDetailedPlanBlocks();
    console.log('Detailed generated plan:', detailedState.generatedPlan);
    detailedState.selectedDate = days[0]?.date || localToday();
    saveDetailedDraft();
    saveGeneratedDetailedPlan();
    showDetailedReviewError('');
    navigateDetailed('week');
  } catch (error) {
    console.error(error);
    showDetailedReviewError('Could not generate plan. Please check your tasks and time settings.');
  }
}

export var refreshDetailedPlanBlocks: any = function refreshDetailedPlanBlocks() {
  if (!detailedState.generatedPlan?.days) return;
  detailedState.generatedPlan.blocks = detailedState.generatedPlan.days.flatMap(day => day.blocks.map(block => ({ ...block, date: day.date })));
}

export var generateDetailedSchedule: any = function generateDetailedSchedule(dates, tasks) {
  const normalizedTasks = normalizeDetailedTaskData(tasks);
  const days = dates.map(date => buildLogicalDay(date));
  days.forEach(day => {
    day.fixedBlocks = fixedBlocksForLogicalDay(day);
    day.freeTimeBlocks = subtractFixedCommitments(day.dayStartTimestamp, day.dayEndTimestamp, day.fixedBlocks);
    day.generatedBlocks = [];
    day.blocks = [...day.fixedBlocks];
  });
  const taskQueue = buildDetailedTaskQueue(normalizedTasks, dates);
  days.forEach(day => fillDetailedLogicalDay(day, taskQueue));
  days.forEach(cleanDetailedDayBlocks);
  return days.map(day => ({
    date: day.date,
    label: day.label,
    dayStartTimestamp: day.dayStartTimestamp,
    dayEndTimestamp: day.dayEndTimestamp,
    fixedBlocks: day.fixedBlocks,
    freeTimeBlocks: day.freeTimeBlocks,
    generatedBlocks: day.generatedBlocks,
    blocks: day.blocks
  }));
}

export var normalizeDetailedTaskData: any = function normalizeDetailedTaskData(tasks) {
  const source = Array.isArray(tasks) ? tasks : [];
  return source.map(task => {
    const difficultyValue = Number(task.difficulty);
    const preparednessValue = Number(task.preparedness);
    const difficulty = Number.isFinite(difficultyValue) ? Math.max(1, Math.min(10, difficultyValue)) : 5;
    const preparedness = Number.isFinite(preparednessValue) ? Math.max(0, Math.min(100, preparednessValue)) : 50;
    const dueDate = task.dueDate || detailedState.setup?.endDate || localToday();
    const lastPrepDate = taskLastPrepDate(dueDate, detailedState.setup?.startDate || localToday());
    const priorityScore = calculateDetailedPriorityScore(difficulty, preparedness);
    return {
      ...task,
      id: task.id || uniqueId(),
      taskName: task.taskName || task.name || 'Study Task',
      taskType: task.taskType || 'Study',
      dueDate,
      difficulty,
      preparedness,
      lastPrepDate,
      urgent: lastPrepDate === dueDate,
      priorityScore,
      priorityLevel: priorityLevelFromScore(priorityScore)
    };
  });
}

export var buildLogicalDay: any = function buildLogicalDay(date) {
  const dayStart = combineLocalDateTime(date, detailedState.setup.startTime || '09:00');
  const dayEnd = combineLocalDateTime(date, detailedState.setup.endTime || '21:00');
  if (dayEnd <= dayStart) dayEnd.setDate(dayEnd.getDate() + 1);
  return {
    date,
    label: dayLabel(date),
    dayStartTimestamp: dayStart.toISOString(),
    dayEndTimestamp: dayEnd.toISOString(),
    fixedBlocks: [],
    freeTimeBlocks: [],
    generatedBlocks: [],
    blocks: []
  };
}

export var combineLocalDateTime: any = function combineLocalDateTime(dateString, timeString) {
  const date = parseLocalDate(dateString);
  const [hours, minutes] = String(timeString || '00:00').split(':').map(Number);
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

export var fixedBlocksForLogicalDay: any = function fixedBlocksForLogicalDay(day) {
  const key = dayKey(day.date);
  const dayStart = new Date(day.dayStartTimestamp);
  const dayEnd = new Date(day.dayEndTimestamp);
  const dailyStartMinutes = timeToMinutes(detailedState.setup.startTime || '09:00');
  const dailyEndMinutes = timeToMinutes(detailedState.setup.endTime || '21:00');
  return (Array.isArray(detailedState.fixedBlocks) ? detailedState.fixedBlocks : [])
    .filter(block => (block.days?.length ? block.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).includes(key))
    .map(block => {
      const fixedStart = combineLocalDateTime(day.date, block.startTime || '00:00');
      const fixedEnd = combineLocalDateTime(day.date, block.endTime || '00:00');
      if (dailyEndMinutes <= dailyStartMinutes && timeToMinutes(block.startTime || '00:00') < dailyStartMinutes) {
        fixedStart.setDate(fixedStart.getDate() + 1);
        fixedEnd.setDate(fixedEnd.getDate() + 1);
      }
      if (fixedEnd <= fixedStart) fixedEnd.setDate(fixedEnd.getDate() + 1);
      const start = new Date(Math.max(dayStart.getTime(), fixedStart.getTime()));
      const end = new Date(Math.min(dayEnd.getTime(), fixedEnd.getTime()));
      if (end <= start) return null;
      return makeDetailedBlock({
        logicalDate: day.date,
        start,
        end,
        type: 'fixed',
        taskId: block.id,
        task: block.title || 'Fixed Commitment',
        phase: block.category || 'Fixed',
        priority: 'Fixed',
        locked: true,
        blockNote: block.blockNote || block.note || ''
      });
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.actualStartISO) - new Date(b.actualStartISO));
}

export var subtractFixedCommitments: any = function subtractFixedCommitments(dayStartISO, dayEndISO, fixedBlocks) {
  const windows = [{ start: new Date(dayStartISO), end: new Date(dayEndISO) }];
  fixedBlocks.forEach(block => {
    const fixedStart = new Date(block.actualStartISO);
    const fixedEnd = new Date(block.actualEndISO);
    for (let index = windows.length - 1; index >= 0; index -= 1) {
      const window = windows[index];
      if (fixedEnd <= window.start || fixedStart >= window.end) continue;
      const next = [];
      if (fixedStart > window.start) next.push({ start: window.start, end: fixedStart });
      if (fixedEnd < window.end) next.push({ start: fixedEnd, end: window.end });
      windows.splice(index, 1, ...next);
    }
  });
  return windows
    .filter(window => minutesBetween(window.start, window.end) >= 15)
    .sort((a, b) => a.start - b.start)
    .map(window => ({ start: window.start.toISOString(), end: window.end.toISOString() }));
}

export var buildDetailedTaskQueue: any = function buildDetailedTaskQueue(tasks, dates) {
  const rangeHasMultipleDays = dates.length > 1;
  return tasks.map(task => {
    const phases = phasesForTask(task.taskType);
    const config = detailedModeConfig();
    return {
      ...task,
      phases,
      phaseIndex: 0,
      remainingChunks: phases.length,
      scheduledDates: new Set(),
      rangeHasMultipleDays,
      defaultDuration: config.studyDuration
    };
  }).sort(compareDetailedTaskPriority);
}

export var detailedModeConfig: any = function detailedModeConfig() {
  const intensity = detailedState.preferences?.intensity || 'Balanced';
  if (intensity === 'Intense') return { mode: 'Intense', studyDuration: 90, breakDuration: 15, minimumStudyBlock: 25, strategy: 'depth' };
  if (intensity === 'Light') return { mode: 'Light', studyDuration: 30, breakDuration: 8, minimumStudyBlock: 15, strategy: 'spaced' };
  return { mode: 'Balanced', studyDuration: 50, breakDuration: 15, minimumStudyBlock: 20, strategy: 'rotate' };
}

export var fillDetailedLogicalDay: any = function fillDetailedLogicalDay(day, queue) {
  const config = detailedModeConfig();
  const scheduledToday = new Set();
  day.freeTimeBlocks.forEach(freeBlock => {
    let cursor = new Date(freeBlock.start);
    const freeEnd = new Date(freeBlock.end);
    while (minutesBetween(cursor, freeEnd) >= config.minimumStudyBlock) {
      const task = selectDetailedTaskForDate(queue, day.date, config, scheduledToday);
      if (!task) break;
      const remaining = minutesBetween(cursor, freeEnd);
      const duration = Math.min(config.studyDuration, remaining);
      if (duration < config.minimumStudyBlock) break;
      const phase = task.phases[task.phaseIndex % task.phases.length] || { name: 'Focus Work', energy: 'Medium' };
      const end = addMinutes(cursor, duration);
      const study = makeDetailedBlock({
        logicalDate: day.date,
        start: cursor,
        end,
        type: 'study',
        taskId: task.id,
        task: task.taskName,
        phase: phase.name,
        priority: task.priorityLevel,
        locked: false,
        blockNote: ''
      });
      study.energy = phase.energy;
      study.dueDate = task.dueDate;
      study.lastPrepDate = task.lastPrepDate;
      study.urgent = !!task.urgent;
      study.priorityScore = task.priorityScore;
      day.generatedBlocks.push(study);
      day.blocks.push(study);
      cursor = end;
      task.phaseIndex += 1;
      task.remainingChunks = Math.max(0, task.remainingChunks - 1);
      scheduledToday.add(task.id);
      const futureTask = selectDetailedTaskForDate(queue, day.date, config, scheduledToday, true);
      if (shouldPlaceDetailedBreak(day, cursor, freeEnd, futureTask, config)) {
        const breakEnd = addMinutes(cursor, config.breakDuration);
        const rest = makeDetailedBlock({
          logicalDate: day.date,
          start: cursor,
          end: breakEnd,
          type: 'break',
          task: 'Break',
          phase: 'Break',
          priority: 'Break',
          locked: false,
          blockNote: ''
        });
        day.generatedBlocks.push(rest);
        day.blocks.push(rest);
        cursor = breakEnd;
      }
    }
  });
}

export var selectDetailedTaskForDate: any = function selectDetailedTaskForDate(queue, date, config, scheduledToday, preview = false) {
  const eligible = queue
    .filter(task => task.remainingChunks > 0 && canScheduleTaskOnDate(task, date))
    .sort(compareDetailedTaskPriority);
  if (!eligible.length) return null;
  if (config.strategy === 'depth') return eligible[0];
  if (config.strategy === 'spaced' && eligible.length > 1 && queue.some(task => task.rangeHasMultipleDays)) {
    const fresh = eligible.filter(task => !scheduledToday.has(task.id));
    return (fresh.length ? fresh : eligible).sort((a, b) => a.priorityScore - b.priorityScore || compareDateStrings(a.lastPrepDate, b.lastPrepDate))[0];
  }
  const top = eligible.slice(0, 3);
  if (preview) return top[0];
  const freshTop = top.filter(task => !scheduledToday.has(task.id));
  return freshTop[0] || top[0];
}

export var shouldPlaceDetailedBreak: any = function shouldPlaceDetailedBreak(day, cursor, freeEnd, futureTask, config) {
  const last = day.blocks.at(-1);
  if (!last || last.type !== 'study' || !futureTask) return false;
  const afterBreak = addMinutes(cursor, config.breakDuration);
  return minutesBetween(afterBreak, freeEnd) >= config.minimumStudyBlock;
}

export var compareDetailedTaskPriority: any = function compareDetailedTaskPriority(a, b) {
  const due = compareDateStrings(a.lastPrepDate || a.dueDate, b.lastPrepDate || b.dueDate);
  return due || b.priorityScore - a.priorityScore || b.difficulty - a.difficulty;
}

export var canScheduleTaskOnDate: any = function canScheduleTaskOnDate(task, date) {
  if (!task?.dueDate) return true;
  if (date <= (task.lastPrepDate || taskLastPrepDate(task.dueDate, detailedState.setup.startDate))) return true;
  return task.urgent && date === task.dueDate;
}

export var makeDetailedBlock: any = function makeDetailedBlock({ logicalDate, start, end, type, taskId = '', task, phase, priority, locked, blockNote = '' }) {
  const actualStartISO = start.toISOString();
  const actualEndISO = end.toISOString();
  const startMinutes = minutesFromLogicalStart(logicalDate, start);
  const endMinutes = minutesFromLogicalStart(logicalDate, end);
  const label = type === 'study' ? `${task} - ${phase}` : task;
  return {
    id: uniqueId(),
    date: logicalDate,
    logicalDate,
    actualStartISO,
    actualEndISO,
    displayDate: formatLocalDate(start),
    type,
    taskId,
    task,
    label,
    phase,
    priority,
    priorityLevel: priority,
    startMinute: startMinutes,
    endMinute: endMinutes,
    startTime: minutesToTime(timeToMinutesFromDate(start)),
    endTime: minutesToTime(timeToMinutesFromDate(end)),
    completed: false,
    locked,
    blockNote,
    note: blockNote
  };
}

export var minutesFromLogicalStart: any = function minutesFromLogicalStart(logicalDate, date) {
  const start = combineLocalDateTime(logicalDate, detailedState.setup.startTime || '09:00');
  return Math.round((date - start) / 60000) + timeToMinutes(detailedState.setup.startTime || '09:00');
}

export var timeToMinutesFromDate: any = function timeToMinutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export var addMinutes: any = function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export var minutesBetween: any = function minutesBetween(start, end) {
  return Math.round((end - start) / 60000);
}

export var freeWindowsForDay: any = function freeWindowsForDay(day) {
  if (day.freeTimeBlocks?.length) {
    return day.freeTimeBlocks.map(window => ({
      start: minutesFromLogicalStart(day.date, new Date(window.start)),
      end: minutesFromLogicalStart(day.date, new Date(window.end))
    }));
  }
  const dayStart = timeToMinutes(detailedState.setup.startTime);
  let dayEnd = timeToMinutes(detailedState.setup.endTime);
  if (dayEnd <= dayStart) dayEnd += 1440;
  return [{ start: dayStart, end: dayEnd }];
}

export var insertFixedBlocksForDay: any = function insertFixedBlocksForDay(day) {
  day.fixedBlocks = fixedBlocksForLogicalDay(buildLogicalDay(day.date));
  day.blocks.push(...day.fixedBlocks);
}

export var cleanDetailedDayBlocks: any = function cleanDetailedDayBlocks(day) {
  day.blocks = (day.blocks || []).filter(block => block && blockInsideLogicalDay(day, block)).sort(compareDetailedBlocksByStart);
  day.blocks = day.blocks.filter(block => {
    if (block.type !== 'study') return true;
    return canScheduleTaskOnDate(block, day.date);
  });
  day.blocks = removeInvalidDetailedOverlaps(day.blocks);
  while (day.blocks[0] && ['break', 'buffer', 'rest'].includes(day.blocks[0].type)) day.blocks.shift();
  while (day.blocks.at(-1) && ['break', 'buffer', 'rest'].includes(day.blocks.at(-1).type)) day.blocks.pop();
  day.blocks = day.blocks.filter((block, index, blocks) => {
    if (!['break', 'buffer', 'rest'].includes(block.type)) return true;
    return blocks[index - 1]?.type === 'study' && blocks[index + 1]?.type === 'study';
  });
  day.blocks.forEach(block => {
    block.logicalDate = block.logicalDate || day.date;
    block.date = day.date;
    block.displayDate = block.displayDate || block.logicalDate;
    block.blockNote = block.blockNote || block.note || '';
    block.locked = block.type === 'fixed' ? true : !!block.locked;
  });
  day.generatedBlocks = day.blocks.filter(block => block.type !== 'fixed');
}

export var compareDetailedBlocksByStart: any = function compareDetailedBlocksByStart(a, b) {
  if (a.actualStartISO && b.actualStartISO) return new Date(a.actualStartISO) - new Date(b.actualStartISO);
  return (Number.isFinite(a.startMinute) ? a.startMinute : timeToMinutes(a.startTime)) - (Number.isFinite(b.startMinute) ? b.startMinute : timeToMinutes(b.startTime));
}

export var removeInvalidDetailedOverlaps: any = function removeInvalidDetailedOverlaps(blocks) {
  const accepted = [];
  blocks.forEach(block => {
    const overlaps = accepted.some(existing => rangesOverlap(existing, block));
    if (!overlaps) {
      accepted.push(block);
      return;
    }
    if (block.type === 'fixed') {
      for (let index = accepted.length - 1; index >= 0; index -= 1) {
        if (accepted[index].type !== 'fixed' && rangesOverlap(accepted[index], block)) accepted.splice(index, 1);
      }
      accepted.push(block);
    }
  });
  return accepted.sort(compareDetailedBlocksByStart);
}

export var validateGeneratedDetailedPlan: any = function validateGeneratedDetailedPlan() {
  if (!detailedState.generatedPlan?.days?.length) return;
  const expectedDates = buildDateRange(detailedState.generatedPlan.setup?.startDate || detailedState.setup.startDate, detailedState.generatedPlan.setup?.endDate || detailedState.setup.endDate);
  detailedState.generatedPlan.days = expectedDates.map(date => {
    const existing = detailedState.generatedPlan.days.find(day => day.date === date) || { date, label: dayLabel(date), blocks: [] };
    existing.label = existing.label || dayLabel(date);
    existing.blocks = (existing.blocks || []).map(block => normalizeDetailedBlockForValidation(block, date));
    cleanDetailedDayBlocks(existing);
    return existing;
  });
}

export var normalizeDetailedBlockForValidation: any = function normalizeDetailedBlockForValidation(block, logicalDate) {
  const start = block.actualStartISO ? new Date(block.actualStartISO) : blockDateFromTime(logicalDate, block.startTime, false);
  const end = block.actualEndISO ? new Date(block.actualEndISO) : blockDateFromTime(logicalDate, block.endTime, timeToMinutes(block.endTime) <= timeToMinutes(block.startTime));
  if (end <= start) end.setDate(end.getDate() + 1);
  return {
    ...block,
    date: logicalDate,
    logicalDate,
    actualStartISO: start.toISOString(),
    actualEndISO: end.toISOString(),
    displayDate: block.displayDate || formatLocalDate(start),
    startMinute: minutesFromLogicalStart(logicalDate, start),
    endMinute: minutesFromLogicalStart(logicalDate, end),
    blockNote: block.blockNote || block.note || '',
    priority: block.priority || block.priorityLevel || (block.type === 'break' ? 'Break' : 'Low'),
    priorityLevel: block.priorityLevel || block.priority || (block.type === 'break' ? 'Break' : 'Low'),
    locked: block.type === 'fixed' ? true : !!block.locked
  };
}

export var blockDateFromTime: any = function blockDateFromTime(logicalDate, time, forceNextDay) {
  const date = combineLocalDateTime(logicalDate, time || '00:00');
  const dayStart = timeToMinutes(detailedState.setup?.startTime || '09:00');
  const dayEnd = timeToMinutes(detailedState.setup?.endTime || '21:00');
  if (forceNextDay || (dayEnd <= dayStart && timeToMinutes(time || '00:00') < dayStart)) date.setDate(date.getDate() + 1);
  return date;
}

export var blockInsideLogicalDay: any = function blockInsideLogicalDay(day, block) {
  const canvas = buildLogicalDay(day.date);
  const start = new Date(block.actualStartISO || blockDateFromTime(day.date, block.startTime, false));
  const end = new Date(block.actualEndISO || blockDateFromTime(day.date, block.endTime, timeToMinutes(block.endTime) <= timeToMinutes(block.startTime)));
  return start >= new Date(canvas.dayStartTimestamp) && end <= new Date(canvas.dayEndTimestamp) && end > start;
}

export var buildFallbackDetailedPlan: any = function buildFallbackDetailedPlan(days, tasks, clearExisting = false) {
  const matrix = timeMatrix(detailedState.preferences.intensity);
  const sortedTasks = [...tasks].sort(compareDetailedTaskPriority);
  days.forEach(day => {
    if (clearExisting) day.blocks = day.blocks.filter(block => block.type === 'fixed');
    let taskIndex = 0;
    let phaseIndex = 0;
    freeWindowsForDay(day).forEach(window => {
      let cursor = window.start;
      while (cursor < window.end && sortedTasks.length) {
        const eligible = sortedTasks.filter(task => canScheduleTaskOnDate(task, day.date));
        if (!eligible.length) break;
        const task = eligible[taskIndex % eligible.length];
        const phases = fallbackPhasesForTask(task.taskType);
        const phase = phases[phaseIndex % phases.length];
        const duration = Math.min(matrix[phase.energy] || matrix.Medium, window.end - cursor);
        if (duration < 15) break;
        const candidate = {
          id: uniqueId(),
          date: day.date,
          taskId: task.id,
          taskName: task.taskName,
          task: task.taskName,
          label: `${task.taskName} - ${phase.name}`,
          phase: phase.name,
          type: 'study',
          energy: phase.energy,
          priority: task.priorityLevel,
          priorityLevel: task.priorityLevel,
          startMinute: cursor,
          endMinute: cursor + duration,
          startTime: minutesToTime(cursor),
          endTime: minutesToTime(cursor + duration),
          duration,
          locked: false,
          completed: false
        };
        if (hasOverlap(day.blocks, candidate)) {
          cursor += 15;
          continue;
        }
        day.blocks.push(candidate);
        cursor += duration;
        const moreWorkFits = cursor + matrix.Break + 15 <= window.end;
        const nextStudyExists = sortedTasks.some(item => canScheduleTaskOnDate(item, day.date));
        if (moreWorkFits && nextStudyExists && shouldAddBreak(phase.energy)) {
          day.blocks.push(makeRestBlock(day.date, cursor, cursor + matrix.Break, 'break'));
          cursor += matrix.Break;
        }
        phaseIndex += 1;
        if (phaseIndex % phases.length === 0) taskIndex += 1;
      }
    });
  });
}

export var fallbackPhasesForTask: any = function fallbackPhasesForTask(type) {
  if (['Study', 'Exam Prep'].includes(type)) return [
    { name: 'Concept Learning', energy: 'Medium' },
    { name: 'Deep Study', energy: 'Heavy' },
    { name: 'Active Recall', energy: 'Medium' },
    { name: 'Practice Problems', energy: 'Heavy' },
    { name: 'Revision', energy: 'Light' }
  ];
  if (['Assignment', 'Project'].includes(type)) return [
    { name: 'Understand Assignment', energy: 'Light' },
    { name: 'Research', energy: 'Medium' },
    { name: 'Plan Structure', energy: 'Medium' },
    { name: 'Write Draft', energy: 'Heavy' },
    { name: 'Final Review', energy: 'Light' }
  ];
  return [
    { name: 'Focus Work', energy: 'Medium' },
    { name: 'Practice', energy: 'Heavy' },
    { name: 'Review', energy: 'Light' }
  ];
}

export var buildDateRange: any = function buildDateRange(startDate, endDate) {
  const dates = [];
  const cursor = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length ? dates : [localToday()];
}

export var parseLocalDate: any = function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || localToday()).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export var formatLocalDate: any = function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export var addLocalDays: any = function addLocalDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export var inclusiveDateDiff: any = function inclusiveDateDiff(startDate, endDate) {
  return Math.round((parseLocalDate(endDate) - parseLocalDate(startDate)) / 86400000);
}

export var compareDateStrings: any = function compareDateStrings(a, b) {
  return parseLocalDate(a) - parseLocalDate(b);
}

export var taskLastPrepDate: any = function taskLastPrepDate(dueDate, startDate) {
  if (!dueDate) return startDate || localToday();
  const previous = addLocalDays(dueDate, -1);
  if (compareDateStrings(startDate || localToday(), dueDate) >= 0) return dueDate;
  return previous;
}

export var dayLabel: any = function dayLabel(date) {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export var dayKey: any = function dayKey(date) {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3);
}

export var insertFixedBlocks: any = function insertFixedBlocks(days) {
  days.forEach(day => {
    const key = dayKey(day.date);
    detailedState.fixedBlocks.forEach(block => {
      if (!block.days.includes(key)) return;
      day.blocks.push({
        ...block,
        id: `${block.id}-${day.date}`,
        date: day.date,
        label: block.title,
        task: block.title,
        phase: block.category,
        type: 'fixed',
        priorityLevel: 'Fixed',
        priority: 'Fixed',
        energy: 'Fixed',
        completed: false,
        locked: true
      });
    });
  });
}

export var buildDetailedWorkload: any = function buildDetailedWorkload() {
  const ordered = [...detailedState.tasks].sort((a, b) => b.priorityScore - a.priorityScore);
  const matrix = timeMatrix(detailedState.preferences.intensity);
  return ordered.flatMap(task => {
    const phases = phasesForTask(task.taskType);
    return phases.map((phase, index) => ({
      id: uniqueId(),
      taskId: task.id,
      taskName: task.taskName,
      task: task.taskName,
      label: `${task.taskName} - ${phase.name}`,
      phase: phase.name,
      type: 'study',
      energy: phase.energy,
      priority: task.priorityLevel,
      priorityLevel: task.priorityLevel,
      duration: matrix[phase.energy],
      order: index
    }));
  }).sort((a, b) => energyRank(a.energy) - energyRank(b.energy));
}

export var phasesForTask: any = function phasesForTask(type) {
  if (['Assignment', 'Project'].includes(type)) return [
    { name: 'Understand Assignment', energy: 'Light' },
    { name: 'Research', energy: 'Medium' },
    { name: 'Plan Structure', energy: 'Medium' },
    { name: 'Write Draft', energy: 'Heavy' },
    { name: 'Edit & Improve', energy: 'Medium' },
    { name: 'Final Review', energy: 'Light' }
  ];
  if (type === 'Revision') return [
    { name: 'Quick Review', energy: 'Light' },
    { name: 'Active Recall', energy: 'Medium' },
    { name: 'Practice Questions', energy: 'Heavy' },
    { name: 'Final Recap', energy: 'Light' }
  ];
  return [
    { name: 'Concept Learning', energy: 'Medium' },
    { name: 'Deep Study', energy: 'Heavy' },
    { name: 'Active Recall', energy: 'Medium' },
    { name: 'Practice Problems', energy: 'Heavy' },
    { name: 'Weak Area Review', energy: 'Light' },
    { name: 'Revision', energy: 'Light' }
  ];
}

export var timeMatrix: any = function timeMatrix(intensity) {
  if (intensity === 'Light') return { Heavy: 45, Medium: 30, Light: 20, Break: 15, Buffer: 20, max: 45 };
  if (intensity === 'Intense') return { Heavy: 90, Medium: 60, Light: 40, Break: 8, Buffer: 15, max: 90 };
  return { Heavy: 60, Medium: 45, Light: 25, Break: 10, Buffer: 15, max: 60 };
}

export var energyRank: any = function energyRank(energy) {
  const pref = detailedState.preferences?.intensity;
  if (pref === 'Intense') return { Heavy: 0, Medium: 1, Light: 2 }[energy] ?? 3;
  if (pref === 'Light') return { Light: 0, Medium: 1, Heavy: 2 }[energy] ?? 3;
  return { Heavy: 0, Medium: 1, Light: 2 }[energy] ?? 3;
}

export var placeWorkload: any = function placeWorkload(days, workload) {
  const matrix = timeMatrix(detailedState.preferences.intensity);
  let dayIndex = 0;
  workload.forEach(item => {
    const parts = splitDetailedDuration(item.duration, matrix.max);
    parts.forEach((duration, partIndex) => {
      const block = {
        ...item,
        id: uniqueId(),
        label: parts.length > 1 ? `${item.label} (Part ${partIndex + 1})` : item.label,
        duration,
        type: 'study',
        locked: false,
        completed: false
      };
      let placed = false;
      for (let tries = 0; tries < days.length && !placed; tries += 1) {
        const day = days[(dayIndex + tries) % days.length];
        placed = placeBlockInDay(day, block);
        if (placed) {
          addBreakAndBuffer(day, block);
          dayIndex = (dayIndex + tries + 1) % days.length;
        }
      }
    });
  });
}

export var splitDetailedDuration: any = function splitDetailedDuration(duration, max) {
  if (duration <= max) return [duration];
  const count = Math.ceil(duration / max);
  const each = Math.floor(duration / count);
  return Array.from({ length: count }, (_, index) => each + (index < duration - each * count ? 1 : 0));
}

export var placeBlockInDay: any = function placeBlockInDay(day, block) {
  const startDay = timeToMinutes(detailedState.setup.startTime);
  const endDay = timeToMinutes(detailedState.setup.endTime);
  const peak = peakWindow();
  const ideal = block.energy === 'Heavy' ? peak[0] : block.energy === 'Medium' ? Math.max(startDay, peak[1]) : Math.max(startDay, endDay - 180);
  for (let cursor = Math.max(startDay, ideal); cursor + block.duration <= endDay; cursor += 15) {
    const candidate = { ...block, date: day.date, startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + block.duration) };
    if (!hasOverlap(day.blocks, candidate)) {
      day.blocks.push(candidate);
      return true;
    }
  }
  for (let cursor = startDay; cursor + block.duration <= endDay; cursor += 15) {
    const candidate = { ...block, date: day.date, startTime: minutesToTime(cursor), endTime: minutesToTime(cursor + block.duration) };
    if (!hasOverlap(day.blocks, candidate)) {
      day.blocks.push(candidate);
      return true;
    }
  }
  return false;
}

export var peakWindow: any = function peakWindow() {
  if (detailedState.preferences.bestFocus === 'Afternoon') return [12 * 60, 18 * 60];
  if (detailedState.preferences.bestFocus === 'Night') return [18 * 60, 24 * 60];
  return [6 * 60, 12 * 60];
}

export var hasOverlap: any = function hasOverlap(blocks, candidate) {
  return blocks.some(block => rangesOverlap(block, candidate));
}

export var addBreakAndBuffer: any = function addBreakAndBuffer(day, afterBlock) {
  const matrix = timeMatrix(detailedState.preferences.intensity);
  if (shouldAddBreak(afterBlock.energy)) {
    appendAdjacent(day, afterBlock, { label: 'Break', task: 'Break', phase: 'Break', type: 'break', energy: 'Break', priority: 'Break', priorityLevel: 'Break', duration: matrix.Break });
  }
  const wantsBuffer = detailedState.preferences.intensity === 'Light' || detailedState.preferences.intensity === 'Balanced' || detailedState.preferences.includeBuffer;
  if (wantsBuffer && afterBlock.energy === 'Heavy') {
    appendAdjacent(day, day.blocks.at(-1), { label: 'Buffer / Catch Up', task: 'Buffer / Catch Up', phase: 'Buffer', type: 'buffer', energy: 'Buffer', priority: 'Buffer', priorityLevel: 'Buffer', duration: matrix.Buffer });
  }
}

export var shouldAddBreak: any = function shouldAddBreak(energy) {
  const pref = detailedState.preferences.breakPreference;
  if (pref === 'Frequent') return ['Heavy', 'Medium', 'Light'].includes(energy);
  if (pref === 'Minimal') return energy === 'Heavy';
  return ['Heavy', 'Medium'].includes(energy);
}

export var appendAdjacent: any = function appendAdjacent(day, afterBlock, block) {
  if (!afterBlock) return;
  const start = timeToMinutes(afterBlock.endTime);
  const end = start + block.duration;
  if (end > timeToMinutes(detailedState.setup.endTime)) return;
  const candidate = { ...block, id: uniqueId(), date: day.date, startTime: minutesToTime(start), endTime: minutesToTime(end), locked: false, completed: false };
  if (!hasOverlap(day.blocks, candidate)) day.blocks.push(candidate);
}

/* Detailed Planner v2: deterministic, science-aligned scheduling engine. */
export const detailKeywords: any = {
  math: ['math', 'maths', 'mathematics', 'algebra', 'geometry', 'trigonometry', 'calculus', 'differentiation', 'integration', 'matrices', 'determinants', 'statistics', 'probability', 'discrete math', 'graph theory', 'linear algebra', 'numerical methods', 'equations', 'limits', 'derivatives', 'integrals', 'vectors', 'coordinate geometry', 'mensuration', 'arithmetic', 'quantitative aptitude', 'aptitude', 'reasoning', 'formulas', 'theorem', 'proof'],
  physics: ['physics', 'mechanics', 'optics', 'waves', 'sound', 'electricity', 'magnetism', 'circuits', 'current', 'voltage', 'resistance', 'thermodynamics', 'heat', 'motion', 'force', 'work', 'energy', 'power', 'gravitation', 'modern physics', 'atoms', 'nuclei', 'ray optics', 'derivation', 'numerical', 'diagram', 'experiment', 'lab physics'],
  chemistry: ['chemistry', 'organic', 'inorganic', 'physical chemistry', 'reaction', 'reactions', 'equation', 'equations', 'balancing', 'mole concept', 'periodic table', 'bonding', 'thermochemistry', 'electrochemistry', 'kinetics', 'equilibrium', 'acid', 'base', 'salt', 'mechanism', 'named reactions', 'chemical formula', 'lab chemistry', 'titration'],
  biology: ['biology', 'botany', 'zoology', 'anatomy', 'physiology', 'genetics', 'ecology', 'evolution', 'cell biology', 'reproduction', 'human body', 'plant', 'animal', 'diagram', 'diagrams', 'labelling', 'specimen', 'classification', 'microbiology', 'biotechnology', 'life processes', 'diagram labels'],
  coding: ['computer', 'cs', 'coding', 'programming', 'program', 'code', 'java', 'python', 'c programming', 'cpp', 'c++', 'javascript', 'html', 'css', 'web', 'php', 'sql', 'mysql', 'dbms', 'plsql', 'data structure', 'dsa', 'algorithm', 'array', 'stack', 'queue', 'linked list', 'tree', 'graph', 'oop', 'object oriented', 'class', 'object', 'inheritance', 'polymorphism', 'servlet', 'jsp', 'jdbc', 'netbeans', 'xampp', 'tomcat', 'debugging', 'debug', 'compile', 'syntax', 'output', 'dry run', 'lab exam', 'practical', 'query', 'database', 'normalization', 'er diagram'],
  english: ['english', 'grammar', 'tenses', 'essay', 'letter', 'email', 'report writing', 'precis', 'comprehension', 'literature', 'poem', 'poetry', 'prose', 'drama', 'novel', 'story', 'character sketch', 'summary', 'annotation', 'speech', 'article writing', 'paragraph writing', 'writing skills', 'reading', 'vocabulary', 'idioms'],
  language: ['malayalam', 'hindi', 'kannada', 'sanskrit', 'language'],
  social: ['history', 'civics', 'constitution', 'geography', 'economics', 'political science', 'sociology', 'psychology', 'philosophy', 'social science', 'law', 'rights', 'duties', 'amendment', 'article', 'map', 'timeline', 'dates', 'case study', 'long answer', 'short answer'],
  commerce: ['commerce', 'accountancy', 'accounting', 'business', 'management', 'finance', 'marketing', 'economics', 'balance sheet', 'ledger', 'journal', 'trial balance', 'final accounts', 'ratio analysis', 'financial statement', 'cost accounting', 'business studies', 'entrepreneurship', 'audit', 'taxation', 'income tax', 'gst'],
  ai: ['ai', 'artificial intelligence', 'ml', 'machine learning', 'deep learning', 'data science', 'neural network', 'dataset', 'model', 'training', 'classification', 'regression', 'clustering', 'pandas', 'numpy', 'visualization', 'statistics', 'probability', 'algorithm'],
  engineering: ['engineering', 'digital logic', 'logic design', 'boolean algebra', 'kmap', 'k-map', 'gates', 'flip flop', 'counter', 'multiplexer', 'decoder', 'encoder', 'circuit', 'electronics', 'microprocessor', 'computer organization', 'coa', 'operating system', 'os', 'networking', 'cn'],
  exam: ['exam', 'test', 'quiz', 'unit test', 'midterm', 'final', 'board', 'practical exam', 'lab exam', 'viva', 'oral', 'assessment', 'mock test', 'previous paper', 'question bank', 'sample paper', 'past paper'],
  revision: ['revise', 'revision', 'review', 'recall', 'memorize', 'memorise', 'remember', 'learn by heart', 'mug up', 'blurting', 'formula review', 'recap', 'quick revision'],
  assignment: ['assignment', 'homework', 'writeup', 'write up', 'record', 'lab record', 'report', 'essay', 'submit', 'submission', 'project report', 'documentation', 'file work', 'worksheet', 'workbook', 'notes submission', 'internal assessment', 'file', 'article', 'paragraph', 'answers', 'bibliography', 'citation', 'case study', 'observation', 'journal'],
  project: ['project', 'mini project', 'final project', 'major project', 'capstone', 'build', 'prototype', 'app', 'website', 'webpage', 'design', 'implementation', 'documentation', 'presentation', 'demo', 'testing', 'deploy', 'deployment', 'module', 'feature', 'ui', 'frontend', 'backend', 'ux', 'model', 'system', 'dashboard', 'portfolio', 'chatbot', 'tool', 'software', 'implement', 'develop'],
  problem: ['solve', 'problems', 'sums', 'numericals', 'equations', 'proof', 'calculate', 'practice set', 'exercises', 'examples', 'word problems', 'mcq'],
  reading: ['read', 'reading', 'chapter', 'textbook', 'notes', 'pdf', 'slides', 'lecture', 'video', 'watch', 'article', 'paper', 'material'],
  memorisation: ['definition', 'definitions', 'dates', 'formulas', 'formulae', 'laws', 'theorems', 'steps', 'points', 'headings', 'keywords', 'diagram labels'],
  creative: ['poster', 'design', 'canva', 'figma', 'wireframe', 'layout', 'animation', 'video', 'reel', 'thumbnail', 'storyboard', 'script', 'drawing', 'diagram', 'infographic', 'logo', 'branding'],
  presentation: ['ppt', 'pptx', 'powerpoint', 'slides', 'presentation', 'speech', 'seminar', 'demo', 'oral', 'talk', 'anchoring', 'script', 'speaker notes', 'rehearse', 'practice speaking', 'viva'],
  lab: ['lab', 'practical', 'experiment', 'record', 'observation', 'viva', 'output', 'procedure', 'aim', 'result', 'conclusion', 'diagram', 'table', 'apparatus', 'circuit', 'specimen'],
  career: ['resume', 'cv', 'linkedin', 'portfolio', 'internship', 'job', 'interview', 'aptitude', 'leetcode', 'placement', 'hr round', 'technical round'],
  admin: ['submit', 'upload', 'print', 'scan', 'email', 'form', 'application', 'registration', 'fee', 'certificate', 'document', 'attendance', 'timetable', 'schedule', 'deadline'],
  chore: ['clean', 'room', 'laundry', 'pack', 'packing', 'organize', 'organise', 'water plants', 'cook', 'meal prep', 'shopping', 'buy', 'call', 'message', 'appointment'],
  wellbeing: ['gym', 'workout', 'walk', 'yoga', 'meditation', 'sleep', 'rest', 'drink water', 'medicine', 'therapy', 'doctor'],
  vague: ['study', 'work', 'finish', 'complete', 'do', 'start', 'continue', 'pending', 'important', 'urgent']
};

escapeHTML = function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export var clampNumber: any = function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

export var normalizeText: any = function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[._/-]+/g, ' ')
    .replace(/\bmaths\b/g, 'math')
    .replace(/\bexam prep\b/g, 'exam')
    .replace(/\brevise\b/g, 'revision')
    .replace(/\bassign\b/g, 'assignment')
    .replace(/\bproj\b/g, 'project')
    .replace(/\bprac\b/g, 'practical')
    .replace(/\bprogramming\b/g, 'coding')
    .replace(/\bprogram\b/g, 'code')
    .replace(/\bppt\b/g, 'presentation')
    .replace(/\brecord\b/g, 'lab record')
    .replace(/\s+/g, ' ')
    .trim();
}

export var tokenizeTaskName: any = function tokenizeTaskName(value) {
  return normalizeText(value).split(' ').filter(Boolean);
}

export function detectTaskKeywords(text, groups = Object.keys(detailKeywords)) {
  const normalized = ` ${normalizeText(text)} `;
  return groups.reduce((acc, group) => {
    const matches = (detailKeywords[group] || []).filter(keyword => normalized.includes(` ${normalizeText(keyword)} `));
    if (matches.length) acc[group] = matches;
    return acc;
  }, {});
}

export var keywordGroup: any = function keywordGroup(text, groups) {
  const matches = detectTaskKeywords(text, groups);
  return Object.entries(matches).sort((a, b) => b[1].join(' ').length - a[1].join(' ').length)[0]?.[0] || '';
}

export var detectTaskIntent: any = function detectTaskIntent(taskName, selectedType = 'Study') {
  const group = keywordGroup(taskName, ['exam', 'revision', 'assignment', 'project', 'career', 'admin', 'chore']);
  return group || normalizeText(selectedType).replace(' ', '-');
}

export var detectTaskSubtype: any = function detectTaskSubtype(taskName, selectedType = 'Study') {
  return keywordGroup(taskName, ['coding', 'lab', 'presentation', 'problem', 'reading', 'memorisation', 'creative', 'career', 'admin', 'chore']) || (normalizeText(selectedType) === 'other' ? 'neutral' : 'general');
}

export var detectSubjectArea: any = function detectSubjectArea(taskName) {
  return keywordGroup(taskName, ['math', 'physics', 'chemistry', 'biology', 'coding', 'english', 'language', 'social', 'commerce', 'ai', 'engineering']) || 'general';
}

export var detectDeliverableType: any = function detectDeliverableType(taskName, selectedType = 'Study') {
  const text = normalizeText(taskName);
  if (text.includes('lab record')) return 'lab record';
  if (keywordGroup(text, ['presentation'])) return 'presentation/slides';
  if (text.includes('essay') || text.includes('report') || text.includes('writeup') || text.includes('write up')) return 'essay/report/writeup';
  if (text.includes('worksheet') || text.includes('question bank') || text.includes('answers')) return 'answers/question bank';
  if ((text.includes('website') || text.includes('webpage') || text.includes('app')) && selectedType !== 'Study') return 'website/app';
  if (keywordGroup(text, ['coding']) && ['Assignment', 'Project'].includes(selectedType)) return 'coding program';
  if (keywordGroup(text, ['creative'])) return 'poster/design';
  if (keywordGroup(text, ['reading'])) return 'reading chapter';
  if (keywordGroup(text, ['memorisation'])) return 'memorisation';
  if (keywordGroup(text, ['career'])) return 'interview';
  if (keywordGroup(text, ['admin'])) return 'admin/submission';
  if (keywordGroup(text, ['chore', 'wellbeing'])) return 'chore';
  return normalizeText(selectedType) === 'other' ? 'neutral task' : 'study work';
}

export var detectActionVerb: any = function detectActionVerb(taskName) {
  return keywordGroup(taskName, ['problem', 'reading', 'revision', 'admin', 'chore', 'project']) || 'work';
}

export var detectUrgencyWords: any = function detectUrgencyWords(taskName) {
  return detectTaskKeywords(taskName, ['vague']).vague?.filter(word => ['urgent', 'important', 'pending'].includes(word)) || [];
}

export var getTaskScienceProfile: any = function getTaskScienceProfile(task) {
  const combined = task.taskName || '';
  const selectedType = task.taskType || task.selectedType || 'Study';
  const inferredSubtype = detectTaskSubtype(combined, selectedType);
  const subjectArea = detectSubjectArea(combined);
  const deliverableType = detectDeliverableType(combined, selectedType);
  const groups = Object.keys(detectTaskKeywords(combined));
  const methods = new Set(['Timeboxing', 'Task Breakdown']);
  if (['Study', 'Revision', 'Exam Prep'].includes(selectedType)) ['Spaced Practice', 'Active Recall', 'Practice Testing', 'Final Recall'].forEach(method => methods.add(method));
  if (['math', 'physics', 'chemistry', 'coding', 'engineering'].includes(subjectArea) || inferredSubtype === 'problem') methods.add('Worked Examples');
  if (selectedType === 'Project') methods.add('Project Milestones');
  if (['Exam Prep', 'Revision'].includes(selectedType) || task.difficulty >= 7) methods.add('Mistake Review');
  if (inferredSubtype === 'coding') methods.add('Self Explanation');
  if (task.difficulty >= 8 || detailedState.preferences?.sessionLength === '90 min') methods.add('Deep Focus');
  return {
    selectedType,
    inferredSubtype,
    subjectArea,
    deliverableType,
    actionIntent: detectActionVerb(combined),
    cognitiveMode: ['coding', 'problem'].includes(inferredSubtype) ? 'problem-solving' : inferredSubtype === 'memorisation' ? 'retrieval' : 'mixed',
    practicalMode: ['coding', 'lab', 'creative', 'presentation'].includes(inferredSubtype) ? inferredSubtype : 'none',
    phaseBiases: groups,
    labelStyle: normalizeText(selectedType) === 'other' ? 'neutral' : 'academic',
    confidence: groups.length >= 3 ? 'High' : groups.length >= 1 ? 'Medium' : 'Low',
    reasons: groups,
    methods: Array.from(methods)
  };
}

export var scientificPhase: any = function scientificPhase(name, energy, methods = []) {
  return { name, energy, methods };
}

export var buildScientificPhaseQueue: any = function buildScientificPhaseQueue(task) {
  const type = task.selectedType || task.taskType || 'Study';
  const subtype = task.inferredSubtype || 'general';
  const subject = task.subjectArea || 'general';
  const deliverable = task.deliverableType || '';
  const lowPrep = task.preparedness <= 30;
  const highPrep = task.preparedness >= 86 || (task.preparedness >= 71 && task.difficulty <= 4);
  if (task.emergency || task.overdue) {
    if (type === 'Other') return [scientificPhase('Start', 'Medium'), scientificPhase('Finish', 'Medium'), scientificPhase('Review', 'Light')];
    if (type === 'Assignment') return [scientificPhase('Understand Question', 'Light'), scientificPhase('Draft', 'Heavy'), scientificPhase('Final Check', 'Light'), scientificPhase('Submission Prep', 'Light')];
    if (type === 'Project') return [scientificPhase('Build', 'Heavy'), scientificPhase('Test', 'Medium'), scientificPhase('Final Review', 'Light')];
    return [scientificPhase(lowPrep ? 'Concept Learning' : 'High Yield Review', 'Medium', ['Active Recall']), scientificPhase('Practice Test', 'Heavy', ['Practice Testing']), scientificPhase('Final Recall', 'Light', ['Final Recall'])];
  }
  if (type === 'Other') return [scientificPhase('Start', 'Medium'), scientificPhase('Continue', 'Medium'), scientificPhase('Finish', 'Medium'), scientificPhase('Review', 'Light')];
  if (deliverable === 'lab record') return [scientificPhase('Aim & Procedure Review', 'Medium'), scientificPhase('Observation Table', 'Medium'), scientificPhase('Diagram/Table Practice', 'Medium'), scientificPhase('Result & Conclusion', 'Light'), scientificPhase('Viva Questions', 'Light'), scientificPhase('Final Check', 'Light')];
  if (deliverable === 'presentation/slides') return [scientificPhase('Content Planning', 'Medium'), scientificPhase('Slide Outline', 'Medium'), scientificPhase('Design Slides', 'Heavy'), scientificPhase('Speaker Notes', 'Medium'), scientificPhase('Rehearsal', 'Light'), scientificPhase('Final Check', 'Light')];
  if (subtype === 'lab') return [scientificPhase('Aim & Procedure Review', 'Medium'), scientificPhase('Experiment Steps', 'Medium'), scientificPhase('Observation Table', 'Medium'), scientificPhase('Diagram/Table Practice', 'Medium'), scientificPhase('Output Practice', 'Medium'), scientificPhase('Result & Conclusion', 'Light'), scientificPhase('Viva Questions', 'Light'), scientificPhase('Final Check', 'Light')];
  if (deliverable === 'essay/report/writeup') return [scientificPhase('Understand Question', 'Light'), scientificPhase('Research', 'Medium'), scientificPhase('Outline', 'Medium'), scientificPhase('Draft Writing', 'Heavy'), scientificPhase('Edit & Improve', 'Medium'), scientificPhase('Proofread', 'Light'), scientificPhase('Final Check', 'Light'), scientificPhase('Submission Prep', 'Light')];
  if (deliverable === 'coding program' && type === 'Assignment') return [scientificPhase('Requirement Check', 'Light'), scientificPhase('Logic Planning', 'Medium'), scientificPhase('Program Writing', 'Heavy'), scientificPhase('Dry Run Practice', 'Medium'), scientificPhase('Debugging Practice', 'Heavy'), scientificPhase('Output Tracing', 'Medium'), scientificPhase('Final Code Review', 'Light'), scientificPhase('Submission Prep', 'Light')];
  if (subtype === 'coding' && type === 'Exam Prep') return [scientificPhase('Question Pattern Review', 'Light'), scientificPhase('Logic Recall', 'Medium', ['Active Recall']), scientificPhase('Code Practice', 'Heavy', ['Practice Testing']), scientificPhase('Dry Run', 'Medium'), scientificPhase('Debug Mistakes', 'Medium', ['Mistake Review']), scientificPhase('Viva Recall', 'Light', ['Active Recall']), scientificPhase('Final Recall', 'Light', ['Final Recall'])];
  if (deliverable === 'website/app') return [scientificPhase('Requirement Planning', 'Medium'), scientificPhase('UI Layout', 'Medium'), scientificPhase('Build Components', 'Heavy'), scientificPhase('Add Interactions', 'Heavy'), scientificPhase('Debug', 'Heavy'), scientificPhase('Test', 'Medium'), scientificPhase('Polish UI', 'Medium'), scientificPhase('Documentation', 'Light'), scientificPhase('Final Review', 'Light')];
  if (type === 'Project') return [scientificPhase('Requirement Planning', 'Medium'), scientificPhase('Design', 'Medium'), scientificPhase('Build', 'Heavy'), scientificPhase('Debug', 'Heavy'), scientificPhase('Test', 'Medium'), scientificPhase('Documentation', 'Light'), scientificPhase('Final Review', 'Light')];
  if (type === 'Assignment' && (subject === 'math' || subtype === 'problem')) return [scientificPhase('Understand Questions', 'Light'), scientificPhase('Solve Easy Problems', 'Medium', ['Worked Examples']), scientificPhase('Solve Hard Problems', 'Heavy', ['Practice Testing']), scientificPhase('Check Mistakes', 'Medium', ['Mistake Review']), scientificPhase('Final Check', 'Light'), scientificPhase('Submission Prep', 'Light')];
  if (subtype === 'coding' || subject === 'coding') return [scientificPhase('Concept Understanding', 'Medium'), scientificPhase('Logic Planning', 'Medium'), scientificPhase('Syntax Practice', 'Medium'), scientificPhase('Program Writing', 'Heavy'), scientificPhase('Code Implementation', 'Heavy'), scientificPhase('Debugging Practice', 'Heavy'), scientificPhase('Output Tracing', 'Medium'), scientificPhase('Test Cases', 'Medium'), scientificPhase('Final Code Review', 'Light')];
  if (type === 'Assignment') return [scientificPhase('Understand Question', 'Light'), scientificPhase('Requirement Check', 'Light'), scientificPhase('Research', 'Medium'), scientificPhase('Outline', 'Medium'), scientificPhase('Draft Writing', 'Heavy'), scientificPhase('Edit & Improve', 'Medium'), scientificPhase('Proofread', 'Light'), scientificPhase('Submission Prep', 'Light')];
  if (type === 'Project') return [scientificPhase('Requirement Planning', 'Medium'), scientificPhase('Design', 'Medium'), scientificPhase('Build', 'Heavy'), scientificPhase('Debug', 'Heavy'), scientificPhase('Test', 'Medium'), scientificPhase('Documentation', 'Light'), scientificPhase('Final Review', 'Light')];
  if (subject === 'math') return lowPrep ? [scientificPhase('Concept Learning', 'Medium'), scientificPhase('Worked Examples', 'Medium', ['Worked Examples']), scientificPhase('Easy Problems', 'Medium'), scientificPhase('Active Recall', 'Light', ['Active Recall']), scientificPhase('Mixed Problems', 'Heavy', ['Interleaving']), scientificPhase('Mistake Review', 'Light', ['Mistake Review']), scientificPhase('Final Formula Recall', 'Light', ['Final Recall'])] : highPrep ? [scientificPhase('Timed Practice', 'Heavy', ['Practice Testing']), scientificPhase('Past Questions', 'Heavy'), scientificPhase('Mistake Review', 'Medium', ['Mistake Review']), scientificPhase('Final Formula Recall', 'Light', ['Final Recall'])] : [scientificPhase('Formula Review', 'Light'), scientificPhase('Concept Learning', 'Medium'), scientificPhase('Worked Examples', 'Medium', ['Worked Examples']), scientificPhase('Practice Problems', 'Heavy'), scientificPhase('Mixed Problems', 'Heavy', ['Interleaving']), scientificPhase('Mistake Review', 'Medium', ['Mistake Review']), scientificPhase('Timed Practice', 'Heavy', ['Practice Testing']), scientificPhase('Final Formula Recall', 'Light', ['Final Recall'])];
  if (subject === 'physics') return [scientificPhase('Formula Map', 'Light'), scientificPhase('Concept Learning', 'Medium'), scientificPhase('Derivation Practice', 'Medium'), scientificPhase('Worked Examples', 'Medium'), scientificPhase('Numerical Practice', 'Heavy'), scientificPhase('Problem Solving', 'Heavy'), scientificPhase('Mistake Review', 'Medium'), scientificPhase('Practice Test', 'Heavy', ['Practice Testing']), scientificPhase('Final Formula Recall', 'Light', ['Final Recall'])];
  if (subject === 'chemistry') return [scientificPhase('Concept Learning', 'Medium'), scientificPhase('Reaction Map', 'Medium'), scientificPhase('Formula Review', 'Light'), scientificPhase('Equation Practice', 'Heavy'), scientificPhase('Mechanism Review', 'Medium'), scientificPhase('Numerical Practice', 'Heavy'), scientificPhase('Memory Recall', 'Light', ['Active Recall']), scientificPhase('Past Questions', 'Heavy'), scientificPhase('Final Revision', 'Light')];
  if (subject === 'biology') return lowPrep ? [scientificPhase('Concept Reading', 'Medium'), scientificPhase('Diagram Practice', 'Medium'), scientificPhase('Terminology Recall', 'Light'), scientificPhase('Short Notes', 'Light'), scientificPhase('Memory Recall', 'Light', ['Active Recall']), scientificPhase('Final Revision', 'Light')] : [scientificPhase('Diagram Practice', 'Medium'), scientificPhase('Process Flow Review', 'Medium'), scientificPhase('Definition Practice', 'Light'), scientificPhase('Labelled Diagram Review', 'Medium'), scientificPhase('Important Questions', 'Heavy'), scientificPhase('Practice Test', 'Heavy'), scientificPhase('Final Revision', 'Light')];
  if (subject === 'english' || subject === 'language') return [scientificPhase('Reading & Understanding', 'Medium'), scientificPhase('Chapter Summary', 'Light'), scientificPhase('Character Analysis', 'Medium'), scientificPhase('Important Questions', 'Medium'), scientificPhase('Answer Writing', 'Heavy'), scientificPhase('Grammar Practice', 'Medium'), scientificPhase('Vocabulary Review', 'Light'), scientificPhase('Final Review', 'Light')];
  if (subject === 'commerce') return [scientificPhase('Concept Review', 'Medium'), scientificPhase('Formula Review', 'Light'), scientificPhase('Journal Practice', 'Heavy'), scientificPhase('Ledger Practice', 'Heavy'), scientificPhase('Statement Practice', 'Heavy'), scientificPhase('Problem Practice', 'Heavy'), scientificPhase('Case Study Review', 'Medium'), scientificPhase('Important Questions', 'Medium'), scientificPhase('Final Revision', 'Light')];
  if (subject === 'engineering') return [scientificPhase('Concept Review', 'Medium'), scientificPhase('Circuit Practice', 'Heavy'), scientificPhase('Truth Table Practice', 'Medium'), scientificPhase('K-Map Practice', 'Heavy'), scientificPhase('Boolean Simplification', 'Heavy'), scientificPhase('Diagram Practice', 'Medium'), scientificPhase('Problem Practice', 'Heavy'), scientificPhase('Past Questions', 'Heavy'), scientificPhase('Final Revision', 'Light')];
  if (subject === 'ai') return [scientificPhase('Concept Review', 'Medium'), scientificPhase('Algorithm Understanding', 'Medium'), scientificPhase('Dataset Practice', 'Heavy'), scientificPhase('Model Logic', 'Heavy'), scientificPhase('Code Practice', 'Heavy'), scientificPhase('Output Interpretation', 'Medium'), scientificPhase('Formula Review', 'Light'), scientificPhase('Case Study Review', 'Medium'), scientificPhase('Final Revision', 'Light')];
  if (subject === 'social') {
    const name = normalizeText(task.taskName);
    if (name.includes('constitution') || name.includes('civics')) return [scientificPhase('Article/Concept Understanding', 'Medium'), scientificPhase('Simple Notes', 'Light'), scientificPhase('Keyword Recall', 'Light'), scientificPhase('6 Mark Answer Practice', 'Heavy'), scientificPhase('Case/Example', 'Medium'), scientificPhase('Final Recall', 'Light')];
    if (name.includes('history')) return [scientificPhase('Story Timeline', 'Medium'), scientificPhase('Cause and Effect', 'Medium'), scientificPhase('Dates/Events Recall', 'Light'), scientificPhase('Answer Writing', 'Heavy'), scientificPhase('Past Questions', 'Heavy'), scientificPhase('Final Recall', 'Light')];
    return [scientificPhase('Concept Learning', 'Medium'), scientificPhase('Key Terms Recall', 'Light'), scientificPhase('Answer Practice', 'Heavy'), scientificPhase('Final Review', 'Light')];
  }
  if (type === 'Revision') return highPrep ? [scientificPhase('Blurting', 'Light', ['Active Recall']), scientificPhase('Past Questions', 'Heavy', ['Practice Testing']), scientificPhase('Mistake Review', 'Medium', ['Mistake Review']), scientificPhase('Final Recall', 'Light', ['Final Recall'])] : [scientificPhase('Concept Patch Up', 'Medium'), scientificPhase('Quick Review', 'Light'), scientificPhase('Active Recall', 'Medium'), scientificPhase('Mistake Review', 'Medium'), scientificPhase('Final Recall', 'Light')];
  if (type === 'Exam Prep') return highPrep ? [scientificPhase('Past Questions', 'Heavy'), scientificPhase('Timed Practice', 'Heavy'), scientificPhase('Mistake Review', 'Medium'), scientificPhase('Active Recall', 'Medium'), scientificPhase('Final Recall', 'Light')] : [scientificPhase(lowPrep ? 'Concept Learning' : 'Deep Study', lowPrep ? 'Medium' : 'Heavy'), scientificPhase('Worked Examples', 'Medium'), scientificPhase('Active Recall', 'Medium'), scientificPhase('Practice Problems', 'Heavy'), scientificPhase('Weak Area Review', 'Medium'), scientificPhase('Final Recall', 'Light')];
  return highPrep ? [scientificPhase('Quick Concept Check', 'Light'), scientificPhase('Active Recall', 'Medium'), scientificPhase('Practice', 'Heavy'), scientificPhase('Mini Test', 'Medium'), scientificPhase('Final Review', 'Light')] : [scientificPhase('Concept Learning', 'Medium'), scientificPhase('Example Practice', 'Medium'), scientificPhase('Active Recall', 'Medium'), scientificPhase('Short Notes', 'Light'), scientificPhase('Mini Test', 'Medium'), scientificPhase('Final Review', 'Light')];
}

export var estimateTaskEffortMinutes: any = function estimateTaskEffortMinutes(task, dates = []) {
  const typeBase = { Study: 120, Revision: 90, 'Exam Prep': 240, Assignment: 180, Project: 300, Other: 90 }[task.selectedType] || 90;
  let boost = 0;
  if (['math', 'physics'].includes(task.subjectArea) || task.inferredSubtype === 'problem') boost += 30;
  if (task.inferredSubtype === 'coding') boost += task.selectedType === 'Project' ? 90 : 45;
  if (task.inferredSubtype === 'lab') boost += 30;
  if (task.inferredSubtype === 'presentation') boost += 30;
  if (task.inferredSubtype === 'creative') boost += 30;
  if (task.inferredSubtype === 'career') boost += 60;
  if (task.inferredSubtype === 'reading') boost -= 20;
  if (['admin', 'chore'].includes(task.inferredSubtype)) boost -= 40;
  const usableDays = Math.max(0, dates.filter(date => canScheduleTaskOnDate(task, date)).length);
  const urgency = task.overdue || task.emergency || usableDays === 0 ? 1.6 : usableDays === 1 ? 1.35 : usableDays === 2 ? 1.2 : usableDays <= 5 ? 1.05 : 1;
  const intensity = detailedState.preferences?.intensity === 'Light' ? 0.9 : detailedState.preferences?.intensity === 'Intense' ? 1.1 : 1;
  let estimate = (typeBase + boost) * (0.75 + task.difficulty / 10) * (1.6 - task.preparedness / 100) * urgency * intensity;
  if (task.preparedness > 85 && task.difficulty < 5) estimate *= 0.8;
  if (task.difficulty >= 8 && task.preparedness <= 40) estimate *= 1.2;
  const minimum = task.inferredSubtype === 'admin' ? 20 : task.inferredSubtype === 'chore' ? 20 : task.inferredSubtype === 'coding' && task.selectedType === 'Project' ? 150 : ({ Other: 30, Revision: 40, Study: 60, Assignment: 60, 'Exam Prep': 90, Project: 90 }[task.selectedType] || 40);
  return Math.max(minimum, Math.round(estimate / 10) * 10);
}

calculateDetailedPriorityScore = function calculateDetailedPriorityScore(difficultyOrTask, preparedness, availableMinutesBeforeDeadline) {
  const task = typeof difficultyOrTask === 'object' ? difficultyOrTask : { difficulty: difficultyOrTask, preparedness, selectedType: 'Study', estimatedMinutes: 120, daysLeft: 1 };
  const difficulty = clampNumber(task.difficulty, 0, 10, 5);
  const prep = clampNumber(task.preparedness, 0, 100, 50);
  const typeWeight = task.inferredSubtype === 'career' ? 90 : task.inferredSubtype === 'admin' ? 35 : task.inferredSubtype === 'chore' ? 25 : ({ 'Exam Prep': 100, Project: 85, Assignment: 75, Study: 70, Revision: 65, Other: 45 }[task.selectedType || task.taskType] || 45);
  const usableDays = Math.max(1, task.usableDaysUntilStudyDeadline || task.daysLeft || 1);
  const estimated = Math.max(1, task.estimatedMinutes || 120);
  const available = Math.max(1, availableMinutesBeforeDeadline || task.availableMinutesBeforeDeadline || estimated);
  const deadlineRiskScore = (estimated / available) * 100;
  task.deadlineRiskScore = deadlineRiskScore;
  return (100 / usableDays) * 0.30 + (100 - prep) * 0.20 + (difficulty * 10) * 0.20 + typeWeight * 0.15 + deadlineRiskScore * 0.10;
}

priorityLevelFromScore = function priorityLevelFromScore(score, task = {}) {
  if (task.displayPriorityLevel) return task.displayPriorityLevel;
  return visiblePriorityLevelFromScore(score || 0);
}

export var calculateDetailedDisplayPriorityScore: any = function calculateDetailedDisplayPriorityScore(difficultyOrTask, preparedness) {
  const task = typeof difficultyOrTask === 'object' ? difficultyOrTask : { difficulty: difficultyOrTask, preparedness };
  const difficulty = clampNumber(task.difficulty, 0, 10, 5);
  const prep = clampNumber(task.preparedness, 0, 100, 50);
  const preparednessGap = 100 - prep;
  const difficultyPressure = difficulty * 10;
  return (preparednessGap * 0.55) + (difficultyPressure * 0.45);
}

export var visiblePriorityLevelFromScore: any = function visiblePriorityLevelFromScore(score) {
  if (score >= 70) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

export var upgradePriorityOneLevel: any = function upgradePriorityOneLevel(level) {
  if (level === 'Low') return 'Medium';
  if (level === 'Medium') return 'High';
  return 'High';
}

export var isTruePriorityEmergency: any = function isTruePriorityEmergency(task = {}) {
  const startDate = detailedState.setup?.startDate || localToday();
  const dueDistance = compareDateKeys(task.dueDate || startDate, startDate);
  const dueNow = dueDistance >= 0 && dueDistance <= 1;
  const lowPreparedness = clampNumber(task.preparedness, 0, 100, 50) < 40;
  const estimated = Math.max(0, task.estimatedMinutes || task.requiredMinutes || 0);
  const available = Math.max(0, task.availableMinutesBeforeDeadline || 0);
  const impossibleFit = estimated > 0 && available > 0 && estimated > available;
  return (dueNow && lowPreparedness) || impossibleFit;
}

export var calculateDetailedDisplayPriorityLevel: any = function calculateDetailedDisplayPriorityLevel(task = {}) {
  const baseScore = calculateDetailedDisplayPriorityScore(task);
  const baseLevel = visiblePriorityLevelFromScore(baseScore);
  const startDate = detailedState.setup?.startDate || localToday();
  const dueDistance = compareDateKeys(task.dueDate || startDate, startDate);
  const deadlineUpgrade = dueDistance >= 0 && dueDistance <= 2;
  if (isTruePriorityEmergency(task)) return 'High';
  return deadlineUpgrade ? upgradePriorityOneLevel(baseLevel) : baseLevel;
}

export var withDetailedPriorityFields: any = function withDetailedPriorityFields(task = {}) {
  const schedulingScore = calculateDetailedPriorityScore(task, task.preparedness, task.availableMinutesBeforeDeadline);
  const displayPriorityScore = calculateDetailedDisplayPriorityScore(task);
  const displayPriorityLevel = calculateDetailedDisplayPriorityLevel({ ...task, schedulingScore, displayPriorityScore });
  return {
    ...task,
    schedulingScore,
    priorityScore: schedulingScore,
    displayPriorityScore,
    displayPriorityLevel,
    priorityLevel: displayPriorityLevel
  };
}

export var applyRelativeDisplayPriority: any = function applyRelativeDisplayPriority(tasks = []) {
  if (tasks.length < 3 || !tasks.every(task => task.displayPriorityLevel === 'High')) return tasks;
  const trueEmergencyIds = new Set(tasks.filter(isTruePriorityEmergency).map(task => task.id));
  const adjustable = tasks.filter(task => !trueEmergencyIds.has(task.id)).sort((a, b) => (b.displayPriorityScore || 0) - (a.displayPriorityScore || 0) || (b.schedulingScore || 0) - (a.schedulingScore || 0));
  const highCut = Math.ceil(adjustable.length * 0.30);
  const mediumCut = Math.ceil(adjustable.length * 0.70);
  adjustable.forEach((task, index) => {
    const baseLevel = visiblePriorityLevelFromScore(task.displayPriorityScore || 0);
    task.displayPriorityLevel = index < highCut ? 'High' : index < mediumCut ? 'Medium' : baseLevel === 'Low' ? 'Low' : 'Medium';
    task.priorityLevel = task.displayPriorityLevel;
  });
  return tasks;
}

generateDetailedPlan = function generateDetailedPlan() {
  try {
    collectDetailedSetup();
    normalizeDetailedSetup();
    normalizeDetailedTasks();
    collectDetailedPreferences();
    const setup = detailedState.setup;
    if (setup.scope === 'Today Only') setup.endDate = setup.startDate;
    const startMinutes = timeToMinutesSafe(setup.startTime || '09:00');
    let endMinutes = timeToMinutesSafe(setup.endTime || '21:00');
    if (endMinutes <= startMinutes) endMinutes += 1440;
    if (!detailedState.tasks.length || endMinutes <= startMinutes || compareDateKeys(setup.startDate, setup.endDate) > 0) {
      showDetailedReviewError(!detailedState.tasks.length ? 'Add at least one task before generating your plan.' : 'Something went wobbly while building the plan. Please check your dates and fixed schedule.');
      return;
    }
    const dates = buildDateRange(setup.startDate, setup.endDate);
    const schedule = generateDetailedSchedule(dates, detailedState.tasks);
    detailedState.generatedPlan = {
      createdAt: new Date().toISOString(),
      setup: { ...setup },
      preferences: { ...detailedState.preferences },
      tasks: schedule.tasks,
      days: schedule.days,
      blocks: [],
      warnings: schedule.warnings,
      overload: schedule.overload,
      unscheduledTasks: schedule.unscheduledTasks,
      overflowSessions: schedule.overflowSessions,
      scienceMethodsUsed: schedule.scienceMethodsUsed,
      scienceSummary: schedule.scienceSummary,
      validationReport: schedule.validationReport
    };
    detailedPlannerGenerated = true;
    window.detailedPlannerGenerated = true;
    refreshDetailedPlanBlocks();
    detailedState.selectedDate = schedule.days[0]?.date || localToday();
    saveDetailedDraft();
    saveGeneratedDetailedPlan();
    showDetailedReviewError('');
    navigateDetailed('week');
  } catch (error) {
    console.error(error);
    showDetailedReviewError('Something went wobbly while building the plan. Please check your dates and fixed schedule.');
  }
}

generateDetailedSchedule = function generateDetailedSchedule(dates, tasks) {
  const days = buildLogicalDays(dates);
  const normalizedTasks = normalizeDetailedTaskData(tasks, dates, days);
  const units = buildSessionUnits(normalizedTasks, days);
  const overflowSessions = [];
  units.sort(compareDetailedUnitPriority).forEach(unit => {
    const placement = findBestPlacement(unit, days);
    if (!placement) {
      overflowSessions.push({ taskId: unit.taskId, taskName: unit.taskName, phase: unit.phase, remainingMinutes: unit.duration, reason: 'Not enough free space before the safe study deadline.', suggestion: 'Try extending the dates, reducing fixed blocks, or switching intensity.' });
      return;
    }
    placeSessionIntoSlot(placement, unit);
  });
  insertBreaksAndBuffers(days);
  buildDueNotes(days, normalizedTasks);
  days.forEach(day => {
    if (!day.freeSlots.length) day.warnings.push('Fully booked day. No study space left.');
    if (!day.blocks.some(block => block.type === 'study') && day.freeSlots.some(slot => slot.endMs - slot.startMs >= 20 * 60000) && normalizedTasks.some(task => task.remainingMinutes > 0 && canScheduleTaskOnDate(task, day.date))) {
      day.warnings.push('No required study here. Tiny breathing space.');
    }
    cleanDetailedDayBlocks(day);
  });
  normalizedTasks.forEach(task => {
    task.scheduledMinutes = days.flatMap(day => day.blocks).filter(block => block.taskId === task.id && block.type === 'study').reduce((sum, block) => sum + blockMinutes(block), 0);
    task.remainingMinutes = Math.max(0, task.requiredMinutes - task.scheduledMinutes);
    if (task.remainingMinutes <= Math.max(detailedModeConfig().minimumStudyBlock, detailedModeConfig().lightDuration)) task.remainingMinutes = 0;
    task.overflow = task.remainingMinutes > 0 && !task.futureDueBeyondRange;
    if (task.overflow && !overflowSessions.some(item => item.taskId === task.id)) {
      overflowSessions.push({ taskId: task.id, taskName: task.taskName, phase: 'Remaining work', remainingMinutes: task.remainingMinutes, reason: 'The available time ran out before this task was complete.', suggestion: 'Extend the date range or reduce fixed blocks if this must be finished.' });
    }
  });
  const warnings = buildOverflowWarnings(normalizedTasks, overflowSessions);
  const totalEstimatedWorkMinutes = normalizedTasks.reduce((sum, task) => sum + (task.requiredMinutes || task.estimatedMinutes || 0), 0);
  const totalScheduledStudyMinutes = normalizedTasks.reduce((sum, task) => sum + (task.scheduledMinutes || 0), 0);
  const unscheduledMinutes = normalizedTasks.reduce((sum, task) => sum + (task.remainingMinutes || 0), 0);
  const overload = {
    isOverloaded: unscheduledMinutes > 0 || overflowSessions.length > 0,
    totalEstimatedWorkMinutes,
    totalScheduledStudyMinutes,
    unscheduledMinutes,
    fitPercentage: totalEstimatedWorkMinutes ? Math.round((totalScheduledStudyMinutes / totalEstimatedWorkMinutes) * 100) : 100
  };
  const unscheduledTasks = normalizedTasks
    .filter(task => (task.remainingMinutes || 0) > 0)
    .map(task => ({ taskName: task.taskName, remainingMinutes: task.remainingMinutes, reason: task.futureDueBeyondRange ? 'Due date is beyond this plan range.' : 'Not enough free time before the safe study deadline.' }));
  const science = buildScienceSummary(normalizedTasks, detailedState.preferences);
  let validationReport = validateDetailedPlan({ days, tasks: normalizedTasks, overflowSessions, warnings });
  if (!validationReport.valid) {
    repairDetailedPlanOnce(days);
    validationReport = validateDetailedPlan({ days, tasks: normalizedTasks, overflowSessions, warnings });
    if (!validationReport.valid) {
      warnings.push('Something went wobbly while building the plan. Please check your dates and fixed schedule.');
      console.error('Detailed plan validation failed', validationReport);
    }
  }
  return { days, tasks: normalizedTasks, warnings, overload, unscheduledTasks, overflowSessions, scienceMethodsUsed: science.methods, scienceSummary: science.copy, validationReport };
}

normalizeDetailedTaskData = function normalizeDetailedTaskData(tasks, dates = [], days = []) {
  const startDate = detailedState.setup?.startDate || localToday();
  const endDate = detailedState.setup?.endDate || startDate;
  const planEnd = dates.at(-1) || endDate;
  const freeByDate = Object.fromEntries((days || []).map(day => [day.date, (day.freeSlots || []).reduce((sum, slot) => sum + Math.floor((slot.endMs - slot.startMs) / 60000), 0)]));
  const normalized = (Array.isArray(tasks) ? tasks : []).map(raw => {
    const dueDateMissing = !raw.dueDate;
    const dueDate = raw.dueDate || endDate || addDays(startDate, 1);
    const difficulty = clampNumber(raw.difficulty, 0, 10, 5);
    const preparedness = clampNumber(raw.preparedness, 0, 100, 50);
    const selectedType = raw.taskType || raw.selectedType || 'Study';
    const base = {
      ...raw,
      id: raw.id || uniqueId(),
      rawName: raw.taskName || raw.name || 'Untitled task',
      taskName: raw.taskName || raw.name || 'Untitled task',
      selectedType,
      taskType: selectedType,
      dueDate,
      dueDateMissing,
      difficulty,
      preparedness
    };
    const profile = getTaskScienceProfile(base);
    const studyDeadlineDate = calculateStudyDeadlineDate(dueDate, startDate);
    const task = {
      ...base,
      ...profile,
      studyDeadlineDate,
      lastPrepDate: studyDeadlineDate,
      overdue: compareDateKeys(dueDate, startDate) < 0,
      emergency: compareDateKeys(dueDate, startDate) === 0 || compareDateKeys(dueDate, startDate) < 0,
      futureDueBeyondRange: compareDateKeys(studyDeadlineDate, planEnd) > 0
    };
    task.estimatedMinutes = estimateTaskEffortMinutes(task, dates);
    task.availableMinutesBeforeDeadline = dates.filter(date => compareDateKeys(date, studyDeadlineDate) <= 0).reduce((sum, date) => sum + (freeByDate[date] || 0), 0);
    task.usableDaysUntilStudyDeadline = Math.max(0, dates.filter(date => canScheduleTaskOnDate(task, date)).length);
    Object.assign(task, withDetailedPriorityFields(task));
    task.phaseQueue = buildScientificPhaseQueue(task);
    task.methods = Array.from(new Set([...(task.methods || []), ...task.phaseQueue.flatMap(phase => phase.methods || [])]));
    task.requiredMinutes = task.futureDueBeyondRange ? Math.max(detailedModeConfig().minimumStudyBlock, Math.round(task.estimatedMinutes * 0.45 / 10) * 10) : task.emergency ? Math.min(task.estimatedMinutes, detailedModeConfig().studyDuration * 3) : task.estimatedMinutes;
    task.scheduledMinutes = 0;
    task.remainingMinutes = task.requiredMinutes;
    return task;
  });
  return applyRelativeDisplayPriority(normalized).sort(compareDetailedTaskPriority);
}

export var buildLogicalDays: any = function buildLogicalDays(dates) {
  return dates.map(date => {
    const start = combineDateAndTime(date, detailedState.setup?.startTime || '09:00');
    let end = combineDateAndTime(date, detailedState.setup?.endTime || '21:00');
    if (end <= start) end = addMinutes(end, 1440);
    const day = { date, label: dayLabel(date), logicalStartMs: start.getTime(), logicalEndMs: end.getTime(), dayStartTimestamp: start.toISOString(), dayEndTimestamp: end.toISOString(), fixedBlocks: [], freeSlots: [], freeTimeBlocks: [], generatedBlocks: [], blocks: [], warnings: [], dueNotes: [] };
    day.fixedBlocks = expandFixedBlocksForDay(day);
    day.freeSlots = buildAvailableSlots(day);
    day.freeTimeBlocks = day.freeSlots.map(slot => ({ start: new Date(slot.startMs).toISOString(), end: new Date(slot.endMs).toISOString() }));
    day.blocks = [...day.fixedBlocks];
    return day;
  });
}

buildLogicalDay = function buildLogicalDay(date) {
  return buildLogicalDays([date])[0];
}

export var expandFixedBlocksForDay: any = function expandFixedBlocksForDay(day) {
  const key = dayKey(day.date);
  const dailyStart = timeToMinutesSafe(detailedState.setup?.startTime || '09:00');
  const crossesMidnight = timeToMinutesSafe(detailedState.setup?.endTime || '21:00') <= dailyStart;
  return (Array.isArray(detailedState.fixedBlocks) ? detailedState.fixedBlocks : [])
    .filter(block => (block.days?.length ? block.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).includes(key))
    .map(block => {
      let start = combineDateAndTime(day.date, block.startTime || '00:00');
      let end = combineDateAndTime(day.date, block.endTime || '00:00');
      if (crossesMidnight && timeToMinutesSafe(block.startTime || '00:00') < dailyStart) {
        start = addMinutes(start, 1440);
        end = addMinutes(end, 1440);
      }
      if (end <= start) end = addMinutes(end, 1440);
      const startMs = Math.max(day.logicalStartMs, start.getTime());
      const endMs = Math.min(day.logicalEndMs, end.getTime());
      if (endMs <= startMs) return null;
      return makeDetailedBlock({ logicalDate: day.date, start: new Date(startMs), end: new Date(endMs), type: 'fixed', taskId: block.id, task: block.title || 'Fixed Commitment', phase: block.category || 'Fixed', priority: 'Fixed', energy: 'Fixed', locked: true, blockNote: block.blockNote || block.note || '' });
    })
    .filter(Boolean)
    .sort(compareDetailedBlocksByStart);
}

fixedBlocksForLogicalDay = function fixedBlocksForLogicalDay(day) {
  return expandFixedBlocksForDay(day);
}

export var subtractIntervals: any = function subtractIntervals(baseIntervals, removeIntervals) {
  let windows = baseIntervals.map(item => ({ ...item }));
  removeIntervals.sort((a, b) => a.startMs - b.startMs).forEach(remove => {
    const next = [];
    windows.forEach(window => {
      if (remove.endMs <= window.startMs || remove.startMs >= window.endMs) {
        next.push(window);
        return;
      }
      if (remove.startMs > window.startMs) next.push({ startMs: window.startMs, endMs: remove.startMs });
      if (remove.endMs < window.endMs) next.push({ startMs: remove.endMs, endMs: window.endMs });
    });
    windows = next;
  });
  return windows.filter(slot => slot.endMs - slot.startMs >= 15 * 60000).sort((a, b) => a.startMs - b.startMs);
}

subtractFixedCommitments = function subtractFixedCommitments(dayStartISO, dayEndISO, fixedBlocks) {
  return subtractIntervals([{ startMs: new Date(dayStartISO).getTime(), endMs: new Date(dayEndISO).getTime() }], (fixedBlocks || []).map(block => ({ startMs: new Date(block.actualStartISO).getTime(), endMs: new Date(block.actualEndISO).getTime() }))).map(slot => ({ start: new Date(slot.startMs).toISOString(), end: new Date(slot.endMs).toISOString() }));
}

export var buildAvailableSlots: any = function buildAvailableSlots(day) {
  return subtractIntervals([{ startMs: day.logicalStartMs, endMs: day.logicalEndMs }], day.fixedBlocks.map(block => ({ startMs: new Date(block.actualStartISO).getTime(), endMs: new Date(block.actualEndISO).getTime() })));
}

buildDetailedTaskQueue = function buildDetailedTaskQueue(tasks, dates) {
  return normalizeDetailedTaskData(tasks, dates, buildLogicalDays(dates)).map(task => ({ ...task, remainingChunks: task.phaseQueue.length, phaseIndex: 0 }));
}

export var buildSessionUnits: any = function buildSessionUnits(tasks, days) {
  const config = detailedModeConfig();
  return tasks.flatMap(task => {
    const usableDates = days.map(day => day.date).filter(date => canScheduleTaskOnDate(task, date));
    if (!usableDates.length) return [];
    const phases = task.phaseQueue.length ? task.phaseQueue : buildScientificPhaseQueue(task);
    const totalWeight = phases.reduce((sum, phase) => sum + energyWeight(phase.energy), 0);
    let remaining = task.requiredMinutes;
    const units = [];
    phases.forEach((phase, phaseIndex) => {
      let phaseMinutes = phaseIndex === phases.length - 1 ? remaining : Math.max(config.minimumStudyBlock, Math.round((task.requiredMinutes * energyWeight(phase.energy) / totalWeight) / 10) * 10);
      if (phase.energy === 'Heavy' && config.selectedDuration === 90 && detailedState.preferences?.intensity === 'Intense') phaseMinutes = Math.max(90, phaseMinutes);
      remaining = Math.max(0, remaining - phaseMinutes);
      splitDetailedDuration(Math.max(config.minimumStudyBlock, phaseMinutes), preferredSessionDuration(phase, task, config)).forEach((duration, chunkIndex) => {
        units.push({ id: uniqueId(), taskId: task.id, taskName: task.taskName, selectedType: task.selectedType, subjectArea: task.subjectArea, phase: phase.name, label: labelForTaskPhase(task, phase.name, chunkIndex ? chunkIndex + 1 : 0), category: 'study', type: 'study', energy: phase.energy, priority: task.displayPriorityLevel || task.priorityLevel, priorityLevel: task.displayPriorityLevel || task.priorityLevel, displayPriorityLevel: task.displayPriorityLevel || task.priorityLevel, priorityScore: task.priorityScore, schedulingScore: task.schedulingScore || task.priorityScore, duration, methods: phase.methods?.length ? phase.methods : task.methods, studyMethod: studyMethodForUnit(phase, task), dueDate: task.dueDate, studyDeadlineDate: task.studyDeadlineDate, emergency: task.emergency, overdue: task.overdue, targetDate: targetDateForPhase(usableDates, phase, phaseIndex, phases.length), allowedDates: usableDates, order: phaseIndex });
      });
    });
    return units;
  });
}

fillDetailedLogicalDay = function fillDetailedLogicalDay(day, queue) {
  (queue || []).filter(unit => canScheduleTaskOnDate(unit, day.date)).forEach(unit => {
    const placement = findBestPlacement(unit, [day]);
    if (placement) placeSessionIntoSlot(placement, unit);
  });
}

export var scorePlacement: any = function scorePlacement(unit, day, slot, startMs) {
  const minute = logicalMinutesForDate(day.date, new Date(startMs));
  const focus = focusScore(unit.energy, minute, day);
  const energyMatch = energyPlacementScore(unit.energy, day, startMs, slot);
  const targetDistance = Math.abs(compareDateKeys(day.date, unit.targetDate));
  const deadlineDistance = Math.max(0, compareDateKeys(unit.studyDeadlineDate, day.date));
  const afterFixedPenalty = day.fixedBlocks.some(block => Math.abs(startMs - new Date(block.actualEndISO).getTime()) <= 10 * 60000 && ['Travel', 'Gym'].includes(block.phase)) && unit.energy === 'Heavy' && detailedState.preferences?.intensity !== 'Intense' ? 15 : 0;
  const sameTaskBefore = day.blocks.some(block => block.type === 'study' && block.taskId === unit.taskId && Math.abs(new Date(block.actualEndISO).getTime() - startMs) <= 5 * 60000);
  return (unit.schedulingScore || unit.priorityScore || 0) * 0.05 + focus * 3 + energyMatch - targetDistance * 28 + Math.min(deadlineDistance, 7) * 4 + Math.min((slot.endMs - slot.startMs) / 60000, 120) / 12 + (unit.selectedType === 'Project' && sameTaskBefore ? 10 : sameTaskBefore ? -8 : 0) - afterFixedPenalty;
}

export var findBestPlacement: any = function findBestPlacement(unit, days) {
  const config = detailedModeConfig();
  let best = null;
  days.filter(day => unit.allowedDates.includes(day.date)).forEach(day => {
    day.freeSlots.forEach((slot, slotIndex) => {
      const maxMinutes = Math.floor((slot.endMs - slot.startMs) / 60000);
      const duration = Math.min(unit.duration, maxMinutes);
      if (duration < config.minimumStudyBlock) return;
      candidateStartsForSlot(day, slot, unit, duration).forEach(startMs => {
        const endMs = startMs + duration * 60000;
        if (endMs > slot.endMs) return;
        const candidate = { actualStartISO: new Date(startMs).toISOString(), actualEndISO: new Date(endMs).toISOString(), startMinute: minutesFromLogicalStart(day.date, new Date(startMs)), endMinute: minutesFromLogicalStart(day.date, new Date(endMs)) };
        if (hasOverlap(day.blocks, candidate)) return;
        const score = scorePlacement(unit, day, slot, startMs);
        if (!best || score > best.score) best = { score, day, slotIndex, startMs, endMs, duration };
      });
    });
  });
  return best;
}

export var candidateStartsForSlot: any = function candidateStartsForSlot(day, slot, unit, duration) {
  const starts = new Set([slot.startMs]);
  const focus = focusWindowForDay(day);
  const latest = slot.endMs - duration * 60000;
  if (unit.energy === 'Heavy') starts.add(Math.max(slot.startMs, Math.min(latest, focus.startMs)));
  if (unit.energy === 'Medium') starts.add(Math.max(slot.startMs, Math.min(latest, focus.midMs)));
  if (unit.energy === 'Light') starts.add(Math.max(slot.startMs, latest));
  for (let cursor = slot.startMs; cursor <= latest; cursor += 15 * 60000) starts.add(cursor);
  return Array.from(starts).sort((a, b) => a - b);
}

export var placeSessionIntoSlot: any = function placeSessionIntoSlot(placement, unit) {
  const block = makeDetailedBlock({ logicalDate: placement.day.date, start: new Date(placement.startMs), end: new Date(placement.endMs), type: 'study', taskId: unit.taskId, task: unit.taskName, phase: unit.phase, priority: unit.displayPriorityLevel || unit.priorityLevel, energy: unit.energy, locked: false, blockNote: methodNote(unit.methods) });
  Object.assign(block, { label: unit.label, category: 'study', methods: unit.methods || [], studyMethod: unit.studyMethod, dueDate: unit.dueDate, studyDeadlineDate: unit.studyDeadlineDate, emergency: unit.emergency, overdue: unit.overdue, displayPriorityLevel: unit.displayPriorityLevel || unit.priorityLevel, schedulingScore: unit.schedulingScore || unit.priorityScore, priorityScore: unit.priorityScore });
  placement.day.blocks.push(block);
  const old = placement.day.freeSlots[placement.slotIndex];
  let reservedEndMs = placement.endMs;
  const config = detailedModeConfig();
  const breakMs = config.breakDuration * 60000;
  if (shouldAddBreak(unit.energy) && old.endMs - placement.endMs >= breakMs + config.minimumStudyBlock * 60000) {
    const rest = makeSimpleBlock(placement.day.date, placement.endMs, placement.endMs + breakMs, 'break', 'Break', 'Break', 'Break');
    rest.blockNote = detailedState.preferences?.breakPreference === 'Minimal' ? 'Tiny reset' : 'Rest your mind';
    rest.note = rest.blockNote;
    placement.day.blocks.push(rest);
    reservedEndMs = placement.endMs + breakMs;
  }
  const next = [];
  if (old.startMs < placement.startMs) next.push({ startMs: old.startMs, endMs: placement.startMs });
  if (reservedEndMs < old.endMs) next.push({ startMs: reservedEndMs, endMs: old.endMs });
  placement.day.freeSlots.splice(placement.slotIndex, 1, ...next.filter(slot => slot.endMs - slot.startMs >= 15 * 60000));
  placement.day.freeTimeBlocks = placement.day.freeSlots.map(slot => ({ start: new Date(slot.startMs).toISOString(), end: new Date(slot.endMs).toISOString() }));
}

export var insertBreaksAndBuffers: any = function insertBreaksAndBuffers(days) {
  const config = detailedModeConfig();
  days.forEach(day => {
    day.blocks.sort(compareDetailedBlocksByStart);
    const additions = [];
    day.blocks.forEach(block => {
      if (block.type === 'fixed' && detailedState.preferences?.includeBuffer && ['Dinner', 'Travel', 'Gym'].includes(block.phase)) {
        const gap = gapAfterBlock(day, block, day.blocks);
        if (gap && gap.minutes >= config.bufferDuration + 20) additions.push(makeSimpleBlock(day.date, gap.startMs, gap.startMs + config.bufferDuration * 60000, 'buffer', 'Buffer / Catch Up', 'Buffer', 'Buffer'));
      }
      if (block.type === 'study' && shouldAddBreak(block.energy)) {
        const gap = gapAfterBlock(day, block, day.blocks);
        if (gap && gap.minutes >= config.breakDuration) additions.push(makeSimpleBlock(day.date, gap.startMs, gap.startMs + config.breakDuration * 60000, 'break', 'Break', 'Break', 'Break'));
      }
    });
    additions.filter(block => !hasOverlap(day.blocks, block) && blockInsideLogicalDay(day, block)).forEach(block => day.blocks.push(block));
  });
}

export var buildDueNotes: any = function buildDueNotes(days, tasks) {
  days.forEach(day => {
    day.dueNotes = buildDueReminderMessagesForDate(day.date, tasks);
  });
}

export var buildDueReminderMessagesForDate: any = function buildDueReminderMessagesForDate(date, tasks = []) {
  const names = (tasks || [])
    .filter(task => task.dueDate === date && compareDateKeys(task.dueDate, localToday()) >= 0)
    .map(task => task.taskName)
    .filter(Boolean);
  if (!names.length) return [];
  return [dueTodayMessage(names)];
}

export var buildDueReminderMessagesForPlan: any = function buildDueReminderMessagesForPlan(plan) {
  const tasks = plan?.tasks || detailedState.tasks || [];
  const today = localToday();
  const soonLimit = addDays(today, 7);
  const dueToday = [];
  const dueSoon = [];
  (tasks || []).forEach(task => {
    if (!task?.dueDate || !task.taskName) return;
    if (task.dueDate === today) dueToday.push(task.taskName);
    else if (compareDateKeys(task.dueDate, today) > 0 && compareDateKeys(task.dueDate, soonLimit) <= 0) dueSoon.push(task.taskName);
  });
  const messages = [];
  if (dueToday.length) messages.push(dueTodayMessage(dueToday));
  if (dueSoon.length) messages.push(dueSoonMessage(dueSoon));
  return messages;
}

export var dueTodayMessage: any = function dueTodayMessage(names) {
  const list = formatTaskNameList(names);
  return names.length === 1
    ? `${list} is due today. Make sure you're all set.`
    : `${list} are due today. Make sure you're all set for them.`;
}

export var dueSoonMessage: any = function dueSoonMessage(names) {
  return `${formatTaskNameList(names)} ${names.length === 1 ? 'is' : 'are'} coming up soon. Your plan is helping you prepare step by step.`;
}

export var formatTaskNameList: any = function formatTaskNameList(names = []) {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length <= 1) return unique[0] || '';
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')}, and ${unique.at(-1)}`;
}

export var validateDetailedPlan: any = function validateDetailedPlan(plan) {
  const errors = [];
  (plan.days || []).forEach(day => {
    const sorted = [...(day.blocks || [])].sort(compareDetailedBlocksByStart);
    sorted.forEach((block, index) => {
      const start = new Date(block.actualStartISO).getTime();
      const end = new Date(block.actualEndISO).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end)) errors.push(`${day.date}: invalid timestamp`);
      if (end <= start) errors.push(`${day.date}: ${block.label} ends before it starts`);
      if (index && rangesOverlap(sorted[index - 1], block)) errors.push(`${day.date}: overlap near ${block.label}`);
      if (['study', 'break', 'buffer'].includes(block.type) && (day.fixedBlocks || []).some(fixed => rangesOverlap(fixed, block))) errors.push(`${day.date}: ${block.label} overlaps fixed time`);
      if (block.type === 'study' && !block.emergency && !block.overdue && block.studyDeadlineDate && compareDateKeys(day.date, block.studyDeadlineDate) > 0) errors.push(`${day.date}: required study after deadline for ${block.taskName || block.task}`);
    });
  });
  if ((plan.overflowSessions || []).length && !(plan.warnings || []).length) errors.push('Overflow exists without visible warning');
  return { valid: errors.length === 0, errors };
}

export var repairDetailedPlanOnce: any = function repairDetailedPlanOnce(days) {
  days.forEach(day => {
    day.blocks = removeInvalidDetailedOverlaps(day.blocks || []);
    cleanDetailedDayBlocks(day);
  });
}

export var buildOverflowWarnings: any = function buildOverflowWarnings(tasks, overflowSessions) {
  const warnings = [];
  tasks.filter(task => task.dueDateMissing).forEach(task => warnings.push(`I used the plan end date for ${task.taskName} because its due date was blank.`));
  tasks.filter(task => task.overdue).forEach(task => warnings.push(`${task.taskName}'s due date has already passed. Please adjust the date.`));
  if (overflowSessions.length) warnings.push('This plan is a little overloaded. We scheduled the most important work first.');
  if (detailedState.preferences?.intensity === 'Intense') warnings.push('This plan is packed. Tiny breaks only, stay focused.');
  if (detailedState.preferences?.bestFocus === 'Night') warnings.push('Harder blocks are placed later because you chose Night focus.');
  if (detailedState.preferences?.intensity === 'Light') warnings.push('Your plan uses shorter sessions and more breathing space.');
  return Array.from(new Set(warnings));
}

export var buildScienceSummary: any = function buildScienceSummary(tasks, preferences, preview = false) {
  const methods = Array.from(new Set((tasks || []).flatMap(task => task.methods || ['Task Breakdown', 'Timeboxing']))).filter(Boolean);
  const examLike = tasks.filter(task => ['Exam Prep', 'Revision', 'Study'].includes(task.selectedType)).length;
  const projectLike = tasks.filter(task => task.selectedType === 'Project').length;
  const copy = examLike && tasks.length > 1
    ? 'Your plan uses spaced recall and active practice because you have multiple learning tasks across several days.'
    : projectLike
      ? 'Your plan uses milestones, testing, and polish time so the project keeps moving steadily.'
      : preferences?.bestFocus === 'Night'
        ? 'Harder blocks are placed later because you chose Night focus.'
        : preview ? 'I will use active recall, practice, timeboxing, and final review where they fit.' : 'Your plan uses evidence-based timeboxing and task breakdown.';
  return { methods, copy };
}

detailedModeConfig = function detailedModeConfig(intensityOverride) {
  const intensity = intensityOverride || detailedState.preferences?.intensity || 'Balanced';
  const selected = Number(String(detailedState.preferences?.sessionLength || '50').match(/\d+/)?.[0]) || 50;
  const breakPref = detailedState.preferences?.breakPreference || 'Normal';
  if (intensity === 'Light') return { mode: 'Light', selectedDuration: selected, studyDuration: selected === 90 ? 50 : Math.min(selected, 50), heavyDuration: selected === 90 ? 90 : Math.min(selected, 50), mediumDuration: selected === 90 ? 50 : Math.min(selected, 50), lightDuration: Math.min(30, selected), breakDuration: breakPref === 'Frequent' ? 8 : breakPref === 'Minimal' ? 5 : 10, bufferDuration: 10, minimumStudyBlock: 20, maxStudyBlock: selected === 90 ? 90 : 50 };
  if (intensity === 'Intense') return { mode: 'Intense', selectedDuration: selected, studyDuration: selected, heavyDuration: selected, mediumDuration: selected === 90 ? 50 : selected, lightDuration: Math.min(40, selected), breakDuration: breakPref === 'Frequent' ? 8 : breakPref === 'Minimal' ? 10 : 12, bufferDuration: 8, minimumStudyBlock: 20, maxStudyBlock: Math.max(30, selected) };
  return { mode: 'Balanced', selectedDuration: selected, studyDuration: selected, heavyDuration: selected === 30 ? 30 : selected, mediumDuration: selected === 90 ? 50 : selected, lightDuration: Math.min(30, selected), breakDuration: breakPref === 'Frequent' ? 10 : breakPref === 'Minimal' ? 8 : 12, bufferDuration: 10, minimumStudyBlock: 20, maxStudyBlock: Math.max(50, selected) };
}

timeMatrix = function timeMatrix(intensity) {
  const config = detailedModeConfig(intensity);
  return { Heavy: config.heavyDuration, Medium: config.mediumDuration, Light: config.lightDuration, Break: config.breakDuration, Buffer: config.bufferDuration, max: config.maxStudyBlock };
}

buildDateRange = function buildDateRange(startDate, endDate) {
  const dates = [];
  const cursor = parseLocalDate(startDate);
  const end = parseLocalDate(endDate || startDate);
  while (cursor <= end) {
    dates.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length ? dates : [localToday()];
}

parseLocalDate = function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || localToday()).split('-').map(Number);
  const fallback = new Date();
  const date = new Date(Number.isFinite(year) ? year : fallback.getFullYear(), Number.isFinite(month) ? month - 1 : fallback.getMonth(), Number.isFinite(day) ? day : fallback.getDate());
  date.setHours(0, 0, 0, 0);
  return date;
}

formatLocalDate = function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export var dateKey: any = function dateKey(date) {
  return formatLocalDate(date instanceof Date ? date : parseLocalDate(date));
}

export var addDays: any = function addDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

addLocalDays = function addLocalDays(dateString, days) {
  return addDays(dateString, days);
}

export var compareDateKeys: any = function compareDateKeys(a, b) {
  return Math.round((parseLocalDate(a) - parseLocalDate(b)) / 86400000);
}

compareDateStrings = function compareDateStrings(a, b) {
  return compareDateKeys(a, b);
}

inclusiveDateDiff = function inclusiveDateDiff(startDate, endDate) {
  return compareDateKeys(endDate, startDate);
}

export var combineDateAndTime: any = function combineDateAndTime(dateString, timeString) {
  const date = parseLocalDate(dateString);
  const minutes = timeToMinutesSafe(timeString);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

combineLocalDateTime = function combineLocalDateTime(dateString, timeString) {
  return combineDateAndTime(dateString, timeString);
}

export var timeToMinutesSafe: any = function timeToMinutesSafe(value) {
  if (!value || typeof value !== 'string' || !value.includes(':')) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? Math.max(0, Math.min(1439, hours * 60 + minutes)) : 0;
}

export var blockMinutes: any = function blockMinutes(block: any) {
  if (!block) return 0;
  const dur = Number(block.duration);
  if (Number.isFinite(dur) && dur > 0) return Math.round(dur);
  if (block.actualStartISO && block.actualEndISO) {
    const s = new Date(block.actualStartISO).getTime();
    const e = new Date(block.actualEndISO).getTime();
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) {
      return Math.max(0, Math.round((e - s) / 60000));
    }
  }
  const st = block.startTime || block.start || '';
  const et = block.endTime || block.end || '';
  if (typeof st === 'string' && typeof et === 'string' && st.includes(':') && et.includes(':')) {
    const s = timeToMinutesSafe(st);
    let e = timeToMinutesSafe(et);
    if (e <= s) e += 1440;
    return Math.max(0, e - s);
  }
  return 0;
}

export var minutesToTimeLabel: any = function minutesToTimeLabel(total) {
  return displayTime(minutesToTime(total));
}

export var formatBlockTime: any = function formatBlockTime(block) {
  return `${displayTime(block.startTime)} - ${displayTime(block.endTime)}`;
}

export var calculateStudyDeadlineDate: any = function calculateStudyDeadlineDate(dueDate, startDate) {
  if (!dueDate) return startDate || localToday();
  if (compareDateKeys(dueDate, startDate || localToday()) <= 0) return dueDate;
  return addDays(dueDate, -1);
}

taskLastPrepDate = function taskLastPrepDate(dueDate, startDate) {
  return calculateStudyDeadlineDate(dueDate, startDate);
}

dayLabel = function dayLabel(date) {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

dayKey = function dayKey(date) {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3);
}

canScheduleTaskOnDate = function canScheduleTaskOnDate(task, date) {
  if (!task) return true;
  if (task.overdue) return date === detailedState.setup?.startDate;
  if (task.emergency) return date === task.dueDate;
  return compareDateKeys(date, task.studyDeadlineDate || task.lastPrepDate || task.dueDate || date) <= 0;
}

compareDetailedTaskPriority = function compareDetailedTaskPriority(a, b) {
  return compareDateKeys(a.studyDeadlineDate || a.lastPrepDate || a.dueDate, b.studyDeadlineDate || b.lastPrepDate || b.dueDate) || (b.schedulingScore || b.priorityScore || 0) - (a.schedulingScore || a.priorityScore || 0) || (b.difficulty || 0) - (a.difficulty || 0);
}

export var compareDetailedUnitPriority: any = function compareDetailedUnitPriority(a, b) {
  return compareDateKeys(a.studyDeadlineDate, b.studyDeadlineDate) || (b.schedulingScore || b.priorityScore || 0) - (a.schedulingScore || a.priorityScore || 0) || energyRank(a.energy) - energyRank(b.energy) || a.order - b.order;
}

makeDetailedBlock = function makeDetailedBlock({ logicalDate, start, end, type, taskId = '', task, phase, priority, energy, locked, blockNote = '' }) {
  const label = type === 'study' ? `${task} - ${phase}` : task;
  return { id: uniqueId(), date: logicalDate, logicalDate, actualStartISO: start.toISOString(), actualEndISO: end.toISOString(), startMs: start.getTime(), endMs: end.getTime(), displayDate: formatLocalDate(start), taskName: task, task, taskId, label, phase, category: type, type, energy: energy || (type === 'study' ? 'Medium' : phase), priority, priorityLevel: priority, displayPriorityLevel: ['High', 'Medium', 'Low'].includes(priority) ? priority : undefined, startMinute: minutesFromLogicalStart(logicalDate, start), endMinute: minutesFromLogicalStart(logicalDate, end), startTime: minutesToTime(timeToMinutesFromDate(start)), endTime: minutesToTime(timeToMinutesFromDate(end)), methods: [], completed: false, locked: type === 'fixed' ? true : !!locked, blockNote, note: blockNote };
}

export var makeSimpleBlock: any = function makeSimpleBlock(logicalDate, startMs, endMs, type, label, energy, priority) {
  const block = makeDetailedBlock({ logicalDate, start: new Date(startMs), end: new Date(endMs), type, task: label, phase: energy, priority, energy, locked: type === 'fixed' });
  block.label = label;
  block.category = type;
  return block;
}

minutesFromLogicalStart = function minutesFromLogicalStart(logicalDate, date) {
  const start = combineDateAndTime(logicalDate, detailedState.setup?.startTime || '09:00');
  return Math.round((date - start) / 60000) + timeToMinutesSafe(detailedState.setup?.startTime || '09:00');
}

export var logicalMinutesForDate: any = function logicalMinutesForDate(logicalDate, date) {
  return minutesFromLogicalStart(logicalDate, date);
}

timeToMinutesFromDate = function timeToMinutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes();
}

blockDateFromTime = function blockDateFromTime(logicalDate, time, forceNextDay) {
  const date = combineDateAndTime(logicalDate, time || '00:00');
  const dayStart = timeToMinutesSafe(detailedState.setup?.startTime || '09:00');
  const dayEnd = timeToMinutesSafe(detailedState.setup?.endTime || '21:00');
  if (forceNextDay || (dayEnd <= dayStart && timeToMinutesSafe(time || '00:00') < dayStart)) date.setDate(date.getDate() + 1);
  return date;
}

blockInsideLogicalDay = function blockInsideLogicalDay(day, block) {
  const start = new Date(block.actualStartISO || blockDateFromTime(day.date, block.startTime, false)).getTime();
  const end = new Date(block.actualEndISO || blockDateFromTime(day.date, block.endTime, timeToMinutesSafe(block.endTime) <= timeToMinutesSafe(block.startTime))).getTime();
  const logical = day.logicalStartMs ? day : buildLogicalDay(day.date);
  return start >= logical.logicalStartMs && end <= logical.logicalEndMs && end > start;
}

export var isDueReminderBlock: any = function isDueReminderBlock(block = {}) {
  if (block.type === 'due-note') return true;
  const text = [block.title, block.task, block.label, block.phase, block.type, block.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return ['due today', 'due soon', 'exam today', 'submission today', 'reminder', 'all set', 'make sure you', 'coming up soon']
    .some(phrase => text.includes(phrase));
}

cleanDetailedDayBlocks = function cleanDetailedDayBlocks(day) {
  const logical = day.logicalStartMs ? day : buildLogicalDay(day.date);
  day.logicalStartMs = logical.logicalStartMs;
  day.logicalEndMs = logical.logicalEndMs;
  day.dayStartTimestamp = logical.dayStartTimestamp;
  day.dayEndTimestamp = logical.dayEndTimestamp;
  day.fixedBlocks = day.fixedBlocks?.length ? day.fixedBlocks : logical.fixedBlocks;
  day.blocks = (day.blocks || [])
    .map(block => normalizeDetailedBlockForValidation(block, day.date))
    .filter(block => !isDueReminderBlock(block) && blockInsideLogicalDay(day, block))
    .sort(compareDetailedBlocksByStart);
  day.blocks = removeInvalidDetailedOverlaps(day.blocks);
  while (day.blocks[0] && ['break', 'buffer', 'rest'].includes(day.blocks[0].type)) day.blocks.shift();
  day.blocks.forEach(block => {
    block.logicalDate = block.logicalDate || day.date;
    block.date = day.date;
    block.displayDate = block.displayDate || block.logicalDate;
    block.blockNote = block.blockNote || block.note || '';
    block.locked = block.type === 'fixed' ? true : !!block.locked;
  });
  day.generatedBlocks = day.blocks.filter(block => block.type !== 'fixed');
}

compareDetailedBlocksByStart = function compareDetailedBlocksByStart(a, b) {
  const aStart = a.actualStartISO ? new Date(a.actualStartISO).getTime() : Number.isFinite(a.startMinute) ? a.startMinute : timeToMinutesSafe(a.startTime);
  const bStart = b.actualStartISO ? new Date(b.actualStartISO).getTime() : Number.isFinite(b.startMinute) ? b.startMinute : timeToMinutesSafe(b.startTime);
  return aStart - bStart;
}

normalizeDetailedBlockForValidation = function normalizeDetailedBlockForValidation(block, logicalDate) {
  const start = block.actualStartISO ? new Date(block.actualStartISO) : blockDateFromTime(logicalDate, block.startTime, false);
  let end = block.actualEndISO ? new Date(block.actualEndISO) : blockDateFromTime(logicalDate, block.endTime, timeToMinutesSafe(block.endTime) <= timeToMinutesSafe(block.startTime));
  if (end <= start) end = addMinutes(end, 1440);
  const visiblePriority = block.displayPriorityLevel || block.priorityLevel || block.priority || (block.type === 'break' ? 'Break' : block.type === 'buffer' ? 'Buffer' : 'Low');
  return { ...block, date: logicalDate, logicalDate, actualStartISO: start.toISOString(), actualEndISO: end.toISOString(), startMs: start.getTime(), endMs: end.getTime(), displayDate: block.displayDate || formatLocalDate(start), startMinute: minutesFromLogicalStart(logicalDate, start), endMinute: minutesFromLogicalStart(logicalDate, end), startTime: block.startTime || minutesToTime(timeToMinutesFromDate(start)), endTime: block.endTime || minutesToTime(timeToMinutesFromDate(end)), category: block.category || block.type, blockNote: block.blockNote || block.note || '', priority: visiblePriority, priorityLevel: visiblePriority, displayPriorityLevel: ['High', 'Medium', 'Low'].includes(visiblePriority) ? visiblePriority : block.displayPriorityLevel, locked: block.type === 'fixed' ? true : !!block.locked };
}

removeInvalidDetailedOverlaps = function removeInvalidDetailedOverlaps(blocks) {
  const accepted = [];
  (blocks || []).sort(compareDetailedBlocksByStart).forEach(block => {
    const overlaps = accepted.some(existing => rangesOverlap(existing, block));
    if (!overlaps) {
      accepted.push(block);
      return;
    }
    if (block.type === 'fixed') {
      for (let index = accepted.length - 1; index >= 0; index -= 1) {
        if (accepted[index].type !== 'fixed' && rangesOverlap(accepted[index], block)) accepted.splice(index, 1);
      }
      accepted.push(block);
    }
  });
  return accepted.sort(compareDetailedBlocksByStart);
}

validateGeneratedDetailedPlan = function validateGeneratedDetailedPlan() {
  if (!detailedState.generatedPlan?.days?.length) return;
  const setup = detailedState.generatedPlan.setup || detailedState.setup;
  detailedState.generatedPlan.days = buildDateRange(setup.startDate, setup.endDate).map(date => {
    const existing = detailedState.generatedPlan.days.find(day => day.date === date) || buildLogicalDay(date);
    existing.label = existing.label || dayLabel(date);
    cleanDetailedDayBlocks(existing);
    return existing;
  });
  detailedState.generatedPlan.validationReport = validateDetailedPlan(detailedState.generatedPlan);
}

rangesOverlap = function rangesOverlap(a, b) {
  if (a.actualStartISO && a.actualEndISO && b.actualStartISO && b.actualEndISO) return new Date(a.actualStartISO) < new Date(b.actualEndISO) && new Date(b.actualStartISO) < new Date(a.actualEndISO);
  const aStart = Number.isFinite(a.startMinute) ? a.startMinute : timeToMinutesSafe(a.startTime);
  const aEnd = Number.isFinite(a.endMinute) ? a.endMinute : normalizedEndMinutes(a.startTime, a.endTime);
  const bStart = Number.isFinite(b.startMinute) ? b.startMinute : timeToMinutesSafe(b.startTime);
  const bEnd = Number.isFinite(b.endMinute) ? b.endMinute : normalizedEndMinutes(b.startTime, b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

hasOverlap = function hasOverlap(blocks, candidate) {
  return (blocks || []).some(block => rangesOverlap(block, candidate));
}

freeWindowsForDay = function freeWindowsForDay(day) {
  const source = day.freeSlots?.length ? day.freeSlots : buildAvailableSlots(day.logicalStartMs ? day : buildLogicalDay(day.date));
  return source.map(slot => ({ start: minutesFromLogicalStart(day.date, new Date(slot.startMs)), end: minutesFromLogicalStart(day.date, new Date(slot.endMs)) }));
}

splitDetailedDuration = function splitDetailedDuration(duration, max) {
  const safeMax = Math.max(20, max || 50);
  if (duration <= safeMax) return [duration];
  const chunks = [];
  let remaining = duration;
  while (remaining >= safeMax) {
    chunks.push(safeMax);
    remaining -= safeMax;
  }
  if (remaining > 0) chunks.push(Math.max(20, remaining));
  return chunks.length ? chunks : [Math.min(duration, safeMax)];
}

export var preferredSessionDuration: any = function preferredSessionDuration(phase, task, config) {
  if (phase.energy === 'Light') return config.lightDuration;
  if (phase.energy === 'Medium') return config.mediumDuration;
  if (config.selectedDuration === 90 && (['Project', 'Assignment'].includes(task.selectedType) || task.difficulty >= 7)) return 90;
  return config.heavyDuration;
}

export var energyWeight: any = function energyWeight(energy) {
  return { Heavy: 1.45, Medium: 1, Light: 0.65 }[energy] || 1;
}

energyRank = function energyRank(energy) {
  if (detailedState.preferences?.intensity === 'Light') return { Light: 0, Medium: 1, Heavy: 2 }[energy] ?? 3;
  return { Heavy: 0, Medium: 1, Light: 2 }[energy] ?? 3;
}

export var focusWindowForDay: any = function focusWindowForDay(day) {
  const pref = detailedState.preferences?.bestFocus || 'Morning';
  const startLabel = pref === 'Afternoon' ? '12:00' : pref === 'Night' ? '21:00' : detailedState.setup?.startTime || '09:00';
  const endLabel = pref === 'Afternoon' ? '18:00' : pref === 'Night' ? '00:00' : '12:00';
  let start = blockDateFromTime(day.date, startLabel, false);
  let end = blockDateFromTime(day.date, endLabel, pref === 'Night');
  if (end <= start) end = addMinutes(end, 1440);
  const startMs = Math.max(day.logicalStartMs, start.getTime());
  const endMs = Math.min(day.logicalEndMs, end.getTime());
  return { startMs, endMs: Math.max(startMs, endMs), midMs: startMs + Math.max(0, endMs - startMs) / 2 };
}

export var focusScore: any = function focusScore(energy, logicalMinutes, day) {
  const pref = detailedState.preferences?.bestFocus || 'Morning';
  const minute = ((logicalMinutes % 1440) + 1440) % 1440;
  if (energy === 'Light') {
    if (pref === 'Morning') return minute < 720 ? 8 : 16;
    if (pref === 'Afternoon') return minute >= 720 && minute < 1080 ? 8 : 16;
    return minute >= 1200 || minute < 180 ? 8 : 16;
  }
  if (pref === 'Morning') return minute < 720 ? 34 : minute < 1080 ? 16 : 8;
  if (pref === 'Afternoon') return minute >= 720 && minute < 1080 ? 34 : minute >= 1080 ? 16 : 12;
  if (day && day.logicalEndMs - day.logicalStartMs > 0 && timeToMinutesSafe(detailedState.setup?.startTime || '09:00') >= 1080) return minute >= 1260 || minute < 60 ? 34 : minute < 210 ? 22 : 12;
  return minute >= 1200 || minute < 180 ? 34 : minute >= 1080 ? 22 : 8;
}

export var energyPlacementScore: any = function energyPlacementScore(energy, day, startMs, slot) {
  const focus = focusWindowForDay(day);
  const insideFocus = startMs >= focus.startMs && startMs < focus.endMs;
  const distanceMinutes = Math.abs(startMs - focus.midMs) / 60000;
  const nearFocus = distanceMinutes <= 180;
  if (energy === 'Heavy') return insideFocus ? 55 : nearFocus ? 28 : -8;
  if (energy === 'Medium') return insideFocus ? 24 : nearFocus ? 18 : 6;
  if (energy === 'Light') return insideFocus ? -4 : 14;
  return 0;
}

export var targetDateForPhase: any = function targetDateForPhase(usableDates, phase, index, total) {
  if (!usableDates.length) return localToday();
  if (/final|submission|recall|check/i.test(phase.name)) return usableDates.at(-1);
  if (usableDates.length === 1) return usableDates[0];
  return usableDates[Math.min(usableDates.length - 1, Math.round((index / Math.max(1, total - 1)) * (usableDates.length - 1)))];
}

export var labelForTaskPhase: any = function labelForTaskPhase(task, phase, part = 0) {
  const label = `${task.taskName} - ${phase}`;
  return part ? `${label} (${part})` : label;
}

export var studyMethodForUnit: any = function studyMethodForUnit(phase, task) {
  const intensity = detailedState.preferences?.intensity || 'Balanced';
  const phaseName = normalizeText(phase?.name || '');
  if (/final|recall|review|mistake|test/.test(phaseName)) return 'Active Recall';
  if (intensity === 'Light') return 'Kaizen / Spaced Repetition';
  if (intensity === 'Intense') return 'Deep Work / Gongbu';
  if (task?.selectedType === 'Project') return 'Pomodoro / Milestones';
  return 'Pomodoro / Interleaving';
}

export var methodNote: any = function methodNote(methods = []) {
  const shown = methods.filter(method => !['Timeboxing', 'Task Breakdown'].includes(method)).slice(0, 2);
  return shown.join(' + ');
}

export var gapAfterBlock: any = function gapAfterBlock(day, block, blocks) {
  const end = new Date(block.actualEndISO).getTime();
  const next = (blocks || []).filter(item => item.id !== block.id && new Date(item.actualStartISO).getTime() >= end).sort(compareDetailedBlocksByStart)[0];
  const endMs = next ? new Date(next.actualStartISO).getTime() : day.logicalEndMs;
  const candidate = { actualStartISO: new Date(end).toISOString(), actualEndISO: new Date(endMs).toISOString(), startMinute: minutesFromLogicalStart(day.date, new Date(end)), endMinute: minutesFromLogicalStart(day.date, new Date(endMs)) };
  if ((day.fixedBlocks || []).some(fixed => rangesOverlap(fixed, candidate))) return null;
  return endMs > end ? { startMs: end, endMs, minutes: Math.floor((endMs - end) / 60000) } : null;
}

shouldAddBreak = function shouldAddBreak(energy) {
  const pref = detailedState.preferences?.breakPreference || 'Normal';
  if (pref === 'Frequent') return ['Heavy', 'Medium', 'Light'].includes(energy);
  if (pref === 'Minimal') return energy === 'Heavy';
  return ['Heavy', 'Medium'].includes(energy);
}

export var titleCase: any = function titleCase(value) {
  return normalizeText(value).replace(/\b\w/g, char => char.toUpperCase());
}

export var reviewSummaryCards: any = function reviewSummaryCards(items) {
  const icons = {
    Scope: '◎',
    'Date Range': '▣',
    'Daily Time': '◷',
    Intensity: '▥',
    'Best Focus': '☾',
    Breaks: '☕',
    'Total Tasks': '✓',
    'High Priority': '↑',
    'Medium Priority': '−',
    'Low Priority': '↓',
    'Fixed Events': '▣'
  };
  return items.map(([label, value]) => `
    <article class="review-stat-card">
      <span class="review-stat-icon">${icons[label] || '•'}</span>
      <div><span>${escapeHTML(label)}</span><strong>${escapeHTML(String(value))}</strong></div>
    </article>
  `).join('');
}

export var renderReviewMethodChips: any = function renderReviewMethodChips(methods = []) {
  const icons = {
    Timeboxing: '◷',
    'Task Breakdown': '☷',
    'Spaced Practice': '✣',
    'Active Recall': '↻',
    'Practice Testing': '▤',
    'Final Recall': '▱',
    'Worked Examples': '▥',
    'Mistake Review': '△',
    'Deep Focus': '◎'
  };
  const shown = methods.length ? methods : ['Timeboxing', 'Task Breakdown'];
  return `<div class="review-method-chip-grid">${shown.map(method => `<span><i>${icons[method] || '✦'}</i>${escapeHTML(method)}</span>`).join('')}</div>`;
}

export var buildWeekTimeRows: any = function buildWeekTimeRows() {
  const start = timeToMinutes(detailedState.setup?.startTime || '09:00');
  let end = timeToMinutes(detailedState.setup?.endTime || '21:00');
  if (end <= start) end += 1440;
  const rows = [];
  for (let cursor = start; cursor <= end; cursor += 120) rows.push(displayTime(minutesToTime(cursor)));
  return rows;
}

export var swapDetailedBlocks: any = function swapDetailedBlocks(fromId, toId) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  if (!day) return;
  const from = day.blocks.findIndex(block => block.id === fromId);
  const to = day.blocks.findIndex(block => block.id === toId);
  if (from < 0 || to < 0 || day.blocks[from].locked || day.blocks[to].locked) return;
  const [moved] = day.blocks.splice(from, 1);
  day.blocks.splice(to, 0, moved);
  saveGeneratedDetailedPlan();
  renderDetailedEdit();
}

export var lockDetailedPlan: any = function lockDetailedPlan() {
  const today = localToday();
  detailedState.lockedDates[today] = true;
  detailedState.selectedDate = getActiveDetailedTrackDate() || today;
  clearDetailedNavigationState();
  localStorage.setItem(detailedKeys.lockedDates, JSON.stringify(detailedState.lockedDates));
  if (canTrackDetailedDate(detailedState.selectedDate)) saveDetailedProgress(detailedState.selectedDate);
  saveGeneratedDetailedPlan();
  navigateDetailed('track');
}

export var getSelectedDetailedDay: any = function getSelectedDetailedDay() {
  return detailedState.generatedPlan?.days.find(day => day.date === detailedState.selectedDate) || detailedState.generatedPlan?.days[0];
}

export var getDetailedTodayDate: any = function getDetailedTodayDate() {
  return localToday();
}

export var getDetailedDayByDate: any = function getDetailedDayByDate(date) {
  return detailedState.generatedPlan?.days?.find(day => day.date === date) || null;
}

export var getDetailedPlanDates: any = function getDetailedPlanDates() {
  return (detailedState.generatedPlan?.days || []).map(day => day.date);
}

export var getFirstDetailedPlanDate: any = function getFirstDetailedPlanDate() {
  return getDetailedPlanDates()[0] || null;
}

export var getLastDetailedPlanDate: any = function getLastDetailedPlanDate() {
  const dates = getDetailedPlanDates();
  return dates[dates.length - 1] || null;
}

export var isDateInsideDetailedPlan: any = function isDateInsideDetailedPlan(date) {
  return !!getDetailedDayByDate(date);
}

export var getNextDetailedPlanDate: any = function getNextDetailedPlanDate(date) {
  return getDetailedPlanDates().filter(dayDate => dayDate > date).sort()[0] || null;
}

export var isDetailedDateCompleted: any = function isDetailedDateCompleted(date) {
  return !!detailedState.feedback?.[date];
}

export var areAllDetailedPlanDaysCompleted: any = function areAllDetailedPlanDaysCompleted() {
  const dates = getDetailedPlanDates();
  return dates.length > 0 && dates.every(date => isDetailedDateCompleted(date));
}

export var getFirstUnfinishedDetailedDate: any = function getFirstUnfinishedDetailedDate() {
  return getDetailedPlanDates().find(date => !isDetailedDateCompleted(date)) || null;
}

export var getActiveDetailedTrackDate: any = function getActiveDetailedTrackDate() {
  const today = localToday();
  const dates = getDetailedPlanDates();
  if (!dates.length) return null;
  if (isDateInsideDetailedPlan(today)) {
    if (!isDetailedDateCompleted(today)) return today;
    const next = getNextDetailedPlanDate(today);
    if (next) return next;
    return null;
  }
  const first = getFirstDetailedPlanDate();
  const last = getLastDetailedPlanDate();
  if (today < first) return first;
  if (today > last) return getFirstUnfinishedDetailedDate();
  return getFirstUnfinishedDetailedDate();
}

export var canTrackDetailedDate: any = function canTrackDetailedDate(date) {
  const today = localToday();
  return isDetailedPlanLocked() && isDateInsideDetailedPlan(date) && date === today && !isDetailedDateCompleted(date);
}

export var canPreviewDetailedDate: any = function canPreviewDetailedDate(date) {
  return isDateInsideDetailedPlan(date) && !canTrackDetailedDate(date);
}

export var getCurrentDetailedFeedbackDate: any = function getCurrentDetailedFeedbackDate() {
  const today = getDetailedTodayDate();
  if (detailedState.feedbackDate && isDetailedDateCompleted(detailedState.feedbackDate)) return detailedState.feedbackDate;
  if (detailedState.selectedDate && isDetailedDateCompleted(detailedState.selectedDate)) return detailedState.selectedDate;
  if (isDetailedDateCompleted(today)) return today;
  return detailedState.selectedDate || today;
}

export var getTodayDetailedDay: any = function getTodayDetailedDay() {
  const today = localToday();
  return detailedState.generatedPlan?.days.find(item => item.date === today) || detailedState.generatedPlan?.days[0];
}

export function getTodayDetailedBlocks(date = getActiveDetailedTrackDate() || localToday()) {
  const day = getDetailedDayByDate(date) || getTodayDetailedDay();
  applyDetailedProgressToDay(day);
  return day?.blocks || [];
}

export var blockClass: any = function blockClass(block) {
  if (block.type === 'fixed' || block.priorityLevel === 'Fixed') return 'fixed';
  if (block.type === 'break' || block.type === 'Break') return 'break';
  if (block.type === 'buffer' || block.type === 'Buffer') return 'buffer';
  if (block.type === 'warning') return 'warning';
  return (block.priorityLevel || 'Low').toLowerCase();
}

export var displayDetailedType: any = function displayDetailedType(block) {
  if (block.type === 'study') return block.energy || 'Study';
  if (block.type === 'fixed') return 'Fixed';
  if (block.type === 'break') return 'Break';
  if (block.type === 'buffer') return 'Buffer';
  if (block.type === 'warning') return 'Note';
  return block.type || block.energy || 'Study';
}

export var updateDetailedBlockLabel: any = function updateDetailedBlockLabel(input) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  const block = day?.blocks.find(item => item.id === input.dataset.editLabel);
  if (!block || block.locked) return;
  const label = input.value.trim();
  if (!label) {
    input.value = block.label;
    return;
  }
  block.label = label;
  block.task = label;
  saveGeneratedDetailedPlan();
}

export var updateDetailedBlockNote: any = function updateDetailedBlockNote(input) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  const block = day?.blocks.find(item => item.id === input.dataset.editNote);
  if (!block || block.locked) return;
  block.blockNote = input.value.trim();
  block.note = block.blockNote;
  saveGeneratedDetailedPlan();
}

export var updateDetailedBlockType: any = function updateDetailedBlockType(select) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  const block = day?.blocks.find(item => item.id === select.dataset.editType);
  if (!block || block.locked) return;
  const original = { type: block.type, energy: block.energy, phase: block.phase, priorityLevel: block.priorityLevel, priority: block.priority };
  const type = select.value;
  block.type = type === 'Break' ? 'break' : type === 'Buffer' ? 'buffer' : 'study';
  block.energy = type;
  block.phase = type;
  block.priorityLevel = type === 'Break' ? 'Break' : type === 'Buffer' ? 'Buffer' : (['High', 'Medium', 'Low'].includes(block.priorityLevel) ? block.priorityLevel : 'Low');
  block.priority = block.priorityLevel;
  block.displayPriorityLevel = ['High', 'Medium', 'Low'].includes(block.priorityLevel) ? block.priorityLevel : undefined;
  if (block.type === 'break' && !isBreakValidPosition(day, block)) {
    Object.assign(block, original);
    document.getElementById('editWarning').textContent = 'Breaks should only be between study blocks.';
    renderDetailedEdit();
    return;
  }
  saveGeneratedDetailedPlan();
  renderDetailedEdit();
}

export var updateDetailedBlockPriority: any = function updateDetailedBlockPriority(select) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  const block = day?.blocks.find(item => item.id === select.dataset.editPriority);
  if (!block || block.locked || block.type === 'break' || block.type === 'buffer') return;
  block.priority = select.value;
  block.priorityLevel = select.value;
  block.displayPriorityLevel = select.value;
  saveGeneratedDetailedPlan();
}

export var isBreakValidPosition: any = function isBreakValidPosition(day, block) {
  const blocks = [...(day.blocks || [])].sort(compareDetailedBlocksByStart);
  const index = blocks.findIndex(item => item.id === block.id);
  if (index <= 0 || index >= blocks.length - 1) return false;
  return blocks[index - 1]?.type === 'study' && blocks[index + 1]?.type === 'study';
}

export var updateDetailedBlockTime: any = function updateDetailedBlockTime(input) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  const id = input.dataset.editStart || input.dataset.editEnd;
  const block = day?.blocks.find(item => item.id === id);
  if (!block || block.locked) return;
  const original = { startTime: block.startTime, endTime: block.endTime, actualStartISO: block.actualStartISO, actualEndISO: block.actualEndISO, startMinute: block.startMinute, endMinute: block.endMinute };
  if (input.dataset.editStart) block.startTime = input.value;
  if (input.dataset.editEnd) block.endTime = input.value;
  const start = blockDateFromTime(day.date, block.startTime, false);
  const end = blockDateFromTime(day.date, block.endTime, timeToMinutes(block.endTime) <= timeToMinutes(block.startTime));
  block.actualStartISO = start.toISOString();
  block.actualEndISO = end.toISOString();
  block.startMinute = minutesFromLogicalStart(day.date, start);
  block.endMinute = minutesFromLogicalStart(day.date, end);
  const minutes = blockMinutes(block);
  const max = timeMatrix(detailedState.preferences.intensity).max;
  const invalidBreak = block.type === 'break' && !isBreakValidPosition(day, block);
  const invalid = minutes < 15 || (block.type === 'study' && minutes > max) || !blockInsideLogicalDay(day, block) || hasOverlap(day.blocks.filter(item => item.id !== block.id), block) || invalidBreak;
  document.getElementById('editWarning').textContent = invalidBreak ? 'Breaks should only be between study blocks.' : invalid ? 'Keep blocks within limits and away from overlaps.' : '';
  if (invalid) {
    Object.assign(block, original);
  }
  saveGeneratedDetailedPlan();
  renderDetailedEdit();
}

export var addCustomDetailedBlock: any = function addCustomDetailedBlock() {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  if (!day) return;
  const label = document.getElementById('customBlockTitle')?.value.trim() || 'Custom Block';
  const startTime = document.getElementById('customBlockStart')?.value;
  const endTime = document.getElementById('customBlockEnd')?.value;
  const type = document.getElementById('customBlockType')?.value || 'Light';
  const normalizedType = type === 'Break' ? 'break' : type === 'Buffer' ? 'buffer' : 'study';
  const block = {
    id: uniqueId(),
    date: day.date,
    label,
    task: label,
    phase: type,
    startTime,
    endTime,
    actualStartISO: startTime ? blockDateFromTime(day.date, startTime, false).toISOString() : '',
    actualEndISO: startTime && endTime ? blockDateFromTime(day.date, endTime, timeToMinutes(endTime) <= timeToMinutes(startTime)).toISOString() : '',
    startMinute: startTime ? minutesFromLogicalStart(day.date, blockDateFromTime(day.date, startTime, false)) : 0,
    endMinute: startTime && endTime ? minutesFromLogicalStart(day.date, blockDateFromTime(day.date, endTime, timeToMinutes(endTime) <= timeToMinutes(startTime))) : 0,
    type: normalizedType,
    energy: normalizedType === 'study' ? type : type,
    priority: normalizedType === 'break' ? 'Break' : normalizedType === 'buffer' ? 'Buffer' : 'Low',
    priorityLevel: normalizedType === 'break' ? 'Break' : normalizedType === 'buffer' ? 'Buffer' : 'Low',
    displayPriorityLevel: normalizedType === 'study' ? 'Low' : undefined,
    locked: false,
    completed: false,
    blockNote: ''
  };
  const invalidBreak = block.type === 'break' && !isBreakValidPosition({ ...day, blocks: [...day.blocks, block] }, block);
  if (!startTime || !endTime || blockMinutes(block) < 15 || !blockInsideLogicalDay(day, block) || hasOverlap(day.blocks, block) || invalidBreak) {
    document.getElementById('editWarning').textContent = invalidBreak ? 'Breaks should only be between study blocks.' : 'Choose a valid non-overlapping time block.';
    return;
  }
  day.blocks.push(block);
  day.blocks.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  cleanDetailedDayBlocks(day);
  saveGeneratedDetailedPlan();
  renderDetailedEdit();
}

export var removeDetailedBlock: any = function removeDetailedBlock(id) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  const block = day?.blocks.find(item => item.id === id);
  if (!day || !block || block.locked) return;
  day.blocks = day.blocks.filter(item => item.id !== id);
  cleanDetailedDayBlocks(day);
  saveGeneratedDetailedPlan();
  renderDetailedEdit();
}

export var moveDetailedBlock: any = function moveDetailedBlock(id, direction) {
  if (isDetailedPlanLocked()) return;
  const day = getSelectedDetailedDay();
  if (!day) return;
  const index = day.blocks.findIndex(block => block.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= day.blocks.length || day.blocks[index].locked || day.blocks[next].locked) return;
  const moved = day.blocks[index];
  day.blocks[index] = day.blocks[next];
  day.blocks[next] = moved;
  saveGeneratedDetailedPlan();
  renderDetailedEdit();
}

export var saveDetailedEdit: any = function saveDetailedEdit() {
  if (isDetailedPlanLocked()) {
    navigateDetailed('track');
    return;
  }
  saveGeneratedDetailedPlan();
  navigateDetailed(detailedState.lastTimetableStep || 'day');
}

export var handleViewTomorrowPlan: any = function handleViewTomorrowPlan() {
  const previousFeedbackDate = getCurrentDetailedFeedbackDate();
  loadDetailedPlannerState();
  detailedState.feedbackDate = previousFeedbackDate;
  const baseDate = getCurrentDetailedFeedbackDate() || getDetailedTodayDate() || detailedState.selectedDate;
  const nextDate = getNextDetailedPlanDate(baseDate);
  if (nextDate) {
    showDetailedPreviewDate(nextDate, 'feedback');
    return;
  }
  showDetailToast('No next plan day found.');
}

export var showDetailedPreviewDate: any = function showDetailedPreviewDate(date, returnStep = detailedState.currentStep) {
  if (!isDateInsideDetailedPlan(date)) {
    showDetailToast('No next plan day found.');
    return;
  }
  detailedState.previewDate = date;
  detailedState.previewReturnStep = returnStep || null;
  detailedState.selectedDate = date;
  detailedState.currentStep = 'track';
  renderDetailedTrack(date);
  showPage(detailedStepPages.track);
  try {
    history.pushState({ detailedStep: 'track', previewDate: date }, '', '');
  } catch (error) {
    console.warn('Could not push detailed preview state', error);
  }
}

export var endDetailedDay: any = function endDetailedDay() {
  const date = detailedState.selectedDate || getActiveDetailedTrackDate();
  if (!canTrackDetailedDate(date)) {
    showDetailToast('This plan is preview-only until that day starts.');
    renderDetailedTrack(date);
    return;
  }
  const day = getDetailedDayByDate(date);
  applyDetailedProgressToDay(day);
  const blocks = day?.blocks || [];
  const studyBlocks = blocks.filter(block => block.type === 'study' || ['Heavy', 'Medium', 'Light'].includes(block.type));
  if ((studyBlocks.length ? studyBlocks : blocks).every(block => block.completed)) {
    showDetailedFeedback(true);
    return;
  }
  const end = new Date();
  const last = [...blocks].sort((a, b) => timeToMinutes(b.endTime) - timeToMinutes(a.endTime))[0];
  if (last) {
    const [h, m] = last.endTime.split(':').map(Number);
    end.setHours(h, m, 0, 0);
  }
  if (new Date() > end) {
    showDetailedFeedback(false);
    return;
  }
  document.getElementById('detailedEndModal')?.classList.add('active');
}

export var showDetailedFeedback: any = function showDetailedFeedback(complete) {
  const date = getCurrentDetailedFeedbackDate();
  detailedState.feedbackDate = date;
  detailedState.selectedDate = date || detailedState.selectedDate;
  if (!canTrackDetailedDate(date)) {
    showDetailToast('This plan is preview-only until that day starts.');
    renderDetailedTrack(date);
    return;
  }
  const day = getDetailedDayByDate(date);
  if (!day) return;
  applyDetailedProgressToDay(day);
  const blocks = day.blocks || [];
  const completed = blocks.filter(block => block.completed).length;
  const percent = blocks.length ? Math.round((completed / blocks.length) * 100) : 0;
  const focus = blocks.filter(block => block.completed && (block.type === 'study' || ['Heavy', 'Medium', 'Light'].includes(block.type))).reduce((sum, block) => sum + blockMinutes(block), 0);
  const breaks = blocks.filter(block => block.completed && (block.type === 'break' || block.type === 'Break')).reduce((sum, block) => sum + blockMinutes(block), 0);
  if (!complete) moveUnfinishedDetailedWork(date);
  detailedState.feedbackDate = date;
  detailedState.previewDate = null;
  detailedState.previewReturnStep = null;
  detailedState.feedback[date] = { complete, percent, completed, total: blocks.length, focus, breaks, date };
  localStorage.setItem(detailedKeys.feedback, JSON.stringify(detailedState.feedback));
  navigateDetailed('feedback');
}

export function moveUnfinishedDetailedWork(date = detailedState.selectedDate || localToday()) {
  const today = getDetailedDayByDate(date);
  const nextDate = getNextDetailedPlanDate(today?.date || date);
  const next = nextDate ? getDetailedDayByDate(nextDate) : null;
  if (!today || !next) return;
  today.blocks.filter(block => !block.completed && !block.locked && (block.type === 'study' || ['Heavy', 'Medium', 'Light'].includes(block.type))).slice(0, 3).forEach(block => {
    const clone = { ...block, id: uniqueId(), date: next.date, completed: false, duration: Math.max(15, Math.round(blockMinutes(block) * 0.9)) };
    placeBlockInDay(next, clone);
  });
  saveGeneratedDetailedPlan();
}

export var showDetailToast: any = function showDetailToast(text) {
  const toast = document.getElementById('detailToast');
  const card = toast?.querySelector('.tiny-toast');
  if (card) card.textContent = text;
  toast?.classList.add('active');
  setTimeout(() => toast?.classList.remove('active'), 1200);
}

