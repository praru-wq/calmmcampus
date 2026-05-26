import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout, BackButton, useApp } from "@/components/AppShell";
import { Fox } from "@/components/fox/Fox";
import { useEffect, useRef, useState } from "react";
import { updateCurrentUserData } from "@/lib/storage";
import { playAppSound } from "@/lib/appSounds";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CRISIS_RE = /\b(kill myself|suicid(e|al)|end my life|want to die|don'?t want to (be here|live|exist)|can'?t live( anymore)?|want to disappear|want (everything|it all) to end|overdose|want to jump|going to (hurt|kill) myself|hurt myself|cut myself|cutting myself|self[- ]?harm|not safe|in danger|someone is hurting me|i was (abused|assaulted|raped|forced)|unsafe at home)\b/i;

const CHIP_TO_MODE: Record<string, string> = {
  "Comfort me": "comfort",
  "Ask me questions": "questions",
  "Give advice": "advice",
  "Help me calm down": "calm",
  "Help me text them": "text-help",
  "I just want to vent": "vent",
  "Tiny step please": "tiny-step",
  "Continue": "auto",
};

export const Route = createFileRoute("/talk")({
  head: () => ({ meta: [{ title: "Talk Assistant — CalmCampus" }] }),
  component: () => <ProtectedLayout><TalkPage /></ProtectedLayout>,
});

const DEFAULT_CHIPS = [
  "Comfort me",
  "Ask me questions",
  "Give advice",
  "Help me calm down",
  "Help me text them",
  "I just want to vent",
  "Tiny step please",
  "Continue",
];

function clearLegacyTalkMemory() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem("calmCampusTalkAssistantMemory"); } catch { /* ignore */ }
}

