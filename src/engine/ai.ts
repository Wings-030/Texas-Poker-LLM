import { getLegalActions } from "./betting";
import { estimateWinRate } from "./odds";
import type { AIProfile, GameState, PlayerActionType } from "../types/poker";

export interface AIDecision {
  type: PlayerActionType;
  targetTotal?: number;
  reason: string;
}

export const AI_PROFILES: Record<string, AIProfile> = {
  easy: { difficulty: "easy", aggression: 0.35, bluffRate: 0.03, looseness: 0.2, randomness: 0.2 },
  normal: { difficulty: "normal", aggression: 0.55, bluffRate: 0.08, looseness: 0.08, randomness: 0.1 },
  hard: { difficulty: "hard", aggression: 0.7, bluffRate: 0.12, looseness: 0.02, randomness: 0.06 },
};

export function decideAIAction(state: GameState, playerId: string, random: () => number = Math.random): AIDecision {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) throw new Error("找不到需要行动的电脑玩家");
  const legal = getLegalActions(state, playerId);
  const profile = AI_PROFILES[state.config.aiDifficulty];
  const opponents = state.players.filter((item) => item.id !== playerId && item.status !== "folded" && item.status !== "eliminated").length;
  const simulations = state.config.aiDifficulty === "hard" ? 110 : state.config.aiDifficulty === "normal" ? 65 : 30;
  const equity = estimateWinRate(player.holeCards, state.communityCards, Math.max(1, opponents), simulations, random);
  const potOdds = legal.toCall / Math.max(1, state.potTotal + legal.toCall);
  const noise = (random() - 0.5) * profile.randomness;
  const adjusted = equity + noise;
  const bluff = random() < profile.bluffRate;

  if (legal.canCheck && adjusted < 0.48 && !bluff) return { type: "check", reason: "免费继续看牌" };
  if (legal.toCall > 0 && adjusted + profile.looseness < potOdds && !bluff) return { type: "fold", reason: "跟注成本高于估算胜率" };
  if (adjusted > 0.78 && legal.canAllIn && player.chips <= state.potTotal * 1.2) return { type: "all-in", reason: "强牌且有效筹码较浅" };

  const wantsRaise = adjusted > 0.62 || (bluff && adjusted > 0.25);
  if (wantsRaise && (legal.canBet || legal.canRaise)) {
    const potTarget = player.streetBet + Math.max(state.config.bigBlind, Math.round(state.potTotal * (adjusted > 0.78 ? 0.75 : 0.5)));
    const targetTotal = Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, potTarget));
    return { type: legal.canBet ? "bet" : "raise", targetTotal, reason: bluff ? "根据牌面尝试施压" : "按牌力进行价值下注" };
  }
  if (legal.canCall) return { type: "call", reason: "胜率与底池赔率允许继续" };
  if (legal.toCall > 0 && legal.canAllIn) return adjusted + profile.looseness >= potOdds ? { type: "all-in", reason: "短筹码全下跟注" } : { type: "fold", reason: "筹码不足且赔率不合适" };
  return { type: "check", reason: "控制底池" };
}
