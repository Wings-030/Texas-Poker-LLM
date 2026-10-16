import type { Card, Rank, Suit } from "../types/poker";

const SUIT_CODES: Record<Suit, string> = {
  spades: "S",
  hearts: "H",
  diamonds: "D",
  clubs: "C",
};

const RANK_CODES: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

const CARD_ASSET_BASE = `${import.meta.env.BASE_URL}cards`;
const loggedMappings = new Set<string>();
const loggedFailures = new Set<string>();

export const CARD_BACK_ASSET = `${CARD_ASSET_BASE}/Back-Club.svg`;

export function cardAssetName(card: Card): string {
  return `${card.rank} of ${card.suit}`;
}

export function cardAssetPath(card: Card): string {
  const path = `${CARD_ASSET_BASE}/${SUIT_CODES[card.suit]}-${RANK_CODES[card.rank]}.png`;
  if (typeof window !== "undefined" && !loggedMappings.has(path)) {
    loggedMappings.add(path);
    console.info(`[cards] 牌面资源映射 card="${cardAssetName(card)}" path="${path}"`);
  }
  return path;
}

export function logCardAssetFailure(card: Card | undefined, path: string): void {
  if (loggedFailures.has(path)) return;
  loggedFailures.add(path);
  console.error(`[cards] 扑克牌图片加载失败，已切换为文字降级牌面 card="${card ? cardAssetName(card) : "card back"}" path="${path}"`);
}

if (typeof window !== "undefined") {
  console.info(`[cards] 本地牌面资源目录 base="${CARD_ASSET_BASE}" back="${CARD_BACK_ASSET}"`);
}
