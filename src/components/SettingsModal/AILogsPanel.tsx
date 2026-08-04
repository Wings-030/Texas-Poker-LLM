import { useEffect, useState } from "react";
import { clearBackendLogs, fetchLog, fetchLogs, getBackendConfig, openLogDirectory, saveBackendConfig, type BackendConfig, type LogSummary } from "../../api/aiBackend";
import { useI18n } from "../../i18n";

type PanelMessage = { source: string } | { raw: string };

export function AILogsPanel() {
  const { t, text } = useI18n();
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [selected, setSelected] = useState<LogSummary | null>(null);
  const [content, setContent] = useState("");
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [message, setMessage] = useState<PanelMessage | null>(null);
  const messageText = message ? "raw" in message ? message.raw : t(message.source) : "";
  const failureMessage = (error: unknown, fallback: string): PanelMessage => error instanceof Error ? { raw: error.message } : { source: fallback };
  const refresh = () => Promise.all([fetchLogs(), getBackendConfig()]).then(([items, current]) => { setLogs(items); setConfig(current); }).catch((error) => setMessage(failureMessage(error, "读取日志列表失败")));
  useEffect(() => { void refresh(); }, []);
  const view = async (log: LogSummary) => { setSelected(log); try { setContent((await fetchLog(log.id)).content); } catch (error) { setMessage(failureMessage(error, "读取日志失败")); } };
  const download = () => { if (!selected) return; const blob = new Blob([content], { type: "text/plain;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = selected.filename; link.click(); URL.revokeObjectURL(link.href); };
  const clear = async () => {
    if (!window.confirm(t("第一次确认：要清空全部 AI 请求日志吗？"))) return;
    if (!window.confirm(t("第二次确认：日志清空后无法恢复，仍要继续吗？"))) return;
    try { await clearBackendLogs(); setSelected(null); setContent(""); await refresh(); setMessage({ source: "日志已清空。" }); } catch (error) { setMessage(failureMessage(error, "清空日志失败")); }
  };
  const updateLogging = async (values: Partial<BackendConfig>) => { try { const saved = await saveBackendConfig(values); setConfig(saved); setMessage({ source: "日志设置已保存。" }); } catch (error) { setMessage(failureMessage(error, "保存日志设置失败")); } };
  return (
    <div className="logs-panel">
      <div className="log-toolbar"><button onClick={() => void refresh()}>{t("刷新列表")}</button><button onClick={() => void openLogDirectory()}>{t("打开日志目录")}</button><button className="danger" onClick={clear}>{t("清空日志")}</button><span>{messageText}</span></div>
      {config && <div className="log-options"><label><span>{t("日志保留天数")}</span><input type="number" min="1" max="3650" value={config.logRetentionDays} onChange={(event) => setConfig({ ...config, logRetentionDays: Number(event.target.value) })} onBlur={() => void updateLogging({ logRetentionDays: config.logRetentionDays })} /></label><label className="toggle-row compact"><span><strong>{t("记录完整提示词")}</strong></span><input type="checkbox" checked={config.detailedLogging} onChange={(event) => void updateLogging({ detailedLogging: event.target.checked })} /></label></div>}
      <div className="log-layout">
        <div className="log-list">{logs.length ? logs.map((log) => <button key={log.id} className={selected?.id === log.id ? "selected" : ""} onClick={() => void view(log)}><span><strong>{text(log.character || "未知角色")}</strong><small>{log.timestamp}</small></span><span><b className={`status-${log.status}`}>{log.status}</b><small>{log.model} · {log.durationMs} ms</small><code>{log.requestId}</code></span></button>) : <div className="empty-state">{t("暂无 AI 请求日志")}</div>}</div>
        <div className="log-viewer"><div className="log-viewer-actions"><strong>{selected?.relativePath ?? t("选择一条日志查看")}</strong><span><button disabled={!content} onClick={() => void navigator.clipboard.writeText(content)}>{t("复制")}</button><button disabled={!content} onClick={download}>{t("下载 TXT")}</button></span></div><pre>{content || t("日志内容会显示在这里。")}</pre></div>
      </div>
    </div>
  );
}
