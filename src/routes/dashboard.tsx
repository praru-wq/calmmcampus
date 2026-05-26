import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout, useApp } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";
import { todayStr } from "@/lib/storage";
import { playAppSound } from "@/lib/appSounds";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CalmCampus" }] }),
  component: () => <ProtectedLayout><Dashboard /></ProtectedLayout>,
});

function ProgressRing({ value, size = 110, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 16) / 2; const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} stroke="oklch(0.92 0.04 20)" strokeWidth="10" fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#pg)" strokeWidth="10" fill="none"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stopColor="oklch(0.82 0.14 10)" /><stop offset="1" stopColor="oklch(0.78 0.13 350)" /></linearGradient></defs>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="20" fontWeight="700" fill="oklch(0.4 0.1 15)">{Math.round(value)}%</text>
      {label && <text x="50%" y="68%" textAnchor="middle" fontSize="9" fill="oklch(0.5 0.05 20)">{label}</text>}
    </svg>
  );
}

function Dashboard() {
  const { user } = useApp(); if (!user) return null;
  const today = todayStr();
  const plan = user.data.singlePlanner.plans[today];
  const completed = plan ? plan.blocks.filter((b)=>b.completed).length : 0;
  const total = plan ? plan.blocks.length : 0;
  const pct = total ? (completed/total)*100 : 0;
  const qt = user.data.quickToolsProgress[today] || {};

  const Card = ({ to, color, title, sub, cta, icon }: any) => (
    <Link to={to} onClick={() => playAppSound("open")} className="card-cozy p-6 flex flex-col gap-3 group hover:-translate-y-1 transition-transform"
      style={{ background: `linear-gradient(180deg, ${color}, var(--card))` }}>
      <div className="flex items-start justify-between">
        <div className="text-3xl">{icon}</div>
        <span className="chip">Open</span>
      </div>
      <h3 className="text-xl font-display">{title}</h3>
      <p className="text-sm text-muted-foreground flex-1">{sub}</p>
      <span className="btn-rose self-start">{cta} →</span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <section className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div>
          <p className="chip mb-2">{new Date().toLocaleDateString(undefined,{weekday:"long", month:"long", day:"numeric"})}</p>
          <h1 className="text-4xl md:text-5xl font-display">Good to see you, <span style={{ color: "var(--rose)" }}>{user.profile.username}</span> 🌸</h1>
          <p className="text-muted-foreground mt-2">You've got this. One soft step at a time.</p>
        </div>
        <div className="animate-floaty hidden md:block"><Fox pose="study" size={220} /></div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <Card to="/plans" color="var(--blush)" icon="📔" title="Plan Your Day" sub="Stay organized and reduce stress with a soft plan." cta="Start Planning" />
        <Card to="/talk" color="var(--lavender)" icon="💬" title="Talk It Out" sub="Share what's on your mind. We're listening." cta="Open Chat" />
        <Card to="/tools" color="var(--mint)" icon="🌿" title="Quick Calm Tools" sub="Breathe, ground, and feel better in minutes." cta="Open Tools" />
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="card-cozy p-5">
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Today's Progress</h4>
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} />
            <div className="text-sm flex-1 flex flex-col gap-1">
              <div className="flex justify-between"><span>Study blocks</span><b>{plan?plan.blocks.filter(b=>b.category==="study"&&b.completed).length:0}/{plan?plan.blocks.filter(b=>b.category==="study").length:0}</b></div>
              <div className="flex justify-between"><span>Breaks</span><b>{plan?plan.blocks.filter(b=>b.category==="break"&&b.completed).length:0}/{plan?plan.blocks.filter(b=>b.category==="break").length:0}</b></div>
              <div className="flex justify-between"><span>Total</span><b>{completed}/{total}</b></div>
            </div>
          </div>
        </div>
        <div className="card-cozy p-5">
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Current Streak</h4>
          <div className="flex items-center gap-3">
            <div className="text-5xl font-display" style={{ color: "var(--rose)" }}>{user.data.streak}</div>
            <div><div className="font-semibold">Days</div><div className="text-xs text-muted-foreground">Keep it going!</div></div>
          </div>
          <div className="mt-3 flex gap-1">{Array.from({length:7}).map((_,i)=>(<div key={i} className="flex-1 h-2 rounded-full" style={{background: i<user.data.streak%7?"var(--rose)":"var(--blush)"}}/>))}</div>
        </div>
        <div className="card-cozy p-5" style={{ background: "var(--blush)" }}>
          <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Today's Reminder ✨</h4>
          <p className="font-display text-lg leading-snug">You don't have to be perfect. Just be consistent. 🌷</p>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="chip">{qt.breathe?"✓":"○"} Breathe</span>
            <span className="chip">{qt.ground?"✓":"○"} Ground</span>
            <span className="chip">{qt.motivate?"✓":"○"} Motivate</span>
          </div>
        </div>
      </section>
    </div>
  );
}
