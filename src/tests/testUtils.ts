import type { Card, GameState, Player, Rank, Suit } from "../types/poker";
import { createDeck } from "../engine/deck";

export function card(text: string): Card {
  const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
  return { rank: text.slice(0, -1) as Rank, suit: suitMap[text.slice(-1)] };
}

export function cards(text: string): Card[] {
  return text.split(/\s+/).map(card);
}

export function player(id: string, chips: number, totalBet = 0, status: Player["status"] = "active"): Player {
  return {
    id, name: id, seat: Number(id.replace(/\D/g, "")) || 0, isHuman: id === "p0", chips,
    startingChips: chips + totalBet, streetBet: totalBet, totalBet, holeCards: [], status, acted: false, lastAction: "",
  };
}

export function bettingState(): GameState {
  return {
    id: "test", config: { mode: "quick", playerCount: 2, startingChips: 1000, smallBlind: 25, bigBlind: 50, aiDifficulty: "easy", speed: "instant", handsPerLevel: 5 },
    players: [player("p0", 950, 50), player("p1", 900, 100)], deck: createDeck(), deckIndex: 0, communityCards: [],
    dealerIndex: 0, smallBlindIndex: 0, bigBlindIndex: 1, currentPlayerIndex: 0, phase: "preflop", handNumber: 1,
    currentBet: 100, minRaise: 50, potTotal: 150, actions: [], replay: [], result: null, tournament: null, message: "",
  };
}
