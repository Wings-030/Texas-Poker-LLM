import { useMemo } from "react";
import { getLegalActions } from "../../engine/betting";
import { evaluateHand } from "../../engine/handEvaluator";
import { detectDraws, estimateWinRate } from "../../engine/odds";
import { useI18n } from "../../i18n";
import type { GameState } from "../../types/poker";

export function BeginnerHelp({ game, showHandName }: { game: GameState; showHandName: boolean }) {
  const { language, t, text } = useI18n();
  const hero = game.players[0];
  const info = useMemo(() => {
    const known = [...hero.holeCards, ...game.communityCards];
    const evaluation = known.length >= 5 ? evaluateHand(known) : null;
    const draws = detectDraws(known);
    const opponents = game.players.filter((player) => !player.isHuman && player.status !== "folded" && player.status !== "eliminated").length;
    const winRate = estimateWinRate(hero.holeCards, game.communityCards, Math.max(1, opponents), 70);
    const legal = getLegalActions(game, hero.id);
    const potOdds = legal.toCall / Math.max(1, game.potTotal + legal.toCall);
    let recommendation = t("过牌");
    let reason = t("可以免费继续看牌，通常无需主动扩大底池。");
    if (legal.toCall > 0 && winRate + 0.04 < potOdds) { recommendation = t("弃牌"); reason = t("从当前可见信息看，估算胜率低于约 {percent}% 的跟注门槛。", { percent: Math.round(potOdds * 100) }); }
    else if (winRate > 0.68 && (legal.canBet || legal.canRaise)) { recommendation = t(legal.canBet ? "下注" : "加注"); reason = t("当前估算牌力较强，通常可以考虑价值下注。"); }
    else if (legal.toCall > 0) { recommendation = t(legal.canCall ? "跟注" : "谨慎决定是否全下"); reason = t("估算胜率能够覆盖当前底池赔率，但结果仍有不确定性。"); }
    const drawsText = [draws.flushDraw ? t("同花听牌") : "", draws.openEndedStraightDraw ? t("两头顺听牌") : ""].filter(Boolean).join(language === "zh" ? "、" : ", ") || t("未识别到明显听牌");
    return { evaluation, draws, winRate, potOdds, recommendation, reason, drawsText };
  }, [game, hero, language, t]);
  const suited = hero.holeCards[0]?.suit === hero.holeCards[1]?.suit;
  const holeName = hero.holeCards.map((card) => card.rank).join("") + ` ${language === "zh" ? (suited ? "同花" : "非同花") : (suited ? "suited" : "offsuit")}`;
  return (
    <aside className="beginner-help">
      <div className="panel-title"><span>{t("学习助手")}</span><small>{t("仅使用你能看到的信息")}</small></div>
      <div className="help-grid">
        <span>{t("底牌")}<strong>{holeName}</strong></span><span>{t("当前牌型")}<strong>{showHandName ? info.evaluation ? text(info.evaluation.name) : t("尚未成牌") : t("已隐藏")}</strong></span>
        <span>{t("听牌")}<strong>{info.drawsText}</strong></span><span>{t("可用补牌")}<strong>{t("约 {count} 张", { count: info.draws.outs })}</strong></span>
        <span>{t("粗略胜率")}<strong>{Math.round(info.winRate * 100)}%</strong></span><span>{t("底池赔率")}<strong>{Math.round(info.potOdds * 100)}%</strong></span>
      </div>
      <div className="recommendation"><span>{t("建议：")}{info.recommendation}</span><p>{info.reason}</p></div>
      <small className="disclaimer">{t("建议只作学习参考，并不代表绝对正确的扑克策略。")}</small>
    </aside>
  );
}
