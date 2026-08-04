import type { buildPokerAIRequest } from "./pokerAiState";

export interface BackendConfig {
  apiBaseUrl: string;
  model: string;
  stream: boolean;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  temperature: number | null;
  topP: number | null;
  maxTokens: number | null;
  reasoningEffort: string;
  customHeaders: Record<string, unknown>;
  customParameters: Record<string, unknown>;
  logRetentionDays: number;
  detailedLogging: boolean;
  rawStreamLogging: boolean;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
}

export interface BackendError { type: string; message: string; httpStatus?: number; requestId?: string; logFile?: string; retryCount?: number; timedOut?: boolean; cancelled?: boolean }
export interface LogSummary { id: string; filename: string; relativePath: string; timestamp: string; character: string; model: string; durationMs: number; status: string; requestId: string }

export interface DecisionResponse {
  ok: true;
  gameId: string;
  handId: string;
  turnId: string;
  characterId: string;
  requestId: string;
  decision: { action: "fold" | "check" | "call" | "bet" | "raise" | "all-in"; amount: number; table_talk: string };
  fallback: boolean;
  error?: BackendError;
  debug: { model: string; durationMs: number; retryCount: number; rawContent: string; parsedDecision: unknown; finalAction: string; logFile: string };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }); }
  catch (cause) { const error = new Error("本地 AI 后端未运行。请使用 start.bat 启动游戏。") as Error & { detail?: BackendError }; error.detail = { type: "BACKEND_NOT_RUNNING", message: error.message }; throw error; }
  const payload = await response.json().catch(() => ({ error: { type: "INVALID_RESPONSE", message: `本地后端返回了无法解析的响应（HTTP ${response.status}）。` } }));
  if (!response.ok || payload.ok === false) { const error = new Error(payload.error?.message ?? "本地后端请求失败") as Error & { detail?: BackendError }; error.detail = payload.error; throw error; }
  return payload as T;
}

export const getBackendHealth = () => api<{ ok: true; service: string; version: string; timestamp: string; debugAi: boolean }>("/api/health");
export const getBackendConfig = async () => (await api<{ ok: true; config: BackendConfig }>("/api/config")).config;
export const saveBackendConfig = async (config: Partial<BackendConfig> & { apiKey?: string }) => (await api<{ ok: true; config: BackendConfig }>("/api/config", { method: "POST", body: JSON.stringify(config) })).config;
export const clearBackendConfig = async () => (await api<{ ok: true; config: BackendConfig }>("/api/config", { method: "DELETE" })).config;
export const testBackendConnection = () => api<{ ok: true; requestId: string; model: string; modelsSupported: boolean; streamSupported: boolean; responsePreview: string; logFile: string }>("/api/test", { method: "POST", body: "{}" });
export const fetchBackendModels = async () => (await api<{ ok: true; models: string[] }>("/api/models")).models;
export const fetchLogs = async () => (await api<{ ok: true; logs: LogSummary[] }>("/api/logs")).logs;
export const fetchLog = (id: string) => api<{ ok: true; relativePath: string; content: string }>(`/api/logs/${encodeURIComponent(id)}`);
export const openLogDirectory = () => api<{ ok: true }>("/api/logs/open", { method: "POST", body: "{}" });
export const clearBackendLogs = () => api<{ ok: true }>("/api/logs", { method: "DELETE", body: JSON.stringify({ confirm: "CLEAR" }) });
export const cancelDecision = (requestId: string) => api<{ ok: boolean }>(`/api/ai/requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
export const markStaleDecision = (request: ReturnType<typeof buildPokerAIRequest>) => api<{ ok: true }>("/api/ai/stale", { method: "POST", body: JSON.stringify(request) });

function readSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try { return { event, data: JSON.parse(data.join("\n")) }; } catch { return null; }
}

export async function requestAIDecision(request: ReturnType<typeof buildPokerAIRequest>, signal: AbortSignal, onStatus: (status: string, detail?: Record<string, unknown>) => void): Promise<DecisionResponse> {
  let response: Response;
  try { response = await fetch("/api/ai/decision", { method: "POST", headers: { "Content-Type": "application/json", "X-Request-ID": request.requestId }, body: JSON.stringify(request), signal }); }
  catch (cause) {
    if (signal.aborted) { const error = new DOMException("AI 请求已取消", "AbortError"); throw error; }
    const error = new Error("本地 AI 后端未运行。请使用 start.bat 启动游戏。") as Error & { detail?: BackendError }; error.detail = { type: "BACKEND_NOT_RUNNING", message: error.message, requestId: request.requestId }; throw error;
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: { type: "INVALID_RESPONSE", message: `HTTP ${response.status}` } }));
    const error = new Error(payload.error?.message ?? "AI 请求失败") as Error & { detail?: BackendError }; error.detail = payload.error; throw error;
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) return response.json() as Promise<DecisionResponse>;
  if (!response.body) throw new Error("本地后端未返回流式响应体");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: DecisionResponse | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const parsed = readSseBlock(block);
      if (!parsed) continue;
      if (parsed.event === "status") { const detail = parsed.data as { status: string } & Record<string, unknown>; onStatus(detail.status, detail); }
      if (parsed.event === "error") { const detail = parsed.data as BackendError; const error = new Error(detail.message) as Error & { detail?: BackendError }; error.detail = detail; throw error; }
      if (parsed.event === "final") final = parsed.data as DecisionResponse;
    }
  }
  if (!final) throw new Error("流式响应结束，但没有最终 AI 决策");
  return final;
}
