import type { DetectionResult } from "./talkAssistantTypes";

const SUICIDE_PATTERNS = [
  /\bkill (myself|me)\b/i,
  /\bwant(ed)? to die\b/i,
  /\b(don'?t|dont|do not) want to (be here|exist|live|wake up)\b/i,
  /\bend (it|my life|things)\b/i,
  /\bsuicid\w*/i,
  /\b(goodbye|good bye) (forever|world)\b/i,
  /\b(overdose|od)\b/i,
  /\bi'?m? (done|finished) with life\b/i,
  /\bi have a plan\b/i,
  /\bwish i (was|were) dead\b/i,
  /\bwant to disappear forever\b/i,
  /\bno (point|reason) (in )?living\b/i,
];

const SELF_HARM_PATTERNS = [
  /\b(cut|cutting|cuts) (myself|my arms?|my wrists?|my legs?)\b/i,
  /\bself[- ]?harm\w*/i,
  /\bhurt (myself|me)\b/i,
  /\bharm (myself|me)\b/i,
  /\bi cut myself\b/i,
  /\bburn(ed|ing)? myself\b/i,
];

const DANGER_PATTERNS = [
  /\bcan'?t stay safe\b/i,
  /\bnot safe (alone|right now|tonight)\b/i,
  /\bsomeone is hurting me\b/i,
  /\bhe (hits|hit|beats|beat) me\b/i,
  /\bshe (hits|hit|beats|beat) me\b/i,
  /\bbeing abused\b/i,
];

export function detectCrisis(text: string): Pick<DetectionResult, "isCrisis" | "crisisKind"> {
  if (SUICIDE_PATTERNS.some((r) => r.test(text))) return { isCrisis: true, crisisKind: "suicide" };
  if (DANGER_PATTERNS.some((r) => r.test(text))) return { isCrisis: true, crisisKind: "danger" };
  if (SELF_HARM_PATTERNS.some((r) => r.test(text))) return { isCrisis: true, crisisKind: "self-harm" };
  return { isCrisis: false };
}

export function crisisResponse(kind: "suicide" | "self-harm" | "danger" | undefined): string {
  if (kind === "suicide") {
    return [
      "I'm really glad you told me. What you're carrying sounds serious, and I don't want you to be alone with it right now.",
      "",
      "Can you tell me — are you in immediate danger, or feeling like you might hurt yourself tonight?",
      "",
      "Please reach out for emergency help now. In India you can call 112, or go to the nearest emergency room. If calling feels too hard, message one person you trust and say: \"I'm not safe alone right now. Please stay with me.\"",
      "",
      "If anything around you could be used to hurt yourself, please move away from it and try to sit somewhere with another person nearby. I'm here, and I'm not going anywhere.",
    ].join("\n");
  }
  if (kind === "self-harm") {
    return [
      "Thank you for trusting me with this. Hurting yourself is your mind trying to release something that feels unbearable — I hear how much pain is underneath that.",
      "",
      "Are you safe right now, or is the urge very strong this moment?",
      "",
      "If the urge is loud, try one of these instead: hold an ice cube in your hand until it melts, draw red lines on your skin with a marker, or squeeze a pillow as hard as you can for 60 seconds. These won't fix everything, but they can carry you through the wave.",
      "",
      "Please also tell one trusted person today — a friend, sibling, or campus counselor. You deserve support that's bigger than just me. In India, 112 is there if things feel unsafe.",
    ].join("\n");
  }
  return [
    "I hear you, and I'm worried about your safety. You shouldn't have to face this alone.",
    "",
    "Are you somewhere safe right now? If you're in immediate danger, please call 112 (India emergency) or get to a place where other people are around.",
    "",
    "If you can, message one trusted person and tell them where you are. You deserve protection and support, and reaching out is not weakness — it's the right move.",
  ].join("\n");
}

export const CRISIS_CHIPS = ["I'm safe right now", "I need help now", "Help me tell someone"];