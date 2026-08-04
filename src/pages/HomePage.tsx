import { useState } from "react";
import { CardArtwork } from "../components/Card/CardArtwork";
import { AICharacterSettingsPanel } from "../components/SettingsModal/AICharacterSettingsPanel";
import { AI_PLAYERS } from "../data/aiPlayers";
import { useI18n } from "../i18n";
import type { AIDifficulty, GameConfig, GameMode, GameSpeed, Settings } from "../types/poker";

const defaultAIPlayerIds = AI_PLAYERS.slice(0, 5).map((player) => player.id);
const defaults: Record<GameMode, GameConfig> = {
  quick: { mode: "quick", playerCount: 6, aiPlayerIds: defaultAIPlayerIds, startingChips: 5000, smallBlind: 25, bigBlind: 50, aiDifficulty: "normal", speed: "normal", handsPerLevel: 5 },
  tournament: { mode: "tournament", playerCount: 6, aiPlayerIds: defaultAIPlayerIds, startingChips: 10000, smallBlind: 50, bigBlind: 100, aiDifficulty: "normal", speed: "normal", handsPerLevel: 5 },
};

export function HomePage({ hasResume, settings, onSettingsChange, onStart, onResume }: { hasResume: boolean; settings: Settings; onSettingsChange: (settings: Settings) => void; onStart: (config: GameConfig) => void; onResume: () => void }) {
  const { t, text } = useI18n();
  const [mode, setMode] = useState<GameMode>("quick");
  const [config, setConfig] = useState(defaults.quick);
  const chooseMode = (next: GameMode) => { setMode(next); setConfig({ ...defaults[next] }); };
  const numberField = (key: keyof GameConfig, value: string) => setConfig((current) => ({ ...current, [key]: Number(value) }));
  const selectedAIPlayerIds = config.aiPlayerIds ?? [];
  const toggleAIPlayer = (id: string) => setConfig((current) => {
    const selected = current.aiPlayerIds ?? [];
    const aiPlayerIds = selected.includes(id) ? selected.filter((playerId) => playerId !== id) : [...selected, id];
    return { ...current, aiPlayerIds, playerCount: aiPlayerIds.length + 1 };
  });
  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-copy"><span className="eyebrow">NO-LIMIT HOLD'EM</span><h1>Texas Hold’em LLM</h1><p>{t("一张安静的牌桌，一套完整的无限注德州扑克规则。磨练判断，复盘每一步。")}</p>{hasResume && <button className="resume-button" onClick={onResume}><span>{t("继续上次牌局")}</span><small>{t("存档会在每次行动后自动更新")}</small><i className="resume-arrow" aria-hidden="true">→</i></button>}</div>
        <div className="hero-cards" aria-hidden="true"><CardArtwork className="show-card back-card" /><CardArtwork className="show-card ace-card" card={{ rank: "A", suit: "hearts" }} /><CardArtwork className="show-card" card={{ rank: "K", suit: "spades" }} /></div>
      </section>
      <section className="game-setup">
        <div className="mode-tabs"><button className={mode === "quick" ? "selected" : ""} onClick={() => chooseMode("quick")}><span>{t("快速游戏")}</span><small>{t("固定盲注，输光即结束")}</small></button><button className={mode === "tournament" ? "selected" : ""} onClick={() => chooseMode("tournament")}><span>{t("锦标赛")}</span><small>{t("盲注升级，决出最后冠军")}</small></button></div>
        <div className="setup-card">
          <div className="section-heading"><div><span className="eyebrow">{t("牌桌配置")}</span><h2>{t(mode === "quick" ? "建立快速牌桌" : "建立单桌锦标赛")}</h2></div><span className="mode-badge">{t(mode === "quick" ? "现金模式" : "淘汰赛")}</span></div>
          <div className="form-grid">
            <label><span>{t("初始筹码")}</span><input type="number" min="200" step="100" value={config.startingChips} onChange={(event) => numberField("startingChips", event.target.value)} /></label>
            <label><span>{t("小盲注")}</span><input type="number" min="1" step="5" value={config.smallBlind} disabled={mode === "tournament"} onChange={(event) => numberField("smallBlind", event.target.value)} /></label>
            <label><span>{t("大盲注")}</span><input type="number" min="2" step="10" value={config.bigBlind} disabled={mode === "tournament"} onChange={(event) => numberField("bigBlind", event.target.value)} /></label>
            <label><span>{t("电脑难度")}</span><select value={config.aiDifficulty} onChange={(event) => setConfig({ ...config, aiDifficulty: event.target.value as AIDifficulty })}><option value="easy">{t("简单 · 宽松随性")}</option><option value="normal">{t("普通 · 均衡思考")}</option><option value="hard">{t("困难 · 赔率与范围")}</option></select></label>
            <label><span>{t("游戏速度")}</span><select value={config.speed} onChange={(event) => setConfig({ ...config, speed: event.target.value as GameSpeed })}><option value="normal">{t("正常")}</option><option value="fast">{t("快速")}</option><option value="instant">{t("瞬间")}</option></select></label>
            {mode === "tournament" && <label><span>{t("每级持续手数")}</span><input type="number" min="2" max="20" value={config.handsPerLevel} onChange={(event) => numberField("handsPerLevel", event.target.value)} /></label>}
          </div>
          <section className="ai-player-picker" aria-labelledby="ai-player-picker-title">
            <div className="picker-heading"><div><h3 id="ai-player-picker-title">{t("选择电脑玩家")}</h3><small>{t("每局可选择 1 至 8 位电脑玩家")}</small></div><strong>{t("已选择 {count} / 8", { count: selectedAIPlayerIds.length })}</strong></div>
            <div className="ai-player-grid">
              {AI_PLAYERS.map((player) => {
                const selected = selectedAIPlayerIds.includes(player.id);
                return <button type="button" key={player.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleAIPlayer(player.id)}><span className="ai-avatar" aria-hidden="true">{player.code}</span><strong>{text(player.name)}</strong><small>{selected ? t("已入座") : t("点击选择")}</small></button>;
              })}
            </div>
          </section>
          {selectedAIPlayerIds.length > 0 && <section className="home-character-ai" aria-labelledby="character-ai-title">
            <div className="picker-heading"><div><h3 id="character-ai-title">{t("配置角色 AI")}</h3><small>{t("只为本局已入座的角色设置大模型与提示词")}</small></div></div>
            <AICharacterSettingsPanel settings={settings} onChange={onSettingsChange} characterIds={selectedAIPlayerIds} />
          </section>}
          {selectedAIPlayerIds.length === 0 && <p className="picker-error">{t("请至少选择一位电脑玩家")}</p>}
          <button className="primary start-game" disabled={selectedAIPlayerIds.length === 0} onClick={() => onStart(config)}>{t("坐下并开始")} <span>→</span></button>
        </div>
      </section>
    </main>
  );
}
