import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  getCurrentUser, getCurrentUsername, logoutUser, updateCurrentUserData, playSound,
  type UserRecord,
} from "@/lib/storage";
import { Fox } from "@/components/fox/Fox";
import { playAppSound } from "@/lib/appSounds";
import { AmbienceControl } from "@/components/AmbienceControl";

interface AppCtx {
  user: UserRecord | null;
  refresh: () => void;
  toast: (msg: string, kind?: "info" | "success" | "error") => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  hydrated: boolean;
}
interface ConfirmOpts { title: string; body: string; confirmText?: string; cancelText?: string; danger?: boolean; }

const Ctx = createContext<AppCtx | null>(null);
export function useApp() {
  const v = useContext(Ctx); if (!v) throw new Error("AppCtx missing"); return v;
}

interface Toast { id: number; msg: string; kind: "info" | "success" | "error"; }

const SIDEBAR_PREF_KEY = "calmCampus:sidebarOpen";
const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

function isDesktopViewport() {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function readDesktopSidebarPreference() {
  if (typeof window === "undefined") return true;
  try {
    const saved = window.localStorage.getItem(SIDEBAR_PREF_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function getInitialSidebarOpen() {
  return isDesktopViewport() ? readDesktopSidebarPreference() : false;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);

  const refresh = useCallback(() => setUser(getCurrentUser()), []);
  useEffect(() => {
    setHydrated(true);
    refresh();
    const h = () => refresh();
    window.addEventListener("calmcampus:update", h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener("calmcampus:update", h); window.removeEventListener("storage", h); };
  }, [refresh]);

  useEffect(() => {
    if (user?.data.settings.softMode) document.documentElement.classList.add("soft-mode");
    else document.documentElement.classList.remove("soft-mode");
  }, [user?.data.settings.softMode]);

  const toast = useCallback((msg: string, kind: "info" | "success" | "error" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const confirm = useCallback((opts: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => setConfirmState({ opts, resolve }));
  }, []);

  const value = useMemo<AppCtx>(() => ({ user, refresh, toast, confirm, hydrated }), [user, refresh, toast, confirm, hydrated]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            className="card-cozy animate-fade-up px-4 py-3 text-sm font-medium pointer-events-auto"
            style={{
              borderColor: t.kind === "error" ? "var(--destructive)" : t.kind === "success" ? "var(--mint)" : undefined,
            }}>
            {t.msg}
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 animate-fade-up">
          <div className="card-cozy max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full p-2" style={{ background: "var(--blush)" }}><Fox pose="sleepy" size={72} /></div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold mb-1">{confirmState.opts.title}</h3>
                <p className="text-muted-foreground text-sm">{confirmState.opts.body}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => { confirmState.resolve(false); setConfirmState(null); }}>
                {confirmState.opts.cancelText || "Cancel"}
              </button>
              <button
                className="btn-rose"
                style={confirmState.opts.danger ? { background: "linear-gradient(135deg, oklch(0.7 0.2 25), oklch(0.6 0.2 15))" } : undefined}
                onClick={() => { confirmState.resolve(true); setConfirmState(null); }}>
                {confirmState.opts.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, hydrated, refresh, toast } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen);
  const [isDesktop, setIsDesktop] = useState(isDesktopViewport);

  useEffect(() => {
    if (hydrated && !getCurrentUsername()) nav({ to: "/login" });
  }, [hydrated, nav, loc.pathname]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncSidebarForViewport = () => {
      const desktop = media.matches;
      setIsDesktop(desktop);
      setSidebarOpen(desktop ? readDesktopSidebarPreference() : false);
    };

    syncSidebarForViewport();
    media.addEventListener("change", syncSidebarForViewport);
    return () => media.removeEventListener("change", syncSidebarForViewport);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    try {
      window.localStorage.setItem(SIDEBAR_PREF_KEY, String(sidebarOpen));
    } catch {
      // Sidebar state is cosmetic; ignore storage failures.
    }
  }, [isDesktop, sidebarOpen]);

  if (!hydrated || !user) {
    return <div className="min-h-screen grid place-items-center"><div className="animate-floaty"><Fox pose="sit" size={160} /></div></div>;
  }

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: "✦" },
    { to: "/plans", label: "My Plans", icon: "✧" },
    { to: "/talk", label: "Talk Assistant", icon: "✿" },
    { to: "/tools", label: "Quick Tools", icon: "❀" },
  ];

  const toggleSound = () => {
    updateCurrentUserData((d) => { d.settings.sound = !d.settings.sound; });
    const turningOn = !user.data.settings.sound;
    refresh();
    if (turningOn) {
      // Resume AudioContext from this user gesture so audio is unlocked.
      import("@/lib/calmSounds").then(m => { m.resumeAudio(); m.calmSfx.click(); });
    } else {
      import("@/lib/calmSounds").then(m => m.stopAllSounds());
    }
    toast("Sound " + (turningOn ? "on" : "off"));
  };
  const toggleSoft = () => {
    updateCurrentUserData((d) => { d.settings.softMode = !d.settings.softMode; });
    refresh();
    const turningOn = !user.data.settings.softMode;
    if (turningOn) playAppSound("softMode");
    toast("Soft mode " + (turningOn ? "on" : "off"));
  };
  const doLogout = () => { playAppSound("tap"); logoutUser(); refresh(); nav({ to: "/login" }); };
  const toggleSidebar = () => setSidebarOpen((open) => !open);
  const closeMobileSidebar = () => {
    if (!isDesktop) setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* sidebar desktop */}
      <aside className={`hidden md:flex shrink-0 flex-col sticky top-0 h-screen overflow-hidden transition-all duration-200 ease-out ${sidebarOpen ? "w-64 p-5 gap-2 opacity-100" : "w-0 p-0 gap-0 opacity-0 pointer-events-none"}`}
             style={{ background: "color-mix(in oklab, var(--sidebar) 90%, transparent)", borderRight: sidebarOpen ? "1px solid color-mix(in oklab, var(--rose) 15%, transparent)" : "0 solid transparent" }}>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <span className="text-2xl font-display font-bold" style={{ color: "var(--rose)" }}>CalmCampus</span>
          <span>🌸</span>
        </Link>
        <nav className="flex flex-col gap-1 mt-2">
          {items.map((it) => {
            const active = loc.pathname.startsWith(it.to);
            return (
              <Link key={it.to} to={it.to}
                onClick={() => { if (!active) playAppSound("open"); }}
                className="px-4 py-3 rounded-2xl flex items-center gap-3 font-medium transition-all"
                style={{
                  background: active ? "var(--gradient-rose)" : "transparent",
                  color: active ? "var(--primary-foreground)" : "var(--foreground)",
                  boxShadow: active ? "var(--shadow-soft)" : undefined,
                }}>
                <span>{it.icon}</span>{it.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-3 card-cozy text-sm" style={{ background: "var(--blush)" }}>
          <div className="flex items-center gap-2"><Fox pose="card" size={48} /><div><div className="font-semibold">Tip from Foxy</div><div className="text-xs text-muted-foreground">Progress is progress. 🌸</div></div></div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* header */}
        <header className={`sticky top-0 z-30 px-4 md:px-8 py-3 flex items-center gap-3 overflow-hidden transition-all duration-200 ease-out ${sidebarOpen ? "glass justify-between" : "justify-start bg-transparent shadow-none border-transparent backdrop-blur-0"}`}>
          <button className="btn-ghost !py-2 !px-3" onClick={toggleSidebar} aria-label="Menu" aria-expanded={sidebarOpen}>☰</button>
          <div className={`font-display text-lg hidden md:block overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${sidebarOpen ? "opacity-100 max-w-xs" : "opacity-0 max-w-0 pointer-events-none"}`}>Hello, {user.profile.username} ✿</div>
          <div className={`md:hidden font-display text-base overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${sidebarOpen ? "opacity-100 max-w-xs" : "opacity-0 max-w-0 pointer-events-none"}`}>CalmCampus 🌸</div>
          <div className={`flex items-center gap-1.5 overflow-hidden transition-all duration-200 ease-out ${sidebarOpen ? "opacity-100 max-w-[52rem]" : "opacity-0 max-w-0 pointer-events-none"}`}>
            <button className="btn-ghost !py-2 !px-3" onClick={toggleSound}>{user.data.settings.sound ? "🔊 Sound On" : "🔈 Sound Off"}</button>
            <AmbienceControl />
            <button className="btn-ghost !py-2 !px-3 hidden sm:inline-flex" onClick={toggleSoft}>{user.data.settings.softMode ? "🌙 Soft" : "✨ Soft Mode"}</button>
            <button className="btn-ghost !py-2 !px-3" onClick={doLogout}>Logout</button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
        {/* bottom nav mobile */}
        <nav className="md:hidden sticky bottom-0 z-30 glass flex justify-around py-2 px-2">
          {items.map((it) => {
            const active = loc.pathname.startsWith(it.to);
            return (
              <Link key={it.to} to={it.to}
                onClick={() => { if (!active) playAppSound("open"); }}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl text-xs"
                style={{ background: active ? "var(--blush)" : "transparent", color: active ? "var(--rose)" : "var(--muted-foreground)", fontWeight: active ? 700 : 500 }}>
                <span className="text-base">{it.icon}</span>{it.label.split(" ")[0]}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* mobile drawer */}
      {sidebarOpen && !isDesktop && (
        <div className="md:hidden fixed inset-0 z-40 bg-foreground/30" onClick={() => setSidebarOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 p-5 bg-card animate-fade-up flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xl font-display" style={{ color: "var(--rose)" }}>CalmCampus 🌸</span>
              <button className="btn-ghost !py-1 !px-3" onClick={() => setSidebarOpen(false)}>✕</button>
            </div>
            {items.map((it) => (
              <Link key={it.to} to={it.to} onClick={() => { playAppSound("open"); closeMobileSidebar(); }}
                className="px-4 py-3 rounded-2xl font-medium" style={{ background: "var(--blush)" }}>
                {it.icon} {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BackButton({ onClick, label = "Back" }: { onClick?: () => void; label?: string }) {
  const nav = useNavigate();
  return (
    <button className="btn-ghost !py-1.5 !px-3 mb-3" onClick={() => { playAppSound("tap"); if (onClick) onClick(); else nav({ to: "/dashboard" }); }}>
      ← {label}
    </button>
  );
}
