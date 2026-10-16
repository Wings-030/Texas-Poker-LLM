import { describe, expect, it } from "vitest";
import { evaluateHand } from "../engine/handEvaluator";
import { awardPots, buildPots } from "../engine/pots";
import { cards, player } from "./testUtils";

describe("主池与边池", () => {
  it("普通底池只有一层", () => {
    const pots = buildPots([player("p0", 900, 100), player("p1", 900, 100)]);
    expect(pots).toEqual([{ amount: 200, cap: 100, eligiblePlayerIds: ["p0", "p1"] }]);
  });

  it("三人不同筹码全下生成多个边池", () => {
    const pots = buildPots([player("p0", 0, 50, "all-in"), player("p1", 0, 100, "all-in"), player("p2", 0, 200, "all-in")]);
    expect(pots.map((pot) => pot.amount)).toEqual([150, 100]);
    expect(pots.map((pot) => pot.eligiblePlayerIds)).toEqual([
      ["p0", "p1", "p2"], ["p1", "p2"],
    ]);
  });

  it("弃牌玩家贡献筹码但不能赢池", () => {
    const pots = buildPots([player("p0", 0, 100, "folded"), player("p1", 0, 100, "all-in")]);
    expect(pots[0].amount).toBe(200);
    expect(pots[0].eligiblePlayerIds).toEqual(["p1"]);
  });

  it("平分奇数筹码时从庄家左侧依次分配", () => {
    const players = [player("p0", 0, 5, "all-in"), player("p1", 0, 5, "all-in"), player("p2", 0, 5, "all-in")];
    const tied = evaluateHand(cards("As Ks Qs Js 10s"));
    const awards = awardPots(buildPots(players), players, { p0: tied, p1: tied, p2: tied }, 0);
    expect(awards[0].shares).toEqual({ p1: 5, p2: 5, p0: 5 });
  });

  it("奇数筹码真正存在时由庄家左侧赢家多得一枚", () => {
    const players = [player("p0", 0, 5, "all-in"), player("p1", 0, 5, "all-in"), player("p2", 0, 5, "folded")];
    const tied = evaluateHand(cards("As Ks Qs Js 10s"));
    const awards = awardPots(buildPots(players), players, { p0: tied, p1: tied }, 0);
    expect(awards[0].shares).toEqual({ p1: 8, p0: 7 });
  });

  it("主池与边池可以由不同玩家赢得", () => {
    const players = [player("p0", 0, 50, "all-in"), player("p1", 0, 100, "all-in"), player("p2", 0, 100, "all-in")];
    const evaluations = {
      p0: evaluateHand(cards("As Ad Ah Ks Kd")),
      p1: evaluateHand(cards("Qs Qd 9h 9c 2s")),
      p2: evaluateHand(cards("Js Jd 8h 7c 2d")),
    };
    const awards = awardPots(buildPots(players), players, evaluations, 2);
    expect(awards[0].winnerIds).toEqual(["p0"]);
    expect(awards[1].winnerIds).toEqual(["p1"]);
  });
});
