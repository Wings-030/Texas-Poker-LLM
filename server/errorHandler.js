export class AppError extends Error {
  constructor(type, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.type = type;
    this.httpStatus = options.httpStatus ?? 500;
    this.providerStatus = options.providerStatus ?? null;
    this.remoteBody = options.remoteBody ?? "";
    this.requestUrl = options.requestUrl ?? "";
    this.requestMethod = options.requestMethod ?? "";
    this.durationMs = options.durationMs ?? 0;
    this.retryCount = options.retryCount ?? 0;
    this.timedOut = Boolean(options.timedOut);
    this.cancelled = Boolean(options.cancelled);
    this.code = options.code ?? options.cause?.code ?? "";
  }
}

const MESSAGES = {
  BACKEND_NOT_RUNNING: "本地 AI 后端未运行。请使用 start.bat 启动游戏。",
  CONFIG_MISSING: "尚未保存完整的 AI API 配置。",
  INVALID_BASE_URL: "API Base URL 无效，请检查协议和地址。",
  INVALID_API_KEY: "API 返回 401：API Key 无效或未被服务商接受。",
  MODEL_NOT_FOUND: "服务商未找到所选模型，请刷新模型列表或手动检查模型名。",
  CORS_ERROR: "服务商拒绝了跨域请求；请确认请求由本地后端发出。",
  NETWORK_ERROR: "连接模型服务时发生网络错误。",
  DNS_ERROR: "无法解析模型服务域名。",
  CONNECTION_REFUSED: "模型服务拒绝了连接。",
  CONNECTION_RESET: "模型服务意外断开了连接。",
  REQUEST_TIMEOUT: "AI 请求超过了配置的等待时间。",
  RATE_LIMITED: "API 返回 429：请求过于频繁，请稍后重试。",
  INSUFFICIENT_QUOTA: "服务商额度不足或账户不可用。",
  PROVIDER_ERROR: "模型服务返回了服务器错误。",
  INVALID_RESPONSE: "模型服务返回了无法识别的响应格式。",
  STREAM_INTERRUPTED: "流式响应在完成前意外中断。",
  JSON_PARSE_FAILED: "模型输出中没有可解析的决策 JSON。",
  INVALID_AI_ACTION: "模型返回了当前牌局不允许的动作。",
  INVALID_BET_AMOUNT: "模型返回了不合法的下注金额。",
  REQUEST_CANCELLED: "AI 请求已由用户取消。",
  CONCURRENT_REQUEST: "该电脑玩家已有一个进行中的请求。",
  UNKNOWN_ERROR: "AI 请求发生未知错误。",
};

export function classifyError(error, context = {}) {
  if (error instanceof AppError) return error;
  if (context.cancelled || error?.name === "AbortError" && !context.timedOut) return new AppError("REQUEST_CANCELLED", MESSAGES.REQUEST_CANCELLED, { ...context, cause: error, cancelled: true, httpStatus: 499 });
  if (context.timedOut) return new AppError("REQUEST_TIMEOUT", MESSAGES.REQUEST_TIMEOUT, { ...context, cause: error, timedOut: true, httpStatus: 504 });
  const code = error?.code ?? error?.cause?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new AppError("DNS_ERROR", MESSAGES.DNS_ERROR, { ...context, cause: error, code, httpStatus: 502 });
  if (code === "ECONNREFUSED") return new AppError("CONNECTION_REFUSED", MESSAGES.CONNECTION_REFUSED, { ...context, cause: error, code, httpStatus: 502 });
  if (code === "ECONNRESET") return new AppError("CONNECTION_RESET", MESSAGES.CONNECTION_RESET, { ...context, cause: error, code, httpStatus: 502 });
  if (error instanceof TypeError) return new AppError("NETWORK_ERROR", `${MESSAGES.NETWORK_ERROR} ${error.message}`, { ...context, cause: error, code, httpStatus: 502 });
  return new AppError("UNKNOWN_ERROR", error?.message || MESSAGES.UNKNOWN_ERROR, { ...context, cause: error });
}

export function providerHttpError(status, body, context = {}) {
  if (status === 401 || status === 403) return new AppError("INVALID_API_KEY", MESSAGES.INVALID_API_KEY, { ...context, providerStatus: status, remoteBody: body, httpStatus: status });
  if (status === 404) return new AppError("MODEL_NOT_FOUND", MESSAGES.MODEL_NOT_FOUND, { ...context, providerStatus: status, remoteBody: body, httpStatus: 404 });
  if (status === 429) return new AppError("RATE_LIMITED", MESSAGES.RATE_LIMITED, { ...context, providerStatus: status, remoteBody: body, httpStatus: 429 });
  if (status === 402 || /quota|insufficient/i.test(body)) return new AppError("INSUFFICIENT_QUOTA", MESSAGES.INSUFFICIENT_QUOTA, { ...context, providerStatus: status, remoteBody: body, httpStatus: 402 });
  return new AppError("PROVIDER_ERROR", `${MESSAGES.PROVIDER_ERROR} HTTP ${status}`, { ...context, providerStatus: status, remoteBody: body, httpStatus: status >= 500 ? 502 : status });
}

export function serializeError(error, requestId = "", logFile = "") {
  const value = classifyError(error);
  return {
    ok: false,
    error: {
      type: value.type,
      message: value.message,
      httpStatus: value.providerStatus ?? value.httpStatus,
      requestId,
      logFile,
      retryCount: value.retryCount,
      timedOut: value.timedOut,
      cancelled: value.cancelled,
    },
  };
}

export function expressErrorHandler(error, req, res, _next) {
  const requestId = req.requestId ?? "";
  const value = classifyError(error);
  console.error(`[${new Date().toISOString()}] [${requestId}] ${value.type}: ${value.message}`, value.stack ?? "");
  res.status(value.httpStatus).json(serializeError(value, requestId));
}
