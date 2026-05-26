import type { TalkMemory } from "./talkAssistantTypes";

/** Pick an item from options, avoiding ones recently used (by exact text). */
export function pickVaried<T extends string>(
  options: readonly T[],
  recentlyUsed: readonly string[],
): T {
  if (!options.length) return "" as T;
  const fresh = options.filter((o) => !recentlyUsed.includes(o));
  const pool = fresh.length ? fresh : options;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Track that we used a fragment so we don't immediately repeat it. */
export function rememberFragment(mem: TalkMemory, fragment: string) {
  if (!fragment) return;
  mem.lastFragments = [...mem.lastFragments.filter((f) => f !== fragment), fragment].slice(-30);
}

export function rememberOpening(mem: TalkMemory, opening: string) {
  if (!opening) return;
  mem.lastOpenings = [...mem.lastOpenings.filter((o) => o !== opening), opening].slice(-5);
}

/** Light grammar cleanup so stitched fragments read naturally. */
export function cleanText(text: string): string {
  return text
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Reflect the user's input into a short summary phrase. */
export function reflectInput(text: string, people: string[]): string {
  const lower = text.toLowerCase();
  const subj = people[0];
  if (subj && /(ignored|ghosted|not replying|no reply)/.test(lower)) {
    return `It sounds like things with your ${subj} have gone quiet again, and it's getting under your skin.`;
  }
  if (subj && /(yelled|shouting|fought|argued|fight)/.test(lower)) {
    return `So there's been a fight with your ${subj}, and it's still sitting heavy with you.`;
  }
  if (/(exam|test|paper|viva).*(tomorrow|tonight|today)/.test(lower)) {
    return "And the exam is basically on top of you — that timeline alone makes the brain panic.";
  }
  return "";
}