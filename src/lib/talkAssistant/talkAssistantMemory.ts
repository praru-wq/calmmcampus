import type { TalkMemory, Emotion, Mode } from "./talkAssistantTypes";

const KEY = "calmCampusTalkAssistantMemory";

const DEFAULT_MEMORY: TalkMemory = {
  history: [],
  intensity: 0,
  lastOpenings: [],
  lastFragments: [],
};

export function loadMemory(): TalkMemory {
  if (typeof window === "undefined") return { ...DEFAULT_MEMORY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_MEMORY };
    const parsed = JSON.parse(raw) as TalkMemory;
    return { ...DEFAULT_MEMORY, ...parsed };
  } catch {
    return { ...DEFAULT_MEMORY };
  }
}

export function saveMemory(mem: TalkMemory) {
  if (typeof window === "undefined") return;
  try {
    // Cap arrays so storage doesn't grow.
    const trimmed: TalkMemory = {
      ...mem,
      history: mem.history.slice(-10),
      lastOpenings: mem.lastOpenings.slice(-5),
      lastFragments: mem.lastFragments.slice(-30),
    };
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

export function recordUserTurn(mem: TalkMemory, text: string, topic?: string, emotion?: Emotion, mode?: Mode, person?: string) {
  mem.history.push({ role: "user", text, ts: Date.now(), topic, emotion });
  if (topic) mem.currentTopic = topic;
  if (emotion) mem.lastMood = emotion;
  if (mode && mode !== "auto") mem.preferredMode = mode;
  if (person) mem.lastPerson = person;
}

export function recordBotTurn(mem: TalkMemory, text: string, topic?: string) {
  mem.history.push({ role: "bot", text, ts: Date.now(), topic });
}