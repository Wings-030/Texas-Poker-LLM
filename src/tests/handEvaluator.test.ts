import { describe, expect, it } from "vitest";
import { compareEvaluations, evaluateHand } from "../engine/handEvaluator";
import { cards } from "./testUtils";

describe("牌型判断", () => {
  it.each([
    ["皇家同花顺", "10s Js Qs Ks As", 9],
    ["同花顺", "5h 6h 7h 8h 9h", 8],
    ["四条", "Ac Ad Ah As 2c", 7],
    ["葫芦", "Kc Kd Kh 3s 3d", 6],
    ["同花", "2c 5c 8c Jc Kc", 5],
    ["顺子", "5c 6d 7h 8s 9c", 4],
    ["三条", "Qc Qd Qh 8s 2c", 3],
    ["两对", "Jc Jd 4h 4s Ac", 2],
    ["一对", "10c 10d Ah 7s 3c", 1],
    ["高牌", "Ac Jd 8h 5s 2c", 0],
  ])("识别%s", (name, input, category) => {
    const result = evaluateHand(cards(input));
    expect(result.name).toBe(name);
    expect(result.category).toBe(category);
  });

  it("识别 A-2-3-4-5 小顺子", () => {
    const result = evaluateHand(cards("As 2d 3h 4c 5s"));
    expect(result.name).toBe("顺子");
    expect(result.kickers).toEqual([5]);
  });

  it("不把 Q-K-A-2-3 当作顺子", () => {
    expect(evaluateHand(cards("Qs Kd Ah 2c 3s")).name).toBe("高牌");
  });

  it("从七张牌中选择最佳五张", () => {
    const result = evaluateHand(cards("As Ad Ah Ks Kd 2c 3c"));
    expect(result.name).toBe("葫芦");
    expect(result.kickers).toEqual([14, 13]);
  });

  it("逐级比较两对和踢脚", () => {
    const higherSecondPair = evaluateHand(cards("As Ad Qh Qc 2s"));
    const lowerSecondPair = evaluateHand(cards("Ah Ac Jh Jd Ks"));
    const higherKicker = evaluateHand(cards("As Ad Qh Qc Ks"));
    expect(compareEvaluations(higherSecondPair, lowerSecondPair)).toBe(1);
    expect(compareEvaluations(higherKicker, higherSecondPair)).toBe(1);
  });

  it("公共牌构成最佳牌时判为平局", () => {
    const board = cards("10s Js Qs Ks As");
    const first = evaluateHand([...cards("2h 3h"), ...board]);
    const second = evaluateHand([...cards("Ac Ad"), ...board]);
    expect(compareEvaluations(first, second)).toBe(0);
  });
});
