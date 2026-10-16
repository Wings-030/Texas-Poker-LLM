import { AppError } from "./errorHandler.js";
import { PokerRequestLog } from "./logger.js";
import { buildRequestBody, requestProvider } from "./apiClient.js";
import { parseModelList } from "./responseParser.js";

export async function getModels(config) {
  if (!config.apiBaseUrl) throw new AppError("CONFIG_MISSING", "请先填写 API Base URL。", { httpStatus: 400 });
  const result = await requestProvider({ config: { ...config, model: config.model || "models", stream: false }, endpoint: "models", method: "GET", requestId: crypto.randomUUID() });
  const models = parseModelList(result.rawResponse);
  if (!models.length) throw new AppError("INVALID_RESPONSE", "服务商返回了响应，但未识别到模型列表。可继续手动填写模型名称。", { httpStatus: 502 });
  return models;
}

export async function testConnection(config, options = {}) {
  if (!config.apiBaseUrl || !config.apiKey || !config.model) throw new AppError("CONFIG_MISSING", "测试连接需要 API Base URL、API Key 和模型名称。", { httpStatus: 400 });
  const requestId = crypto.randomUUID();
  let models = [];
  let modelsSupported = true;
  try { models = await getModels(config); }
  catch (error) { if (error.type === "MODEL_NOT_FOUND" || error.type === "INVALID_RESPONSE") modelsSupported = false; else throw error; }
  if (modelsSupported && !models.includes(config.model)) throw new AppError("MODEL_NOT_FOUND", `模型列表中不存在 ${config.model}。`, { httpStatus: 404 });
  const messages = [{ role: "system", content: "Return exactly the word OK." }, { role: "user", content: "Connection test." }];
  const requestBody = buildRequestBody(config, messages, { parameters: { max_tokens: 8 } });
  const log = new PokerRequestLog({ requestId, characterId: "connection-test", characterName: "Connection Test", model: config.model, config, systemPrompt: messages[0].content, messages, requestBody }, options);
  try {
    const result = await requestProvider({ config, body: requestBody, requestId, onAttempt: (attempt) => log.attempt(attempt), onChunk: (raw, timestamp) => log.chunk(raw, timestamp) });
    await log.finalize({ status: "success", rawResponses: [result.rawResponse], assembledContent: result.content, assembledReasoning: result.reasoning, usage: result.usage });
    return { ok: true, requestId, model: config.model, modelsSupported, streamSupported: Boolean(config.stream), responsePreview: result.content.slice(0, 120), logFile: log.relativePath.replaceAll("\\", "/") };
  } catch (error) {
    log.addError(error);
    await log.finalize({ status: "failed" });
    error.logFile = log.relativePath.replaceAll("\\", "/");
    throw error;
  }
}
