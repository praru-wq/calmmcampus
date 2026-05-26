/* CalmCampus — User-scoped localStorage layer.

Transparently rewrites a whitelisted set of legacy/global localStorage keys
into per-user scoped keys of the form:
    calmCampus:user:<username>:<baseKey>

This lets legacy planner / talk assistant code keep using its existing
string keys verbatim while still isolating data between accounts on the
same browser. No UI / scheduling / response logic is changed. */

const CURRENT_KEY = "calmCampusCurrentUser";
const SCOPE_PREFIX = "calmCampus:user:";
const MIGRATION_FLAG = "legacyStorageMigrated";

/** Exact base keys that must be scoped per user. */
export const SCOPED_BASE_KEYS = new Set<string>([
  // Single Planner
  "singlePlannerSaved", "singlePlannerLocked", "singlePlannerPlan",
  "singlePlannerProgress", "singlePlannerDate",
  "singlePlannerResult", "singlePlannerResultDate",
  "calmCampusSinglePlan", "calmCampusTimeTracking",
  // Talk Assistant
  "calmCampusTalkAssistantMemory",
]);

/** Any key with one of these prefixes is also scoped (covers detailedPlanner*). */
export const SCOPED_PREFIXES = ["detailedPlanner"];

function currentUsername(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    // Read via raw accessor if installed, else direct.
    const raw = (window as any).__ccRawGetItem as ((k: string) => string | null) | undefined;
    return raw ? raw(CURRENT_KEY) : window.localStorage.getItem(CURRENT_KEY);
  } catch { return null; }
}

function isScopedBase(key: string): boolean {
  if (!key) return false;
  if (key.startsWith(SCOPE_PREFIX)) return false; // already scoped
  if (SCOPED_BASE_KEYS.has(key)) return true;
  return SCOPED_PREFIXES.some(p => key.startsWith(p));
}

/** Return the user-scoped key for the current (or given) user, or the
 *  base key when no user is logged in / no scoping applies. */
export function scopedKey(base: string, username?: string | null): string {
  const u = username ?? currentUsername();
  if (!u) return base;
  if (!isScopedBase(base)) return base;
  return `${SCOPE_PREFIX}${u}:${base}`;
}

let installed = false;
/** Patch Storage.prototype so legacy code transparently uses scoped keys.
 *  Safe to call multiple times. */
export function installScopedStorage() {
  if (installed) return;
  if (typeof window === "undefined" || !window.localStorage) return;
  const proto = Storage.prototype;
  const rawGet = proto.getItem;
  const rawSet = proto.setItem;
  const rawRem = proto.removeItem;

  // Expose raw accessors for migration / safe internal reads.
  (window as any).__ccRawGetItem = (k: string) => rawGet.call(window.localStorage, k);
  (window as any).__ccRawSetItem = (k: string, v: string) => rawSet.call(window.localStorage, k, v);
  (window as any).__ccRawRemoveItem = (k: string) => rawRem.call(window.localStorage, k);

  proto.getItem = function (this: Storage, key: string) {
    if (this === window.localStorage && isScopedBase(key)) {
      const u = currentUsername();
      if (u) return rawGet.call(this, `${SCOPE_PREFIX}${u}:${key}`);
    }
    return rawGet.call(this, key);
  };
  proto.setItem = function (this: Storage, key: string, val: string) {
    if (this === window.localStorage && isScopedBase(key)) {
      const u = currentUsername();
      if (u) return rawSet.call(this, `${SCOPE_PREFIX}${u}:${key}`, val);
    }
    return rawSet.call(this, key, val);
  };
  proto.removeItem = function (this: Storage, key: string) {
    if (this === window.localStorage && isScopedBase(key)) {
      const u = currentUsername();
      if (u) return rawRem.call(this, `${SCOPE_PREFIX}${u}:${key}`);
    }
    return rawRem.call(this, key);
  };
  installed = true;
}

/** One-time migration: if a logged-in user has no scoped value for a base
 *  key but a legacy (unscoped) value exists, copy it into their scoped key.
 *  Old global keys are left alone (not deleted) to stay safe. */
export function migrateLegacyKeysForCurrentUser() {
  if (typeof window === "undefined" || !window.localStorage) return;
  const u = currentUsername(); if (!u) return;
  const rawGet = (window as any).__ccRawGetItem as ((k: string) => string | null);
  const rawSet = (window as any).__ccRawSetItem as ((k: string, v: string) => void);
  if (!rawGet || !rawSet) return;
  const flag = `${SCOPE_PREFIX}${u}:${MIGRATION_FLAG}`;
  if (rawGet(flag)) return;

  for (const base of SCOPED_BASE_KEYS) {
    const scoped = `${SCOPE_PREFIX}${u}:${base}`;
    const existing = rawGet(scoped);
    if (existing != null && existing !== "") continue;
    const legacy = rawGet(base);
    if (legacy == null) continue;
    try { rawSet(scoped, legacy); } catch { /* quota etc. */ }
  }
  try { rawSet(flag, "1"); } catch {}
}

/** Mark migration as already done for current user (used on register so a
 *  brand-new user does not inherit any pre-existing legacy global data). */
export function markMigratedForCurrentUser() {
  if (typeof window === "undefined" || !window.localStorage) return;
  const u = currentUsername(); if (!u) return;
  const rawSet = (window as any).__ccRawSetItem as ((k: string, v: string) => void) | undefined;
  const flag = `${SCOPE_PREFIX}${u}:${MIGRATION_FLAG}`;
  try { (rawSet ?? ((k: string, v: string) => window.localStorage.setItem(k, v)))(flag, "1"); } catch {}
}
