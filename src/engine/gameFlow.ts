import { actionLabel, isBettingStreet, validateAction } from "./betting";
import { createDeck, drawCards, shuffleDeck } from "./deck";
import { evaluateHand } from "./handEvaluator";
import { awardPots, buildPots } from "./pots";
import { blindsForLevel, nextTournamentState, rotateDealer } from "./tournament";
import { AI_PLAYERS, findAIPlayer } from "../data/aiPlayers";
import type {
  GameConfig, GameState, HandRecord, HandResult, Player, PlayerAction, PlayerActionType, ReplayStep, Street,
} from "../types/poker";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nextIndex(players: readonly Player[], from: number, predicate: (player: Player) => boolean): number {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (from + offset + players.length) % players.length;
    if (predicate(players[index])) return index;
  }
  return from;
}

function snapshot(state: GameState, actionText: string, action?: PlayerAction): ReplayStep {
  return {
    index: state.replay.length,
    street: state.phase,
    communityCards: [...state.communityCards],
    pot: state.potTotal,
    playerChips: Object.fromEntries(state.players.map((player) => [player.id, player.chips])),
    currentPlayerId: state.players[state.currentPlayerIndex]?.id ?? null,
    currentBet: state.currentBet,
    actionText,
    action,
  };
}

function postBlind(player: Player, amount: number): number {
  const paid = Math.min(player.chips, amount);
  player.chips -= paid;
  player.streetBet += paid;
  player.totalBet += paid;
  player.lastAction = `盲注 ${paid}`;
  if (player.chips === 0) player.status = "all-in";
  return paid;
}

export function createGame(config: GameConfig, random: () => number = Math.random): GameState {
  const selectedIds = config.aiPlayerIds ?? AI_PLAYERS.slice(0, config.playerCount - 1).map((player) => player.id);
  const selectedAIPlayers = selectedIds.map(findAIPlayer);
  if (selectedIds.length < 1 || selectedIds.length > 8) throw new Error("请选择 1 至 8 位电脑玩家");
  if (new Set(selectedIds).size !== selectedIds.length || selectedAIPlayers.some((player) => !player)) throw new Error("电脑玩家选择无效");
  if (![config.startingChips, config.smallBlind, config.bigBlind].every(Number.isInteger)) throw new Error("筹码和盲注必须是整数");
  if (config.startingChips <= 0 || config.smallBlind <= 0 || config.bigBlind <= config.smallBlind) throw new Error("初始筹码和盲注设置不合法");
  const normalizedConfig = { ...config, playerCount: selectedIds.length + 1, aiPlayerIds: selectedIds };
  const players: Player[] = [{ id: "hero", name: "USER" }, ...selectedAIPlayers.map((player) => ({ id: player!.id, name: player!.name }))].map((player, seat) => ({
    ...player,
    seat,
    isHuman: seat === 0,
    chips: config.startingChips,
    startingChips: config.startingChips,
    streetBet: 0,
    totalBet: 0,
    holeCards: [],
    status: "active",
    acted: false,
    lastAction: "等待",
  }));
  const state: GameState = {
    id: `game-${Date.now()}`,
    config: normalizedConfig,
    players,
    deck: [],
    deckIndex: 0,
    communityCards: [],
    dealerIndex: normalizedConfig.playerCount - 1,
    smallBlindIndex: 0,
    bigBlindIndex: 1,
    currentPlayerIndex: 0,
    phase: "preflop",
    handNumber: 0,
    currentBet: 0,
    minRaise: config.bigBlind,
    potTotal: 0,
    actions: [],
    replay: [],
    result: null,
    tournament: config.mode === "tournament" ? {
      blindLevel: 0,
      handsAtLevel: 0,
      handsUntilNextLevel: config.handsPerLevel,
      eliminatedPlayerIds: [],
      finalStandings: [],
    } : null,
    message: "准备开始",
  };
  return startNextHand(state, random);
}

