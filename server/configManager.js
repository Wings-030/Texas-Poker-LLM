import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_CONFIG_PATH = path.join(ROOT, "config", "api-config.json");

export const DEFAULT_CONFIG = Object.freeze({
  apiBaseUrl: "", apiKey: "", model: "", stream: true,
  timeoutMs: 120000, maxRetries: 2, retryDelayMs: 1500,
  temperature: 0.7, topP: 1, maxTokens: 1200, reasoningEffort: "",
  customHeaders: {}, customParameters: {}, logRetentionDays: 30,
  detailedLogging: true, rawStreamLogging: true,
});

function numberInRange(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const SENSITIVE_KEYS = new Set(["authorization", "proxy-authorization", "apikey", "api-key", "api_key", "x-api-key", "token", "session_token", "access_token", "refresh_token", "cookie", "password", "secret"]);

function preserveRedacted(input, existing) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return normalizeObject(input);
  return Object.fromEntries(Object.entries(input).map(([key, value]) => {
    const previous = existing?.[key];
    if (value === "[REDACTED]") return [key, previous ?? value];
    if (value && typeof value === "object" && !Array.isArray(value)) return [key, preserveRedacted(value, previous)];
    return [key, value];
  }));
}

function redactPublic(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactPublic);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEYS.has(key.toLowerCase().replace(/\s/g, "")) ? "[REDACTED]" : redactPublic(item)]));
}

export function normalizeConfig(input = {}, existing = DEFAULT_CONFIG) {
  const apiKey = typeof input.apiKey === "string" && input.apiKey.trim() ? input.apiKey.trim() : existing.apiKey;
  return {
    apiBaseUrl: String(input.apiBaseUrl ?? existing.apiBaseUrl ?? "").trim(),
    apiKey,
    model: String(input.model ?? existing.model ?? "").trim(),
    stream: input.stream === undefined ? Boolean(existing.stream) : Boolean(input.stream),
    timeoutMs: numberInRange(input.timeoutMs, existing.timeoutMs, 1000, 600000),
    maxRetries: Math.round(numberInRange(input.maxRetries, existing.maxRetries, 0, 5)),
    retryDelayMs: Math.round(numberInRange(input.retryDelayMs, existing.retryDelayMs, 0, 30000)),
    temperature: input.temperature === "" || input.temperature === null ? null : numberInRange(input.temperature, existing.temperature, 0, 2),
    topP: input.topP === "" || input.topP === null ? null : numberInRange(input.topP, existing.topP, 0, 1),
    maxTokens: input.maxTokens === "" || input.maxTokens === null ? null : Math.round(numberInRange(input.maxTokens, existing.maxTokens, 1, 200000)),
    reasoningEffort: String(input.reasoningEffort ?? existing.reasoningEffort ?? "").trim(),
    customHeaders: input.customHeaders === undefined ? normalizeObject(existing.customHeaders) : preserveRedacted(input.customHeaders, existing.customHeaders),
    customParameters: input.customParameters === undefined ? normalizeObject(existing.customParameters) : preserveRedacted(input.customParameters, existing.customParameters),
    logRetentionDays: Math.round(numberInRange(input.logRetentionDays, existing.logRetentionDays, 1, 3650)),
    detailedLogging: input.detailedLogging === undefined ? Boolean(existing.detailedLogging) : Boolean(input.detailedLogging),
    rawStreamLogging: input.rawStreamLogging === undefined ? Boolean(existing.rawStreamLogging) : Boolean(input.rawStreamLogging),
  };
}

export function apiKeyPreview(apiKey) {
  if (!apiKey) return "";
  const suffix = apiKey.slice(-4);
  const prefix = apiKey.includes("-") ? `${apiKey.split("-")[0]}-` : "";
  return `${prefix}****${suffix}`;
}

export function publicConfig(config) {
  const { apiKey, ...safe } = config;
  return { ...safe, customHeaders: redactPublic(safe.customHeaders), customParameters: redactPublic(safe.customParameters), apiKeyConfigured: Boolean(apiKey), apiKeyPreview: apiKeyPreview(apiKey) };
}

export class ConfigManager {
  constructor(configPath = process.env.AI_CONFIG_PATH || DEFAULT_CONFIG_PATH) { this.configPath = configPath; }
  async read() {
    try { return normalizeConfig(JSON.parse(await readFile(this.configPath, "utf8")), DEFAULT_CONFIG); }
    catch (error) { if (error?.code === "ENOENT") return { ...DEFAULT_CONFIG }; throw error; }
  }
  async save(input) {
    const config = normalizeConfig(input, await this.read());
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    return config;
  }
  async clear() { await rm(this.configPath, { force: true }); return { ...DEFAULT_CONFIG }; }
}

export const configManager = new ConfigManager();
