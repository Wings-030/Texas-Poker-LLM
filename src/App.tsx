import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { SettingsModal } from "./components/SettingsModal/SettingsModal";
import { createGame, createHandRecord } from "./engine/gameFlow";
import { GamePage } from "./pages/GamePage";
import { HomePage } from "./pages/HomePage";
import { ReplayPage } from "./pages/ReplayPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { I18nProvider, translate, translateGameText } from "./i18n";
import { addHandToStatistics, defaultSaveData, exportSave, importSave, loadSaveData, saveData } from "./storage/localStorage";
import type { GameConfig, GameState, Language, SaveData, Settings } from "./types/poker";

type Page = "home" | "game" | "statistics" | "replay";

class ErrorBoundary extends Component<{ children: ReactNode; language: Language }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) { return { error: error.message || "未知错误" }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("牌桌界面异常", error, info.componentStack); }
  render() {
    if (this.state.error) return <main className="fatal-error"><span>⚠</span><h1>{translate(this.props.language, "牌桌暂时无法显示")}</h1><p>{translateGameText(this.props.language, this.state.error)}</p><button className="primary" onClick={() => window.location.reload()}>{translate(this.props.language, "重新载入存档")}</button></main>;
    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<SaveData>(() => loadSaveData());
  const [page, setPage] = useState<Page>(() => data.activeGame ? "game" : "home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState("");
  const language = data.settings.language;
  const t = (source: string) => translate(language, source);

  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => { document.documentElement.lang = language === "zh" ? "zh-CN" : "en"; document.title = "Texas Hold’em LLM"; }, [language]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);

  const start = (config: GameConfig) => {
    try {
      const game = createGame(config);
      setData((current) => ({ ...current, settings: { ...current.settings, speed: config.speed }, activeGame: game, statistics: { ...current.statistics, games: current.statistics.games + 1, quickGames: current.statistics.quickGames + (config.mode === "quick" ? 1 : 0), tournaments: current.statistics.tournaments + (config.mode === "tournament" ? 1 : 0) } }));
      setPage("game");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    } catch (caught) { setToast(translateGameText(language, caught instanceof Error ? caught.message : "无法创建牌桌")); }
  };
  const changeGame = (game: GameState) => setData((current) => ({ ...current, activeGame: game }));
  const completeHand = (game: GameState) => {
    if (!game.result) return;
    const id = `${game.id}-hand-${game.handNumber}`;
    setData((current) => {
      if (current.history.some((record) => record.id === id)) return current;
      const record = createHandRecord(game);
      const statistics = addHandToStatistics(current.statistics, record);
      if (game.tournament?.championId === "hero") {
        statistics.tournamentWins += 1;
        statistics.bestTournamentPlace = 1;
      } else if (game.config.mode === "tournament" && game.players[0].chips === 0) {
        const place = game.players.filter((player) => player.chips > 0).length + 1;
        statistics.bestTournamentPlace = statistics.bestTournamentPlace === null ? place : Math.min(statistics.bestTournamentPlace, place);
      }
      return { ...current, history: [record, ...current.history].slice(0, 300), statistics };
    });
  };
  const changeSettings = (settings: Settings) => setData((current) => ({ ...current, settings, activeGame: current.activeGame ? { ...current.activeGame, config: { ...current.activeGame.config, speed: settings.speed } } : null }));
  const handleImport = async (file: File) => { try { setData(await importSave(file)); setToast(t("存档导入成功")); } catch (caught) { setToast(translateGameText(language, caught instanceof Error ? caught.message : "导入失败")); } };
  const clear = () => { const fresh = defaultSaveData(); setData({ ...fresh, settings: data.settings }); setToast(t("统计与历史已清空")); };

  return (
    <I18nProvider language={language}>
    <div className={`app card-style-${data.settings.cardStyle} ${data.settings.animation ? "animations" : ""}`}>
      <header className="site-header"><button className="brand" onClick={() => setPage("home")}><span>♠</span><strong>Texas Hold’em LLM</strong></button><nav aria-label={t("主页")}><button aria-current={page === "home" ? "page" : undefined} className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>{t("主页")}</button><button aria-current={page === "game" ? "page" : undefined} className={page === "game" ? "active" : ""} disabled={!data.activeGame} onClick={() => data.activeGame && setPage("game")}>{t("牌桌")}</button><button aria-current={page === "statistics" ? "page" : undefined} className={page === "statistics" ? "active" : ""} onClick={() => setPage("statistics")}>{t("统计")}</button><button aria-current={page === "replay" ? "page" : undefined} className={page === "replay" ? "active" : ""} onClick={() => setPage("replay")}>{t("历史复盘")}</button></nav><div className="header-actions"><div className="language-switch" aria-label="Language"><button className={language === "zh" ? "active" : ""} onClick={() => changeSettings({ ...data.settings, language: "zh" })}>中</button><button className={language === "en" ? "active" : ""} onClick={() => changeSettings({ ...data.settings, language: "en" })}>EN</button></div><button className="header-settings" aria-label={t("偏好设置")} onClick={() => setSettingsOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" /><circle cx="15" cy="17" r="3" /></svg><span>{t("偏好设置")}</span></button></div></header>
      <ErrorBoundary language={language}>
      {page === "home" && <HomePage hasResume={Boolean(data.activeGame && data.activeGame.phase !== "finished")} settings={data.settings} onSettingsChange={changeSettings} onStart={start} onResume={() => setPage("game")} />}
      {page === "game" && data.activeGame && <GamePage game={data.activeGame} settings={data.settings} onGameChange={changeGame} onHandComplete={completeHand} onHome={() => setPage("home")} onSettings={() => setSettingsOpen(true)} />}
      {page === "game" && !data.activeGame && <HomePage hasResume={false} settings={data.settings} onSettingsChange={changeSettings} onStart={start} onResume={() => {}} />}
      {page === "statistics" && <StatisticsPage statistics={data.statistics} history={data.history} onExport={() => exportSave(data)} onImport={handleImport} onClear={clear} />}
      {page === "replay" && <ReplayPage history={data.history} />}
      </ErrorBoundary>
      <footer><span>Texas Hold’em LLM v1.0</span></footer>
      {settingsOpen && <SettingsModal settings={data.settings} onChange={changeSettings} onClose={() => setSettingsOpen(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
    </I18nProvider>
  );
}
