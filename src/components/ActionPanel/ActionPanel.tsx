import { useEffect, useMemo, useState } from "react";
import { CardView } from "../Card/CardView";
import { getLegalActions } from "../../engine/betting";
import { useI18n } from "../../i18n";
import type { GameState, PlayerActionType } from "../../types/poker";

interface Props {
  game: GameState;
  disabled: boolean;
  onAction: (type: PlayerActionType, targetTotal?: number) => void;
}

export function ActionPanel({ game, disabled, onAction }: Props) {
  const { t } = useI18n();
  const hero = game.players[0];
  const legal = useMemo(() => getLegalActions(game, hero.id), [game, hero.id]);
  const [amount, setAmount] = useState(legal.minRaiseTo);
  useEffect(() => setAmount(Math.min(legal.maxRaiseTo, legal.minRaiseTo)), [legal.minRaiseTo, legal.maxRaiseTo]);
  const target = Math.max(0, Math.min(legal.maxRaiseTo, Math.round(amount)));
  const after = hero.chips - Math.max(0, target - hero.streetBet);
  const setPotFraction = (fraction: number) => setAmount(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, hero.streetBet + Math.round(game.potTotal * fraction))));
  const actionable = !disabled && (legal.canCheck || legal.canFold || legal.canAllIn);
  const primaryType = legal.canCheck ? "check" : legal.canCall ? "call" : legal.canBet ? "bet" : legal.canRaise ? "raise" : legal.canAllIn ? "all-in" : "fold";

  return (
    <section className={`action-panel ${!actionable ? "disabled" : ""}`} aria-label={t("玩家操作区")}>
      <div className="action-player-summary">
        <div className="action-hole-cards" aria-hidden="true">{hero.holeCards.map((card, index) => <CardView key={index} card={card} small />)}</div>
        <span><small>{t("你的筹码")}</small><strong>{hero.chips.toLocaleString()}</strong></span>
      </div>
      <div className="action-summary">
        <span>{t("需跟注")} <strong>{legal.toCall}</strong></span>
        <span>{t("底池")} <strong>{game.potTotal}</strong></span>
        <span>{t("最小 / 最大")} <strong>{legal.minRaiseTo} / {legal.maxRaiseTo}</strong></span>
        <span>{t("下注后剩余")} <strong>{after}</strong></span>
      </div>
      <div className="bet-controls">
        <label className="amount-field"><span>{t("选择下注额")}</span><input aria-label={t("下注金额")} type="number" min={legal.minRaiseTo} max={legal.maxRaiseTo} step={game.config.bigBlind} value={target} disabled={!actionable || (!legal.canBet && !legal.canRaise)} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <div className="amount-slider"><input aria-label={t("下注滑块")} type="range" min={Math.min(legal.minRaiseTo, legal.maxRaiseTo)} max={Math.max(legal.minRaiseTo, legal.maxRaiseTo)} step={1} value={target} disabled={!actionable || (!legal.canBet && !legal.canRaise)} onChange={(event) => setAmount(Number(event.target.value))} /><small>{legal.minRaiseTo}<span>{target}</span>{legal.maxRaiseTo}</small></div>
        <div className="quick-bets">
          <button disabled={!legal.canBet && !legal.canRaise} onClick={() => setAmount(legal.minRaiseTo)}>{t("最小加注")}</button>
          {[1 / 3, 1 / 2, 2 / 3, 3 / 4, 1].map((fraction) => <button key={fraction} disabled={!legal.canBet && !legal.canRaise} onClick={() => setPotFraction(fraction)}>{fraction === 1 ? `1× ${t("底池")}` : `${Math.round(fraction * 100)}% ${t("底池")}`}</button>)}
          <button disabled={!legal.canAllIn} onClick={() => setAmount(legal.maxRaiseTo)}>{t("全下额")}</button>
        </div>
      </div>
      <div className="primary-actions">
        <button className={`danger ${primaryType === "fold" ? "primary-action" : ""}`} disabled={disabled || !legal.canFold} onClick={() => onAction("fold")}>{t("弃牌")}</button>
        <button className={primaryType === "check" ? "primary-action" : ""} disabled={disabled || !legal.canCheck} onClick={() => onAction("check")}>{t("过牌")}</button>
        <button className={primaryType === "call" ? "primary-action" : ""} disabled={disabled || !legal.canCall} onClick={() => onAction("call")}>{t("跟注")} <strong>{legal.toCall}</strong></button>
        <button className={`raise-action ${primaryType === "bet" || primaryType === "raise" ? "primary-action" : ""}`} disabled={disabled || (!legal.canBet && !legal.canRaise) || target < legal.minRaiseTo} onClick={() => onAction(legal.canBet ? "bet" : "raise", target)}>{t(legal.canBet ? "下注" : "加注")} <strong>{target}</strong></button>
        <button className={`all-in ${primaryType === "all-in" ? "primary-action" : ""}`} disabled={disabled || !legal.canAllIn} onClick={() => onAction("all-in")}>{t("全下")} <strong>{hero.chips}</strong></button>
      </div>
    </section>
  );
}
