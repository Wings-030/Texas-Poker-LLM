import { getLegalActions } from "../engine/betting";
import type { AICharacterSetting, Card, GameState } from "../types/poker";

const cardText = (card: Card) => `${card.rank}${card.suit[0].toUpperCase()}`;

export function buildPokerAIRequest(game: GameState, characterId: string, requestId: string, characterSetting?: AICharacterSetting) {
  const player = game.players.find((item) => item.id === characterId);
  if (!player) throw new Error("找不到需要行动的电脑玩家");
  const legal = getLegalActions(game, characterId);
  const actions = [
    legal.canFold && "fold", legal.canCheck && "check", legal.canCall && "call", legal.canBet && "bet",
    legal.canRaise && "raise", legal.canAllIn && "all-in",
  ].filter(Boolean) as string[];
  const handId = `${game.id}-hand-${game.handNumber}`;
  const turnId = `${handId}-${game.phase}-${game.actions.length}-${characterId}`;
  return {
    gameId: game.id,
    handId,
    turnId,
    characterId,
    requestId,
    characterPrompt: characterSetting ? {
      personality: characterSetting.personality.trim().slice(0, 12000),
      playingStyle: characterSetting.playingStyle.trim().slice(0, 12000),
      additional: characterSetting.prompt.trim().slice(0, 12000),
    } : undefined,
    gameState: {
      table: { gameMode: game.config.mode, round: game.phase, handNumber: game.handNumber, dealerSeat: game.players[game.dealerIndex]?.seat, seat: player.seat, smallBlind: game.config.smallBlind, bigBlind: game.config.bigBlind },
      players: game.players.map((item) => ({ id: item.id, name: item.name, seat: item.seat, chips: item.chips, streetBet: item.streetBet, totalBet: item.totalBet, status: item.status, lastAction: item.lastAction })),
      aiHoleCards: player.holeCards.map(cardText),
      communityCards: game.communityCards.map(cardText),
      bettingHistory: game.actions.map((action) => ({ playerId: action.playerId, action: action.type, amount: action.amount, round: action.street, potAfterAction: action.potAfterAction })),
      chips: { pot: game.potTotal, aiStack: player.chips, opponentStacks: Object.fromEntries(game.players.filter((item) => item.id !== characterId).map((item) => [item.id, item.chips])), currentBet: game.currentBet, aiStreetBet: player.streetBet, toCall: legal.toCall, minRaiseTo: legal.minRaiseTo, maxRaiseTo: legal.maxRaiseTo },
      legalActions: { actions, toCall: legal.toCall, minRaiseTo: legal.minRaiseTo, maxRaiseTo: legal.maxRaiseTo },
      recentConversation: [game.message, ...game.actions.slice(-6).map((action) => action.label ?? action.type)].filter(Boolean),
    },
  };
}

export function isDecisionCurrent(response: Pick<ReturnType<typeof buildPokerAIRequest>, "gameId" | "handId" | "turnId" | "characterId" | "requestId">, expected: ReturnType<typeof buildPokerAIRequest>): boolean {
  return response.gameId === expected.gameId && response.handId === expected.handId && response.turnId === expected.turnId && response.characterId === expected.characterId && response.requestId === expected.requestId;
}

export function isGameTurnCurrent(game: GameState, expected: ReturnType<typeof buildPokerAIRequest>): boolean {
  const current = game.players[game.currentPlayerIndex];
  const handId = `${game.id}-hand-${game.handNumber}`;
  const turnId = `${handId}-${game.phase}-${game.actions.length}-${current?.id ?? "none"}`;
  return game.id === expected.gameId && handId === expected.handId && turnId === expected.turnId && current?.id === expected.characterId;
}
