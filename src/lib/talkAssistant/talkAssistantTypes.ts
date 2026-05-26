export type Emotion =
  | "sad" | "numb" | "anxious" | "panic" | "angry" | "guilty" | "ashamed"
  | "confused" | "scared" | "overwhelmed" | "rejected" | "lonely"
  | "excited" | "attached" | "hurt" | "tired" | "hopeful" | "neutral";

export type Mode =
  | "comfort" | "questions" | "advice" | "calm" | "text-help" | "vent" | "auto";

export interface TopicPack {
  id: string;
  label: string;
  keywords: string[];
  phrases?: string[];
  emotions?: Emotion[];
  validations: string[];
  reflections: string[];
  insights: string[];
  questions: string[];
  tinySteps: string[];
  closings: string[];
}

export interface DetectionResult {
  topic: TopicPack;
  secondary?: TopicPack;
  emotion: Emotion;
  mode: Mode;
  people: string[];
  isCrisis: boolean;
  crisisKind?: "suicide" | "self-harm" | "danger";
}

export interface TalkMemory {
  history: { role: "user" | "bot"; text: string; ts: number; topic?: string; emotion?: Emotion }[];
  currentTopic?: string;
  lastMood?: Emotion;
  intensity: number; // 0-10
  lastPerson?: string;
  lastSuggestedTask?: string;
  preferredMode?: Mode;
  summary?: string;
  lastOpenings: string[]; // for repetition prevention
  lastFragments: string[];
  crisisRecent?: boolean;
}

export interface AssistantReply {
  text: string;
  chips: string[];
  crisis?: boolean;
  topic?: string;
  emotion?: Emotion;
}