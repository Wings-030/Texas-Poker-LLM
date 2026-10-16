import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { publicConfig } from "./configManager.js";
import { chatCompletion } from "./chatService.js";
import { expressErrorHandler, serializeError } from "./errorHandler.js";
import { cleanupOldLogs, clearLogs, DEFAULT_LOG_DIR, listRequestLogs, readRequestLog, serverLog } from "./logger.js";
import { getModels, testConnection } from "./modelService.js";
import { makePokerDecision, markStaleResponse } from "./pokerAiService.js";
import { requestCoordinator } from "./requestCoordinator.js";
import { DEFAULT_VISITOR_CONFIG_DIR, visitorContext } from "./visitorContext.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);
const HOST = "127.0.0.1";
const DEBUG_AI = String(process.env.DEBUG_AI ?? "true").toLowerCase() === "true";

export function createApp(options = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    req.requestId = String(req.headers["x-request-id"] || crypto.randomUUID());
    res.setHeader("X-Request-ID", req.requestId);
    if (DEBUG_AI && req.path.startsWith("/api/")) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} request=${req.requestId}`);
    next();
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "poker-ai-backend", version: "1.0.0", timestamp: new Date().toISOString(), debugAi: DEBUG_AI }));
  app.use("/api", visitorContext(options));
  app.get("/api/config", async (req, res, next) => { try { res.json({ ok: true, config: publicConfig(await req.configManager.read()) }); } catch (error) { next(error); } });
  app.post("/api/config", async (req, res, next) => {
    try {
      const config = await req.configManager.save(req.body ?? {});
      await cleanupOldLogs(config.logRetentionDays, req.aiContext.logDir);
      await serverLog(`CONFIG_SAVED model=${config.model || "not-set"} keyConfigured=${Boolean(config.apiKey)}`, req.aiContext);
      res.json({ ok: true, config: publicConfig(config) });
    } catch (error) { next(error); }
  });
  app.delete("/api/config", async (req, res, next) => { try { const config = await req.configManager.clear(); await serverLog("CONFIG_CLEARED", req.aiContext); res.json({ ok: true, config: publicConfig(config) }); } catch (error) { next(error); } });
  app.post("/api/test", async (req, res, next) => { try { res.json(await testConnection(await req.configManager.read(), req.aiContext)); } catch (error) { next(error); } });
  app.get("/api/models", async (req, res, next) => { try { res.json({ ok: true, models: await getModels(await req.configManager.read()) }); } catch (error) { next(error); } });

  app.post("/api/ai/decision", async (req, res, next) => {
    const config = await req.configManager.read().catch(next);
    if (!config) return;
    const streamToBrowser = Boolean(config.stream);
    const debugStatus = (status, detail = {}) => { if (DEBUG_AI) console.log(`[${new Date().toISOString()}] AI request=${req.body?.requestId ?? req.requestId} status=${status}${detail.attempt ? ` attempt=${detail.attempt}` : ""}`); };
    if (streamToBrowser) {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();
      const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
      try {
        const result = await makePokerDecision(req.body, config, { ...req.aiContext, onStatus: (status, detail) => { debugStatus(status, detail); send("status", { status, ...detail }); } });
        send("final", result);
      } catch (error) { send("error", serializeError(error, req.body?.requestId).error); }
      res.end();
      return;
    }
    try { res.json(await makePokerDecision(req.body, config, { ...req.aiContext, onStatus: debugStatus })); } catch (error) { next(error); }
  });

  app.post("/api/ai/chat", async (req, res, next) => {
    try { res.json(await chatCompletion(req.body, await req.configManager.read(), req.aiContext)); } catch (error) { next(error); }
  });
  app.delete("/api/ai/requests/:requestId", (req, res) => res.json({ ok: requestCoordinator.cancel(req.params.requestId, req.aiContext.scope), requestId: req.params.requestId }));
  app.post("/api/ai/stale", async (req, res, next) => { try { await markStaleResponse(req.body ?? {}, req.aiContext); res.json({ ok: true }); } catch (error) { next(error); } });

  app.get("/api/logs", async (req, res, next) => { try { res.json({ ok: true, logs: await listRequestLogs(req.aiContext.logDir) }); } catch (error) { next(error); } });
  app.get("/api/logs/:filename", async (req, res, next) => {
    try {
      const log = await readRequestLog(req.params.filename, req.aiContext.logDir);
      if (req.query.download === "1") { res.setHeader("Content-Disposition", `attachment; filename="${path.basename(log.relativePath)}"`); res.type("text/plain").send(log.content); }
      else res.json({ ok: true, ...log });
    } catch (error) { next(error); }
  });
  app.delete("/api/logs", async (req, res, next) => { try { if (req.body?.confirm !== "CLEAR") return res.status(400).json({ ok: false, error: { type: "CONFIRMATION_REQUIRED", message: "清空日志需要二次确认。", requestId: req.requestId } }); await clearLogs(req.aiContext.logDir); await serverLog("LOGS_CLEARED", req.aiContext); res.json({ ok: true }); } catch (error) { next(error); } });

  if (existsSync(DIST)) app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.join(DIST, "index.html");
    if (!existsSync(indexPath)) return res.status(503).send("前端尚未构建，请先运行 npm run build。");
    res.sendFile(indexPath);
  });
  app.use(expressErrorHandler);
  return app;
}

export async function startServer() {
  const app = createApp();
  return app.listen(PORT, HOST, async () => {
    const address = `http://${HOST}:${PORT}`;
    console.log("==================================================");
    console.log("Poker AI backend started successfully");
    console.log(`Service: ${address}`);
    console.log(`Logs: ${DEFAULT_LOG_DIR}`);
    console.log(`Visitor configurations: ${DEFAULT_VISITOR_CONFIG_DIR}`);
    console.log(`DEBUG_AI: ${DEBUG_AI}`);
    console.log("Waiting for visitor API requests...");
    console.log("==================================================");
    await serverLog(`BACKEND_STARTED address=${address} debug=${DEBUG_AI}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startServer().catch((error) => { console.error(error); process.exitCode = 1; });
