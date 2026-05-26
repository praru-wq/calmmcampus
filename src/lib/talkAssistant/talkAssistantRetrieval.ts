import { TOPIC_PACKS, TOPIC_BY_ID, EMOTION_WORDS, MODE_PHRASES, PEOPLE_WORDS } from "./talkAssistantData";
import type { DetectionResult, Emotion, Mode, TalkMemory, TopicPack } from "./talkAssistantTypes";

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function countMatches(haystack: string, needles: string[]): number {
  let n = 0;
  for (const k of needles) {
    if (!k) continue;
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(haystack)) n++;
  }
  return n;
}

function scoreTopic(pack: TopicPack, text: string, prevTopic?: string): number {
  const kw = countMatches(text, pack.keywords);
  const phr = pack.phrases ? countMatches(text, pack.phrases) : 0;
  let score = kw * 3 + phr * 4;
  if (prevTopic && prevTopic === pack.id) score += 0.5; // gentle memory bias
  return score;
}

export function detectEmotion(text: string): Emotion {
  let best: Emotion = "neutral";
  let bestScore = 0;
  for (const [emo, words] of Object.entries(EMOTION_WORDS)) {
    const score = countMatches(text, words);
    if (score > bestScore) {
      bestScore = score;
      best = emo as Emotion;
    }
  }
  return best;
}

export function detectMode(text: string): Mode {
  for (const [mode, phrases] of Object.entries(MODE_PHRASES)) {
    if (phrases.some((p) => text.includes(p))) return mode as Mode;
  }
  return "auto";
}

export function detectPeople(text: string): string[] {
  const found: string[] = [];
  for (const p of PEOPLE_WORDS) {
    const re = new RegExp(`\\b${p}\\b`, "i");
    if (re.test(text)) found.push(p);
  }
  return [...new Set(found)];
}

const CONTINUE_WORDS = ["yes", "yeah", "yep", "ok", "okay", "k", "idk", "i dont know", "i don't know", "continue", "go on", "and?", "same", "same thing", "same as before", "again", "uh huh", "mhm"];

function isFollowUp(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed.split(/\s+/).length <= 4 && CONTINUE_WORDS.some((w) => trimmed === w || trimmed.startsWith(w + " "))) return true;
  return false;
}

export function detect(text: string, mem: TalkMemory): DetectionResult {
  const norm = normalize(text);
  const prevTopic = mem.currentTopic;
  const mode = detectMode(norm);
  const people = detectPeople(norm);
  const emotion = detectEmotion(norm);

  // Score all topics
  const scored = TOPIC_PACKS.map((p) => ({ pack: p, score: scoreTopic(p, norm, prevTopic) }))
    .sort((a, b) => b.score - a.score);

  let topPack = scored[0]?.pack;
  let secondary = scored[1]?.score && scored[1].score > 1 ? scored[1].pack : undefined;

  // No good match → fall back to memory topic for follow-ups, else greeting.
  if (!topPack || (scored[0]?.score ?? 0) === 0) {
    if (isFollowUp(norm) && prevTopic && TOPIC_BY_ID[prevTopic]) {
      topPack = TOPIC_BY_ID[prevTopic];
    } else if (mode !== "auto" && prevTopic && TOPIC_BY_ID[prevTopic]) {
      // Pure mode message ("ask me questions", "i just want to vent") — stay in topic.
      topPack = TOPIC_BY_ID[prevTopic];
    } else if (prevTopic && TOPIC_BY_ID[prevTopic] && norm.split(/\s+/).length < 6) {
      topPack = TOPIC_BY_ID[prevTopic];
    } else {
      topPack = TOPIC_BY_ID["greeting"]!;
    }
  }

  // Don't let "continue" pack override a real previous topic — merge.
  if (topPack.id === "continue" && prevTopic && TOPIC_BY_ID[prevTopic]) {
    secondary = topPack;
    topPack = TOPIC_BY_ID[prevTopic];
  }

  return {
    topic: topPack,
    secondary,
    emotion: emotion === "neutral" && mem.lastMood ? mem.lastMood : emotion,
    mode: mode === "auto" && mem.preferredMode ? mem.preferredMode : mode,
    people,
    isCrisis: false,
  };
}