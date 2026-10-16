import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "../mockProvider.js";
import { buildRequestBody, requestProvider } from "../apiClient.js";
import { getModels } from "../modelService.js";

let server;
let baseUrl;
beforeAll(async () => {
  vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "true");
  server = await new Promise((resolve) => { const listener = createMockProvider().listen(0, "127.0.0.1", () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
});
afterAll(async () => { await new Promise((resolve) => server.close(resolve)); vi.unstubAllEnvs(); });

function config(model, overrides = {}) {
  return { apiBaseUrl: baseUrl, apiKey: "test", model, stream: false, timeoutMs: 300, maxRetries: 0, retryDelayMs: 1, temperature: 0.7, topP: 1, maxTokens: 100, reasoningEffort: "", customHeaders: {}, customParameters: {}, ...overrides };
}

describe("OpenAI compatible client", () => {
  it("gets models and parses non-stream responses", async () => {
    expect(await getModels(config("mock-normal"))).toContain("mock-stream");
    const current = config("mock-normal");
    const result = await requestProvider({ config: current, body: buildRequestBody(current, [{ role: "user", content: "test" }]), requestId: "normal" });
    expect(result.content).toContain('"action":"check"');
  });

  it("parses streaming content, reasoning, usage, and raw chunks", async () => {
    const current = config("mock-reasoning", { stream: true });
    const chunks = [];
    const reasoningChunks = [];
    const result = await requestProvider({ config: current, body: buildRequestBody(current, [{ role: "user", content: "test" }]), requestId: "stream", onChunk: (chunk) => chunks.push(chunk), onReasoning: (chunk) => reasoningChunks.push(chunk) });
    expect(result.content).toContain('"action":"check"');
    expect(result.reasoning).toBe("Private provider reasoning.");
    expect(reasoningChunks.join("")).toBe("Private provider reasoning.");
    expect(result.usage.total_tokens).toBe(30);
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("classifies provider, timeout, cancellation, and invalid response errors", async () => {
    await expect(requestProvider({ config: { ...config("mock-normal"), apiBaseUrl: "not a url" }, body: {}, requestId: "url" })).rejects.toMatchObject({ type: "INVALID_BASE_URL" });
    await expect(requestProvider({ config: config("mock-401"), body: buildRequestBody(config("mock-401"), []), requestId: "401" })).rejects.toMatchObject({ type: "INVALID_API_KEY" });
    await expect(requestProvider({ config: config("mock-garbled"), body: buildRequestBody(config("mock-garbled"), []), requestId: "bad" })).rejects.toMatchObject({ type: "INVALID_RESPONSE" });
    await expect(requestProvider({ config: config("mock-timeout", { timeoutMs: 30 }), body: buildRequestBody(config("mock-timeout"), []), requestId: "timeout" })).rejects.toMatchObject({ type: "REQUEST_TIMEOUT" });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    await expect(requestProvider({ config: config("mock-timeout", { timeoutMs: 500 }), body: buildRequestBody(config("mock-timeout"), []), requestId: "cancel", signal: controller.signal })).rejects.toMatchObject({ type: "REQUEST_CANCELLED" });
  });

  it("retries retryable statuses only up to the configured limit", async () => {
    let attempts = 0;
    const current = config("mock-429", { maxRetries: 2 });
    await expect(requestProvider({ config: current, body: buildRequestBody(current, []), requestId: "retry", onAttempt: () => { attempts += 1; } })).rejects.toMatchObject({ type: "RATE_LIMITED" });
    expect(attempts).toBe(3);
  });
});
