import { useEffect, useRef, useState } from "react";
import type { Settings } from "../../types/poker";
import { useI18n } from "../../i18n";
import { AISettingsPanel, type AISettingsPanelHandle } from "./AISettingsPanel";
import { AILogsPanel } from "./AILogsPanel";
import { AICharacterSettingsPanel } from "./AICharacterSettingsPanel";
import { AIDefaultPromptsPanel } from "./AIDefaultPromptsPanel";

type ToggleSetting = "sound" | "animation" | "autoNextHand" | "showHints" | "showHandName" | "beginnerHelp";
type SettingsTab = "game" | "characters" | "prompts" | "api" | "logs";

export async function saveSettingsAndClose(tab: SettingsTab, apiSettings: AISettingsPanelHandle | null, onClose: () => void) {
  if (tab === "api" && !(await apiSettings?.save())) return false;
  onClose();
  return true;
}

export function SettingsModal({ settings, onChange, onClose }: { settings: Settings; onChange: (settings: Settings) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SettingsTab>("game");
  const aiSettingsRef = useRef<AISettingsPanelHandle>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const toggle = (key: ToggleSetting) => onChange({ ...settings, [key]: !settings[key] });
  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><span className="eyebrow">{t("偏好设置")}</span><h2 id="settings-title">{t("牌桌设置")}</h2></div><button ref={closeButtonRef} type="button" className="icon-button" aria-label={t("关闭")} onClick={onClose}>×</button></div>
        <div className="settings-tabs" role="tablist" aria-label={t("偏好设置")}><button type="button" role="tab" aria-selected={tab === "game"} className={tab === "game" ? "active" : ""} onClick={() => setTab("game")}>{t("牌桌设置")}</button><button type="button" role="tab" aria-selected={tab === "characters"} className={tab === "characters" ? "active" : ""} onClick={() => setTab("characters")}>{t("角色 AI")}</button><button type="button" role="tab" aria-selected={tab === "prompts"} className={tab === "prompts" ? "active" : ""} onClick={() => setTab("prompts")}>{t("默认提示词")}</button><button type="button" role="tab" aria-selected={tab === "api"} className={tab === "api" ? "active" : ""} onClick={() => setTab("api")}>AI API {t("设置")}</button><button type="button" role="tab" aria-selected={tab === "logs"} className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>AI {t("调试与日志")}</button></div>
        {tab === "game" && <div className="setting-grid" role="tabpanel">
          {([
            ["sound", "音效", "保留音效接口，默认关闭"], ["animation", "动画", "牌桌过渡与高亮"],
            ["autoNextHand", "自动开始下一手", "结算后自动继续"], ["showHints", "操作提示", "显示最近行动与合法金额"],
            ["showHandName", "牌型名称", "在辅助面板显示当前牌型"], ["beginnerHelp", "新手辅助", "显示胜率、赔率和建议"],
          ] as const).map(([key, label, description]) => (
            <label className="toggle-row" key={key}><span><strong>{t(label)}</strong><small>{t(description)}</small></span><input type="checkbox" checked={settings[key]} onChange={() => toggle(key)} /></label>
          ))}
          <label><span>{t("游戏速度")}</span><select value={settings.speed} onChange={(event) => onChange({ ...settings, speed: event.target.value as Settings["speed"] })}><option value="normal">{t("正常")}</option><option value="fast">{t("快速")}</option><option value="instant">{t("瞬间")}</option></select></label>
          <label><span>{t("卡牌样式")}</span><select value={settings.cardStyle} onChange={(event) => onChange({ ...settings, cardStyle: event.target.value as Settings["cardStyle"] })}><option value="classic">{t("经典")}</option><option value="minimal">{t("简约")}</option></select></label>
        </div>}
        {tab === "characters" && <div role="tabpanel"><AICharacterSettingsPanel settings={settings} onChange={onChange} /></div>}
        {tab === "prompts" && <div role="tabpanel"><AIDefaultPromptsPanel settings={settings} onChange={onChange} /></div>}
        {tab === "api" && <div role="tabpanel"><AISettingsPanel ref={aiSettingsRef} /></div>}
        {tab === "logs" && <div role="tabpanel"><AILogsPanel /></div>}
        <button className="primary wide settings-close" onClick={() => saveSettingsAndClose(tab, aiSettingsRef.current, onClose)}>{t("保存并关闭")}</button>
      </section>
    </div>
  );
}
