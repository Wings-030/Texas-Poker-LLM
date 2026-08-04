import type { GameState, PlayerActionType, Street } from "../types/poker";

export interface LegalActions {
  toCall: number;
  minRaiseTo: number;
  maxRaiseTo: number;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  canBet: boolean;
  canRaise: boolean;
  canAllIn: boolean;
}

export function getLegalActions(state: GameState, playerId: string): LegalActions {
  const player = state.players.find((item) => item.id === playerId);
  const isTurn = player && state.players[state.currentPlayerIndex]?.id === playerId;
  const actionable = Boolean(isTurn && player?.status === "active" && player.chips > 0 && ["preflop", "flop", "turn", "river"].includes(state.phase));
  const toCall = player ? Math.max(0, state.currentBet - player.streetBet) : 0;
  const maxRaiseTo = player ? player.streetBet + player.chips : 0;
  const minRaiseTo = state.currentBet === 0 ? state.config.bigBlind : state.currentBet + state.minRaise;
  return {
    toCall,
    minRaiseTo,
    maxRaiseTo,
    canFold: actionable,
    canCheck: actionable && toCall === 0,
    canCall: actionable && toCall > 0 && Boolean(player && player.chips > toCall),
    canBet: actionable && state.currentBet === 0 && maxRaiseTo >= minRaiseTo,
    canRaise: actionable && state.currentBet > 0 && maxRaiseTo >= minRaiseTo,
    canAllIn: actionable && Boolean(player && player.chips > 0),
  };
}

export function actionLabel(type: PlayerActionType, amount: number): string {
  const labels: Record<PlayerActionType, string> = {
    fold: "弃牌", check: "过牌", call: "跟注", bet: "下注", raise: "加注", "all-in": "全下",
  };
  return amount > 0 ? `${labels[type]} ${amount}` : labels[type];
}

export function validateAction(state: GameState, playerId: string, type: PlayerActionType, targetTotal?: number): void {
  const legal = getLegalActions(state, playerId);
  const player = state.players.find((item) => item.id === playerId);
  if (!player || state.players[state.currentPlayerIndex]?.id !== playerId) throw new Error("现在还没有轮到该玩家行动");
  if (type === "fold" && !legal.canFold) throw new Error("当前不能弃牌");
  if (type === "check" && !legal.canCheck) throw new Error("面对下注时不能过牌");
  if (type === "call" && !legal.canCall) throw new Error("筹码不足时请使用全下跟注");
  if (type === "bet" && !legal.canBet) throw new Error("当前不能下注");
  if (type === "raise" && !legal.canRaise) throw new Error("当前不能进行合法加注");
  if (type === "all-in" && !legal.canAllIn) throw new Error("当前不能全下");
  if (type === "bet" || type === "raise") {
    if (!Number.isInteger(targetTotal)) throw new Error("下注金额必须是整数");
    if ((targetTotal ?? 0) < legal.minRaiseTo) throw new Error(`最低合法金额为 ${legal.minRaiseTo}`);
    if ((targetTotal ?? 0) > legal.maxRaiseTo) throw new Error("下注金额不能超过剩余筹码");
  }
}

export function isBettingStreet(phase: string): phase is Street {
  return phase === "preflop" || phase === "flop" || phase === "turn" || phase === "river";
}
