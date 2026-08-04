import { useEffect, useMemo, useState } from "react";
import { CardView } from "../Card/CardView";
import { evaluateHand } from "../../engine/handEvaluator";
import { useI18n } from "../../i18n";
import type { HandRecord } from "../../types/poker";

const STREET_LABELS = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌", finished: "结束" } as const;

export function ReplayViewer({ record }: { record: HandRecord }) {
  const { t, text } = useI18n();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const step = record.replay[Math.min(index, record.replay.length - 1)];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index >= record.replay.length - 1) setPlaying(false); else setIndex((value) => value + 1);
    }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, record.replay.length]);
  const heroEvaluation = useMemo(() => step && record.heroCards.length + step.communityCards.length >= 5 ? evaluateHand([...record.heroCards, ...step.communityCards]) : null, [record.heroCards, step]);
  const jump = (street: keyof typeof STREET_LABELS) => {
    const found = record.replay.findIndex((item) => item.street === street);
    if (found >= 0) setIndex(found);
  };
  if (!step) return <div className="empty-state">{t("这手牌没有可播放的步骤。")}</div>;
  return (
    <div className="replay-viewer">
      <section className="replay-stage">
        <div className="replay-meta"><span>{t("步骤")} {index + 1} / {record.replay.length}</span><strong>{t(STREET_LABELS[step.street])}</strong><span>{t("底池")} {step.pot}</span></div>
        <div className="community-cards">{Array.from({ length: 5 }, (_, cardIndex) => <CardView key={cardIndex} card={step.communityCards[cardIndex]} placeholder={!step.communityCards[cardIndex]} />)}</div>
        <div className="replay-hero"><span>{t("你当时可见的底牌")}</span><div className="hole-cards static">{record.heroCards.map((card, cardIndex) => <CardView key={cardIndex} card={card} />)}</div></div>
        <div className="replay-action"><span>{text(step.actionText)}</span>{step.currentPlayerId && <small>{t("轮到：")}{text(record.players.find((player) => player.id === step.currentPlayerId)?.name)}</small>}</div>
        <div className="replay-stacks">{record.players.map((player) => <span key={player.id}>{text(player.name)}<strong>{step.playerChips[player.id] ?? 0}</strong></span>)}</div>
      </section>
      <div className="replay-controls">
        <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>{t("上一步")}</button>
        <button className="primary" onClick={() => setPlaying((value) => !value)}>{t(playing ? "暂停" : "自动播放")}</button>
        <button onClick={() => setIndex(Math.min(record.replay.length - 1, index + 1))} disabled={index === record.replay.length - 1}>{t("下一步")}</button>
        {(["flop", "turn", "river", "showdown"] as const).map((street) => <button key={street} onClick={() => jump(street)}>{t(`到${STREET_LABELS[street]}`)}</button>)}
        <label>{t("速度")}<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={1600}>{t("慢速")}</option><option value={900}>{t("正常")}</option><option value={350}>{t("快速")}</option></select></label>
      </div>
      <aside className="analysis-card"><span className="eyebrow">{t("复盘分析")}</span><h3>{heroEvaluation ? text(heroEvaluation.name) : t("尚未形成五张牌")}</h3><p>{t("从当时可见信息看，实际操作是「{action}」。牌局建议具有不确定性，应结合对手范围、位置与有效筹码理解。", { action: text(step.action?.label ?? step.actionText) })}</p></aside>
    </div>
  );
}
