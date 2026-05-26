import type { TalkMessage, TalkProvider, TalkProviderContext } from "./providerTypes";
import { ProviderError } from "./providerTypes";
import {
  doneChunk,
  fetchWithTimeout,
  manualTextStream,
  openAICompatibleChunk,
  readSseData,
  responseError,
  summarizeProviderError,
} from "./streamUtils";

const RECENT_MESSAGE_LIMIT = 16;
const MID_STREAM_RECOVERY =
  "\n\nI'm going to pause there for a second, but hold onto the main thing above. Come back with the next bit and we'll keep going.";

type OpenAICompatibleConfig = {
  name: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  endpoint: string;
  extraHeaders?: Record<string, string>;
};

type GeminiPart = { text?: unknown };
type GeminiChunk = {
  candidates?: {
    content?: {
      parts?: GeminiPart[];
    };
  }[];
};

type OpenAICompatibleChunk = {
  choices?: {
    delta?: { content?: unknown };
    message?: { content?: unknown };
  }[];
};

type CloudflareResponse = {
  result?: {
    response?: unknown;
    text?: unknown;
    output_text?: unknown;
    output?: unknown;
  };
};

type CohereResponse = {
  message?: {
    content?: unknown;
  };
  text?: unknown;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function recentMessages(messages: TalkMessage[]) {
  return messages.slice(-RECENT_MESSAGE_LIMIT);
}

function toOpenAIMessages(system: string, messages: TalkMessage[]) {
  return [
    { role: "system", content: system },
    ...recentMessages(messages).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function toGeminiContents(messages: TalkMessage[]) {
  return recentMessages(messages).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function getGeminiChunkText(chunk: GeminiChunk) {
  return (
    chunk.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("") ?? ""
  );
}

function getOpenAIChunkText(chunk: OpenAICompatibleChunk) {
  const delta = chunk.choices?.[0]?.delta?.content;
  const message = chunk.choices?.[0]?.message?.content;
  if (typeof delta === "string") return delta;
  if (typeof message === "string") return message;
  return "";
}

function getFirstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

function extractCloudflareText(payload: CloudflareResponse) {
  const result = payload.result;
  if (!result) return "";

  return (
    getFirstString(result.response) ||
    getFirstString(result.text) ||
    getFirstString(result.output_text) ||
    getFirstString(result.output)
  );
}

function extractCohereText(payload: CohereResponse) {
  return getFirstString(payload.message?.content) || getFirstString(payload.text);
}

async function* streamGemini(context: TalkProviderContext) {
  const apiKey = env("GEMINI_API_KEY");
  const models = env("GEMINI_MODEL") ? [env("GEMINI_MODEL")] : ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let lastError: unknown = new ProviderError("invalid response");

  for (const model of models) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: context.system }],
        },
        contents: toGeminiContents(context.messages),
      }),
    });

    if (!response.ok) {
      const error = await responseError(response);
      if (response.status === 429 || response.status === 401 || response.status === 403) throw error;
      lastError = error;
      continue;
    }

    if (!response.body) throw new ProviderError("empty stream");

    let emitted = false;
    for await (const data of readSseData(response.body)) {
      const text = getGeminiChunkText(JSON.parse(data) as GeminiChunk);
      if (text) {
        emitted = true;
        yield text;
      }
    }

    if (emitted) return;
    lastError = new ProviderError("empty stream");
  }

  throw lastError;
}

function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): TalkProvider {
  return {
    name: config.name,
    isConfigured: () => Boolean(env(config.apiKeyEnv)),
    async *streamText(context) {
      const response = await fetchWithTimeout(config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env(config.apiKeyEnv)}`,
          "Content-Type": "application/json",
          ...config.extraHeaders,
        },
        body: JSON.stringify({
          model: env(config.modelEnv) || config.defaultModel,
          messages: toOpenAIMessages(context.system, context.messages),
          temperature: 0.75,
          stream: true,
        }),
      });

      if (!response.ok) throw await responseError(response);
      if (!response.body) throw new ProviderError("empty stream");

      let emitted = false;
      for await (const data of readSseData(response.body)) {
        const text = getOpenAIChunkText(JSON.parse(data) as OpenAICompatibleChunk);
        if (text) {
          emitted = true;
          yield text;
        }
      }

      if (!emitted) throw new ProviderError("empty stream");
    },
  };
}

function createCloudflareProvider(): TalkProvider {
  return {
    name: "Cloudflare Workers AI",
    isConfigured: () => Boolean(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_API_TOKEN")),
    async *streamText(context) {
      const model = env("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.1-8b-instruct-fast";
      const url = `https://api.cloudflare.com/client/v4/accounts/${env("CLOUDFLARE_ACCOUNT_ID")}/ai/run/${model}`;
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("CLOUDFLARE_API_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: toOpenAIMessages(context.system, context.messages),
        }),
      });

      if (!response.ok) throw await responseError(response);

      const text = extractCloudflareText((await response.json()) as CloudflareResponse);
      if (!text) throw new ProviderError("invalid response");

      yield* manualTextStream(text);
    },
  };
}

