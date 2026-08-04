import type { GameStatistics, HandRecord } from "../../types/poker";
import { useI18n } from "../../i18n";

function percent(value: number, total: number): string { return total ? `${(value / total * 100).toFixed(1)}%` : "0.0%"; }

export function StatsPanel({ statistics, history }: { statistics: GameStatistics; history: HandRecord[] }) {
  const { language, t, locale } = useI18n();
  const metrics = [
    ["总手牌", statistics.hands.toLocaleString(locale), "记录的全部牌局"], ["胜率", percent(statistics.handsWon, statistics.hands), "净盈利手牌占比"],
    ["VPIP", percent(statistics.vpipHands, statistics.hands), "翻牌前主动投入筹码的手牌比例"], ["PFR", percent(statistics.pfrHands, statistics.hands), "翻牌前主动加注的手牌比例"],
    ["WTSD", percent(statistics.showdowns, statistics.hands), "进入摊牌的手牌比例"], ["W$SD", percent(statistics.showdownWins, statistics.showdowns), "进入摊牌后获胜的比例"],
    ["总盈亏", `${statistics.netChips >= 0 ? "+" : ""}${statistics.netChips}`, "累计筹码变化"], ["平均每手", statistics.hands ? (statistics.netChips / statistics.hands).toFixed(1) : "0", "平均每手筹码收益"],
    ["最大单手盈利", `+${statistics.biggestWin}`, "历史最佳单手"], ["最大单手亏损", `${statistics.biggestLoss}`, "历史最差单手"],
    ["全下次数", statistics.allIns.toString(), t("获胜 {count} 次", { count: statistics.allInWins })], ["最长连胜 / 连败", `${statistics.longestWinStreak} / ${statistics.longestLossStreak}`, "按单手净收益计算"],
  ];
  const starting = Object.values(statistics.startingHands).sort((a, b) => b.hands - a.hands).slice(0, 12);
  return (
    <div className="stats-content">
      <div className="metric-grid">{metrics.map(([label, value, hint]) => <article className="metric-card" key={label}><span>{t(label)}</span><strong>{value}</strong><small>{t(hint)}</small></article>)}</div>
      <section className="data-card"><div className="section-heading"><div><span className="eyebrow">{t("起手牌表现")}</span><h3>{t("最常拿到的底牌")}</h3></div><small>{language === "zh" ? `共保存 ${history.length} 手历史` : `${history.length} ${history.length === 1 ? "hand" : "hands"} saved`}</small></div>
        {starting.length ? <div className="starting-table"><div className="table-row header"><span>{t("起手牌")}</span><span>{t("次数")}</span><span>{t("胜率")}</span><span>{t("盈亏")}</span></div>{starting.map((item) => <div className="table-row" key={item.key}><strong>{item.key === "未知" ? t("未知") : item.key}</strong><span>{item.hands}</span><span>{percent(item.wins, item.hands)}</span><span className={item.netChips >= 0 ? "positive" : "negative"}>{item.netChips >= 0 ? "+" : ""}{item.netChips}</span></div>)}</div> : <div className="empty-state">{t("完成一手牌后，这里会显示你的数据。")}</div>}
      </section>
      <section className="data-card compact-stats"><div className="section-heading"><div><span className="eyebrow">{t("行动与赛事")}</span><h3>{t("累计计数")}</h3></div></div><div className="count-grid"><span>{t("游戏场数")}<strong>{statistics.games}</strong></span><span>{t("快速 / 锦标赛")}<strong>{statistics.quickGames} / {statistics.tournaments}</strong></span><span>{t("弃牌 / 跟注 / 加注")}<strong>{statistics.folds} / {statistics.calls} / {statistics.raises}</strong></span><span>{t("未摊牌施压获胜")}<strong>{statistics.successfulBluffs}</strong></span><span>{t("锦标赛夺冠")}<strong>{statistics.tournamentWins}</strong></span><span>{t("最佳名次")}<strong>{statistics.bestTournamentPlace ?? "—"}</strong></span></div></section>
    </div>
  );
}
