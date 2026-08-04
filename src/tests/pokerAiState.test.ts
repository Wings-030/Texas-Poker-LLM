import { describe, expect, it } from "vitest";
import { buildPokerAIRequest, isDecisionCurrent, isGameTurnCurrent } from "../api/pokerAiState";
import { bettingState } from "./testUtils";

describe("poker AI request state", () => {
  it("sends only the acting AI hole cards and structured legal actions", () => {
    const state = bettingState();
    state.players[0].isHuman = false;
    state.players[0].id = "ai-tomori";
    state.players[0].holeCards = [{ rank: "A", suit: "spades" }, { rank: "K", suit: "spades" }];
    state.players[1].holeCards = [{ rank: "2", suit: "clubs" }, { rank: "3", suit: "clubs" }];
    const request = buildPokerAIRequest(state, "ai-tomori", "request-1");
    expect(request.gameState.aiHoleCards).toEqual(["AS", "KS"]);
    expect(JSON.stringify(request.gameState.players)).not.toContain("clubs");
    expect(request.gameState.legalActions.actions.length).toBeGreaterThan(0);
  });

  it("rejects old hand, turn, character, and request IDs", () => {
    const state = bettingState();
    state.players[0].isHuman = false;
    state.players[0].id = "ai-tomori";
    const request = buildPokerAIRequest(state, "ai-tomori", "request-1");
    expect(isDecisionCurrent(request, request)).toBe(true);
    expect(isDecisionCurrent({ ...request, handId: "old-hand" }, request)).toBe(false);
    expect(isGameTurnCurrent(state, request)).toBe(true);
    expect(isGameTurnCurrent({ ...state, handNumber: state.handNumber + 1 }, request)).toBe(false);
  });

  it("includes editable default and additional prompts without allowing oversized fields", () => {
    const state = bettingState();
    state.players[0].isHuman = false;
    state.players[0].id = "ai-tomori";
    const request = buildPokerAIRequest(state, "ai-tomori", "request-1", { useModel: true, personality: "Custom personality", playingStyle: "Custom LAG", prompt: `  ${"x".repeat(13000)}  ` });
    expect(request.characterPrompt).toEqual({ personality: "Custom personality", playingStyle: "Custom LAG", additional: "x".repeat(12000) });
  });
});
