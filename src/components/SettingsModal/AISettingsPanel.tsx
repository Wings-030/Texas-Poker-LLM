import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { clearBackendConfig, fetchBackendModels, getBackendConfig, saveBackendConfig, testBackendConnection, type BackendConfig } from "../../api/aiBackend";
import { useI18n } from "../../i18n";

type FormConfig = BackendConfig & { apiKey: string; customHeadersText: string; customParametersText: string };
type PanelMessage = { source: string; values?: Record<string, string | number> } | { raw: string };

function toForm(config: BackendConfig): FormConfig {
  return { ...config, apiKey: "", customHeadersText: JSON.stringify(config.customHeaders, null, 2), customParametersText: JSON.stringify(config.customParameters, null, 2) };
}

export type AISettingsPanelHandle = { save: () => Promise<boolean> };

export const AISettingsPanel = forwardRef<AISettingsPanelHandle>(function AISettingsPanel(_props, ref) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormConfig | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [message, setMessage] = useState<PanelMessage>({ source: "正在连接 AI 服务…" });
  const [busy, setBusy] = useState(false);
  const messageText = "raw" in message ? message.raw : t(message.source, message.values);
  const failureMessage = (error: unknown, fallback: string): PanelMessage => error instanceof Error ? { raw: error.message } : { source: fallback };
  useEffect(() => { getBackendConfig().then((config) => { setForm(toForm(config)); setMessage({ source: "AI 服务已连接" }); }).catch((error) => setMessage(failureMessage(error, "连接 AI 服务失败"))); }, []);
  const update = <K extends keyof FormConfig>(key: K, value: FormConfig[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  const save = async () => {
    if (!form) return false;
    setBusy(true);
    try {
      const customHeaders = JSON.parse(form.customHeadersText || "{}");
      const customParameters = JSON.parse(form.customParametersText || "{}");
      const saved = await saveBackendConfig({ ...form, apiKey: form.apiKey || undefined, customHeaders, customParameters });
      setForm(toForm(saved));
      setMessage({ source: saved.apiKeyConfigured ? "配置已保存。API Key 已配置。" : "配置已保存。API Key 未配置。" });
      return true;
    } catch (error) { setMessage(failureMessage(error, "保存配置失败")); return false; }
    finally { setBusy(false); }
  };
  useImperativeHandle(ref, () => ({ save }));
  const loadModels = async () => { setBusy(true); try { const values = await fetchBackendModels(); setModels(values); setModelMenuOpen(values.length > 0); setMessage({ source: "已获取 {count} 个模型。", values: { count: values.length } }); } catch (error) { setMessage(failureMessage(error, "获取模型列表失败，可继续手动填写模型名称。")); } finally { setBusy(false); } };
  const test = async () => { setBusy(true); try { const result = await testBackendConnection(); setMessage({ source: result.streamSupported ? "连接成功：{model}；流式支持：是；日志：{logFile}" : "连接成功：{model}；流式支持：否；日志：{logFile}", values: { model: result.model, logFile: result.logFile } }); } catch (error) { setMessage(failureMessage(error, "测试连接失败")); } finally { setBusy(false); } };
  const clear = async () => { if (!window.confirm(t("确定清除当前浏览器对应的 API 配置吗？"))) return; setBusy(true); try { setForm(toForm(await clearBackendConfig())); setMessage({ source: "API 配置已清除。" }); } catch (error) { setMessage(failureMessage(error, "清除配置失败")); } finally { setBusy(false); } };
  if (!form) return <div className="api-status-card">{messageText}</div>;
  return (
    <div className="ai-settings-panel">
      <div className="api-status-card"><strong>{t("使用您自己的 API")}</strong><span>{messageText}</span></div>
      <div className="api-form-grid">
        <label><span>API Base URL</span><input value={form.apiBaseUrl} placeholder="https://api.openai.com/v1" onChange={(event) => update("apiBaseUrl", event.target.value)} /></label>
        <label><span>API Key</span><input type="password" autoComplete="off" value={form.apiKey} placeholder={t(form.apiKeyConfigured ? "已配置；留空则保持不变" : "输入 API Key")} onChange={(event) => update("apiKey", event.target.value)} /></label>
        <div className="model-field">
          <label htmlFor="ai-model-name">{t("模型名称")}</label>
          <div className="model-combobox" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setModelMenuOpen(false); }}>
            <input id="ai-model-name" role="combobox" aria-autocomplete="none" aria-expanded={modelMenuOpen} aria-controls="backend-model-list" value={form.model} onClick={() => setModelMenuOpen(models.length > 0)} onKeyDown={(event) => { if (event.key === "Escape") setModelMenuOpen(false); }} onChange={(event) => update("model", event.target.value)} />
            <button type="button" className="model-menu-toggle" aria-label={t("显示模型列表")} aria-expanded={modelMenuOpen} disabled={models.length === 0} onClick={() => setModelMenuOpen((open) => !open)}>▾</button>
            {modelMenuOpen && <div id="backend-model-list" className="model-options" role="listbox">
              {models.map((model) => <button type="button" role="option" aria-selected={model === form.model} className={model === form.model ? "selected" : ""} key={model} onClick={() => { update("model", model); setModelMenuOpen(false); }}>{model}</button>)}
            </div>}
          </div>
        </div>
        <label className="toggle-row compact"><span><strong>{t("流式输出")}</strong><small>{t("接收并转发 OpenAI Compatible SSE")}</small></span><input type="checkbox" checked={form.stream} onChange={(event) => update("stream", event.target.checked)} /></label>
        <label><span>{t("请求超时（毫秒）")}</span><input type="number" min="1000" max="600000" value={form.timeoutMs} onChange={(event) => update("timeoutMs", Number(event.target.value))} /></label>
        <label><span>{t("最大重试次数")}</span><input type="number" min="0" max="5" value={form.maxRetries} onChange={(event) => update("maxRetries", Number(event.target.value))} /></label>
        <label><span>{t("重试延迟（毫秒）")}</span><input type="number" min="0" max="30000" value={form.retryDelayMs} onChange={(event) => update("retryDelayMs", Number(event.target.value))} /></label>
        <label><span>Temperature</span><input type="number" min="0" max="2" step="0.1" value={form.temperature ?? ""} onChange={(event) => update("temperature", event.target.value === "" ? null : Number(event.target.value))} /></label>
        <label><span>Top P</span><input type="number" min="0" max="1" step="0.05" value={form.topP ?? ""} onChange={(event) => update("topP", event.target.value === "" ? null : Number(event.target.value))} /></label>
        <label><span>Max Tokens</span><input type="number" min="1" value={form.maxTokens ?? ""} onChange={(event) => update("maxTokens", event.target.value === "" ? null : Number(event.target.value))} /></label>
        <label><span>Reasoning Effort</span><select value={form.reasoningEffort} onChange={(event) => update("reasoningEffort", event.target.value)}><option value="">{t("不发送")}</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label>
      </div>
      <label className="json-field"><span>{t("自定义请求头（JSON；禁止覆盖 Host、Content-Length、Connection）")}</span><textarea rows={5} value={form.customHeadersText} onChange={(event) => update("customHeadersText", event.target.value)} /></label>
      <label className="json-field"><span>{t("自定义请求参数（JSON；空值不会发送）")}</span><textarea rows={5} value={form.customParametersText} onChange={(event) => update("customParametersText", event.target.value)} /></label>
      <div className="settings-actions"><button disabled={busy} onClick={loadModels}>{t("获取模型列表")}</button><button disabled={busy} onClick={test}>{t("测试连接")}</button><button className="primary" disabled={busy} onClick={save}>{t("保存配置")}</button><button className="danger" disabled={busy} onClick={clear}>{t("清除配置")}</button></div>
      <small className="security-note">{t("请填写您自己的 API，模型费用由对应账户承担。配置由本站服务器按浏览器独立保存，其他访客无法读取或使用；更换浏览器或清理站点数据后需重新填写。")}</small>
    </div>
  );
});
