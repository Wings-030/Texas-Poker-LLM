import { describe, expect, it } from "vitest";
import { blindsForLevel, nextTournamentState, rotateDealer } from "../engine/tournament";
import { player } from "./testUtils";

describe("锦标赛规则", () => {
  it("按手数升级盲注", () => {
    const state = { blindLevel: 0, handsAtLevel: 4, handsUntilNextLevel: 1, eliminatedPlayerIds: [], finalStandings: [] };
    const next = nextTournamentState(state, [player("p0", 100), player("p1", 100)], 5);
    expect(next.blindLevel).toBe(1);
    expect(next.handsUntilNextLevel).toBe(5);
    expect(blindsForLevel(next.blindLevel)).toEqual([75, 150]);
  });

  it("记录淘汰并在只剩一人时产生冠军", () => {
    const state = { blindLevel: 0, handsAtLevel: 0, handsUntilNextLevel: 5, eliminatedPlayerIds: [], finalStandings: [] };
    const next = nextTournamentState(state, [player("p0", 200), player("p1", 0)], 5);
    expect(next.eliminatedPlayerIds).toEqual(["p1"]);
    expect(next.championId).toBe("p0");
    expect(next.finalStandings).toEqual(["p0", "p1"]);
  });

  it("庄家按钮跳过已淘汰玩家", () => {
    expect(rotateDealer([player("p0", 100), player("p1", 0), player("p2", 100)], 0)).toBe(2);
  });
});
