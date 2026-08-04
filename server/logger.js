import { appendFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_LOG_DIR = process.env.AI_LOG_DIR || path.join(ROOT, "logs");
const SENSITIVE_KEYS = new Set(["authorization", "proxy-authorization", "apikey", "api-key", "api_key", "x-api-key", "token", "session_token", "access_token", "refresh_token", "cookie", "password", "secret"]);

function localIso(date = new Date()) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (value, size = 2) => String(Math.abs(value)).padStart(size, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

function dateParts(date = new Date()) {
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`,
  };
}

export function redactSecrets(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.has(key.toLowerCase().replace(/\s/g, "")) ? "[REDACTED]" : redactSecrets(item, seen),
  ]));
}

function scrubText(text, secrets = []) {
  let result = String(text ?? "");
  for (const secret of secrets.filter(Boolean)) result = result.split(String(secret)).join("[REDACTED]");
  result = result.replace(/(Authorization\s*:\s*Bearer\s+)[^\s\r\n]+/gi, "$1[REDACTED]");
  result = result.replace(/((?:x-api-key|api-key|Cookie)\s*:\s*)[^\r\n]+/gi, "$1[REDACTED]");
  return result;
}

function truncateText(text, maxLength = 8000) {
  const value = String(text ?? "");
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...[truncated ${value.length - maxLength} characters]` : value;
}

function collectSensitiveValues(value, result = []) {
  if (!value || typeof value !== "object") return result;
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase().replace(/\s/g, "")) && typeof item === "string") result.push(item.replace(/^Bearer\s+/i, ""), item);
    else if (item && typeof item === "object") collectSensitiveValues(item, result);
  }
  return result;
}

function pretty(value, secrets) {
  if (value === undefined) return "Not provided.";
  return scrubText(JSON.stringify(redactSecrets(value), null, 2), secrets);
}

function section(title, body = "") {
  return `==================================================\n${title}\n==================================================\n\n${body}\n\n`;
}

function formatMessages(messages, secrets) {
  return (messages ?? []).map((message) => `[${message.role ?? "unknown"}]\n${scrubText(typeof message.content === "string" ? message.content : pretty(message.content, secrets), secrets)}`).join("\n\n");
}

function formatErrors(errors, secrets) {
  if (!errors?.length) return "No errors.";
  return errors.map((error, index) => [
    `Error ${index + 1}`,
    `Timestamp: ${error.timestamp ?? localIso()}`,
    `Request ID: ${error.requestId ?? ""}`,
    `Error Type: ${error.type ?? error.name ?? "UNKNOWN_ERROR"}`,
    `Message: ${error.message ?? ""}`,
    `HTTP Status: ${error.providerStatus ?? error.httpStatus ?? ""}`,
    `Remote Response Body: ${scrubText(truncateText(error.remoteBody), secrets)}`,
    `Request URL: ${error.requestUrl ?? ""}`,
    `Request Method: ${error.requestMethod ?? ""}`,
    `Duration: ${error.durationMs ?? 0} ms`,
    `Retry Count: ${error.retryCount ?? 0}`,
    `Stack: ${scrubText(truncateText(error.stack, 4000), secrets)}`,
    `Cause: ${scrubText(truncateText(error.cause?.stack ?? error.cause?.message, 2000), secrets)}`,
    `Node.js Code: ${error.code ?? error.cause?.code ?? ""}`,
    `Timed Out: ${Boolean(error.timedOut)}`,
    `User Cancelled: ${Boolean(error.cancelled)}`,
  ].join("\n")).join("\n\n");
}

function safeName(value) { return String(value ?? "unknown").replace(/[^\p{L}\p{N}_.-]+/gu, "-").slice(0, 50) || "unknown"; }

