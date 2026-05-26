import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { hydrated, user } = useApp();
  const nav = useNavigate();
  useEffect(() => {
    if (!hydrated) return;
    nav({ to: user ? "/dashboard" : "/login" });
  }, [hydrated, user, nav]);
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="animate-floaty"><Fox pose="wave" size={180} /></div>
    </div>
  );
}
