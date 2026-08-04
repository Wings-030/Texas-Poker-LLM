import type { Card, HandEvaluation, Rank } from "../types/poker";

const RANK_VALUE: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

const CATEGORY_NAMES = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺", "皇家同花顺"];

function combinations<T>(items: readonly T[], size: number): T[][] {
  if (size === 0) return [[]];
  const result: T[][] = [];
  for (let i = 0; i <= items.length - size; i += 1) {
    for (const tail of combinations(items.slice(i + 1), size - 1)) result.push([items[i], ...tail]);
  }
  return result;
}

function straightHigh(values: number[]): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let i = 0; i <= unique.length - 5; i += 1) {
    if (unique[i] - unique[i + 4] === 4) return unique[i];
  }
  return null;
}

export function evaluateFive(cards: readonly Card[]): HandEvaluation {
  if (cards.length !== 5) throw new Error("五张牌型判断必须恰好传入五张牌");
  const values = cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const high = straightHigh(values);

  let category = 0;
  let kickers = [...values];
  if (flush && high !== null) {
    category = high === 14 ? 9 : 8;
    kickers = [high];
  } else if (groups[0][1] === 4) {
    category = 7;
    kickers = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    category = 6;
    kickers = [groups[0][0], groups[1][0]];
  } else if (flush) {
    category = 5;
  } else if (high !== null) {
    category = 4;
    kickers = [high];
  } else if (groups[0][1] === 3) {
    category = 3;
    kickers = [groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  } else if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    category = 2;
    const pairs = groups.filter(([, count]) => count === 2).map(([value]) => value).sort((a, b) => b - a);
    const kicker = groups.find(([, count]) => count === 1)?.[0] ?? 0;
    kickers = [...pairs, kicker];
  } else if (groups[0][1] === 2) {
    category = 1;
    kickers = [groups[0][0], ...groups.slice(1).map(([value]) => value).sort((a, b) => b - a)];
  }

  return { category, name: CATEGORY_NAMES[category], kickers, cards: [...cards] };
}

export function compareEvaluations(a: HandEvaluation, b: HandEvaluation): number {
  if (a.category !== b.category) return Math.sign(a.category - b.category);
  const length = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < length; i += 1) {
    const difference = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function evaluateHand(cards: readonly Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) throw new Error("最佳牌型判断需要五至七张牌");
  return combinations(cards, 5).map(evaluateFive).reduce((best, current) =>
    compareEvaluations(current, best) > 0 ? current : best,
  );
}

export function rankValue(rank: Rank): number {
  return RANK_VALUE[rank];
}