export class PokerRequestLog {
  constructor(metadata = {}, options = {}) {
    this.logDir = options.logDir ?? DEFAULT_LOG_DIR;
    this.startedAt = new Date();
    this.metadata = metadata;
    this.attempts = [];
    this.rawChunks = [];
    this.errors = [];
    this.validation = { jsonValid: false, actionValid: false, amountValid: false, repaired: false, retried: false, safeFallback: false, finalAction: "" };
    this.rawResponses = [];
    this.assembledContent = "";
    this.assembledReasoning = "";
    this.parsedDecision = null;
    this.usage = null;
    this.status = "started";
    const parts = dateParts(this.startedAt);
    const filename = `${parts.time}_${safeName(metadata.requestId)}_${safeName(metadata.characterName)}-${safeName(metadata.model)}.txt`;
    this.relativePath = path.join(parts.date, filename);
    this.filePath = path.join(this.logDir, this.relativePath);
  }
  attempt(number, detail = {}) { this.attempts.push({ number, timestamp: localIso(), ...detail }); }
  chunk(raw, timestamp = localIso()) { this.rawChunks.push({ timestamp, raw }); }
  addError(error) {
    const config = this.metadata.config ?? {};
    const secrets = [config.apiKey, ...collectSensitiveValues(config.customHeaders), ...collectSensitiveValues(config.customParameters), ...(this.metadata.secrets ?? [])];
    const recorded = { timestamp: localIso(), requestId: this.metadata.requestId, ...error, name: error?.name, type: error?.type, message: error?.message, stack: error?.stack, cause: error?.cause };
    this.errors.push(recorded);
    console.error(scrubText(`[${recorded.timestamp}] [${recorded.requestId}] ${recorded.type ?? recorded.name ?? "UNKNOWN_ERROR"}: ${recorded.message ?? ""}\n${recorded.stack ?? ""}`, secrets));
  }
  async finalize(data = {}) {
    Object.assign(this, data);
    const config = this.metadata.config ?? {};
    const secrets = [config.apiKey, ...collectSensitiveValues(config.customHeaders), ...collectSensitiveValues(config.customParameters), ...(this.metadata.secrets ?? [])];
    const detailed = config.detailedLogging !== false;
    const detailDisabled = "Detailed logging is disabled by configuration.";
    const durationMs = Date.now() - this.startedAt.getTime();
    this.metadata.durationMs = data.durationMs ?? durationMs;
    const usage = this.usage;
    const usageBody = usage ? [
      `Prompt Tokens: ${usage.prompt_tokens ?? usage.input_tokens ?? ""}`,
      `Completion Tokens: ${usage.completion_tokens ?? usage.output_tokens ?? ""}`,
      `Reasoning Tokens: ${usage.completion_tokens_details?.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens ?? ""}`,
      `Total Tokens: ${usage.total_tokens ?? ""}`,
      `Cached Tokens: ${usage.prompt_tokens_details?.cached_tokens ?? usage.input_tokens_details?.cached_tokens ?? ""}`,
    ].join("\n") : "Usage information not provided.";
    const decision = this.parsedDecision;
    const messages = this.metadata.requestBody?.messages ?? this.metadata.messages;
    const text = [
      section("POKER AI REQUEST LOG", [
        `Request ID: ${this.metadata.requestId ?? ""}`, `Timestamp: ${localIso(this.startedAt)}`, `Duration: ${this.metadata.durationMs} ms`,
        `Game ID: ${this.metadata.gameId ?? ""}`, `Hand ID: ${this.metadata.handId ?? ""}`, `Round: ${this.metadata.round ?? ""}`,
        `Character ID: ${this.metadata.characterId ?? ""}`, `Character Name: ${this.metadata.characterName ?? ""}`, `Seat: ${this.metadata.seat ?? ""}`,
        `Provider: ${this.metadata.provider ?? "OpenAI Compatible"}`, `API Base URL: ${config.apiBaseUrl ?? ""}`, `Model: ${this.metadata.model ?? config.model ?? ""}`,
        `Stream: ${Boolean(config.stream)}`, `Retry Attempt: ${Math.max(0, this.attempts.length - 1)}`, `Status: ${this.status}`,
        this.attempts.map((attempt) => `Attempt ${attempt.number}: ${attempt.timestamp}${attempt.status ? ` - ${attempt.status}` : ""}`).join("\n"),
      ].filter(Boolean).join("\n")),
      section("MESSAGES SENT TO MODEL", detailed ? formatMessages(messages, secrets) : detailDisabled),
      section("MODEL REASONING", scrubText(this.assembledReasoning || "No reasoning field returned by provider.", secrets)),
      section("MODEL CONTENT", scrubText(this.assembledContent ?? "", secrets)),
      section("FINAL DECISION", decision ? [
        `Action: ${decision.action ?? ""}`, `Amount: ${decision.amount ?? 0}`, `Table Talk: ${decision.table_talk ?? ""}`,
      ].join("\n") : "No parsed decision."),
      section("TOKEN USAGE", usageBody),
      section("ERRORS", formatErrors(this.errors, secrets)),
      section("END OF LOG"),
    ].join("");
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, scrubText(text, secrets), "utf8");
    await serverLog(`${this.status.toUpperCase()} request=${this.metadata.requestId} character=${this.metadata.characterId} model=${this.metadata.model} duration=${this.metadata.durationMs}ms log=${this.relativePath}`, { logDir: this.logDir, secrets });
    for (const error of this.errors) await serverLog(`ERROR request=${this.metadata.requestId} type=${error.type ?? error.name ?? "UNKNOWN_ERROR"} message=${error.message ?? ""} http=${error.providerStatus ?? error.httpStatus ?? ""} url=${error.requestUrl ?? ""} retries=${error.retryCount ?? 0} timeout=${Boolean(error.timedOut)} cancelled=${Boolean(error.cancelled)} code=${error.code ?? error.cause?.code ?? ""} stack=${error.stack ?? ""}`, { logDir: this.logDir, secrets });
    return this.relativePath.replaceAll("\\", "/");
  }
}

