import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server.js";
import { requestCoordinator } from "../requestCoordinator.js";

const alice = "a".repeat(64);
const bob = "b".repeat(64);
let directory, options, origin, providerUrl, received;
let holdDecisions, pendingDecisions;
const servers = [];

async function listen(app) {
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function api(token, endpoint, method = "GET", body) {
  const response = await fetch(`${origin}/api/${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { "X-Poker-Client-Token": token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
}

async function configure(token, name) {
  return api(token, "config", "POST", { apiBaseUrl: `${providerUrl}/v1`, apiKey: `test-key-${name}`, model: `model-${name}`, stream: false, maxRetries: 0, timeoutMs: 3000 });
}

beforeEach(async () => {
  vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "true");
  directory = await mkdtemp(path.join(os.tmpdir(), "poker-visitors-"));
  options = { configDir: path.join(directory, "config", "visitors"), logDir: path.join(directory, "logs") };
  await mkdir(path.dirname(options.configDir));
  await writeFile(path.join(directory, "config", "api-config.json"), JSON.stringify({ apiKey: "legacy-owner-key", model: "owner-model" }));
  received = [];
  holdDecisions = false;
  pendingDecisions = [];
  const provider = express();
  provider.use(express.json());
  provider.use((req, _res, next) => { received.push({ path: req.path, authorization: req.get("Authorization"), model: req.body?.model }); next(); });
  provider.get("/v1/models", (_req, res) => res.json({ data: [{ id: "model-alice" }, { id: "model-bob" }] }));
  provider.post("/v1/chat/completions", (req, res) => {
    const content = '{"action":"check","amount":0,"table_talk":"hello"}';
    const reply = () => {
      if (req.body.stream) {
        res.type("text/event-stream").send(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`);
      } else res.json({ choices: [{ message: { content }, finish_reason: "stop" }] });
    };
    if (!holdDecisions) return reply();
    pendingDecisions.push(reply);
    if (pendingDecisions.length === 2) pendingDecisions.splice(0).forEach((send) => send());
  });
  providerUrl = await listen(provider);
  origin = await listen(createApp(options));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); })));
  if (directory) {
    expect(path.dirname(directory)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(directory)).toMatch(/^poker-visitors-/);
    await rm(directory, { recursive: true, force: true });
  }
});

