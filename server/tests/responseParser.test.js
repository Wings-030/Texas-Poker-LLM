import { describe, expect, it } from "vitest";
import { buildProviderUrl, extractJsonObject, extractProviderContent, mergeStreamText, normalizeBaseUrl, parseModelList, safeFallback, validateDecision } from "../responseParser.js";

describe("responseParser", () => {
  it("normalizes base URLs without duplicating v1", () => {
    expect(normalizeBaseUrl("https://example.com/v1/")).toBe("https://example.com/v1");
    expect(buildProviderUrl("https://example.com", "chat/completions")).toBe("https://example.com/v1/chat/completions");
    expect(buildProviderUrl("https://example.com/api/v1", "/models")).toBe("https://example.com/api/v1/models");
  });

  it("parses model lists and compatible response shapes", () => {
    expect(parseModelList({ data: [{ id: "b" }, { id: "a" }] })).toEqual(["a", "b"]);
    expect(extractProviderContent({ choices: [{ message: { content: "ok", reasoning_content: "why" } }] })).toMatchObject({ content: "ok", reasoning: "why" });
    expect(extractProviderContent({ content: [{ type: "text", text: "array" }] }).content).toBe("array");
  });

  it("extracts direct, fenced, embedded, and lightly malformed JSON", () => {
    expect(extractJsonObject('{"action":"check"}').value.action).toBe("check");
    expect(extractJsonObject('```json\n{"action":"call"}\n```').value.action).toBe("call");
    expect(extractJsonObject('Decision: {"action":"fold","amount":0} thanks').value.action).toBe("fold");
    expect(extractJsonObject("{'action':'check',}").value.action).toBe("check");
  });

  it("validates actions, repairs amounts, and chooses a safe fallback", () => {
    const legal = { actions: ["fold", "call", "raise"], minRaiseTo: 120, maxRaiseTo: 500 };
    expect(validateDecision({ action: "all_in" }, legal).valid).toBe(false);
    expect(validateDecision({ action: "raise", amount: 999, confidence: 0.9, reasoning_summary: "ignored" }, legal).decision).toEqual({ action: "raise", amount: 500, table_talk: "" });
    expect(safeFallback(legal)).toEqual({ action: "call", amount: 0, table_talk: "" });
    expect(mergeStreamText("hel", "hello", true)).toBe("hello");
    expect(mergeStreamText("100", "0")).toBe("1000");
    expect(mergeStreamText("哈", "哈")).toBe("哈哈");
  });
});
