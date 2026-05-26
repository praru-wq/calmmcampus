import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FoxScene } from "@/components/fox/Fox";
import { useApp } from "@/components/AppShell";
import { getCurrentUsername, registerUser } from "@/lib/storage";
import { playAuthSound } from "@/lib/appSounds";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — CalmCampus" }, { name: "description", content: "Start your calm journey with CalmCampus." }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const nav = useNavigate(); const { hydrated, refresh, toast } = useApp();
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [p2, setP2] = useState("");
  const [err, setErr] = useState(""); const [shake, setShake] = useState(false);
  useEffect(() => { if (hydrated && getCurrentUsername()) nav({ to: "/dashboard" }); }, [hydrated, nav]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playAuthSound("authSubmit");
    if (!u.trim() || !p || !p2) { playAuthSound("error"); return setErr("Please fill in every field"); }
    if (p !== p2) { playAuthSound("error"); setErr("Passwords don't match yet"); setShake(true); setTimeout(()=>setShake(false),500); return; }
    const res = registerUser(u, p);
    if (!res.ok) { playAuthSound("error"); setErr(res.error!); setShake(true); setTimeout(()=>setShake(false),500); return; }
    playAuthSound("authWelcome");
    refresh(); toast("Welcome to CalmCampus 🌸", "success"); nav({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 grid lg:grid-cols-2 gap-6 items-center max-w-7xl mx-auto">
      <FoxScene variant="login" className="h-72 lg:h-[560px] order-2 lg:order-1 hidden md:block" />
      <div className={"card-cozy p-8 md:p-10 max-w-md mx-auto w-full order-1 lg:order-2 " + (shake?"animate-shake":"animate-fade-up")}>
        <div className="flex items-center gap-2"><span className="text-2xl font-display font-bold" style={{ color: "var(--rose)" }}>CalmCampus</span><span>🌸</span></div>
        <h1 className="text-3xl font-display mt-3">Create Account</h1>
        <p className="text-muted-foreground text-sm mt-1">Start your calm journey today 💕</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <label className="text-sm font-medium">Username
            <input className="input-cozy mt-1" value={u} onChange={(e)=>{setU(e.target.value);setErr("");}} onFocus={() => playAuthSound("inputFocus")} placeholder="pick a soft username" />
          </label>
          <label className="text-sm font-medium">Password
            <input type="password" className="input-cozy mt-1" value={p} onChange={(e)=>{setP(e.target.value);setErr("");}} onFocus={() => playAuthSound("inputFocus")} placeholder="a secret only you know" />
          </label>
          <label className="text-sm font-medium">Confirm Password
            <input type="password" className="input-cozy mt-1" value={p2} onChange={(e)=>{setP2(e.target.value);setErr("");}} onFocus={() => playAuthSound("inputFocus")} placeholder="type it once more" />
          </label>
          <p className="text-xs text-muted-foreground">If password is forgotten, account must be deleted and recreated.</p>
          {err && <div className="text-sm rounded-xl px-3 py-2" style={{ background: "color-mix(in oklab, var(--destructive) 10%, transparent)", color: "var(--destructive)" }}>{err}</div>}
          <button type="submit" className="btn-rose mt-1 w-full">Register</button>
        </form>
        <p className="text-sm text-muted-foreground mt-5 text-center">
          Already have an account? <Link to="/login" onClick={() => playAuthSound("authSwitch")} className="font-semibold" style={{ color: "var(--rose)" }}>Login</Link>
        </p>
      </div>
    </div>
  );
}
