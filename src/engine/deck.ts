import type { Card, Rank, Suit } from "../types/poker";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export function shuffleDeck(deck: readonly Card[], random: () => number = Math.random): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawCards(deck: readonly Card[], index: number, count: number): { cards: Card[]; nextIndex: number } {
  if (!Number.isInteger(count) || count < 0 || index < 0 || index + count > deck.length) {
    throw new Error("牌堆中的牌不足，无法继续发牌");
  }
  return { cards: deck.slice(index, index + count), nextIndex: index + count };
}

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}
