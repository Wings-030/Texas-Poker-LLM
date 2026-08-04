import { useState } from "react";
import { CardView } from "../components/Card/CardView";
import { ReplayViewer } from "../components/ReplayViewer/ReplayViewer";
import { useI18n } from "../i18n";
import type { HandRecord } from "../types/poker";

export function ReplayPage({ history }: { history: HandRecord[] }) {
  const { t, locale } = useI18n();
  const [selectedId, setSelectedId] = useState(history[0]?.id ?? "");
  const selected = history.find((record) => record.id === selectedId) ?? history[0];
  if (!history.length) return <main className="content-page"><div className="page-heading"><div><span className="eyebrow">{t("牌局档案")}</span><h1>{t("历史与复盘")}</h1></div></div><div className="empty-state large">{t("完成一手牌后，完整行动记录会出现在这里。")}</div></main>;
  return (
    <main className="content-page replay-page">
      <div className="page-heading"><div><span className="eyebrow">{t("牌局档案")}</span><h1>{t("历史与复盘")}</h1><p>{t("只公开当时规则允许看到的底牌，未摊牌底牌保持未知。")}</p></div></div>
      <div className="history-layout"><aside className="history-list">{history.map((record) => { const net = record.result.net.hero ?? 0; return <button key={record.id} className={selected?.id === record.id ? "selected" : ""} onClick={() => setSelectedId(record.id)}><span><strong>{t("第 {count} 手", { count: record.handNumber })}</strong><small>{new Date(record.timestamp).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></span><span className="mini-cards">{record.heroCards.map((card, index) => <CardView key={index} card={card} small />)}</span><b className={net >= 0 ? "positive" : "negative"}>{net >= 0 ? "+" : ""}{net}</b></button>; })}</aside><section className="replay-panel">{selected && <ReplayViewer record={selected} />}</section></div>
    </main>
  );
}