describe("visitor-owned API configuration", () => {
  it("rejects missing credentials and never falls back to the owner or another visitor", async () => {
    for (const endpoint of ["config", "models", "logs"]) {
      expect((await api(undefined, endpoint)).status).toBe(401);
      expect((await api("../../owner", endpoint)).status).toBe(401);
    }
    await configure(alice, "alice");
    const fresh = await api(bob, "config");
    expect(fresh.cache).toBe("no-store");
    expect(fresh.body.config).toMatchObject({ apiBaseUrl: "", model: "", apiKeyConfigured: false });
    expect((await api(bob, "models")).body.error.type).toBe("CONFIG_MISSING");
    expect((await api(bob, "test", "POST", {})).body.error.type).toBe("CONFIG_MISSING");
    expect((await api(bob, "ai/chat", "POST", { messages: [{ role: "user", content: "hello" }] })).body.error.type).toBe("CONFIG_MISSING");
    expect(received).toHaveLength(0);
    expect(JSON.parse(await readFile(path.join(directory, "config", "api-config.json"), "utf8")).apiKey).toBe("legacy-owner-key");
  });

  it("uses each visitor's key for models, tests, chat, and both decision response modes", async () => {
    for (const [token, name] of [[alice, "alice"], [bob, "bob"]]) {
      const saved = await configure(token, name);
      expect(saved.status).toBe(200);
      expect(saved.body.config).not.toHaveProperty("apiKey");
      expect(JSON.stringify(saved.body)).not.toContain(`test-key-${name}`);
      expect((await api(token, "models")).status).toBe(200);
      expect((await api(token, "test", "POST", {})).status).toBe(200);
      expect((await api(token, "ai/chat", "POST", { requestId: `chat-${name}`, messages: [{ role: "user", content: `private-${name}` }] })).status).toBe(200);
      const decision = { gameId: "game", handId: "hand", turnId: "turn", characterId: "ai-tomori", requestId: "same-request", gameState: { legalActions: { actions: ["check", "fold"] } } };
      const result = await api(token, "ai/decision", "POST", decision);
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ fallback: false, debug: { model: `model-${name}` }, decision: { action: "check" } });
      await api(token, "config", "POST", { stream: true });
      const stream = await fetch(`${origin}/api/ai/decision`, { method: "POST", headers: { "Content-Type": "application/json", "X-Poker-Client-Token": token }, body: JSON.stringify(decision) });
      expect(stream.headers.get("content-type")).toContain("text/event-stream");
      const events = await stream.text();
      expect(events).toContain("event: final");
      expect(events).toContain('"fallback":false');
      expect(events).toContain(`"model":"model-${name}"`);
      const calls = received.splice(0);
      expect(calls.length).toBeGreaterThanOrEqual(5);
      expect(calls.every((call) => call.authorization === `Bearer test-key-${name}`)).toBe(true);
      expect(calls.filter((call) => call.model).every((call) => call.model === `model-${name}`)).toBe(true);
    }
    origin = await listen(createApp(options));
    expect((await api(alice, "config")).body.config).toMatchObject({ model: "model-alice", apiKeyConfigured: true });
    await api(bob, "config", "DELETE");
    expect((await api(bob, "config")).body.config.apiKeyConfigured).toBe(false);
    expect((await api(alice, "config")).body.config.apiKeyConfigured).toBe(true);
  });

  it("allows simultaneous decisions and prevents another visitor from cancelling them", async () => {
    await configure(alice, "alice");
    await configure(bob, "bob");
    holdDecisions = true;
    const decision = { gameId: "same-game", handId: "hand", turnId: "turn", characterId: "ai-tomori", requestId: "same-request", gameState: { legalActions: { actions: ["check", "fold"] } } };
    const results = await Promise.all([api(alice, "ai/decision", "POST", decision), api(bob, "ai/decision", "POST", decision)]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results.every((result) => result.body.fallback === false)).toBe(true);
    const aliceScope = createHash("sha256").update(alice).digest("hex");
    const active = requestCoordinator.begin("ai-tomori", "alice-pending", aliceScope);
    try {
      expect((await api(bob, "ai/requests/alice-pending", "DELETE")).body.ok).toBe(false);
      expect(active.controller.signal.aborted).toBe(false);
      expect((await api(alice, "ai/requests/alice-pending", "DELETE")).body.ok).toBe(true);
      expect(active.controller.signal.aborted).toBe(true);
    } finally { requestCoordinator.finish("alice-pending", aliceScope); }
  });

  it("isolates log listing, reading, and deletion", async () => {
    await configure(alice, "alice");
    await configure(bob, "bob");
    await api(alice, "ai/chat", "POST", { requestId: "alice-chat", messages: [{ role: "user", content: "private-alice-message" }] });
    const logs = (await api(alice, "logs")).body.logs;
    expect(logs).toHaveLength(1);
    const id = encodeURIComponent(logs[0].id);
    expect((await api(alice, `logs/${id}`)).body.content).toContain("private-alice-message");
    expect((await api(bob, "logs")).body.logs).toEqual([]);
    const denied = await api(bob, `logs/${id}`);
    expect(denied.status).not.toBe(200);
    expect(JSON.stringify(denied.body)).not.toContain("private-alice-message");
    expect((await api(bob, "logs", "DELETE", { confirm: "CLEAR" })).status).toBe(200);
    expect((await api(alice, "logs")).body.logs).toHaveLength(1);
    expect((await api(alice, "logs", "DELETE", { confirm: "CLEAR" })).status).toBe(200);
    expect((await api(alice, "logs")).body.logs).toEqual([]);
  });
});
