import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { Fox } from "@/components/fox/Fox";
import { useApp } from "@/components/AppShell";
import { getCurrentUsername, getUsers, loginUser, saveUsers } from "@/lib/storage";
import { playAuthSound } from "@/lib/appSounds";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — CalmCampus" }, { name: "description", content: "Login to your cozy CalmCampus study space." }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { hydrated, refresh, confirm, toast } = useApp();
  const [u, setU] = useState(""); const [p, setP] = useState("");
  const [err, setErr] = useState(""); const [shake, setShake] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => { if (hydrated && getCurrentUsername()) nav({ to: "/dashboard" }); }, [hydrated, nav]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playAuthSound("authSubmit");
    const res = loginUser(u.trim(), p);
    if (!res.ok) {
      playAuthSound("error");
      setErr(res.error!); setShake(true); setTimeout(() => setShake(false), 500); return;
    }
    playAuthSound("authWelcome");
    refresh(); toast("Welcome back, " + u + " ✿", "success"); nav({ to: "/dashboard" });
  };

  const forgot = async () => {
    playAuthSound("tap");
    if (!u.trim()) { playAuthSound("error"); setErr("Type your username, then tap forgot password"); return; }
    const users = getUsers();
    if (!users[u.trim()]) { playAuthSound("error"); setErr("We couldn't find that username"); return; }
    const ok = await confirm({
      title: "Delete this account?",
      body: "If password is forgotten, the account must be deleted and recreated. This removes only this user's local data on this device.",
      confirmText: "Delete account", danger: true,
    });
    if (!ok) return;
    delete users[u.trim()]; saveUsers(users);
    toast("Account deleted. You can register again.", "info");
    setU(""); setP("");
  };

  // Pre-computed petals for performance
  const petals = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    left: `${(i * 7.3 + 4) % 100}%`,
    delay: `${(i * 1.3) % 12}s`,
    dur: `${10 + (i % 5) * 2}s`,
    size: 10 + ((i * 3) % 10),
    hue: i % 3 === 0 ? "oklch(0.86 0.1 350)" : i % 3 === 1 ? "oklch(0.88 0.08 20)" : "oklch(0.9 0.06 320)",
  })), []);

  const sparkles = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    top: `${(i * 11) % 95}%`,
    left: `${(i * 17 + 5) % 98}%`,
    delay: `${(i * 0.4) % 4}s`,
    size: 6 + (i % 4) * 2,
  })), []);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{
      background: "radial-gradient(ellipse at 20% 20%, oklch(0.96 0.04 30) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, oklch(0.93 0.06 320) 0%, transparent 55%), linear-gradient(135deg, oklch(0.97 0.03 30), oklch(0.94 0.05 350) 50%, oklch(0.94 0.05 310))",
    }}>
      {/* ===== Ambient background decorations ===== */}
      {/* warm glow blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full animate-glow" style={{ background: "radial-gradient(circle, oklch(0.92 0.12 25 / .55), transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 w-[460px] h-[460px] rounded-full animate-glow" style={{ background: "radial-gradient(circle, oklch(0.88 0.1 310 / .5), transparent 70%)", animationDelay: "1.5s" }} />
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 w-[300px] h-[300px] rounded-full animate-glow" style={{ background: "radial-gradient(circle, oklch(0.92 0.09 50 / .35), transparent 70%)", animationDelay: "3s" }} />

      {/* String lights across the top */}
      <svg aria-hidden className="pointer-events-none absolute top-0 left-0 w-full" height="90" viewBox="0 0 1200 90" preserveAspectRatio="none">
        <path d="M0,20 Q300,80 600,30 T1200,25" stroke="oklch(0.78 0.06 30 / .55)" strokeWidth="1.5" fill="none" />
        {Array.from({ length: 20 }).map((_, i) => {
          const x = (i + 1) * 60;
          const y = 20 + Math.sin(i * 0.9) * 18 + (i % 2 ? 6 : 0);
          return (
            <g key={i}>
              <line x1={x} y1={y} x2={x} y2={y + 10} stroke="oklch(0.7 0.04 30 / .5)" strokeWidth="1" />
              <circle cx={x} cy={y + 14} r="4" fill="oklch(0.92 0.14 80)" style={{ animation: `twinkle ${2 + (i % 4)}s ease-in-out ${i * 0.2}s infinite` }} />
              <circle cx={x} cy={y + 14} r="9" fill="oklch(0.92 0.14 80 / .25)" />
            </g>
          );
        })}
      </svg>

      {/* Falling petals */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {petals.map((p, i) => (
          <div key={i} className="absolute animate-petal" style={{ left: p.left, top: 0, animationDelay: p.delay, animationDuration: p.dur }}>
            <svg width={p.size} height={p.size} viewBox="0 0 20 20"><path d="M10,2 C14,6 14,14 10,18 C6,14 6,6 10,2 Z" fill={p.hue} opacity="0.85" /></svg>
          </div>
        ))}
      </div>

      {/* Twinkling sparkles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {sparkles.map((s, i) => (
          <Sparkles key={i} className="absolute animate-twinkle" style={{ top: s.top, left: s.left, width: s.size, height: s.size, color: "oklch(0.85 0.1 50 / .8)", animationDelay: s.delay }} />
        ))}
      </div>

      {/* ===== Top brand bar ===== */}
      <div className="relative z-10 px-6 md:px-10 pt-6 flex items-center gap-2">
        <span className="text-xl">🌸</span>
        <span className="text-2xl font-display font-bold" style={{ color: "var(--rose)" }}>CalmCampus</span>
      </div>

      {/* ===== Main grid ===== */}
      <div className="relative z-10 grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-4 items-center px-6 md:px-10 lg:px-16 pb-16 pt-4 max-w-7xl mx-auto min-h-[calc(100vh-72px)]">
        {/* ----- Left: cozy scene ----- */}
        <div className="relative hidden md:block min-h-[560px]">
          {/* Soft window — top left */}
          <div aria-hidden className="absolute top-0 left-0 w-40 h-52 rounded-2xl animate-drift" style={{
            background: "linear-gradient(180deg, oklch(0.96 0.04 220) 0%, oklch(0.92 0.06 350) 100%)",
            border: "4px solid oklch(0.82 0.06 30)",
            boxShadow: "inset 0 0 30px oklch(0.95 0.05 30 / .6)",
          }}>
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <div style={{ borderRight: "2px solid oklch(0.82 0.06 30)", borderBottom: "2px solid oklch(0.82 0.06 30)" }} />
              <div style={{ borderBottom: "2px solid oklch(0.82 0.06 30)" }} />
              <div style={{ borderRight: "2px solid oklch(0.82 0.06 30)" }} />
              <div />
            </div>
            <div className="absolute top-6 left-3 w-12 h-5 rounded-full" style={{ background: "white", opacity: .7 }} />
            <div className="absolute top-10 left-10 w-16 h-5 rounded-full" style={{ background: "white", opacity: .6 }} />
          </div>

          {/* Hanging plant — top right */}
          <div className="absolute top-0 right-6 flex flex-col items-center animate-sway" style={{ animationDelay: ".6s" }}>
            <div className="w-px h-8" style={{ background: "oklch(0.6 0.05 30)" }} />
            <svg width="70" height="64" viewBox="0 0 80 70">
              <ellipse cx="40" cy="20" rx="28" ry="10" fill="oklch(0.82 0.06 50)" />
              <path d="M20,22 q-4,30 8,42" stroke="oklch(0.55 0.13 145)" strokeWidth="3" fill="none" />
              <path d="M40,22 q0,30 0,42" stroke="oklch(0.6 0.12 150)" strokeWidth="3" fill="none" />
              <path d="M60,22 q4,30 -8,42" stroke="oklch(0.55 0.13 145)" strokeWidth="3" fill="none" />
              <ellipse cx="20" cy="60" rx="5" ry="3" fill="oklch(0.6 0.12 150)" />
              <ellipse cx="40" cy="64" rx="5" ry="3" fill="oklch(0.55 0.13 145)" />
              <ellipse cx="60" cy="60" rx="5" ry="3" fill="oklch(0.6 0.12 150)" />
            </svg>
          </div>

          {/* Neon-style quote sign — centered between window & plant */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl animate-drift text-center" style={{
            background: "color-mix(in oklab, var(--rose) 12%, white)",
            border: "2px solid color-mix(in oklab, var(--rose) 45%, transparent)",
            boxShadow: "0 0 24px color-mix(in oklab, var(--rose) 40%, transparent), inset 0 0 18px color-mix(in oklab, var(--rose) 18%, transparent)",
            animationDelay: "1s",
          }}>
            <div className="font-display text-base leading-tight whitespace-nowrap" style={{ color: "var(--rose)" }}>Small steps every day</div>
            <div className="font-display text-base leading-tight whitespace-nowrap" style={{ color: "var(--rose)" }}>lead to big changes ✿</div>
          </div>

          {/* Sticky notes — clustered nicely */}
          <div className="absolute top-[170px] left-44 -rotate-6 px-3 py-1.5 rounded-md text-[11px] font-semibold animate-sway" style={{ background: "oklch(0.96 0.05 80)", color: "oklch(0.45 0.1 15)", boxShadow: "0 6px 14px oklch(0.7 0.05 20 / .15)" }}>
            Breathe · you've got this 💗
          </div>
          <div className="absolute top-[210px] left-64 rotate-3 px-3 py-1.5 rounded-md text-[11px] font-semibold animate-sway" style={{ background: "color-mix(in oklab, var(--blush) 60%, white)", color: "oklch(0.45 0.1 15)", boxShadow: "0 6px 14px oklch(0.7 0.05 20 / .15)", animationDelay: "1.2s" }}>
            Focus · Plan · Grow
          </div>

          {/* Polaroid photo — extra cozy touch */}
          <div className="absolute top-[150px] right-0 -rotate-[8deg] p-1.5 pb-3 rounded-sm animate-sway" style={{ background: "white", boxShadow: "0 10px 22px oklch(0.7 0.05 20 / .2)", animationDelay: "1.8s" }}>
            <div className="w-20 h-16 rounded-sm" style={{ background: "linear-gradient(180deg, oklch(0.88 0.08 30), oklch(0.85 0.1 350))" }}>
              <div className="w-full h-full grid place-items-center text-xl">🌅</div>
            </div>
            <div className="text-[9px] text-center mt-1 font-display" style={{ color: "oklch(0.5 0.05 20)" }}>cozy days</div>
          </div>

          {/* Desk surface */}
          <div aria-hidden className="absolute bottom-0 left-0 right-0 h-36 rounded-t-3xl" style={{
            background: "linear-gradient(180deg, oklch(0.86 0.06 50), oklch(0.78 0.08 40))",
            boxShadow: "0 -6px 20px oklch(0.7 0.05 20 / .12)",
          }} />
          <div aria-hidden className="absolute bottom-[136px] left-0 right-0 h-1.5" style={{ background: "oklch(0.74 0.08 35)" }} />

          {/* Mug on desk — left */}
          <div className="absolute bottom-[110px] left-6">
            <div className="relative w-14 h-14 rounded-b-2xl rounded-t-md" style={{ background: "oklch(0.94 0.05 350)", border: "2px solid oklch(0.78 0.13 10)" }}>
              <div className="absolute -right-3 top-2 w-4 h-7 rounded-r-full border-2" style={{ borderColor: "oklch(0.78 0.13 10)" }} />
              <div className="absolute top-1.5 left-1.5 right-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.4 0.05 30)" }} />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px]">🌸</div>
              <div className="absolute -top-6 left-3 w-1 h-5 rounded-full animate-floaty" style={{ background: "white", opacity: .6 }} />
              <div className="absolute -top-8 left-7 w-1 h-6 rounded-full animate-floaty" style={{ background: "white", opacity: .5, animationDelay: ".5s" }} />
            </div>
          </div>

          {/* Books stack on desk — right */}
          <div className="absolute bottom-[105px] right-4">
            <div className="w-28 h-5 rounded" style={{ background: "oklch(0.78 0.13 200)", boxShadow: "0 2px 0 oklch(0.66 0.13 200)" }} />
            <div className="w-24 h-5 mt-1 rounded ml-1" style={{ background: "oklch(0.78 0.12 350)", boxShadow: "0 2px 0 oklch(0.66 0.12 350)" }} />
            <div className="w-26 h-5 mt-1 rounded" style={{ background: "oklch(0.85 0.1 80)", boxShadow: "0 2px 0 oklch(0.72 0.1 80)" }} />
            {/* tiny flower on books */}
            <div className="absolute -top-3 right-3 text-base animate-sway">🌷</div>
          </div>

          {/* Foxy — center front, smiling */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 animate-floaty">
            <div className="relative">
              <div aria-hidden className="absolute inset-0 -m-6 rounded-full animate-glow" style={{ background: "radial-gradient(circle, oklch(0.92 0.1 25 / .55), transparent 70%)" }} />
              <Fox pose="card" size={230} smile />
              <Sparkles className="absolute top-2 -left-3 animate-twinkle" style={{ width: 20, height: 20, color: "oklch(0.85 0.12 50)" }} />
              <Sparkles className="absolute top-10 -right-5 animate-twinkle" style={{ width: 15, height: 15, color: "oklch(0.82 0.12 350)", animationDelay: "1s" }} />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-base animate-floaty" style={{ animationDelay: ".4s" }}>✨</div>
            </div>
          </div>
        </div>


        {/* ----- Right: Login card ----- */}
        <div className="relative w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          {/* floating flower accents around the card */}
          <div aria-hidden className="absolute -top-6 -left-4 text-3xl animate-sway">🌸</div>
          <div aria-hidden className="absolute -top-3 right-6 text-2xl animate-sway" style={{ animationDelay: "1s" }}>🌷</div>
          <div aria-hidden className="absolute -bottom-4 -right-3 text-2xl animate-sway" style={{ animationDelay: "1.6s" }}>✿</div>
          <div aria-hidden className="absolute top-1/2 -right-6 text-xl animate-sway" style={{ animationDelay: ".7s" }}>🌼</div>

          {/* Sticky note tucked at corner */}
          <div className="hidden lg:block absolute -top-10 -right-6 rotate-6 px-3 py-2 rounded-md text-xs font-semibold animate-sway z-10" style={{ background: "oklch(0.96 0.05 80)", color: "oklch(0.45 0.1 15)", boxShadow: "0 8px 18px oklch(0.7 0.05 20 / .18)" }}>
            You are doing amazing 💗
          </div>

          <div
            className={"relative p-8 md:p-10 rounded-[28px] " + (shake ? "animate-shake" : "animate-fade-up")}
            style={{
              background: "linear-gradient(180deg, color-mix(in oklab, white 85%, transparent), color-mix(in oklab, var(--blush) 30%, white))",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid color-mix(in oklab, var(--rose) 22%, transparent)",
              boxShadow: "0 30px 60px -20px color-mix(in oklab, var(--rose) 35%, transparent), 0 10px 30px -10px oklch(0.7 0.05 320 / .25), inset 0 1px 0 white",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🌸</span>
              <span className="text-lg font-display font-bold" style={{ color: "var(--rose)" }}>CalmCampus</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-display mt-3 leading-tight">
              Welcome Back <span className="inline-block animate-floaty">🌸</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5">Let's plan, focus and grow together 💕</p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <label className="text-sm font-semibold flex flex-col gap-1.5">
                <span>Username</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full" style={{ background: "color-mix(in oklab, var(--rose) 14%, white)", color: "var(--rose)" }}>
                    <User size={15} strokeWidth={2.4} />
                  </span>
                  <input
                    className="input-cozy"
                    style={{ paddingLeft: "3.1rem", height: "3rem" }}
                    value={u}
                    onChange={(e) => { setU(e.target.value); setErr(""); }}
                    placeholder="your-username"
                    autoComplete="username"
                    onFocus={() => playAuthSound("inputFocus")}
                  />
                </div>
              </label>

              <label className="text-sm font-semibold flex flex-col gap-1.5">
                <span>Password</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-full" style={{ background: "color-mix(in oklab, var(--rose) 14%, white)", color: "var(--rose)" }}>
                    <Lock size={15} strokeWidth={2.4} />
                  </span>
                  <input
                    className="input-cozy"
                    style={{ paddingLeft: "3.1rem", paddingRight: "3rem", height: "3rem" }}
                    type={showPw ? "text" : "password"}
                    value={p}
                    onChange={(e) => { setP(e.target.value); setErr(""); }}
                    placeholder="your-password"
                    autoComplete="current-password"
                    onFocus={() => playAuthSound("inputFocus")}
                  />
                  <button
                    type="button"
                    onClick={() => { playAuthSound("tap"); setShowPw((v) => !v); }}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full transition-colors hover:bg-[color-mix(in_oklab,var(--rose)_14%,transparent)]"
                    style={{ color: "var(--rose)" }}
                  >
                    {showPw ? <EyeOff size={17} strokeWidth={2.2} /> : <Eye size={17} strokeWidth={2.2} />}
                  </button>
                </div>
              </label>

              <button type="button" onClick={forgot} className="text-xs text-right -mt-1 font-semibold hover:underline" style={{ color: "var(--rose)" }}>
                Forgot password?
              </button>

              {err && (
                <div className="text-sm rounded-xl px-3 py-2 animate-fade-up" style={{ background: "color-mix(in oklab, var(--destructive) 10%, transparent)", color: "var(--destructive)" }}>
                  {err}
                </div>
              )}

              <button
                type="submit"
                className="btn-rose mt-1 w-full group relative overflow-hidden"
                style={{ height: "3rem", fontSize: "1rem", letterSpacing: ".01em", boxShadow: "0 14px 28px -10px color-mix(in oklab, var(--rose) 60%, transparent)" }}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  Login
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1" style={{ background: "color-mix(in oklab, var(--rose) 22%, transparent)" }} />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1" style={{ background: "color-mix(in oklab, var(--rose) 22%, transparent)" }} />
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Don't have an account?{" "}
              <Link to="/register" onClick={() => playAuthSound("authSwitch")} className="font-semibold hover:underline" style={{ color: "var(--rose)" }}>Register here</Link>
            </p>
          </div>
        </div>
      </div>

      {/* ===== Mobile-only Foxy peeking ===== */}
      <div className="md:hidden absolute bottom-2 right-2 opacity-90 pointer-events-none animate-floaty">
        <Fox pose="card" size={120} smile />
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center text-xs text-muted-foreground pb-4">
        © {new Date().getFullYear()} CalmCampus · made with 💗
      </div>
    </div>
  );
}
