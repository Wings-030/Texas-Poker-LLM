import type { GameState, GameStatistics, HandRecord, SaveData, Settings } from "../types/poker";
import { findAIPlayer } from "../data/aiPlayers";

const STORAGE_KEY = "solo-texas-holdem-save";

export const defaultSettings: Settings = {
  language: "zh",
  sound: false,
  animation: true,
  speed: "normal",
  autoNextHand: false,
  cardStyle: "classic",
  showHints: true,
  showHandName: true,
  beginnerHelp: true,
  aiCharacters: {},
};

export const emptyStatistics: GameStatistics = {
  games: 0, quickGames: 0, tournaments: 0, hands: 0, handsWon: 0, vpipHands: 0, pfrHands: 0,
  showdowns: 0, showdownWins: 0, netChips: 0, biggestWin: 0, biggestLoss: 0, allIns: 0, allInWins: 0,
  folds: 0, calls: 0, raises: 0, successfulBluffs: 0, tournamentWins: 0, bestTournamentPlace: null,
  currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 0, longestLossStreak: 0, startingHands: {},
};

export function defaultSaveData(): SaveData {
  return { version: 1, settings: { ...defaultSettings }, statistics: structuredClone(emptyStatistics), history: [], activeGame: null };
}

function normalizePlayerName<T extends { id: string; name: string }>(player: T): T {
  const name = player.id === "hero" ? "USER" : findAIPlayer(player.id)?.name;
  return name && player.name !== name ? { ...player, name } : player;
}

function resultMessage(players: Array<{ id: string; name: string }>, result: HandRecord["result"]): string {
  if (result.reason === "uncontested") {
    const winner = players.find((player) => player.id === result.winnerIds[0]);
    const amount = result.awards.reduce((sum, award) => sum + award.amount, 0);
    return `${winner?.name ?? "玩家"} 无需摊牌赢得 ${amount}`;
  }
  return `${result.winnerIds.map((id) => players.find((player) => player.id === id)?.name ?? "玩家").join("、")} 赢得底池`;
}

function normalizeReplay<T extends { actionText: string; action?: HandRecord["actions"][number] }>(steps: T[], players: Array<{ id: string; name: string }>, finalMessage?: string): T[] {
  return steps.map((step, index) => {
    if (step.action) {
      const player = players.find((item) => item.id === step.action?.playerId);
      return { ...step, actionText: `${player?.name ?? "玩家"} ${step.action.label ?? ""}`.trim() };
    }
    if (finalMessage && index === steps.length - 1) return { ...step, actionText: step.actionText.startsWith("摊牌：") ? `摊牌：${finalMessage}` : finalMessage };
    return step;
  });
}

function normalizeGame(game: GameState): GameState {
  const players = game.players.map(normalizePlayerName);
  const finalMessage = game.result ? resultMessage(players, game.result) : undefined;
  const replay = normalizeReplay(game.replay, players, finalMessage);
  const latestActionText = replay.at(-1)?.action ? replay.at(-1)?.actionText : undefined;
  return { ...game, players, replay, message: finalMessage ?? latestActionText ?? game.message };
}

function normalizePlayerNames(data: SaveData): SaveData {
  return {
    ...data,
    settings: { ...defaultSettings, ...data.settings, aiCharacters: { ...defaultSettings.aiCharacters, ...data.settings.aiCharacters } },
    activeGame: data.activeGame ? normalizeGame(data.activeGame) : null,
    history: data.history.map((record) => {
      const players = record.players.map(normalizePlayerName);
      return { ...record, players, replay: normalizeReplay(record.replay, players, resultMessage(players, record.result)) };
    }),
  };
}

function normalizeSave(parsed: Partial<SaveData>): SaveData {
  if (parsed.version !== 1) throw new Error("不是有效的德州扑克存档文件");
  return normalizePlayerNames({
    version: 1,
    settings: { ...defaultSettings, ...parsed.settings, aiCharacters: { ...defaultSettings.aiCharacters, ...parsed.settings?.aiCharacters } },
    statistics: { ...emptyStatistics, ...parsed.statistics },
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, 300) : [],
    activeGame: parsed.activeGame ?? null,
  });
}

async function saveStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("solo-texas-holdem", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("saves");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("saves", mode);
      const request = operation(transaction.objectStore("saves"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error("存档写入失败"));
    });
  } finally { db.close(); }
}

let saveQueue: Promise<void> = Promise.resolve();

