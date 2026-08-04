import { useEffect, useMemo, useRef, useState } from "react";
import { ActionPanel } from "../components/ActionPanel/ActionPanel";
import { BeginnerHelp } from "../components/BeginnerHelp/BeginnerHelp";
import { PokerTable } from "../components/PokerTable/PokerTable";
import { decideAIAction } from "../engine/ai";
import { buildPokerAIRequest, isDecisionCurrent, isGameTurnCurrent } from "../api/pokerAiState";
import { cancelDecision, markStaleDecision, requestAIDecision, type BackendError, type DecisionResponse } from "../api/aiBackend";
import { createGame, performAction, startNextHand } from "../engine/gameFlow";
import { playSound } from "../utils/sound";
import {
  animateGameTransition,
  animateHandOpening,
  clearAllTableAnimations,
  clearTransientTableElements,
  enqueueTableAnimation,
  motionScale,
} from "../utils/tableAnimations";
import { useI18n } from "../i18n";
import { getAICharacterSetting } from "../data/aiCharacterSettings";
import type { GameState, PlayerActionType, Settings } from "../types/poker";

const PHASE_NAMES = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "摊牌", finished: "游戏结束" } as const;
const AI_STATUS: Record<string, string> = {
  building: "正在构建牌局信息", connecting: "正在连接本地后端", requesting: "正在请求模型", retrying: "正在重试模型请求",
  reasoning: "AI 正在思考", streaming: "正在接收最终响应", parsing: "正在解析决策", validating: "正在验证动作", complete: "AI 已完成决策",
  fallback: "模型请求失败，已使用安全回退", cancelled: "AI 请求已取消", stale: "旧响应已丢弃",
  local: "已使用本地策略完成决策", "cancelled-local": "已取消模型，改用本地策略完成决策",
};
const ACTIVE_AI_STATUSES = new Set(["building", "connecting", "requesting", "retrying", "reasoning", "streaming", "parsing", "validating"]);

interface AIViewState {
  status: string;
  requestId: string;
  characterName?: string;
  reasoning: string;
  error?: BackendError;
  debug?: DecisionResponse["debug"];
}

