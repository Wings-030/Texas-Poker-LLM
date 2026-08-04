import { setTimeout as delay } from "node:timers/promises";
import { AppError, classifyError, providerHttpError } from "./errorHandler.js";
import { buildProviderUrl, extractProviderContent, mergeStreamText } from "./responseParser.js";

const FORBIDDEN_HEADERS = new Set(["host", "content-length", "connection"]);
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function compactObject(value) {
  if (Array.isArray(value)) return value.map(compactObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined).map(([key, item]) => [key, item && typeof item === "object" ? compactObject(item) : item]));
}

export function buildRequestBody(config, messages, overrides = {}) {
  const body = {
    model: overrides.model ?? config.model,
    messages,
    stream: overrides.stream ?? config.stream,
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    reasoning_effort: config.reasoningEffort,
    ...compactObject(config.customParameters),
    ...compactObject(overrides.parameters),
  };
  return compactObject(body);
}

function buildHeaders(config) {
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  for (const [key, value] of Object.entries(config.customHeaders ?? {})) {
    if (!FORBIDDEN_HEADERS.has(key.toLowerCase()) && value !== "" && value !== null && value !== undefined) headers[key] = String(value);
  }
  return headers;
}

function attachAbort(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(new Error("Request timeout")); }, timeoutMs);
  const cancel = () => controller.abort(externalSignal?.reason ?? new Error("Request cancelled"));
  if (externalSignal) {
    if (externalSignal.aborted) cancel();
    else externalSignal.addEventListener("abort", cancel, { once: true });
  }
  return { controller, timedOut: () => timedOut, cleanup: () => { clearTimeout(timeout); externalSignal?.removeEventListener("abort", cancel); } };
}

async function parseNonStream(response, context) {
  const rawText = await response.text();
  let rawResponse;
  try { rawResponse = JSON.parse(rawText); }
  catch (cause) { throw new AppError("INVALID_RESPONSE", "模型服务返回了无法解析的非 JSON 响应。", { ...context, cause, remoteBody: rawText, httpStatus: 502 }); }
  const extracted = extractProviderContent(rawResponse);
  if (!extracted.content && !extracted.reasoning) throw new AppError("INVALID_RESPONSE", "模型响应中没有可识别的 content 字段。", { ...context, remoteBody: rawText, httpStatus: 502 });
  return { ...extracted, rawResponse, rawChunks: [] };
}

async function parseStream(response, context, callbacks) {
  if (!response.body) throw new AppError("INVALID_RESPONSE", "模型服务未返回可读取的流。", { ...context, httpStatus: 502 });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let finishReason = null;
  let usage = null;
  let doneMarker = false;
  const rawChunks = [];
  const events = [];

  const handleData = (data) => {
    if (!data) return;
    if (data === "[DONE]") { doneMarker = true; return; }
    try {
      const payload = JSON.parse(data);
      events.push(payload);
      const extracted = extractProviderContent(payload);
      const previousContent = content;
      const previousReasoning = reasoning;
      content = mergeStreamText(content, extracted.content);
      reasoning = mergeStreamText(reasoning, extracted.reasoning);
      finishReason = extracted.finishReason ?? finishReason;
      usage = extracted.usage ?? usage;
      if (content !== previousContent) callbacks.onContent?.(content.slice(previousContent.length), content);
      if (reasoning !== previousReasoning) callbacks.onReasoning?.(reasoning.slice(previousReasoning.length), reasoning);
    } catch {
      events.push({ malformed_sse_data: data });
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      const timestamp = new Date().toISOString();
      rawChunks.push({ timestamp, raw });
      callbacks.onChunk?.(raw, timestamp);
      buffer += raw.replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        handleData(data);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) if (line.startsWith("data:")) handleData(line.slice(5).trimStart());
    }
  } catch (cause) {
    throw new AppError("STREAM_INTERRUPTED", "流式响应在完成前意外中断。", { ...context, cause, httpStatus: 502 });
  }
  if (!content && !reasoning) throw new AppError("INVALID_RESPONSE", "流式响应中没有可识别的内容。", { ...context, remoteBody: JSON.stringify(events), httpStatus: 502 });
  if (!doneMarker && !finishReason) callbacks.onWarning?.("Provider stream ended without [DONE] or finish_reason.");
  return { content, reasoning, finishReason, usage, rawResponse: { events, doneMarker, finishReason, usage }, rawChunks };
}

export async function requestProvider({ config, endpoint = "chat/completions", method = "POST", body, signal, requestId, onAttempt, onChunk, onContent, onReasoning, onWarning }) {
  if (!config.apiBaseUrl || !config.model && endpoint === "chat/completions") throw new AppError("CONFIG_MISSING", "请先配置 API Base URL 和模型名称。", { httpStatus: 400 });
  let requestUrl;
  try { requestUrl = buildProviderUrl(config.apiBaseUrl, endpoint); }
  catch (cause) { throw new AppError("INVALID_BASE_URL", `API Base URL 无效：${cause.message}`, { cause, httpStatus: 400 }); }
  const maximumAttempts = Math.max(1, Number(config.maxRetries ?? 0) + 1);
  let lastError;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const startedAt = Date.now();
    onAttempt?.(attempt);
    const abort = attachAbort(signal, config.timeoutMs);
    try {
      const response = await fetch(requestUrl, { method, headers: buildHeaders(config), body: body === undefined ? undefined : JSON.stringify(body), signal: abort.controller.signal });
      if (!response.ok) {
        const remoteBody = await response.text();
        throw providerHttpError(response.status, remoteBody, { requestUrl, requestMethod: method, durationMs: Date.now() - startedAt, retryCount: attempt - 1 });
      }
      if (method === "GET") {
        const rawText = await response.text();
        let rawResponse;
        try { rawResponse = JSON.parse(rawText); }
        catch (cause) { throw new AppError("INVALID_RESPONSE", "服务商返回了无法解析的 JSON。", { requestUrl, requestMethod: method, cause, remoteBody: rawText, httpStatus: 502 }); }
        abort.cleanup();
        return { content: "", reasoning: "", finishReason: null, usage: null, rawResponse, rawChunks: [], attempt, requestUrl };
      }
      const contentType = response.headers.get("content-type") ?? "";
      const result = body?.stream || contentType.includes("text/event-stream")
        ? await parseStream(response, { requestUrl, requestMethod: method, requestId }, { onChunk, onContent, onReasoning, onWarning })
        : await parseNonStream(response, { requestUrl, requestMethod: method, requestId });
      abort.cleanup();
      return { ...result, attempt, requestUrl };
    } catch (error) {
      abort.cleanup();
      const classified = classifyError(error, { requestUrl, requestMethod: method, durationMs: Date.now() - startedAt, retryCount: attempt - 1, timedOut: abort.timedOut(), cancelled: Boolean(signal?.aborted && !abort.timedOut()) });
      lastError = classified;
      const retryable = RETRYABLE_STATUS.has(classified.providerStatus) || ["NETWORK_ERROR", "DNS_ERROR", "CONNECTION_RESET", "CONNECTION_REFUSED", "STREAM_INTERRUPTED"].includes(classified.type);
      if (!retryable || attempt >= maximumAttempts || classified.cancelled) throw classified;
      await delay(Number(config.retryDelayMs ?? 1500) * attempt, undefined, { signal }).catch(() => {});
    }
  }
  throw lastError;
}
