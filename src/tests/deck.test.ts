import { describe, expect, it } from "vitest";
import { cardKey, createDeck, drawCards, shuffleDeck } from "../engine/deck";

describe("牌组与发牌", () => {
  it("生成 52 张互不重复的标准扑克牌", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardKey)).size).toBe(52);
  });

  it("Fisher-Yates 洗牌不增删任何牌", () => {
    const original = createDeck();
    const shuffled = shuffleDeck(original, () => 0.37);
    expect(shuffled.map(cardKey).sort()).toEqual(original.map(cardKey).sort());
    expect(shuffled.map(cardKey)).not.toEqual(original.map(cardKey));
  });

  it("连续发牌始终从同一个预洗牌堆向后读取", () => {
    const deck = shuffleDeck(createDeck(), () => 0.61);
    const first = drawCards(deck, 0, 2);
    const second = drawCards(deck, first.nextIndex, 3);
    expect([...first.cards, ...second.cards]).toEqual(deck.slice(0, 5));
    expect(second.nextIndex).toBe(5);
  });

  it("牌堆不足时拒绝发牌", () => {
    expect(() => drawCards(createDeck(), 51, 2)).toThrow("牌堆中的牌不足");
  });
});