export function GamePage({ game, settings, onGameChange, onHandComplete, onHome, onSettings }: {
  game: GameState; settings: Settings; onGameChange: (game: GameState) => void; onHandComplete: (game: GameState) => void; onHome: () => void; onSettings: () => void;
}) {
  const { language, t, text } = useI18n();
  const [aiView, setAiView] = useState<AIViewState>({ status: "", requestId: "", reasoning: "" });
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [tableTalk, setTableTalk] = useState<{ playerId: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const handKey = `${game.id}-hand-${game.handNumber}`;
  const [dealtHandKey, setDealtHandKey] = useState(() => motionScale({ enabled: settings.animation, speed: settings.speed }) ? "" : handKey);
  const [isAnimating, setIsAnimating] = useState(false);
  const latestGameRef = useRef(game);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const animationAbortRef = useRef<AbortController | null>(null);
  const animationLockRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef("");
  const manualCancelRef = useRef("");
  const reasoningRef = useRef<HTMLPreElement | null>(null);
  latestGameRef.current = game;
  const thinking = ACTIVE_AI_STATUSES.has(aiView.status);
  const currentPlayer = game.players[game.currentPlayerIndex];
  const currentAISetting = getAICharacterSetting(settings, currentPlayer?.id ?? "");
  const finishedHand = game.phase === "showdown" && Boolean(game.result);
  const recordId = game.result ? `${game.id}-hand-${game.handNumber}` : "";
  const openingHand = dealtHandKey !== handKey && Boolean(motionScale({ enabled: settings.animation, speed: settings.speed }));
  const interactionLocked = isAnimating || openingHand;

  const transitionTo = async (previous: GameState, next: GameState) => {
    if (animationLockRef.current) return;
    animationLockRef.current = true;
    setIsAnimating(true);
    const table = tableRef.current;
    const controller = new AbortController();
    animationAbortRef.current = controller;
    let committed = false;
    try {
      if (table && motionScale({ enabled: settings.animation, speed: settings.speed })) {
        await enqueueTableAnimation(() => animateGameTransition({
          table,
          previous,
          next,
          settings: { enabled: settings.animation, speed: settings.speed },
          signal: controller.signal,
          playSound: (name) => playSound(settings.sound, name),
        }));
      }
      onGameChange(next);
      committed = true;
      if (!controller.signal.aborted) await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    } catch (caught) {
      console.error("牌桌动画异常，已直接继续牌局", caught);
      if (!committed) onGameChange(next);
    } finally {
      clearTransientTableElements(table);
      if (animationAbortRef.current === controller) animationAbortRef.current = null;
      animationLockRef.current = false;
      setIsAnimating(false);
    }
  };

  useEffect(() => { if (recordId) onHandComplete(game); }, [recordId]);
  useEffect(() => () => {
    animationAbortRef.current?.abort();
    clearAllTableAnimations(tableRef.current);
  }, []);
  useEffect(() => {
    if (dealtHandKey === handKey) return;
    animationAbortRef.current?.abort();
    clearAllTableAnimations(tableRef.current);
    if (!motionScale({ enabled: settings.animation, speed: settings.speed })) {
      animationLockRef.current = false;
      setIsAnimating(false);
      setDealtHandKey(handKey);
      return;
    }
    const table = tableRef.current;
    if (!table) {
      setDealtHandKey(handKey);
      return;
    }
    const controller = new AbortController();
    animationAbortRef.current = controller;
    animationLockRef.current = true;
    setIsAnimating(true);
    void enqueueTableAnimation(() => animateHandOpening({
      table,
      game,
      settings: { enabled: settings.animation, speed: settings.speed },
      signal: controller.signal,
      playSound: (name) => playSound(settings.sound, name),
    })).catch((caught) => console.error("开局动画异常，已直接继续牌局", caught)).finally(() => {
      if (controller.signal.aborted) return;
      setDealtHandKey(handKey);
      clearTransientTableElements(table);
      if (animationAbortRef.current === controller) animationAbortRef.current = null;
      animationLockRef.current = false;
      setIsAnimating(false);
    });
    return () => {
      controller.abort();
      clearAllTableAnimations(table);
    };
  }, [handKey, dealtHandKey, settings.animation, settings.speed]);
  useEffect(() => {
    if (!tableTalk) return;
    const timer = window.setTimeout(() => setTableTalk(null), 8000);
    return () => window.clearTimeout(timer);
  }, [tableTalk]);
  useEffect(() => {
    if (!aiPanelOpen || !reasoningRef.current) return;
    reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
  }, [aiPanelOpen, aiView.reasoning]);
  useEffect(() => {
    if (!currentPlayer || currentPlayer.isHuman || finishedHand || game.phase === "finished" || interactionLocked || animationLockRef.current) return;
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
    manualCancelRef.current = "";
    setAiView({ status: "building", requestId, characterName: currentPlayer.name, reasoning: "" });
    const delay = settings.speed === "instant" ? 30 : settings.speed === "fast" ? 280 : 750;
    const timer = window.setTimeout(async () => {
      if (!currentAISetting.useModel) {
        const latest = latestGameRef.current;
        if (latest.players[latest.currentPlayerIndex]?.id !== currentPlayer.id) return;
        const decision = decideAIAction(latest, currentPlayer.id);
        setAiView({ status: "local", requestId, characterName: currentPlayer.name, reasoning: "" });
        await transitionTo(latest, performAction(latest, currentPlayer.id, decision.type, decision.targetTotal));
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      const request = buildPokerAIRequest(game, currentPlayer.id, requestId, currentAISetting);
      try {
        setAiView((current) => current.requestId === requestId ? { ...current, status: "connecting" } : current);
        const response = await requestAIDecision(request, controller.signal, (status, detail) => setAiView((current) => {
          if (current.requestId !== requestId) return current;
          const reasoningChunk = typeof detail?.reasoningChunk === "string" ? detail.reasoningChunk : "";
          return { ...current, status, reasoning: reasoningChunk ? current.reasoning + reasoningChunk : current.reasoning };
        }));
        if (controller.signal.aborted) return;
        const latest = latestGameRef.current;
        if (!isDecisionCurrent(response, request) || !isGameTurnCurrent(latest, request)) {
          setAiView((current) => current.requestId === requestId ? { ...current, status: "stale", debug: response.debug } : current);
          void markStaleDecision(request).catch(() => {});
          return;
        }
        const target = response.decision.action === "bet" || response.decision.action === "raise" ? response.decision.amount : undefined;
        setAiView((current) => current.requestId === requestId ? { ...current, status: response.fallback ? "fallback" : "complete", error: response.error, debug: response.debug } : current);
        const spokenText = response.decision.table_talk.trim();
        if (spokenText) setTableTalk({ playerId: currentPlayer.id, text: spokenText });
        if (response.error) setError(`${response.error.message}\n${t("请求编号：")}${response.error.requestId ?? requestId}\n${t("详细日志：")}${response.error.logFile ?? t("未生成")}`);
        controllerRef.current = null;
        await transitionTo(latest, performAction(latest, currentPlayer.id, response.decision.action, target));
      } catch (caught) {
        if (controller.signal.aborted || caught instanceof DOMException && caught.name === "AbortError") {
          const manuallyCancelled = manualCancelRef.current === requestId;
          manualCancelRef.current = "";
          const latest = latestGameRef.current;
          if (manuallyCancelled && isGameTurnCurrent(latest, request)) {
            const fallback = decideAIAction(latest, currentPlayer.id);
            setAiView((current) => current.requestId === requestId ? { ...current, status: "cancelled-local" } : current);
            controllerRef.current = null;
            await transitionTo(latest, performAction(latest, currentPlayer.id, fallback.type, fallback.targetTotal));
          } else {
            setAiView((current) => current.requestId === requestId ? { ...current, status: "cancelled" } : current);
          }
          return;
        }
        const latest = latestGameRef.current;
        const detail = (caught as Error & { detail?: BackendError }).detail;
        setError(`${detail?.message ?? (caught instanceof Error ? caught.message : t("电脑玩家行动失败"))}\n${t("请求编号：")}${detail?.requestId ?? requestId}${detail?.logFile ? `\n${t("详细日志：")}${detail.logFile}` : ""}`);
        if (isGameTurnCurrent(latest, buildPokerAIRequest(game, currentPlayer.id, requestId))) {
          const fallback = decideAIAction(latest, currentPlayer.id);
          setAiView((current) => current.requestId === requestId ? { ...current, status: "fallback", error: detail } : current);
          controllerRef.current = null;
          await transitionTo(latest, performAction(latest, currentPlayer.id, fallback.type, fallback.targetTotal));
        }
      } finally { if (requestIdRef.current === requestId) controllerRef.current = null; }
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (requestIdRef.current === requestId && controllerRef.current) {
        void cancelDecision(requestId).catch(() => {});
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [game, currentPlayer?.id, currentAISetting.useModel, currentAISetting.personality, currentAISetting.playingStyle, currentAISetting.prompt, finishedHand, settings.speed, settings.animation, settings.sound, interactionLocked]);

  useEffect(() => {
    if (!finishedHand || !settings.autoNextHand) return;
    const timer = window.setTimeout(() => onGameChange(startNextHand(game)), settings.speed === "instant" ? 350 : 1600);
    return () => window.clearTimeout(timer);
  }, [finishedHand, recordId, settings.autoNextHand]);

  const tournamentInfo = useMemo(() => {
    if (!game.tournament) return null;
    const alive = game.players.filter((player) => player.chips > 0).sort((a, b) => b.chips - a.chips);
    const heroRank = alive.findIndex((player) => player.id === "hero") + 1;
    const average = alive.length ? Math.round(alive.reduce((sum, player) => sum + player.chips, 0) / alive.length) : 0;
    return { alive, heroRank, average, max: alive[0]?.chips ?? 0, min: alive.at(-1)?.chips ?? 0 };
  }, [game.players, game.tournament]);

  const act = (type: PlayerActionType, target?: number) => {
    if (animationLockRef.current) return;
    try { setError(""); void transitionTo(game, performAction(game, "hero", type, target)); }
    catch (caught) { setError(text(caught instanceof Error ? caught.message : "操作未能完成")); }
  };
  const confirmHome = () => { if (window.confirm(t("返回主页会保留当前牌局，确定离开牌桌吗？"))) onHome(); };
  const restart = () => { if (window.confirm(t("确定重新开始当前模式吗？本桌进度将被覆盖。"))) onGameChange(createGame(game.config)); };
  const cancelAI = () => { const requestId = requestIdRef.current; if (!requestId || !controllerRef.current) return; manualCancelRef.current = requestId; void cancelDecision(requestId).catch(() => {}); controllerRef.current.abort(); };

  return (
    <main className={`game-page ${interactionLocked ? "table-motion-active" : ""}`} aria-busy={interactionLocked || undefined}>
      <div className="game-toolbar"><div className="toolbar-actions"><button disabled={interactionLocked} onClick={confirmHome}>← {t("返回主页")}</button><button disabled={interactionLocked} onClick={restart}>{t("重新开始")}</button></div><div className="hand-status"><span>{t("第 {count} 手", { count: game.handNumber })}</span><strong>{t(PHASE_NAMES[game.phase])}</strong><span>{game.config.mode === "quick" ? t("快速游戏") : t("锦标赛 · 等级 {level}", { level: (game.tournament?.blindLevel ?? 0) + 1 })}</span></div><button className="toolbar-settings" onClick={onSettings}>{t("设置")} <span aria-hidden="true">⚙</span></button></div>
      {game.tournament && tournamentInfo && <div className="tournament-bar"><span>{t("盲注")} <strong>{game.config.smallBlind}/{game.config.bigBlind}</strong></span><span>{t("下级剩余")} <strong>{language === "zh" ? `${game.tournament.handsUntilNextLevel} 手` : `${game.tournament.handsUntilNextLevel} ${game.tournament.handsUntilNextLevel === 1 ? "hand" : "hands"}`}</strong></span><span>{t("存活")} <strong>{tournamentInfo.alive.length}</strong></span><span>{t("你的排名")} <strong>{tournamentInfo.heroRank || t("已淘汰")}</strong></span><span>{t("平均 / 最大 / 最小")} <strong>{tournamentInfo.average} / {tournamentInfo.max} / {tournamentInfo.min}</strong></span></div>}
      <div className="game-layout">
        <div className="table-column"><PokerTable game={game} thinking={thinking} tableTalk={tableTalk} tableRef={tableRef} concealHoleCards={openingHand} />{!finishedHand && game.phase !== "finished" && !openingHand && <ActionPanel game={game} disabled={!currentPlayer?.isHuman || thinking || interactionLocked} onAction={act} />}</div>
        <aside className="info-sidebar">
          <section className="live-info"><div className="panel-title"><span>{t("牌局信息")}</span><small>{t("盲注")} {game.config.smallBlind}/{game.config.bigBlind}</small></div><div className="status-message">{text(game.message)}</div>{error && <div className="error-message">{error}</div>}{settings.showHints && <div className="action-log">{game.actions.slice(-8).reverse().map((action, index) => <div key={`${action.timestamp}-${index}`}><span>{text(game.players.find((player) => player.id === action.playerId)?.name)}</span><strong>{text(action.label)}</strong><small>{t("底池")} {action.potAfterAction}</small></div>)}</div>}</section>
          {settings.beginnerHelp && <BeginnerHelp game={game} showHandName={settings.showHandName} />}
        </aside>
      </div>
      {aiView.status && <aside className={`ai-thinking-dock ${aiPanelOpen ? "expanded" : ""}`} aria-label={t("AI 决策状态")}>
        <button className="ai-dock-toggle" type="button" aria-expanded={aiPanelOpen} onClick={() => setAiPanelOpen((open) => !open)}>
          <span className={`ai-dock-pulse ${thinking ? "active" : ""}`} aria-hidden="true" />
          <span className="ai-dock-title"><strong>{text(aiView.characterName ?? "AI")}</strong><small>{t(AI_STATUS[aiView.status] ?? aiView.status)}</small></span>
          <span className="ai-dock-arrow" aria-hidden="true">{aiPanelOpen ? "×" : "AI"}</span>
        </button>
        {thinking && aiView.status !== "building" && <button className="ai-cancel-button" type="button" onClick={cancelAI}>{t("取消并使用本地 AI")}</button>}
        {aiPanelOpen && <div className="ai-dock-body">
          <div className="ai-reasoning-heading"><span>{t("思考过程")}</span><small>{t(thinking ? "流式接收中" : "本次记录")}</small></div>
          <pre ref={reasoningRef} className="ai-reasoning-stream" aria-live="polite">{aiView.reasoning || t(thinking ? "等待模型返回 reasoning…" : "本次请求没有可显示的 reasoning。")}</pre>
          <small className="ai-request-id">Request ID: {aiView.requestId}</small>
          {aiView.debug && <details className="ai-debug-details"><summary>{t("请求详情")}</summary><dl><dt>{t("模型")}</dt><dd>{aiView.debug.model}</dd><dt>{t("耗时")}</dt><dd>{aiView.debug.durationMs} ms</dd><dt>{t("重试")}</dt><dd>{aiView.debug.retryCount}</dd><dt>{t("最终动作")}</dt><dd>{aiView.debug.finalAction}</dd><dt>{t("日志")}</dt><dd>{aiView.debug.logFile}</dd></dl></details>}
        </div>}
      </aside>}
      {finishedHand && <div className="result-banner"><div><span className="eyebrow">{t("本手结算")}</span><h2>{text(game.message)}</h2><div className="result-net">{t("你的收益")} <strong className={(game.result?.net.hero ?? 0) >= 0 ? "positive" : "negative"}>{(game.result?.net.hero ?? 0) >= 0 ? "+" : ""}{game.result?.net.hero ?? 0}</strong></div></div><button className="primary" onClick={() => onGameChange(startNextHand(game))}>{t(game.tournament?.championId || game.players[0].chips <= 0 ? "查看结果" : "下一手")} →</button></div>}
      {game.phase === "finished" && <div className="result-banner final"><div><span className="eyebrow">{t("牌桌结束")}</span><h2>{text(game.message)}</h2></div><button className="primary" onClick={onHome}>{t("返回主页")}</button></div>}
    </main>
  );
}
