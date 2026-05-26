import { detect, normalize } from "./talkAssistantRetrieval";
import { detectCrisis, crisisResponse, CRISIS_CHIPS } from "./talkAssistantSafety";
import { loadMemory, recordBotTurn, recordUserTurn, saveMemory } from "./talkAssistantMemory";
import { pickVaried, rememberFragment, rememberOpening, cleanText, reflectInput } from "./talkAssistantPersonality";
import type { AssistantReply, Mode, TalkMemory, TopicPack } from "./talkAssistantTypes";

const BASE_CHIPS = [
  "Comfort me",
  "Ask me questions",
  "Give advice",
  "Help me calm down",
  "Help me text them",
  "Tiny step please",
  "I just want to vent",
  "Continue",
];

function chipsFor(topicId: string, mode: Mode): string[] {
  const base = [...BASE_CHIPS];
  if (["crush", "ignored", "relationship", "breakup", "friendship"].includes(topicId)) {
    return ["Help me text them", "Comfort me", "Ask me questions", "Give advice", "I just want to vent"];
  }
  if (["panic", "anxiety"].includes(topicId)) {
    return ["Help me calm down", "Tiny step please", "Comfort me", "Continue"];
  }
  if (["exam-stress", "cant-study", "procrastination"].includes(topicId)) {
    return ["Tiny step please", "Give advice", "Comfort me", "Help me calm down"];
  }
  if (mode === "vent") return ["Continue", "Comfort me", "Ask me questions"];
  return base.slice(0, 5);
}

function composeResponse(
  topic: TopicPack,
  secondary: TopicPack | undefined,
  mode: Mode,
  mem: TalkMemory,
  userText: string,
  people: string[],
): string {
  const validation = pickVaried(topic.validations, mem.lastFragments);
  rememberFragment(mem, validation);
  rememberOpening(mem, validation);

  const reflectionFromInput = reflectInput(userText, people);
  const reflection = reflectionFromInput || pickVaried(topic.reflections, mem.lastFragments);
  rememberFragment(mem, reflection);

  const insight = topic.insights.length ? pickVaried(topic.insights, mem.lastFragments) : "";
  rememberFragment(mem, insight);

  let actionLine = "";
  if (mode === "vent") {
    // No advice, just reflection + an inviting line.
    actionLine = "I'm just going to sit here with you while you let it out. No advice unless you ask, promise.";
  } else if (mode === "questions") {
    actionLine = pickVaried(topic.questions, mem.lastFragments);
  } else if (mode === "advice" || mode === "calm" || mode === "text-help") {
    const step = topic.tinySteps.length ? pickVaried(topic.tinySteps, mem.lastFragments) : "";
    actionLine = step || pickVaried(topic.questions, mem.lastFragments);
  } else if (mode === "comfort") {
    // soft question, no task
    actionLine = topic.questions.length ? pickVaried(topic.questions, mem.lastFragments) : "";
  } else {
    // auto — alternate question and tiny step based on history length
    const lastBot = [...mem.history].reverse().find((h) => h.role === "bot");
    const lastWasQuestion = lastBot?.text.includes("?");
    if (lastWasQuestion && topic.tinySteps.length) {
      actionLine = pickVaried(topic.tinySteps, mem.lastFragments);
    } else {
      actionLine = pickVaried(topic.questions, mem.lastFragments);
    }
  }
  rememberFragment(mem, actionLine);

  // Optionally weave a secondary-topic insight (one line) if relevant.
  let secondaryLine = "";
  if (secondary && secondary.id !== topic.id && secondary.insights.length && Math.random() < 0.4) {
    secondaryLine = pickVaried(secondary.insights, mem.lastFragments);
    rememberFragment(mem, secondaryLine);
  }

  const closing = pickVaried(topic.closings, mem.lastFragments);
  rememberFragment(mem, closing);

  const pieces = [validation, reflection, insight, secondaryLine, actionLine, closing]
    .filter(Boolean)
    .join(" ");

  return cleanText(pieces);
}

export interface RunOptions {
  /** Override mode (e.g. user picked a chip). */
  forcedMode?: Mode;
}

export function runTalkAssistant(rawText: string, opts: RunOptions = {}): AssistantReply {
  const text = rawText ?? "";
  const mem = loadMemory();

  // 1. Crisis check — highest priority.
  const crisis = detectCrisis(text);
  if (crisis.isCrisis) {
    const reply = crisisResponse(crisis.crisisKind);
    mem.crisisRecent = true;
    recordUserTurn(mem, text, "crisis");
    recordBotTurn(mem, reply, "crisis");
    saveMemory(mem);
    return { text: reply, chips: CRISIS_CHIPS, crisis: true, topic: "crisis", emotion: "scared" };
  }

  // 2. Detect topic / emotion / mode / people.
  const detection = detect(text, mem);
  const mode: Mode = opts.forcedMode ?? detection.mode;

  // 3. Compose response.
  const replyText = composeResponse(
    detection.topic,
    detection.secondary,
    mode,
    mem,
    text,
    detection.people,
  );

  // 4. Save memory.
  recordUserTurn(mem, text, detection.topic.id, detection.emotion, mode, detection.people[0]);
  recordBotTurn(mem, replyText, detection.topic.id);
  mem.crisisRecent = false;
  saveMemory(mem);

  return {
    text: replyText,
    chips: chipsFor(detection.topic.id, mode),
    topic: detection.topic.id,
    emotion: detection.emotion,
  };
}

/** Clear memory (used by the Clear chat button). */
export function clearTalkMemory() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem("calmCampusTalkAssistantMemory"); } catch { /* ignore */ }
}

/** Map a quick-reply chip label to a Mode override. */
export function chipToMode(chip: string): Mode | undefined {
  const c = chip.toLowerCase();
  if (c.includes("vent")) return "vent";
  if (c.includes("calm")) return "calm";
  if (c.includes("text")) return "text-help";
  if (c.includes("advice") || c.includes("tiny step")) return "advice";
  if (c.includes("question")) return "questions";
  if (c.includes("comfort")) return "comfort";
  return undefined;
}

export { normalize };