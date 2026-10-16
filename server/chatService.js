import { PokerRequestLog } from "./logger.js";
import { buildRequestBody, requestProvider } from "./apiClient.js";

export async function chatCompletion(input, config, callbacks = {}) {
  const requestId = input.requestId || crypto.randomUUID();
  const messages = Array.isArray(input.messages) ? input.messages.filter((message) => message && typeof message.role === "string") : [];
  if (!messages.length) throw new Error("messages 不能为空");
  const requestBody = buildRequestBody(config, messages, { stream: input.stream, parameters: input.parameters });
  const systemPrompt = messages.filter((message) => message.role === "system").map((message) => typeof message.content === "string" ? message.content : JSON.stringify(message.content)).join("\n\n");
  const log = new PokerRequestLog({ requestId, gameId: input.gameId, handId: input.handId, characterId: input.characterId || "chat", characterName: input.characterName || "Chat", model: config.model, config, systemPrompt, messages, requestBody }, callbacks);
  try {
    const result = await requestProvider({ config, body: requestBody, requestId, signal: callbacks.signal, onAttempt: (attempt) => log.attempt(attempt), onChunk: (raw, timestamp) => log.chunk(raw, timestamp), onContent: (chunk) => callbacks.onContent?.(chunk) });
    const logFile = await log.finalize({ status: "success", rawResponses: [result.rawResponse], assembledContent: result.content, assembledReasoning: result.reasoning, usage: result.usage });
    return { ok: true, requestId, content: result.content, logFile };
  } catch (error) {
    log.addError(error);
    await log.finalize({ status: "failed" });
    throw error;
  }
}
