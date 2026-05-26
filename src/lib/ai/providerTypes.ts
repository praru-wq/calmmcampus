export type TalkMessage = { role: "user" | "assistant"; content: string };

export type TalkProviderContext = {
  messages: TalkMessage[];
  system: string;
  fallbackText: string;
};

export type TalkProvider = {
  name: string;
  isConfigured: () => boolean;
  streamText: (context: TalkProviderContext) => AsyncGenerator<string>;
};

export class ProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}
