import { getAICharacterSetting, setAICharacterSetting } from "../../data/aiCharacterSettings";
import { AI_PLAYERS } from "../../data/aiPlayers";
import { useI18n } from "../../i18n";
import type { AICharacterSetting, Settings } from "../../types/poker";

export function AIDefaultPromptsPanel({ settings, onChange }: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const { t, text } = useI18n();
  const update = (characterId: string, patch: Partial<AICharacterSetting>) => {
    const current = getAICharacterSetting(settings, characterId);
    onChange(setAICharacterSetting(settings, characterId, { ...current, ...patch }));
  };

  return (
    <div className="ai-character-settings">
      <div className="character-ai-note">
        <strong>{t("编辑角色默认提示词")}</strong>
        <span>{t("这里单独管理角色人格与默认牌风；修改后会替换模型请求中的原始设定。")}</span>
      </div>
      <div className="character-ai-list">
        {AI_PLAYERS.map((player) => {
          const value = getAICharacterSetting(settings, player.id);
          return (
            <article className="character-ai-card model-enabled" key={player.id}>
              <div className="character-ai-heading default-prompt-heading">
                <span className="ai-avatar" aria-hidden="true">{player.code}</span>
                <span><strong>{text(player.name)}</strong><small>{t("默认人格与牌风")}</small></span>
                <button type="button" className="restore-prompt-button" onClick={() => update(player.id, { personality: player.personality, playingStyle: player.playingStyle })}>{t("恢复默认")}</button>
              </div>
              <label className="character-prompt-field">
                <span>{t("角色人格提示词")}</span>
                <textarea rows={4} maxLength={12000} value={value.personality} onChange={(event) => update(player.id, { personality: event.target.value })} />
                <small>{t("控制角色的性格、语气和桌上表达方式。")}</small>
              </label>
              <label className="character-prompt-field">
                <span>{t("默认牌风提示词")}</span>
                <textarea rows={4} maxLength={12000} value={value.playingStyle} onChange={(event) => update(player.id, { playingStyle: event.target.value })} />
                <small>{t("这里包含 TAG、LAG、紧弱或其他默认扑克策略描述，可以直接改写。")}</small>
              </label>
            </article>
          );
        })}
      </div>
    </div>
  );
}
