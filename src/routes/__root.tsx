import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppProvider } from "@/components/AppShell";
import { AmbienceProvider } from "@/lib/audio/AmbienceProvider";
import { Fox } from "@/components/fox/Fox";

function NotFoundComponent() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="card-cozy p-8 text-center max-w-md">
        <div className="mx-auto mb-3"><Fox pose="sleepy" size={140} /></div>
        <h1 className="text-3xl font-display mb-1">Lost in the cozy woods</h1>
        <p className="text-muted-foreground mb-4">This page doesn't exist. Let's head back home.</p>
        <Link to="/dashboard" className="btn-rose">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="card-cozy p-8 text-center max-w-md">
        <div className="mx-auto mb-3"><Fox pose="sleepy" size={140} /></div>
        <h1 className="text-2xl font-display mb-1">Tiny hiccup</h1>
        <p className="text-muted-foreground text-sm mb-4">Something went wrong. Take a breath, then try again.</p>
        <button className="btn-rose" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CalmCampus — Plan calm, study soft" },
      { name: "description", content: "Cozy student wellness & planning website. Build calm study plans, talk it out, and reset with quick calm tools." },
      { property: "og:title", content: "CalmCampus" },
      { property: "og:description", content: "Cozy student wellness & planning website." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Quicksand:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <AmbienceProvider>
          <Outlet />
        </AmbienceProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
