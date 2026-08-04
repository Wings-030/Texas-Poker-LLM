import { compareEvaluations } from "./handEvaluator";
import type { HandEvaluation, Player, Pot, PotAward } from "../types/poker";

export function buildPots(players: readonly Player[]): Pot[] {
  const contributors = players.filter((player) => player.totalBet > 0);
  const levels = [...new Set(contributors.map((player) => player.totalBet))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let previous = 0;
  for (const level of levels) {
    const involved = contributors.filter((player) => player.totalBet >= level);
    const amount = (level - previous) * involved.length;
    if (amount > 0) {
      pots.push({
        amount,
        cap: level,
        eligiblePlayerIds: involved.filter((player) => player.status !== "folded").map((player) => player.id),
      });
    }
    previous = level;
  }
  return pots;
}

function seatOrderFromDealer(players: readonly Player[], dealerIndex: number): string[] {
  const ordered: string[] = [];
  for (let offset = 1; offset <= players.length; offset += 1) {
    ordered.push(players[(dealerIndex + offset) % players.length].id);
  }
  return ordered;
}

export function awardPots(
  pots: readonly Pot[],
  players: readonly Player[],
  evaluations: Record<string, HandEvaluation>,
  dealerIndex: number,
): PotAward[] {
  const oddChipOrder = seatOrderFromDealer(players, dealerIndex);
  return pots.map((pot, potIndex) => {
    const eligible = pot.eligiblePlayerIds.filter((id) => evaluations[id]);
    if (eligible.length === 0) throw new Error("底池没有可参与结算的玩家");
    let winners = [eligible[0]];
    for (const id of eligible.slice(1)) {
      const comparison = compareEvaluations(evaluations[id], evaluations[winners[0]]);
      if (comparison > 0) winners = [id];
      else if (comparison === 0) winners.push(id);
    }
    winners.sort((a, b) => oddChipOrder.indexOf(a) - oddChipOrder.indexOf(b));
    const base = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount % winners.length;
    const shares: Record<string, number> = {};
    for (const id of winners) {
      shares[id] = base + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
    }
    return { potIndex, amount: pot.amount, winnerIds: winners, shares };
  });
}
