import { describe, expect, it } from "vitest";
import { RequestCoordinator } from "../requestCoordinator.js";

describe("request concurrency", () => {
  it("allows only one active request per character and supports cancellation", () => {
    const coordinator = new RequestCoordinator();
    const first = coordinator.begin("ai-1", "request-1");
    expect(() => coordinator.begin("ai-1", "request-2")).toThrow(/进行中的请求/);
    expect(coordinator.cancel("request-1")).toBe(true);
    expect(first.controller.signal.aborted).toBe(true);
    coordinator.finish("request-1");
    expect(() => coordinator.begin("ai-1", "request-2")).not.toThrow();
  });

  it("isolates concurrent requests and cancellation even when visitors reuse the same IDs", () => {
    const coordinator = new RequestCoordinator();
    const first = coordinator.begin("ai-1", "request-1", "alice");
    expect(coordinator.cancel("request-1", "bob")).toBe(false);
    const second = coordinator.begin("ai-1", "request-1", "bob");
    expect(coordinator.cancel("request-1", "bob")).toBe(true);
    expect(second.controller.signal.aborted).toBe(true);
    expect(first.controller.signal.aborted).toBe(false);
    coordinator.finish("request-1", "bob");
    expect(coordinator.isActive("ai-1", "request-1", "alice")).toBe(true);
    expect(coordinator.isActive("ai-1", "request-1", "bob")).toBe(false);
    expect(() => coordinator.begin("ai-1", "request-2", "alice")).toThrow(/进行中的请求/);
  });
});
