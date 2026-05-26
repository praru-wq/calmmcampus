import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";
import { useState } from "react";
import { playPlannerSound } from "@/lib/plannerSounds";


export const Route = createFileRoute("/plans")({
  head: () => ({ meta: [{ title: "My Plans — CalmCampus" }] }),
  component: () => <ProtectedLayout><PlanChoice /></ProtectedLayout>,
});

function PlanChoice() {
  const [picked, setPicked] = useState<"single" | "detailed">("detailed");
  const nav = useNavigate();
  return (
    <div className="animate-fade-up">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl md:text-4xl font-display">Choose Your Planner ✨</h1>
        <p className="text-muted-foreground mt-2">Pick the planning style that fits your needs.</p>
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div className="grid md:grid-cols-2 gap-5">
          {([
            { id: "detailed", title: "Detailed Planner", icon: "📑", bullets: ["Multi-day planning", "Smart prioritization", "Custom schedules", "Track progress"], color: "var(--blush)" },
            { id: "single", title: "Single Planner", icon: "⏰", bullets: ["Plan for today", "Quick & simple", "Time blocking", "Stay productive"], color: "var(--mint)" },
          ] as const).map((c) => (
            <button key={c.id} onClick={() => { setPicked(c.id); playPlannerSound("select"); }}
              className="card-cozy text-left p-6 transition-all"
              style={{
                outline: picked === c.id ? "3px solid var(--rose)" : "3px solid transparent",
                background: `linear-gradient(180deg, ${c.color}, var(--card))`,
                transform: picked === c.id ? "translateY(-4px)" : "none",
              }}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <h3 className="text-2xl font-display">{c.title}</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {c.bullets.map((b, i) => (<li key={i} className="flex gap-2"><span>✓</span>{b}</li>))}
              </ul>
            </button>

          ))}
        </div>
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 hidden md:block animate-floaty pointer-events-none">
          <Fox pose="point" size={120} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto mt-16 card-cozy p-4 text-sm flex gap-3 items-center" style={{ background: "var(--blush)" }}>
        <span className="text-xl">💗</span>
        <div>
          <div className="font-semibold">Not sure which one?</div>
          <div className="text-muted-foreground">Detailed planner is best for long-term goals. Single Planner is perfect for daily focus.</div>
        </div>
      </div>

      <div className="text-center mt-8">
        <button className="btn-rose px-8" onClick={() => { playPlannerSound("next"); nav({ to: picked === "single" ? "/planner/single" : "/planner/detailed" }); }}>
          Continue with {picked === "single" ? "Single" : "Detailed"} Planner ✨
        </button>
        <div className="mt-3 text-xs text-muted-foreground">You can switch anytime. <Link to="/dashboard" className="underline">Back to dashboard</Link></div>
      </div>
    </div>
  );
}
