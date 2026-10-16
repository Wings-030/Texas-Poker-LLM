import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelDecision, fetchLogs, getBackendConfig, requestAIDecision, saveBackendConfig } from "../api/aiBackend";

afterEach(() => vi.unstubAllGlobals());

describe("browser API identity", () => {
  it("reuses one credential across configuration, logs, cancellation, and streaming requests", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, config: {}, logs: [] }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await getBackendConfig();
    await saveBackendConfig({ apiKey: "my-private-key" });
    await fetchLogs();
    await cancelDecision("request-1");
    fetchMock.mockImplementationOnce(async () => new Response('event: final\ndata: {"ok":true}\n\n', { headers: { "Content-Type": "text/event-stream" } }));
    await requestAIDecision({ requestId: "request-1" } as Parameters<typeof requestAIDecision>[0], new AbortController().signal, () => {});
    const credential = storage.get("poker-ai-client-token");
    expect(credential).toMatch(/^[a-f0-9]{64}$/);
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect(new Headers(call[1].headers).get("X-Poker-Client-Token")).toBe(credential);
      expect(call[1].cache).toBe("no-store");
    }
    expect([...storage.values()]).not.toContain("my-private-key");
    storage.clear();
    await getBackendConfig();
    expect(storage.get("poker-ai-client-token")).not.toBe(credential);
  });
});