function createCohereProvider(): TalkProvider {
  return {
    name: "Cohere",
    isConfigured: () => Boolean(env("COHERE_API_KEY")),
    async *streamText(context) {
      const response = await fetchWithTimeout("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("COHERE_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env("COHERE_MODEL") || "command-a-03-2025",
          messages: toOpenAIMessages(context.system, context.messages),
          temperature: 0.75,
        }),
      });

      if (!response.ok) throw await responseError(response);

      const text = extractCohereText((await response.json()) as CohereResponse);
      if (!text) throw new ProviderError("invalid response");

      yield* manualTextStream(text);
    },
  };
}

const providers: TalkProvider[] = [
  {
    name: "Gemini",
    isConfigured: () => Boolean(env("GEMINI_API_KEY")),
    streamText: streamGemini,
  },
  createOpenAICompatibleProvider({
    name: "Groq",
    apiKeyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.1-8b-instant",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
  }),
  createOpenAICompatibleProvider({
    name: "OpenRouter",
    apiKeyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "google/gemini-2.0-flash-001",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    extraHeaders: {
      "X-Title": "CalmCampus",
    },
  }),
  createOpenAICompatibleProvider({
    name: "Mistral",
    apiKeyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
  }),
  createOpenAICompatibleProvider({
    name: "SambaNova",
    apiKeyEnv: "SAMBANOVA_API_KEY",
    modelEnv: "SAMBANOVA_MODEL",
    defaultModel: "Meta-Llama-3.1-8B-Instruct",
    endpoint: "https://api.sambanova.ai/v1/chat/completions",
  }),
  createOpenAICompatibleProvider({
    name: "Cerebras",
    apiKeyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "llama3.1-8b",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
  }),
  createCloudflareProvider(),
  createOpenAICompatibleProvider({
    name: "Hugging Face",
    apiKeyEnv: "HF_TOKEN",
    modelEnv: "HF_MODEL",
    defaultModel: "openai/gpt-oss-20b",
    endpoint: "https://router.huggingface.co/v1/chat/completions",
  }),
  createOpenAICompatibleProvider({
    name: "GitHub Models",
    apiKeyEnv: "GITHUB_TOKEN",
    modelEnv: "GITHUB_MODEL",
    defaultModel: "openai/gpt-4o-mini",
    endpoint: "https://models.github.ai/inference/chat/completions",
  }),
  createCohereProvider(),
  createOpenAICompatibleProvider({
    name: "NVIDIA NIM",
    apiKeyEnv: "NVIDIA_API_KEY",
    modelEnv: "NVIDIA_MODEL",
    defaultModel: "meta/llama-3.1-8b-instruct",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
  }),
];

export function createTalkProviderStream(context: TalkProviderContext) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const provider of providers) {
        if (!provider.isConfigured()) continue;

        console.log(`Trying provider: ${provider.name}`);
        let emitted = false;

        try {
          for await (const text of provider.streamText(context)) {
            if (!text) continue;
            if (!emitted) {
              emitted = true;
              console.log(`Provider selected: ${provider.name}`);
            }
            controller.enqueue(encoder.encode(openAICompatibleChunk(text)));
          }

          if (emitted) {
            controller.enqueue(encoder.encode(doneChunk()));
            controller.close();
            return;
          }

          console.error(`${provider.name} failed: invalid response`);
        } catch (error) {
          console.error(`${provider.name} failed: ${summarizeProviderError(error)}`);
          if (emitted) {
            for await (const chunk of manualTextStream(MID_STREAM_RECOVERY)) {
              controller.enqueue(encoder.encode(openAICompatibleChunk(chunk)));
            }
            controller.enqueue(encoder.encode(doneChunk()));
            controller.close();
            return;
          }
        }
      }

      console.log("All external providers failed, using final friendly fallback");
      for await (const chunk of manualTextStream(context.fallbackText)) {
        controller.enqueue(encoder.encode(openAICompatibleChunk(chunk)));
      }
      controller.enqueue(encoder.encode(doneChunk()));
      controller.close();
    },
  });
}
