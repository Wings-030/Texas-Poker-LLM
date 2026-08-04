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
});
