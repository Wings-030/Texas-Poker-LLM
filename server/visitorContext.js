import { createHash } from "node:crypto";
import path from "node:path";
import { ConfigManager } from "./configManager.js";
import { DEFAULT_LOG_DIR } from "./logger.js";

export function visitorContext({ logDir = DEFAULT_LOG_DIR } = {}) {
  return (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const token = req.get("X-Poker-Client-Token");
    if (!/^[a-f0-9]{64}$/.test(token ?? "")) {
      return res.status(401).json({ ok: false, error: { type: "VISITOR_REQUIRED", message: "缺少浏览器访问凭据，请刷新页面后重试。" } });
    }
    // The browser token is a bearer credential; never store or log the token itself.
    const scope = createHash("sha256").update(token).digest("hex");
    req.configManager = new ConfigManager(scope);
    req.aiContext = { scope, logDir: path.join(logDir, "visitors", scope) };
    next();
  };
}