function BubbleMarkdown({ text }: { text: string }) {
  return (
    <div className="markdown-bubble text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, ...props }) => {
            const isInline = !(props as { className?: string }).className;
            return isInline ? (
              <code className="px-1.5 py-0.5 rounded text-[0.85em]" style={{ background: "color-mix(in oklab, var(--rose) 10%, white)" }}>{children}</code>
            ) : (
              <code className="block px-3 py-2 rounded-lg text-[0.85em] overflow-x-auto" style={{ background: "color-mix(in oklab, var(--rose) 8%, white)" }}>{children}</code>
            );
          },
          pre: ({ children }) => <pre className="my-2 rounded-lg overflow-x-auto">{children}</pre>,
          h1: ({ children }) => <h3 className="font-semibold mt-2 mb-1 text-[1.02em]">{children}</h3>,
          h2: ({ children }) => <h3 className="font-semibold mt-2 mb-1 text-[1.02em]">{children}</h3>,
          h3: ({ children }) => <h3 className="font-semibold mt-2 mb-1 text-[1.02em]">{children}</h3>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="underline">{children}</a>,
          blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 italic opacity-90 my-2">{children}</blockquote>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function TalkPage() {
  const { user, refresh, confirm, toast } = useApp();
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [chips] = useState<string[]>(DEFAULT_CHIPS);
  const [lastCrisis, setLastCrisis] = useState(false);
  const [mode, setMode] = useState<string>("auto");
  const [streamingText, setStreamingText] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const history = user?.data.chatHistory || [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history.length, typing, streamingText]);

  const send = async (msg?: string, chipLabel?: string) => {
    if (typing) return;
    const value = (msg ?? text).trim();
    if (!value) return;

    const activeMode = chipLabel && CHIP_TO_MODE[chipLabel] ? CHIP_TO_MODE[chipLabel] : mode;
    if (chipLabel && CHIP_TO_MODE[chipLabel]) setMode(CHIP_TO_MODE[chipLabel]);

    const isCrisis = CRISIS_RE.test(value);
    setLastCrisis(isCrisis);

    // Persist user message
    updateCurrentUserData((d) => { d.chatHistory.push({ role: "user", text: value, ts: Date.now() }); });
    refresh();
    setText("");
    setTyping(true);
    setStreamingText("");
    stoppedRef.current = false;
    playAppSound("send");

    // Build messages for API. For chip clicks, replace the last user content
    // with an explicit instruction so the model continues from prior context
    // instead of literally replying to the chip text.
    const baseHistory = history.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

    let lastUserContent = value;
    if (chipLabel && CHIP_TO_MODE[chipLabel]) {
      const hasPrior = baseHistory.some((m) => m.role === "user");
      lastUserContent = hasPrior
        ? `[Internal note: the user just tapped the "${chipLabel}" quick-reply chip. Respond to the prior conversation context using the "${activeMode}" mode. Do NOT comment on the chip itself. If the prior context is unclear, gently invite them to share what's on their mind.]`
        : `[Internal note: the user opened the chat and tapped the "${chipLabel}" chip without writing anything yet. Warmly invite them to share what's on their mind, in the "${activeMode}" mode style. Keep it to one short paragraph.]`;
    }

    const apiMessages = [...baseHistory, { role: "user" as const, content: lastUserContent }];

    const controller = new AbortController();
    abortRef.current = controller;

    let acc = "";
    try {
      const resp = await fetch("/api/talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, mode: activeMode }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        let errText = "Something went wrong while connecting. Mind trying that again in a sec?";
        try {
          const j = await resp.json();
          if (j?.error) errText = j.error;
        } catch { /* ignore */ }
        updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: errText, ts: Date.now() }); });
        refresh();
        playAppSound("warning");
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value: chunk, done: rd } = await reader.read();
        if (rd) break;
        buffer += decoder.decode(chunk, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              acc += delta;
              setStreamingText(acc);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      const trimmed = acc.trim();
      if (trimmed) {
        updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: trimmed, ts: Date.now() }); });
        refresh();
        playAppSound(isCrisis ? "warning" : "reply");
      } else if (stoppedRef.current) {
        updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: "Stopped. I'm here when you're ready.", ts: Date.now() }); });
        refresh();
      } else {
        updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: "I couldn't generate a response — please try again.", ts: Date.now() }); });
        refresh();
        playAppSound("warning");
      }
    } catch (e: unknown) {
      const aborted = e instanceof Error && e.name === "AbortError";
      if (aborted) {
        const partial = acc.trim();
        if (partial) {
          updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: partial, ts: Date.now() }); });
        } else {
          updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: "Stopped. I'm here when you're ready.", ts: Date.now() }); });
        }
        refresh();
      } else {
        console.error(e);
        const fallback = acc.trim() || "Something went wrong while connecting. Mind trying that again in a sec?";
        updateCurrentUserData((d) => { d.chatHistory.push({ role: "bot", text: fallback, ts: Date.now() }); });
        refresh();
        playAppSound("warning");
      }
    } finally {
      setStreamingText("");
      setTyping(false);
      abortRef.current = null;
      stoppedRef.current = false;
    }
  };

  const stop = () => {
    stoppedRef.current = true;
    abortRef.current?.abort();
  };

  const clear = async () => {
    playAppSound("warning");
    const ok = await confirm({ title: "Clear chat?", body: "This removes your conversation history for this account.", confirmText: "Clear", danger: true });
    if (!ok) { playAppSound("tap"); return; }
    updateCurrentUserData((d) => { d.chatHistory = []; });
    clearLegacyTalkMemory();
    setLastCrisis(false);
    setMode("auto");
    refresh();
    playAppSound("clear");
    toast("Chat cleared", "info");
  };

  return (
    <div className="animate-fade-up flex flex-col gap-4 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BackButton />
        <button className="btn-ghost" onClick={clear}>Clear chat</button>
      </div>

      {/* Main chat card */}
      <div
        className="relative rounded-[28px] border overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, color-mix(in oklab, var(--blush) 55%, white) 0%, white 35%)",
          borderColor: "color-mix(in oklab, var(--rose) 22%, transparent)",
          boxShadow: "0 20px 60px -30px color-mix(in oklab, var(--rose) 55%, transparent)",
          minHeight: "calc(100vh - 11rem)",
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 sm:px-8 pt-6 pb-5 relative">
          <div className="shrink-0 -mt-2">
            <Fox pose="card" size={96} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl leading-tight">Talk It Out</h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Share what's on your mind. I'm listening — warmly, no judgment.
            </p>
          </div>
          {/* soft sparkle decoration */}
          <div className="hidden sm:block absolute right-6 top-6 opacity-60 select-none" aria-hidden>
            <svg width="60" height="60" viewBox="0 0 60 60">
              <path d="M30 8 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 z" fill="color-mix(in oklab, var(--rose) 40%, white)" />
            </svg>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 flex flex-col gap-5"
          style={{ minHeight: "48vh" }}
        >
          {history.length === 0 && (
            <div className="self-start max-w-[78%]">
              <div className="text-[11px] uppercase tracking-wider font-medium mb-1.5 px-1" style={{ color: "var(--rose)" }}>Assistant</div>
              <div
                className="rounded-2xl rounded-tl-md px-5 py-4 text-[15px] leading-relaxed shadow-sm border"
                style={{
                  background: "color-mix(in oklab, var(--blush) 70%, white)",
                  borderColor: "color-mix(in oklab, var(--rose) 18%, transparent)",
                }}
              >
                Hey {user?.profile.username || "you"} — glad you're here. No need to have it all figured out before you type. Whatever's loudest in your head right now, we can start there. What's going on?
              </div>
            </div>
          )}

          {history.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div key={i} className={"max-w-[78%] " + (isUser ? "self-end items-end" : "self-start items-start") + " flex flex-col"}>
                <div
                  className="text-[11px] uppercase tracking-wider font-medium mb-1.5 px-1"
                  style={{ color: isUser ? "var(--lavender-ink, #6b5cb8)" : "var(--rose)" }}
                >
                  {isUser ? "You" : "Assistant"}
                </div>
                <div
                  className={
                    "px-5 py-3.5 shadow-sm border animate-fade-up rounded-2xl " +
                    (isUser ? "rounded-tr-md" : "rounded-tl-md")
                  }
                  style={
                    isUser
                      ? {
                          background: "color-mix(in oklab, var(--lavender) 75%, white)",
                          borderColor: "color-mix(in oklab, var(--lavender) 50%, transparent)",
                          color: "oklch(0.28 0.08 295)",
                        }
                      : {
                          background: "color-mix(in oklab, var(--blush) 70%, white)",
                          borderColor: "color-mix(in oklab, var(--rose) 18%, transparent)",
                          color: "oklch(0.28 0.04 20)",
                        }
                  }
                >
                  {isUser ? (
                    <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  ) : (
                    <BubbleMarkdown text={m.text} />
                  )}
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="self-start max-w-[78%] flex flex-col">
              <div className="text-[11px] uppercase tracking-wider font-medium mb-1.5 px-1" style={{ color: "var(--rose)" }}>Assistant</div>
              <div
                className="rounded-2xl rounded-tl-md px-5 py-3.5 border shadow-sm"
                style={{
                  background: "color-mix(in oklab, var(--blush) 70%, white)",
                  borderColor: "color-mix(in oklab, var(--rose) 18%, transparent)",
                  color: "oklch(0.28 0.04 20)",
                }}
              >
                {streamingText ? (
                  <BubbleMarkdown text={streamingText} />
                ) : (
                  <span className="inline-flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-foreground/40 animate-pop" />
                    <span className="w-2 h-2 rounded-full bg-foreground/40 animate-pop" style={{ animationDelay: ".15s" }} />
                    <span className="w-2 h-2 rounded-full bg-foreground/40 animate-pop" style={{ animationDelay: ".3s" }} />
                  </span>
                )}
                <div className="mt-2">
                  <button type="button" onClick={stop} className="text-[11px] underline opacity-70 hover:opacity-100">Stop</button>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick reply chips */}
        <div className="px-4 sm:px-8 pt-2 pb-3 flex gap-2 flex-wrap">
          {chips.map((q) => (
            <button
              key={q}
              className="chip text-sm hover:scale-[1.03] transition-transform"
              onClick={() => { playAppSound("select"); send(q, q); }}
              disabled={typing}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="px-4 sm:px-8 pb-5 pt-1">
          <form
            className="flex gap-3 items-center rounded-full border p-1.5 pl-5"
            style={{
              background: "white",
              borderColor: "color-mix(in oklab, var(--rose) 22%, transparent)",
              boxShadow: "0 8px 24px -18px color-mix(in oklab, var(--rose) 60%, transparent)",
            }}
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <input
              className="flex-1 bg-transparent outline-none text-[15px] py-2.5 placeholder:text-muted-foreground/70"
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              className="btn-rose rounded-full px-5 py-2.5 text-sm font-medium inline-flex items-center gap-1.5"
              aria-label="Send message"
              disabled={typing}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4Z" />
              </svg>
              Send
            </button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-3 text-center px-4">
            {lastCrisis
              ? "If you're in immediate danger, please call 112 (India) or get to your nearest emergency room. For emotional crisis support, iCall: +91-9152987821. You don't have to be alone with this."
              : "I'm a supportive companion, not a licensed therapist. For ongoing concerns, please reach out to a campus counselor or trusted professional."}
          </p>
        </div>
      </div>
    </div>
  );
}
