import { createServer } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { requestProvider } from "../apiClient.js";
import { fetchProvider, isPublicAddress, publicLookup } from "../providerTransport.js";

let server;
let baseUrl;
let privateHits = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/redirect") { res.writeHead(302, { Location: "/private" }); res.end(); return; }
    if (req.url === "/private") { privateHits += 1; res.end("private"); return; }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const send = (delta) => res.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
    if (req.url.startsWith("/hang")) { send({ content: "first" }); return; }
    send({ content: '{"amount":100', reasoning_content: "哈" });
    send({ content: "0", reasoning_content: "哈" });
    send({ content: "}" });
    res.end("data: [DONE]\n\n");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });

describe("provider network boundary", () => {
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2002:7f00:1::", "invalid"])("blocks non-public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("recognizes public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
  it("blocks literal and DNS-resolved loopback by default", async () => {
    vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "false");
    await expect(fetchProvider(baseUrl, {})).rejects.toMatchObject({ type: "BLOCKED_API_ADDRESS" });
    await expect(new Promise((resolve, reject) => publicLookup("localhost", { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)))).rejects.toMatchObject({ type: "BLOCKED_API_ADDRESS" });
    await expect(requestProvider({ config: { apiBaseUrl: baseUrl.replace("127.0.0.1", "localhost"), model: "test", timeoutMs: 1000, maxRetries: 2 }, body: {} })).rejects.toMatchObject({ type: "BLOCKED_API_ADDRESS" });
  });
  it("allows local providers only with server opt-in and never follows redirects", async () => {
    vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "true");
    const before = privateHits;
    await expect(fetchProvider(`${baseUrl}/redirect`, {})).rejects.toMatchObject({ type: "INVALID_BASE_URL" });
    expect(privateHits).toBe(before);
    expect((await fetchProvider(`${baseUrl}/private`, {})).status).toBe(200);
    expect(privateHits).toBe(before + 1);
  });
});

describe("stream integrity and abort classification", () => {
  const config = (path = "") => ({ apiBaseUrl: baseUrl + path, apiKey: "test", model: "test", stream: true, timeoutMs: 1000, maxRetries: 2, retryDelayMs: 1 });
  it("retains repeated content and reasoning deltas", async () => {
    vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "true");
    const chunks = [];
    const result = await requestProvider({ config: config(), body: { stream: true }, onContent: (chunk) => chunks.push(chunk) });
    expect(result.content).toBe('{"amount":1000}');
    expect(chunks.join("")).toBe(result.content);
    expect(result.reasoning).toBe("哈哈");
  });
  it("does not retry a timeout after the stream has already started", async () => {
    vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "true");
    const onAttempt = vi.fn();
    await expect(requestProvider({ config: { ...config("/hang"), timeoutMs: 150 }, body: { stream: true }, onAttempt })).rejects.toMatchObject({ type: "REQUEST_TIMEOUT", timedOut: true, cancelled: false, retryCount: 0 });
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });
  it("preserves cancellation after a streamed chunk without retrying", async () => {
    vi.stubEnv("AI_ALLOW_PRIVATE_ENDPOINTS", "true");
    const controller = new AbortController();
    const onAttempt = vi.fn();
    await expect(requestProvider({ config: config("/hang"), body: { stream: true }, signal: controller.signal, onAttempt, onContent: () => controller.abort() })).rejects.toMatchObject({ type: "REQUEST_CANCELLED", timedOut: false, cancelled: true });
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });
});
