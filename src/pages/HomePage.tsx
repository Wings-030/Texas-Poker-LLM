import { useState } from "react";
import { PlayerAvatar } from "../components/PlayerSeat/PlayerAvatar";
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
  const { t, text, locale } = useI18n();
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
        <img className="hero-art" src={`${import.meta.env.BASE_URL}art/poker-room.png`} alt="" fetchPriority="high" />
        <div className="hero-copy">
          <span className="eyebrow"><i /> THE PRIVATE TABLE</span>
          <h1>{t("好牌，")}<br /><em>{t("更好的判断。")}</em></h1>
          <p>{t("落座，读懂对手。在每一次下注之间，找到自己的节奏。")}</p>
          <div className="hero-features"><span>♠ {t("无限注德州扑克")}</span><span>{t("个性 AI 对手")}</span><span>{t("逐手复盘")}</span></div>
          {hasResume && <button className="resume-button" onClick={onResume}><span>{t("继续上次牌局")}</span><i className="resume-arrow" aria-hidden="true">↗</i></button>}
        </div>
        <div className="hero-caption" aria-hidden="true"><span>01 / THE CARD ROOM</span><span>PLAY YOUR OWN HAND.</span></div>
      </section>
      <section className="game-setup">
        <aside className="setup-sidebar">
          <div className="setup-intro"><span className="eyebrow">TAKE YOUR SEAT</span><h2>{t("今晚，打哪一局？")}</h2><p>{t("选好模式，邀请对手，余下的交给牌桌。")}</p></div>
          <div className="mode-tabs">
            <button className={mode === "quick" ? "selected" : ""} aria-pressed={mode === "quick"} onClick={() => chooseMode("quick")}><i aria-hidden="true">♠</i><span>{t("快速游戏")}</span><small>{t("固定盲注，输光即结束")}</small><b aria-hidden="true">↗</b></button>
            <button className={mode === "tournament" ? "selected" : ""} aria-pressed={mode === "tournament"} onClick={() => chooseMode("tournament")}><i aria-hidden="true">♜</i><span>{t("锦标赛")}</span><small>{t("盲注升级，决出最后冠军")}</small><b aria-hidden="true">↗</b></button>
          </div>
          <div className="room-note"><span aria-hidden="true">♧</span><p>{t("不急于每一手，专注每一步。")}</p><small>{t("自动存档 · 随时回来")}</small></div>
        </aside>
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
                return <button type="button" key={player.id} className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => toggleAIPlayer(player.id)}><PlayerAvatar code={player.code} className="ai-avatar" /><strong>{text(player.name)}</strong><small>{selected ? t("已入座") : t("点击选择")}</small><span className="selection-mark" aria-hidden="true">{selected ? "✓" : "+"}</span></button>;
              })}
            </div>
          </section>
          {selectedAIPlayerIds.length > 0 && <details className="home-character-ai">
            <summary><span><strong>{t("配置角色 AI")}</strong><small>{t("大模型与角色提示词 · 可选")}</small></span><i aria-hidden="true">+</i></summary>
            <AICharacterSettingsPanel settings={settings} onChange={onSettingsChange} characterIds={selectedAIPlayerIds} />
          </details>}
          {selectedAIPlayerIds.length === 0 && <p className="picker-error">{t("请至少选择一位电脑玩家")}</p>}
          <div className="setup-launch"><div><strong>{t("{count} 人牌桌", { count: selectedAIPlayerIds.length + 1 })}</strong><small>{t("初始筹码")} {config.startingChips.toLocaleString(locale)} · {t("盲注")} {config.smallBlind}/{config.bigBlind}</small></div><button className="primary start-game" disabled={selectedAIPlayerIds.length === 0} onClick={() => onStart(config)}>{t("坐下并开始")} <span aria-hidden="true">↗</span></button></div>
        </div>
      </section>
    </main>
  );
}
