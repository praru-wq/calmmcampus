import { ProviderError } from "./providerTypes";

const DEFAULT_TIMEOUT_MS = 20000;

export function openAICompatibleChunk(text: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

export function doneChunk() {
  return "data: [DONE]\n\n";
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunkText(text: string, wordsPerChunk = 5) {
  const words = text.match(/\S+\s*/g) ?? [text];
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(""));
  }

  return chunks;
}

export async function* manualTextStream(text: string) {
  for (const chunk of chunkText(text)) {
    yield chunk;
    await sleep(35);
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProviderError("timeout");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function responseError(response: Response) {
  let detail = "";

  try {
    detail = (await response.text()).slice(0, 240);
  } catch {
    detail = "";
  }

  const label =
    response.status === 429
      ? "429 rate limit"
      : response.status === 401 || response.status === 403
        ? `${response.status} auth`
        : `${response.status}${detail ? ` ${detail}` : ""}`;

  return new ProviderError(label, response.status);
}

export async function* readSseData(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") return;
        yield data;
      }
    }

    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      const data = tail.slice(5).trim();
      if (data && data !== "[DONE]") yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

export function summarizeProviderError(error: unknown) {
  if (error instanceof ProviderError) return error.message;
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}
