import type { Player, TournamentState } from "../types/poker";

export const BLIND_LEVELS: Array<[number, number]> = [
  [50, 100], [75, 150], [100, 200], [150, 300], [200, 400],
  [300, 600], [400, 800], [600, 1200], [1000, 2000],
];

export function blindsForLevel(level: number): [number, number] {
  if (level < BLIND_LEVELS.length) return BLIND_LEVELS[level];
  const extra = level - BLIND_LEVELS.length + 1;
  const multiplier = 2 ** Math.ceil(extra / 2);
  const base = BLIND_LEVELS[BLIND_LEVELS.length - 1];
  return [base[0] * multiplier, base[1] * multiplier];
}

export function nextTournamentState(
  tournament: TournamentState,
  players: readonly Player[],
  handsPerLevel: number,
): TournamentState {
  const eliminated = players.filter((player) => player.chips === 0 && !tournament.eliminatedPlayerIds.includes(player.id));
  const finalStandings = [...tournament.finalStandings];
  const eliminatedIds = [...tournament.eliminatedPlayerIds];
  for (const player of eliminated.sort((a, b) => a.startingChips - b.startingChips || a.seat - b.seat)) {
    eliminatedIds.push(player.id);
    finalStandings.unshift(player.id);
  }
  const handsAtLevel = tournament.handsAtLevel + 1;
  const advanceLevel = handsAtLevel >= handsPerLevel;
  const survivors = players.filter((player) => player.chips > 0);
  const championId = survivors.length === 1 ? survivors[0].id : undefined;
  if (championId && !finalStandings.includes(championId)) finalStandings.unshift(championId);
  return {
    blindLevel: tournament.blindLevel + (advanceLevel ? 1 : 0),
    handsAtLevel: advanceLevel ? 0 : handsAtLevel,
    handsUntilNextLevel: advanceLevel ? handsPerLevel : handsPerLevel - handsAtLevel,
    eliminatedPlayerIds: eliminatedIds,
    finalStandings,
    championId,
  };
}

// Players eliminated in the same hand rank by their stack at the start of it.
// Equal starting stacks share a place.
export function eliminationPlace(players: readonly Player[], playerId: string): number {
  const eliminated = players.find((player) => player.id === playerId)!;
  return 1 + players.filter((player) => player.chips > 0 || player.chips === 0 && player.startingChips > eliminated.startingChips).length;
}

export function rotateDealer(players: readonly Player[], dealerIndex: number): number {
  if (players.every((player) => player.chips <= 0)) return dealerIndex;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const index = (dealerIndex + offset + players.length) % players.length;
    if (players[index].chips > 0) return index;
  }
  return dealerIndex;
}
