// CalmCampus local user store. All data scoped to the current user.
import {
  installScopedStorage,
  migrateLegacyKeysForCurrentUser,
  markMigratedForCurrentUser,
} from "./userScopedStorage";

// Install transparent per-user scoping for legacy localStorage keys as soon
// as this module is loaded in the browser. Safe no-op during SSR.
if (typeof window !== "undefined") installScopedStorage();

export { scopedKey } from "./userScopedStorage";

export interface UserProfile {
  username: string;
  createdAt: string;
  lastLogin: string;
}

export interface Settings { sound: boolean; softMode: boolean; }

export interface ChatMessage { role: "user" | "bot"; text: string; ts: number; }

export interface SingleBlock {
  id: string;
  category: "study" | "break";
  type: "Deep" | "Medium" | "Light" | "Break";
  task: string;
  label: string;
  startTime: string;
  endTime: string;
  completed: boolean;
}

export interface SinglePlan {
  date: string;
  activity: "Study" | "Assignment" | "Mixed";
  intensity: "Easy" | "Normal" | "Push";
  startTime: string;
  blocks: SingleBlock[];
  locked: boolean;
  finished: boolean;
}

export interface SinglePlannerState { plans: Record<string, SinglePlan>; }

export interface DetailedSetup {
  scope: "Today Only" | "Multiple Days";
  startDate: string;
  endDate: string;
  dailyStart: string;
  dailyEnd: string;
}
export interface FixedBlock { id: string; name: string; date: string; start: string; end: string; category?: string; }
export interface DetailedTask {
  id: string; name: string; due: string; duration: number;
  difficulty: number; preparedness: number; category: string;
}
export interface DetailedPreferences {
  sessionLength: number; breakStyle: "short" | "long" | "pomodoro";
  focus: "morning" | "afternoon" | "evening" | "any";
  order: "easiest-first" | "hardest-first";
  energy: "low" | "medium" | "high";
  method: "active-recall" | "spaced" | "interleaving" | "pomodoro";
}
export interface GeneratedDayBlock {
  id: string; date: string; start: string; end: string;
  label: string; type: "study" | "break" | "fixed";
  priority?: "High" | "Medium" | "Low";
  completed?: boolean;
}
export interface DetailedPlan {
  setup: DetailedSetup | null;
  fixedBlocks: FixedBlock[];
  tasks: DetailedTask[];
  preferences: DetailedPreferences | null;
  generated: { days: { date: string; blocks: GeneratedDayBlock[] }[]; warnings: string[]; methods?: string[] } | null;
  lockedDates: Record<string, boolean>;
  progress: Record<string, Record<string, boolean>>;
  feedback: Record<string, string>;
  draft?: boolean;
}

export interface QuickToolsDay { breathe?: boolean; ground?: boolean; motivate?: boolean; }

export interface UserData {
  tasks: { id: string; name: string; days: number; difficulty: number; preparedness: number }[];
  singlePlanner: SinglePlannerState;
  detailedPlanner: DetailedPlan;
  chatHistory: ChatMessage[];
  quickToolsProgress: Record<string, QuickToolsDay>;
  settings: Settings;
  streak: number;
  lastActivityDate: string;
}

export interface UserRecord {
  password: string;
  profile: UserProfile;
  data: UserData;
}

const USERS_KEY = "calmCampusUsers";
const CURRENT_KEY = "calmCampusCurrentUser";

const isBrowser = () => typeof window !== "undefined";

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export function freshData(): UserData {
  return {
    tasks: [],
    singlePlanner: { plans: {} },
    detailedPlanner: {
      setup: null, fixedBlocks: [], tasks: [], preferences: null,
      generated: null, lockedDates: {}, progress: {}, feedback: {},
    },
    chatHistory: [],
    quickToolsProgress: {},
    settings: { sound: false, softMode: false },
    streak: 0,
    lastActivityDate: "",
  };
}

export function getUsers(): Record<string, UserRecord> {
  if (!isBrowser()) return {};
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}"); } catch { return {}; }
}
export function saveUsers(u: Record<string, UserRecord>) {
  if (!isBrowser()) return;
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}
export function getCurrentUsername(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(CURRENT_KEY);
}
export function getCurrentUser(): UserRecord | null {
  const n = getCurrentUsername(); if (!n) return null;
  return getUsers()[n] || null;
}
export function getCurrentUserData(): UserData | null {
  return getCurrentUser()?.data || null;
}
export function updateCurrentUserData(updater: (d: UserData) => UserData | void) {
  const users = getUsers();
  const name = getCurrentUsername(); if (!name || !users[name]) return;
  const next = updater(users[name].data);
  if (next) users[name].data = next; // mutate-in-place also fine
  saveUsers(users);
  window.dispatchEvent(new Event("calmcampus:update"));
}

export function registerUser(username: string, password: string): { ok: boolean; error?: string } {
  username = username.trim();
  if (!username) return { ok: false, error: "Please enter a username" };
  if (!password) return { ok: false, error: "Please enter a password" };
  const users = getUsers();
  if (users[username]) return { ok: false, error: "That username is already taken" };
  users[username] = {
    password,
    profile: { username, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString() },
    data: freshData(),
  };
  saveUsers(users);
  localStorage.setItem(CURRENT_KEY, username);
  // Brand-new account starts fresh — do NOT inherit any pre-existing
  // legacy global planner / chat data left over in this browser.
  markMigratedForCurrentUser();
  return { ok: true };
}
export function loginUser(username: string, password: string): { ok: boolean; error?: string } {
  const users = getUsers();
  if (!users[username]) return { ok: false, error: "We couldn't find that username" };
  if (users[username].password !== password) return { ok: false, error: "That password doesn't match" };
  users[username].profile.lastLogin = new Date().toISOString();
  saveUsers(users);
  localStorage.setItem(CURRENT_KEY, username);
  // One-time copy of pre-fix legacy global keys into this user's scoped
  // namespace (only fills empty scoped slots). Idempotent via flag.
  try { migrateLegacyKeysForCurrentUser(); } catch {}
  return { ok: true };
}
export function logoutUser() { if (isBrowser()) localStorage.removeItem(CURRENT_KEY); }
export function deleteCurrentUser() {
  const users = getUsers();
  const name = getCurrentUsername(); if (!name) return;
  delete users[name]; saveUsers(users); logoutUser();
}

export function bumpStreak() {
  updateCurrentUserData((d) => {
    const today = todayStr();
    if (d.lastActivityDate === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;
    d.streak = d.lastActivityDate === yStr ? d.streak + 1 : 1;
    d.lastActivityDate = today;
  });
}

export function playSound(kind: "click" | "pop" | "chime" | "save") {
  const u = getCurrentUser(); if (!u?.data.settings.sound) return;
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    const freq = kind === "click" ? 520 : kind === "pop" ? 660 : kind === "save" ? 740 : 880;
    o.frequency.value = freq; o.type = "sine";
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.stop(ctx.currentTime + 0.28);
    setTimeout(()=>ctx.close(), 400);
  } catch {}
}