export function startNextHand(previous: GameState, random: () => number = Math.random): GameState {
  const state = clone(previous);
  if (state.tournament?.championId) {
    state.phase = "finished";
    state.message = `${state.players.find((player) => player.id === state.tournament?.championId)?.name ?? "玩家"} 获得冠军`;
    return state;
  }
  const survivors = state.players.filter((player) => player.chips > 0);
  if (survivors.length <= 1 || state.players[0].chips <= 0) {
    state.phase = "finished";
    state.message = state.players[0].chips <= 0 ? "你的筹码已经用尽" : "牌桌只剩最后一名玩家";
    return state;
  }
  if (state.tournament) {
    const [smallBlind, bigBlind] = blindsForLevel(state.tournament.blindLevel);
    state.config.smallBlind = smallBlind;
    state.config.bigBlind = bigBlind;
  }
  state.handNumber += 1;
  state.dealerIndex = rotateDealer(state.players, state.dealerIndex);
  for (const player of state.players) {
    player.startingChips = player.chips;
    player.streetBet = 0;
    player.totalBet = 0;
    player.holeCards = [];
    player.acted = false;
    player.lastAction = player.chips > 0 ? "等待" : "已淘汰";
    player.status = player.chips > 0 ? "active" : "eliminated";
  }
  state.deck = shuffleDeck(createDeck(), random);
  state.deckIndex = 0;
  state.communityCards = [];
  state.actions = [];
  state.replay = [];
  state.result = null;
  state.phase = "preflop";
  state.currentBet = state.config.bigBlind;
  state.minRaise = state.config.bigBlind;

  const active = state.players.filter((player) => player.status === "active");
  for (let round = 0; round < 2; round += 1) {
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const index = (state.dealerIndex + offset) % state.players.length;
      if (state.players[index].status !== "active") continue;
      const draw = drawCards(state.deck, state.deckIndex, 1);
      state.players[index].holeCards.push(draw.cards[0]);
      state.deckIndex = draw.nextIndex;
    }
  }

  if (active.length === 2) {
    state.smallBlindIndex = state.dealerIndex;
    state.bigBlindIndex = nextIndex(state.players, state.dealerIndex, (player) => player.status === "active");
  } else {
    state.smallBlindIndex = nextIndex(state.players, state.dealerIndex, (player) => player.status === "active");
    state.bigBlindIndex = nextIndex(state.players, state.smallBlindIndex, (player) => player.status === "active");
  }
  postBlind(state.players[state.smallBlindIndex], state.config.smallBlind);
  postBlind(state.players[state.bigBlindIndex], state.config.bigBlind);
  state.potTotal = state.players.reduce((sum, player) => sum + player.totalBet, 0);
  state.currentPlayerIndex = nextIndex(state.players, state.bigBlindIndex, (player) => player.status === "active" && player.chips > 0);
  state.message = `第 ${state.handNumber} 手牌开始`;
  state.replay.push(snapshot(state, `发放底牌，盲注 ${state.config.smallBlind}/${state.config.bigBlind}`));
  return normalizeAutomaticProgress(state);
}

function bettingRoundComplete(state: GameState): boolean {
  const actors = state.players.filter((player) => player.status === "active" && player.chips > 0);
  return actors.every((player) => player.acted && player.streetBet === state.currentBet);
}

function contenderCount(state: GameState): number {
  return state.players.filter((player) => player.status !== "folded" && player.status !== "eliminated").length;
}

function settleUncontested(state: GameState): GameState {
  const winner = state.players.find((player) => player.status !== "folded" && player.status !== "eliminated");
  if (!winner) throw new Error("无法找到未弃牌的获胜玩家");
  const amount = state.potTotal;
  winner.chips += amount;
  const shares = { [winner.id]: amount };
  const result: HandResult = {
    winnerIds: [winner.id],
    awards: [{ potIndex: 0, amount, winnerIds: [winner.id], shares }],
    evaluations: {},
    net: Object.fromEntries(state.players.map((player) => [player.id, player.chips - player.startingChips])),
    reason: "uncontested",
  };
  state.result = result;
  state.phase = "showdown";
  state.message = `${winner.name} 无需摊牌赢得 ${amount}`;
  state.replay.push(snapshot(state, state.message));
  return finishTournamentHand(state);
}

function settleShowdown(state: GameState): GameState {
  const contenders = state.players.filter((player) => player.status !== "folded" && player.status !== "eliminated");
  const evaluations = Object.fromEntries(contenders.map((player) => [player.id, evaluateHand([...player.holeCards, ...state.communityCards])]));
  const pots = buildPots(state.players);
  const awards = awardPots(pots, state.players, evaluations, state.dealerIndex);
  for (const award of awards) {
    for (const [id, amount] of Object.entries(award.shares)) {
      const player = state.players.find((item) => item.id === id);
      if (player) player.chips += amount;
    }
  }
  const winnerIds = [...new Set(awards.flatMap((award) => award.winnerIds))];
  state.result = {
    winnerIds,
    awards,
    evaluations,
    net: Object.fromEntries(state.players.map((player) => [player.id, player.chips - player.startingChips])),
    reason: "showdown",
  };
  state.phase = "showdown";
  state.message = winnerIds.map((id) => state.players.find((player) => player.id === id)?.name).join("、") + " 赢得底池";
  state.replay.push(snapshot(state, `摊牌：${state.message}`));
  return finishTournamentHand(state);
}

function finishTournamentHand(state: GameState): GameState {
  if (state.tournament) {
    state.tournament = nextTournamentState(state.tournament, state.players, state.config.handsPerLevel);
    if (state.tournament.championId) state.message += `；${state.players.find((player) => player.id === state.tournament?.championId)?.name} 获得冠军`;
  }
  return state;
}

