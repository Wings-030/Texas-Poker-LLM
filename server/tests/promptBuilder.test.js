import { describe, expect, it } from "vitest";
import { buildPokerMessages } from "../promptBuilder.js";

describe("poker prompt builder", () => {
  it("replaces editable defaults and appends the selected character's additional prompt", () => {
    const built = buildPokerMessages({ characterId: "ai-tomori", gameState: {}, characterPrompt: { personality: "Custom personality", playingStyle: "Custom LAG", additional: "Speak briefly and value position." } });
    expect(built.systemPrompt).toContain("# Core System Prompt");
    expect(built.systemPrompt).toContain("# Private Reasoning and Public Speech Boundary");
    expect(built.systemPrompt).toContain("discard all wording from the private analysis");
    expect(built.systemPrompt).toContain("Do not mention any card rank or suit in table_talk");
    expect(built.systemPrompt).toContain("我的K");
    expect(built.systemPrompt).toContain("always be written in Simplified Chinese");
    expect(built.systemPrompt).toContain("15 to 60 Chinese characters");
    expect(built.systemPrompt).not.toContain("confidence");
    expect(built.systemPrompt).not.toContain('"reasoning_summary"');
    expect(built.systemPrompt).toContain("Custom personality");
    expect(built.systemPrompt).toContain("Custom LAG");
    expect(built.systemPrompt).not.toContain("Tight-passive leaning");
    expect(built.systemPrompt).toContain("# Custom Character Prompt");
    expect(built.systemPrompt).toContain("Speak briefly and value position.");
    expect(built.systemPrompt.indexOf("# Custom Character Prompt")).toBeGreaterThan(built.systemPrompt.indexOf("# Output Protocol"));
  });
});