export async function serverLog(message, options = {}) {
  const logDir = options.logDir ?? DEFAULT_LOG_DIR;
  const parts = dateParts();
  const line = `[${localIso()}] ${scrubText(message, options.secrets)}\n`;
  await mkdir(logDir, { recursive: true });
  await Promise.all([
    appendFile(path.join(logDir, "server-latest.txt"), line, "utf8"),
    appendFile(path.join(logDir, `server-${parts.date}.txt`), line, "utf8"),
  ]);
}

function logId(relativePath) { return relativePath.replaceAll("\\", "/").replace("/", "__"); }
function idToRelative(id) {
  if (!/^\d{4}-\d{2}-\d{2}__[\p{L}\p{N}_.-]+\.txt$/u.test(id)) throw new Error("无效日志文件名");
  return id.replace("__", path.sep);
}

export async function listRequestLogs(logDir = DEFAULT_LOG_DIR) {
  await mkdir(logDir, { recursive: true });
  const days = (await readdir(logDir, { withFileTypes: true })).filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name));
  const items = [];
  for (const day of days) {
    for (const name of await readdir(path.join(logDir, day.name))) {
      if (!name.endsWith(".txt")) continue;
      const relativePath = path.join(day.name, name);
      const content = await readFile(path.join(logDir, relativePath), "utf8");
      const field = (label) => content.match(new RegExp(`^${label}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "";
      items.push({ id: logId(relativePath), filename: name, relativePath: relativePath.replaceAll("\\", "/"), timestamp: field("Timestamp"), character: field("Character Name"), model: field("Model"), durationMs: Number(field("Duration").replace(/\D/g, "")) || 0, status: field("Status"), requestId: field("Request ID") });
    }
  }
  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
}

export async function readRequestLog(id, logDir = DEFAULT_LOG_DIR) {
  const relativePath = idToRelative(id);
  const resolved = path.resolve(logDir, relativePath);
  if (!resolved.startsWith(path.resolve(logDir) + path.sep)) throw new Error("无效日志路径");
  return { relativePath: relativePath.replaceAll("\\", "/"), content: await readFile(resolved, "utf8") };
}

export async function clearLogs(logDir = DEFAULT_LOG_DIR) {
  const resolved = path.resolve(logDir);
  if (resolved === path.parse(resolved).root) throw new Error("拒绝清空根目录");
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
}

export async function cleanupOldLogs(retentionDays, logDir = DEFAULT_LOG_DIR) {
  const cutoff = Date.now() - Math.max(1, retentionDays) * 86400000;
  await mkdir(logDir, { recursive: true });
  for (const entry of await readdir(logDir, { withFileTypes: true })) {
    const target = path.join(logDir, entry.name);
    if (entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && (await stat(target)).mtimeMs < cutoff) await rm(target, { recursive: true, force: true });
    if (entry.isFile() && /^server-\d{4}-\d{2}-\d{2}\.txt$/.test(entry.name) && (await stat(target)).mtimeMs < cutoff) await rm(target, { force: true });
  }
}

export function openLogDirectory(logDir = DEFAULT_LOG_DIR) {
  mkdir(logDir, { recursive: true }).then(() => {
    if (process.platform === "win32") spawn("explorer.exe", [path.resolve(logDir)], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  });
}

export { localIso };