function advanceStreet(state: GameState): GameState {
  for (const player of state.players) {
    player.streetBet = 0;
    player.acted = false;
    if (player.status === "active") player.lastAction = "等待";
  }
  state.currentBet = 0;
  state.minRaise = state.config.bigBlind;
  let drawCount = 0;
  if (state.phase === "preflop") {
    state.phase = "flop";
    drawCount = 3;
  } else if (state.phase === "flop") {
    state.phase = "turn";
    drawCount = 1;
  } else if (state.phase === "turn") {
    state.phase = "river";
    drawCount = 1;
  } else {
    return settleShowdown(state);
  }
  const draw = drawCards(state.deck, state.deckIndex, drawCount);
  state.communityCards.push(...draw.cards);
  state.deckIndex = draw.nextIndex;
  state.currentPlayerIndex = nextIndex(state.players, state.dealerIndex, (player) => player.status === "active" && player.chips > 0);
  state.message = state.phase === "flop" ? "翻牌圈" : state.phase === "turn" ? "转牌圈" : "河牌圈";
  state.replay.push(snapshot(state, `${state.message}发牌`));
  return normalizeAutomaticProgress(state);
}

function normalizeAutomaticProgress(input: GameState): GameState {
  let state = input;
  if (contenderCount(state) === 1) return settleUncontested(state);
  if (!isBettingStreet(state.phase)) return state;
  const actors = state.players.filter((player) => player.status === "active" && player.chips > 0);
  if (actors.length === 0 || bettingRoundComplete(state)) return advanceStreet(state);
  if (actors.length === 1) {
    const actor = actors[0];
    const toCall = Math.max(0, state.currentBet - actor.streetBet);
    if (toCall === 0) return advanceStreet(state);
  }
  if (state.players[state.currentPlayerIndex]?.status !== "active" || state.players[state.currentPlayerIndex].chips <= 0) {
    state.currentPlayerIndex = nextIndex(state.players, state.currentPlayerIndex, (player) => player.status === "active" && player.chips > 0);
  }
  return state;
}

export function performAction(stateInput: GameState, playerId: string, type: PlayerActionType, targetTotal?: number): GameState {
  validateAction(stateInput, playerId, type, targetTotal);
  const state = clone(stateInput);
  const player = state.players.find((item) => item.id === playerId)!;
  const previousCurrentBet = state.currentBet;
  let paid = 0;
  let isFullRaise = false;

  if (type === "fold") player.status = "folded";
  if (type === "call") paid = Math.min(player.chips, state.currentBet - player.streetBet);
  if (type === "bet" || type === "raise") {
    paid = (targetTotal ?? 0) - player.streetBet;
    const raiseSize = (targetTotal ?? 0) - previousCurrentBet;
    isFullRaise = raiseSize >= state.minRaise;
    state.currentBet = targetTotal ?? state.currentBet;
    state.minRaise = raiseSize;
  }
  if (type === "all-in") {
    paid = player.chips;
    const allInTotal = player.streetBet + paid;
    if (allInTotal > state.currentBet) {
      const raiseSize = allInTotal - state.currentBet;
      isFullRaise = raiseSize >= state.minRaise;
      if (isFullRaise) state.minRaise = raiseSize;
      state.currentBet = allInTotal;
    }
  }
  if (paid > 0) {
    player.chips -= paid;
    player.streetBet += paid;
    player.totalBet += paid;
  }
  if (player.chips === 0 && player.status === "active") player.status = "all-in";
  if (isFullRaise) {
    for (const other of state.players) if (other.id !== player.id && other.status === "active") other.acted = false;
  }
  player.acted = true;
  player.lastAction = actionLabel(type, paid);
  state.potTotal = state.players.reduce((sum, item) => sum + item.totalBet, 0);
  const action: PlayerAction = {
    playerId,
    type,
    amount: paid,
    street: state.phase as Street,
    potAfterAction: state.potTotal,
    timestamp: Date.now(),
    label: player.lastAction,
  };
  state.actions.push(action);
  state.message = `${player.name} ${player.lastAction}`;
  state.replay.push(snapshot(state, state.message, action));

  if (contenderCount(state) === 1) return settleUncontested(state);
  if (bettingRoundComplete(state)) return advanceStreet(state);
  state.currentPlayerIndex = nextIndex(state.players, state.currentPlayerIndex, (item) => item.status === "active" && item.chips > 0);
  return normalizeAutomaticProgress(state);
}

export function createHandRecord(state: GameState): HandRecord {
  if (!state.result) throw new Error("牌局尚未结束，不能写入历史记录");
  const revealedHoleCards = state.result.reason === "showdown"
    ? Object.fromEntries(state.players.filter((player) => player.status !== "folded" && player.status !== "eliminated").map((player) => [player.id, player.holeCards]))
    : {};
  return {
    id: `${state.id}-hand-${state.handNumber}`,
    handNumber: state.handNumber,
    mode: state.config.mode,
    timestamp: Date.now(),
    players: state.players.map(({ id, name, seat, startingChips }) => ({ id, name, seat, startingChips })),
    dealerIndex: state.dealerIndex,
    smallBlind: state.config.smallBlind,
    bigBlind: state.config.bigBlind,
    heroCards: [...state.players[0].holeCards],
    communityCards: [...state.communityCards],
    revealedHoleCards,
    actions: [...state.actions],
    replay: [...state.replay],
    result: clone(state.result),
  };
}
