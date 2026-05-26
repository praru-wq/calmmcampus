import type { TalkMessage } from "./providerTypes";

function getLastUserMessage(messages: TalkMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function getPreviousAssistantMessage(messages: TalkMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant")?.content.trim() ?? "";
}

function isCrisisText(text: string) {
  return /\b(kill myself|suicide|end my life|want to die|wanna die|hurt myself|self[-\s]?harm|cut myself|overdose|jump off|not be here|end everything|unsafe|in danger|abuse|abused|assault|assaulted)\b/i.test(
    text,
  );
}

function isStudyText(text: string) {
  return /\b(study|studying|exam|test|marks|chapter|topic|homework|assignment|syllabus|revision|revise|focus|notes|lecture|class|semester|deadline)\b/i.test(
    text,
  );
}

function isEmotionalText(text: string) {
  return /\b(sad|crying|cried|lonely|alone|anxious|anxiety|panic|panicking|depressed|tired|burnout|burned out|overwhelmed|scared|hurt|heartbroken|friend|crush|family|fight|fighting|ignored)\b/i.test(
    text,
  );
}

function wantsDraft(messages: TalkMessage[], mode?: string) {
  const lastUser = getLastUserMessage(messages);
  const lastAssistant = getPreviousAssistantMessage(messages);
  const lower = lastUser.toLowerCase();

  return (
    mode === "text-help" ||
    /\b(what\s+(should|do)\s+i\s+(reply|say)|what\s+i\s+should\s+(reply|say)|help me reply|help me text|help me message|draft|message|text him|text her|text them)\b/i.test(
      lastUser,
    ) ||
    (/^(sure|yes|yeah|yep|okay|ok|please)$/i.test(lower) &&
      /\b(word|draft|message|reply|text)\b/i.test(lastAssistant))
  );
}

export function buildLocalFallbackText(messages: TalkMessage[], mode?: string) {
  const lastUser = getLastUserMessage(messages);

  if (isCrisisText(lastUser)) {
    return (
      "I'm having trouble connecting fully right now, but your safety matters more than the chat. " +
      "If you might hurt yourself or you're in danger, please contact someone trusted near you right now. " +
      "If you're in India and it feels urgent, call 112. Are you physically safe right now?"
    );
  }

  if (wantsDraft(messages, mode)) {
    return (
      "I'm having a little connection moment, but don't wait on me for the whole thing. " +
      'For now, you can send something simple like: "Hey, I want to say this honestly. This has been bothering me, and I need a little space to think." ' +
      "Keep it short. You can always soften it later."
    );
  }

  if (isStudyText(lastUser)) {
    return (
      "I'm having a little connection moment, but don't waste the mood. " +
      "Go do one tiny study step now, literally just open the topic or read one page, and come back after a bit. " +
      "We'll continue from there."
    );
  }

  if (isEmotionalText(lastUser)) {
    return (
      "Hey, I'm having trouble connecting properly right now, but I don't want you sitting with this alone. " +
      "If it feels heavy, stay near someone you trust for a bit, okay? Come back after a little while and we'll continue slowly."
    );
  }

  return (
    "Okay, tiny pause from my side. We've been talking for a bit and I'm having trouble connecting right now. " +
    "How about you take a small study break or drink some water, and come back in a little while? I'll be right here."
  );
}