export async function loadSaveData(): Promise<SaveData> {
  await saveQueue;
  const stored = await saveStore<SaveData | undefined>("readonly", (store) => store.get(STORAGE_KEY));
  if (stored) return normalizeSave(stored);
  const legacy = localStorage.getItem(STORAGE_KEY);
  if (!legacy) return defaultSaveData();
  const migrated = normalizeSave(JSON.parse(legacy));
  // Do not discard the old save until its replacement has committed successfully.
  await saveData(migrated);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* The durable copy is already in IndexedDB. */ }
  return migrated;
}

export async function saveData(data: SaveData): Promise<void> {
  const snapshot = structuredClone({ ...data, history: data.history.slice(0, 300) });
  const pending = saveQueue.then(async () => { await saveStore("readwrite", (store) => store.put(snapshot, STORAGE_KEY)); });
  saveQueue = pending.catch(() => {});
  return pending;
}

function startingHandKey(record: HandRecord): string {
  const [a, b] = record.heroCards;
  if (!a || !b) return "未知";
  const values: Record<string, number> = { A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2 };
  const ranks = [a.rank, b.rank].sort((x, y) => values[y] - values[x]);
  return ranks[0] === ranks[1] ? `${ranks[0]}${ranks[1]}` : `${ranks.join("")}${a.suit === b.suit ? "s" : "o"}`;
}

export function addHandToStatistics(statsInput: GameStatistics, record: HandRecord): GameStatistics {
  const stats = structuredClone(statsInput);
  const heroNet = record.result.net.hero ?? 0;
  const heroWon = heroNet > 0;
  const heroActions = record.actions.filter((action) => action.playerId === "hero");
  const preflop = heroActions.filter((action) => action.street === "preflop");
  const voluntarilyInPot = preflop.some((action) => ["call", "bet", "raise", "all-in"].includes(action.type));
  const preflopRaised = preflop.some((action) => action.type === "raise") || record.replay.some((step, index) =>
    step.action?.playerId === "hero" && step.action.street === "preflop" && step.action.type === "all-in"
    && step.currentBet > (record.replay[index - 1]?.currentBet ?? record.bigBlind));
  const sawShowdown = record.result.reason === "showdown" && Boolean(record.revealedHoleCards.hero);

  stats.hands += 1;
  if (heroWon) stats.handsWon += 1;
  if (voluntarilyInPot) stats.vpipHands += 1;
  if (preflopRaised) stats.pfrHands += 1;
  if (sawShowdown) stats.showdowns += 1;
  if (sawShowdown && record.result.winnerIds.includes("hero")) stats.showdownWins += 1;
  stats.netChips += heroNet;
  stats.biggestWin = Math.max(stats.biggestWin, heroNet);
  stats.biggestLoss = Math.min(stats.biggestLoss, heroNet);
  stats.allIns += heroActions.filter((action) => action.type === "all-in").length;
  if (heroActions.some((action) => action.type === "all-in") && heroWon) stats.allInWins += 1;
  stats.folds += heroActions.filter((action) => action.type === "fold").length;
  stats.calls += heroActions.filter((action) => action.type === "call").length;
  stats.raises += heroActions.filter((action) => action.type === "raise" || action.type === "bet").length;
  if (record.result.reason === "uncontested" && record.result.winnerIds.includes("hero") && heroActions.some((action) => action.type === "bet" || action.type === "raise")) stats.successfulBluffs += 1;
  if (heroWon) {
    stats.currentWinStreak += 1;
    stats.currentLossStreak = 0;
  } else {
    stats.currentLossStreak += 1;
    stats.currentWinStreak = 0;
  }
  stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
  stats.longestLossStreak = Math.max(stats.longestLossStreak, stats.currentLossStreak);
  const key = startingHandKey(record);
  const starting = stats.startingHands[key] ?? { key, hands: 0, wins: 0, netChips: 0 };
  starting.hands += 1;
  if (heroWon) starting.wins += 1;
  starting.netChips += heroNet;
  stats.startingHands[key] = starting;
  return stats;
}

export function exportSave(data: SaveData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${data.settings.language === "en" ? "texas-holdem-save" : "德州扑克存档"}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importSave(file: File): Promise<SaveData> {
  const parsed = JSON.parse(await file.text()) as SaveData;
  if (parsed.version !== 1 || !parsed.settings || !parsed.statistics || !Array.isArray(parsed.history)) {
    throw new Error("不是有效的德州扑克存档文件");
  }
  return normalizePlayerNames({ ...parsed, history: parsed.history.slice(0, 300) });
}
