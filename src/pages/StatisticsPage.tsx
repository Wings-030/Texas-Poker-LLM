import { useRef, useState } from "react";
import { StatsPanel } from "../components/StatsPanel/StatsPanel";
import type { GameStatistics, HandRecord, SaveData } from "../types/poker";
import { addHandToStatistics, emptyStatistics } from "../storage/localStorage";
import { useI18n } from "../i18n";

export function StatisticsPage({ statistics, history, onExport, onImport, onClear }: {
  statistics: GameStatistics; history: HandRecord[]; onExport: () => void; onImport: (file: File) => void; onClear: () => void;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "10" | "50" | "100" | "quick" | "tournament">("all");
  const input = useRef<HTMLInputElement>(null);
  const filtered = filter === "all" ? history : filter === "quick" || filter === "tournament" ? history.filter((record) => record.mode === filter) : history.slice(0, Number(filter));
  const rangeStatistics = [...filtered].reverse().reduce(addHandToStatistics, structuredClone(emptyStatistics));
  const displayedStatistics = filter === "all" ? statistics : {
    ...rangeStatistics,
    games: statistics.games,
    quickGames: statistics.quickGames,
    tournaments: statistics.tournaments,
    tournamentWins: statistics.tournamentWins,
    bestTournamentPlace: statistics.bestTournamentPlace,
  };
  return (
    <main className="content-page">
      <div className="page-heading"><div><span className="eyebrow">{t("数据中心")}</span><h1>{t("牌局统计")}</h1><p>{t("用通俗指标观察长期倾向，而不是评价单次运气。")}</p></div><div className="page-actions"><button onClick={onExport}>{t("导出 JSON")}</button><button onClick={() => input.current?.click()}>{t("导入 JSON")}</button><input ref={input} hidden type="file" accept="application/json" onChange={(event) => event.target.files?.[0] && onImport(event.target.files[0])} /><button className="danger-text" onClick={() => window.confirm(t("确定清空全部统计与历史吗？此操作无法撤销。")) && onClear()}>{t("清空数据")}</button></div></div>
      <div className="filter-tabs">{([['all','总体'],['10','最近 10 手'],['50','最近 50 手'],['100','最近 100 手'],['quick','快速游戏'],['tournament','锦标赛']] as const).map(([value, label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{t(label)}</button>)}</div>
      <StatsPanel statistics={displayedStatistics} history={filtered} />
      <p className="data-note">{t("说明：当前指标按所选范围重新计算；游戏场次数以总体统计为准。存档格式版本为 v1。")}</p>
    </main>
  );
}

export type ImportedSave = SaveData;
