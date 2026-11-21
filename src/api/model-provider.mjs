import OpenAI from "openai";
import { AutoTokenizer } from "@huggingface/transformers";
import { randomUUID } from "node:crypto";

let tokenizerPromise;
const positive = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const failure = (code, message, status = 503) => Object.assign(new Error(message), { code, status });

export function getModelSettings(environment = process.env) {
  const provider = (environment.AI_PROVIDER || "openai").trim().toLowerCase();
  if (!["openai", "ollama", "retrieval"].includes(provider)) throw failure("MODEL_PROVIDER_INVALID", "AI_PROVIDER must be openai, ollama or retrieval.");
  const baseUrl = new URL(environment.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
  if (provider === "ollama" && (!['127.0.0.1', 'localhost', '[::1]'].includes(baseUrl.hostname) || !['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash || baseUrl.pathname !== "/")) {
    throw failure("OLLAMA_URL_INVALID", "The local model must use a loopback HTTP endpoint.");
  }
  return {
    provider,
    model: provider === "ollama" ? environment.OLLAMA_MODEL || "qwen3:4b-instruct-2507-q4_K_M" : environment.OPENAI_MODEL || "gpt-5-mini",
    baseUrl: baseUrl.origin,
    contextLength: positive(environment.OLLAMA_CONTEXT_LENGTH, 16384),
    timeoutMs: positive(environment.OLLAMA_TIMEOUT_MS, 180000),
    configured: provider !== "openai" || Boolean(environment.OPENAI_API_KEY),
    retrievalFallback: environment.AI_RETRIEVAL_FALLBACK === "true",
  };
}

export function toChatMessages(request) {
  return [
    { role: "system", content: String(request.instructions || "") },
    ...(request.input || []).map(message => ({
      role: message.role,
      content: typeof message.content === "string" ? message.content : (message.content || []).map(part => part.text || "").join("\n"),
    })),
  ];
}

async function countLocalTokens(messages) {
  tokenizerPromise ||= AutoTokenizer.from_pretrained("Qwen/Qwen3-4B-Instruct-2507", {
    cache_dir: process.env.HUGGINGFACE_CACHE_DIR || "./.cache/huggingface",
  }).catch(error => { tokenizerPromise = null; throw error; });
  const tokenizer = await tokenizerPromise;
  // Reserve extra template tokens below; never silently truncate clinical inputs.
  return tokenizer.encode(messages.map(message => `${message.role}\n${message.content}`).join("\n")).length;
}

export function createModelResponder({ environment = process.env, fetchImpl = globalThis.fetch, countTokens = countLocalTokens, openAIClientFactory = options => new OpenAI(options) } = {}) {
  let openai;
  return async request => {
    const settings = getModelSettings(environment);
    if (settings.provider === "retrieval") throw failure("GENERATION_DISABLED", "Retrieval-only mode is enabled.");
    if (settings.provider === "openai") {
      openai ||= openAIClientFactory({ apiKey: environment.OPENAI_API_KEY });
      return openai.responses.create({ ...request, model: settings.model, store: false });
    }
    const messages = toChatMessages(request);
    const outputTokens = Math.min(request.max_output_tokens || 1800, 1800);
    const inputTokens = await countTokens(messages);
    if (inputTokens + outputTokens + 512 > settings.contextLength) {
      throw failure("LOCAL_CONTEXT_TOO_LARGE", "The supplied data exceeds the local model context window.", 413);
    }
    let response;
    try {
      response = await fetchImpl(`${settings.baseUrl}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(settings.timeoutMs),
        body: JSON.stringify({
          model: settings.model, messages, stream: false, think: false, keep_alive: "5m",
          options: { num_ctx: settings.contextLength, num_predict: outputTokens, temperature: 0.2 },
        }),
      });
    } catch {
      throw failure("OLLAMA_UNAVAILABLE", "Local model service is unavailable.");
    }
    if (!response.ok) throw failure(response.status === 404 ? "OLLAMA_MODEL_MISSING" : "OLLAMA_FAILED", "Local model request failed.");
    const data = await response.json();
    const answer = String(data.message?.content || "").trim();
    if (!answer || data.done !== true || data.done_reason === "length") throw failure("OLLAMA_INCOMPLETE", "Local model did not complete its answer.");
    return {
      id: `local-${randomUUID()}`, output_text: answer, provider: "ollama", model: data.model,
      usage: { input_tokens: data.prompt_eval_count, output_tokens: data.eval_count },
    };
  };
}

export const createModelResponse = createModelResponder();
