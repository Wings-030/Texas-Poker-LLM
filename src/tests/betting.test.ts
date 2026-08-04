import { describe, expect, it } from "vitest";
import { getLegalActions, validateAction } from "../engine/betting";
import { performAction } from "../engine/gameFlow";
import { bettingState } from "./testUtils";

describe("下注规则", () => {
  it("面对下注可以弃牌、跟注和加注，不能过牌", () => {
    const legal = getLegalActions(bettingState(), "p0");
    expect(legal.toCall).toBe(50);
    expect(legal.canFold).toBe(true);
    expect(legal.canCheck).toBe(false);
    expect(legal.canCall).toBe(true);
    expect(legal.minRaiseTo).toBe(150);
  });

  it("无人下注时也允许主动弃牌", () => {
    const state = bettingState();
    state.currentBet = 50;
    state.players[0].streetBet = 50;
    expect(getLegalActions(state, "p0").canFold).toBe(true);
    expect(getLegalActions(state, "p0").canCheck).toBe(true);
  });

  it("拒绝低于最小额和超过筹码的加注", () => {
    expect(() => validateAction(bettingState(), "p0", "raise", 149)).toThrow("最低合法金额");
    expect(() => validateAction(bettingState(), "p0", "raise", 1001)).toThrow("不能超过");
  });

  it("跟注正确扣除筹码并增加底池", () => {
    const next = performAction(bettingState(), "p0", "call");
    expect(next.players[0].chips).toBe(900);
    expect(next.potTotal).toBe(200);
  });

  it("筹码不足时只能全下跟注", () => {
    const state = bettingState();
    state.players[0].chips = 30;
    expect(getLegalActions(state, "p0").canCall).toBe(false);
    const next = performAction(state, "p0", "all-in");
    expect(next.players[0].status).toBe("all-in");
    expect(next.players[0].totalBet).toBe(80);
  });

  it("最后一人未弃牌时立即获胜", () => {
    const next = performAction(bettingState(), "p0", "fold");
    expect(next.phase).toBe("showdown");
    expect(next.result?.reason).toBe("uncontested");
    expect(next.result?.winnerIds).toEqual(["p1"]);
  });
});
