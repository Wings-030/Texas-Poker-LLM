import { cardKey, createDeck, shuffleDeck } from "./deck";
import { compareEvaluations, evaluateHand } from "./handEvaluator";
import type { Card } from "../types/poker";

export function estimateWinRate(
  holeCards: readonly Card[],
  communityCards: readonly Card[],
  opponentCount: number,
  simulations = 120,
  random: () => number = Math.random,
): number {
  if (holeCards.length !== 2 || communityCards.length > 5 || opponentCount < 1) return 0;
  const known = new Set([...holeCards, ...communityCards].map(cardKey));
  const unseen = createDeck().filter((card) => !known.has(cardKey(card)));
  let score = 0;
  for (let run = 0; run < simulations; run += 1) {
    const sample = shuffleDeck(unseen, random);
    let cursor = 0;
    const board = [...communityCards, ...sample.slice(cursor, cursor + 5 - communityCards.length)];
    cursor += 5 - communityCards.length;
    const hero = evaluateHand([...holeCards, ...board]);
    let tied = 1;
    let beaten = false;
    for (let opponent = 0; opponent < opponentCount; opponent += 1) {
      const rival = evaluateHand([...sample.slice(cursor, cursor + 2), ...board]);
      cursor += 2;
      const comparison = compareEvaluations(hero, rival);
      if (comparison < 0) {
        beaten = true;
        break;
      }
      if (comparison === 0) tied += 1;
    }
    if (!beaten) score += 1 / tied;
  }
  return score / simulations;
}

export interface DrawInfo {
  flushDraw: boolean;
  openEndedStraightDraw: boolean;
  outs: number;
}

export function detectDraws(cards: readonly Card[]): DrawInfo {
  const suitCounts = new Map<string, number>();
  for (const card of cards) suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  const flushDraw = [...suitCounts.values()].some((count) => count === 4);
  const values = [...new Set(cards.map((card) => card.rank === "A" ? 14 : Number(card.rank) || { J: 11, Q: 12, K: 13 }[card.rank as "J" | "Q" | "K"]))].sort((a, b) => a - b);
  if (values.includes(14)) values.unshift(1);
  let openEndedStraightDraw = false;
  for (let i = 0; i <= values.length - 4; i += 1) {
    if (values[i + 3] - values[i] === 3) openEndedStraightDraw = true;
  }
  const outs = (flushDraw ? 9 : 0) + (openEndedStraightDraw ? 8 : 0) - (flushDraw && openEndedStraightDraw ? 2 : 0);
  return { flushDraw, openEndedStraightDraw, outs };
}
