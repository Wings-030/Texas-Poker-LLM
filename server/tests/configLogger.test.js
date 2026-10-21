import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ConfigManager, publicConfig } from "../configManager.js";
import { PokerRequestLog, listRequestLogs, readRequestLog, redactSecrets } from "../logger.js";

const temporary = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((target) => rm(target, { recursive: true, force: true }))); });

describe("configuration and logging", () => {
  it("saves configuration while never exposing the API key", async () => {
    const manager = new ConfigManager("test-config-scope");
    const saved = await manager.save({ apiBaseUrl: "http://127.0.0.1:3999/v1", apiKey: "sk-super-secret-1234", model: "mock-normal", customHeaders: { Authorization: "Bearer custom-secret" } });
    expect((await manager.read()).apiKey).toBe("sk-super-secret-1234");
    expect(publicConfig(saved)).not.toHaveProperty("apiKey");
    expect(publicConfig(saved).apiKeyPreview).toBe("sk-****1234");
    expect(publicConfig(saved).customHeaders.Authorization).toBe("[REDACTED]");
    await manager.save({ customHeaders: { Authorization: "[REDACTED]", "X-Trace": "enabled" } });
    expect((await manager.read()).customHeaders).toEqual({ Authorization: "Bearer custom-secret", "X-Trace": "enabled" });
  });

  it("recursively redacts authentication fields", () => {
    expect(redactSecrets({ nested: { authorization: "Bearer secret", apiKey: "secret", safe: "ok" } })).toEqual({ nested: { authorization: "[REDACTED]", apiKey: "[REDACTED]", safe: "ok" } });
  });

  it("creates compact request logs without leaking the API key", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "poker-logs-")); temporary.push(directory);
    const secret = "sk-never-write-this";
    const customSecret = "custom-provider-secret";
    const log = new PokerRequestLog({ requestId: "request-1", gameId: "game", handId: "hand", round: "flop", characterId: "ai-test", characterName: "Tester", seat: 1, model: "mock-normal", config: { apiBaseUrl: "http://localhost/v1", apiKey: secret, stream: true, customHeaders: { Authorization: `Bearer ${customSecret}` }, customParameters: {}, rawStreamLogging: true }, gameState: { pot: 100 }, systemPrompt: "Full system prompt", messages: [{ role: "system", content: "Full system prompt" }], requestBody: { model: "mock-normal", messages: [] } }, { logDir: directory });
    log.attempt(1);
    log.chunk(`data: {"token":"${secret}","padding":"${"x".repeat(100000)}"}`);
    const logFile = await log.finalize({ status: "success", rawResponses: [{ content: "x".repeat(100000), authorization: secret }], assembledContent: "ok", assembledReasoning: "Private provider reasoning.", parsedDecision: { action: "check", amount: 0, table_talk: "中文牌桌发言。" }, validation: { jsonValid: true, actionValid: true, amountValid: true, finalAction: "check" }, usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } });
    const content = await readFile(path.join(directory, logFile), "utf8");
    for (const section of ["MESSAGES SENT TO MODEL", "MODEL REASONING", "MODEL CONTENT", "FINAL DECISION", "TOKEN USAGE", "ERRORS"]) expect(content).toContain(section);
    for (const section of ["GAME STATE", "RAW REQUEST BODY", "RAW STREAM CHUNKS", "RAW MODEL RESPONSE"]) expect(content).not.toContain(section);
    expect(content).toContain("Private provider reasoning.");
    expect(content).toContain("Table Talk: 中文牌桌发言。");
    expect(content).not.toContain("Confidence:");
    expect(content).not.toContain("Reasoning Summary:");
    expect(content.length).toBeLessThan(10000);
    expect(content).not.toContain(secret);
    expect(content).not.toContain(customSecret);
    const logs = await listRequestLogs(directory);
    expect(logs).toHaveLength(1);
    expect((await readRequestLog(logs[0].id, directory)).content).toContain("Request ID: request-1");
  });
});
