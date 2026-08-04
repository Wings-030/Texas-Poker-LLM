import { getAICharacterSetting, setAICharacterSetting } from "../../data/aiCharacterSettings";
import { AI_PLAYERS } from "../../data/aiPlayers";
import { useI18n } from "../../i18n";
import type { AICharacterSetting, Settings } from "../../types/poker";

export function AICharacterSettingsPanel({ settings, onChange, characterIds }: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  characterIds?: string[];
}) {
  const { t, text } = useI18n();
  const characters = characterIds ? AI_PLAYERS.filter((player) => characterIds.includes(player.id)) : AI_PLAYERS;
  const update = (characterId: string, patch: Partial<AICharacterSetting>) => {
    const current = getAICharacterSetting(settings, characterId);
    onChange(setAICharacterSetting(settings, characterId, { ...current, ...patch }));
  };

  return (
    <div className="ai-character-settings">
      <div className="character-ai-note">
        <strong>{t("逐角色选择决策方式")}</strong>
        <span>{t("开启后调用已配置的大模型；关闭后使用游戏内置策略。这里的额外指令只影响对应角色。")}</span>
      </div>
      <div className="character-ai-list">
        {characters.map((player) => {
          const value = getAICharacterSetting(settings, player.id);
          return (
            <article className={`character-ai-card ${value.useModel ? "model-enabled" : ""}`} key={player.id}>
              <div className="character-ai-heading">
                <span className="ai-avatar" aria-hidden="true">{player.code}</span>
                <span><strong>{text(player.name)}</strong><small>{t(value.useModel ? "大模型决策" : "本地策略决策")}</small></span>
                <label className="model-toggle"><span>{t("启用大模型")}</span><input type="checkbox" checked={value.useModel} onChange={(event) => update(player.id, { useModel: event.target.checked })} /></label>
              </div>
              <label className="character-prompt-field">
                <span>{t("角色追加提示词（可选）")}</span>
                <textarea rows={3} maxLength={12000} disabled={!value.useModel} value={value.prompt} placeholder={t("例如：本局更重视位置优势，不要轻易全下。")} onChange={(event) => update(player.id, { prompt: event.target.value })} />
                <small>{t("核心规则、合法动作限制和 JSON 输出格式不会被这些提示词覆盖。")}</small>
              </label>
            </article>
          );
        })}
      </div>
    </div>
  );
}
