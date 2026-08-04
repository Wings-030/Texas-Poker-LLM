import { AppError, serializeError } from "./errorHandler.js";
import { PokerRequestLog, serverLog } from "./logger.js";
import { buildRequestBody, requestProvider } from "./apiClient.js";
import { buildPokerMessages } from "./promptBuilder.js";
import { extractJsonObject, safeFallback, validateDecision } from "./responseParser.js";
import { requestCoordinator } from "./requestCoordinator.js";

function requireIds(input) {
  for (const key of ["gameId", "handId", "turnId", "characterId", "requestId"]) if (!String(input?.[key] ?? "").trim()) throw new AppError("INVALID_RESPONSE", `缺少请求标识：${key}`, { httpStatus: 400 });
}

export async function makePokerDecision(input, config, callbacks = {}) {
  requireIds(input);
  const { gameId, handId, turnId, characterId, requestId, gameState, characterPrompt } = input;
  const active = requestCoordinator.begin(characterId, requestId);
  let log;
  try {
    const built = buildPokerMessages({ characterId, gameState, characterPrompt });
    const requestBody = buildRequestBody(config, built.messages);
    log = new PokerRequestLog({ requestId, gameId, handId, round: gameState?.table?.round, characterId, characterName: built.character.name, seat: gameState?.table?.seat, model: config.model, config, gameState, systemPrompt: built.systemPrompt, messages: built.messages, requestBody });
    callbacks.onStatus?.("requesting", { requestId });
    const parseAttempts = Math.max(1, Number(config.maxRetries ?? 0) + 1);
    let messages = built.messages;
    let finalValidation;
    for (let parseAttempt = 1; parseAttempt <= parseAttempts; parseAttempt += 1) {
      const body = buildRequestBody(config, messages);
      log.metadata.requestBody = body;
      try {
        const result = await requestProvider({
          config, body, signal: active.controller.signal, requestId,
          onAttempt: (attempt) => { log.attempt(log.attempts.length + 1, { providerAttempt: attempt }); callbacks.onStatus?.(attempt > 1 ? "retrying" : "requesting", { attempt }); },
          onChunk: (raw, timestamp) => log.chunk(raw, timestamp),
          onContent: (chunk) => { callbacks.onStatus?.("streaming", { chunk }); },
          onReasoning: (chunk) => { callbacks.onStatus?.("reasoning", { reasoningChunk: chunk }); },
          onWarning: (warning) => log.addError({ type: "STREAM_WARNING", message: warning }),
        });
        log.rawResponses.push(result.rawResponse);
        log.assembledContent += result.content;
        log.assembledReasoning += result.reasoning;
        log.usage = result.usage ?? log.usage;
        callbacks.onStatus?.("parsing", {});
        let extracted;
        try { extracted = extractJsonObject(result.content); }
        catch (cause) {
          const error = new AppError("JSON_PARSE_FAILED", "模型输出中没有可解析的决策 JSON。", { cause, httpStatus: 502 });
          log.addError(error);
          if (parseAttempt < parseAttempts) {
            messages = [...built.messages, { role: "assistant", content: result.content }, { role: "user", content: "Your previous response was not valid JSON. Return only one valid decision JSON object using a currently legal action." }];
            log.validation.retried = true;
            continue;
          }
          throw error;
        }
        finalValidation = validateDecision(extracted.value, gameState.legalActions);
        finalValidation.repaired = Boolean(finalValidation.repaired || extracted.repaired);
        if (!finalValidation.valid) {
          const error = new AppError(finalValidation.errorType, finalValidation.errorType === "INVALID_AI_ACTION" ? "模型返回了非法动作。" : "模型返回了非法下注金额。", { httpStatus: 502 });
          log.addError(error);
          if (parseAttempt < parseAttempts) {
            messages = [...built.messages, { role: "assistant", content: result.content }, { role: "user", content: `The previous decision was illegal (${finalValidation.errorType}). Legal actions: ${JSON.stringify(gameState.legalActions)}. Return corrected JSON only.` }];
            log.validation.retried = true;
            continue;
          }
          throw error;
        }
        callbacks.onStatus?.("validating", {});
        const decision = finalValidation.decision;
        log.validation = { ...log.validation, ...finalValidation, finalAction: decision.action };
        const logFile = await log.finalize({ status: "success", parsedDecision: decision, validation: log.validation });
        callbacks.onStatus?.("complete", { requestId, logFile });
        return { ok: true, gameId, handId, turnId, characterId, requestId, decision, fallback: false, debug: { model: config.model, durationMs: log.metadata.durationMs, retryCount: Math.max(0, log.attempts.length - 1), rawContent: log.assembledContent, parsedDecision: decision, finalAction: decision.action, logFile } };
      } catch (error) {
        if (error.type === "REQUEST_CANCELLED") throw error;
        if (parseAttempt >= parseAttempts || !["JSON_PARSE_FAILED", "INVALID_AI_ACTION", "INVALID_BET_AMOUNT"].includes(error.type)) throw error;
      }
    }
    throw new AppError("UNKNOWN_ERROR", "AI 决策流程未产生结果。", { httpStatus: 500 });
  } catch (error) {
    if (error.type === "REQUEST_CANCELLED" && log) {
      log.addError(error);
      const logFile = await log.finalize({ status: "cancelled", validation: log.validation });
      error.logFile = logFile;
      callbacks.onStatus?.("cancelled", { requestId, logFile });
      throw error;
    }
    const fallback = safeFallback(gameState?.legalActions);
    if (log) {
      const latestError = log.errors.at(-1);
      if (latestError?.type !== error.type || latestError?.message !== error.message) log.addError(error);
      log.validation = { ...log.validation, safeFallback: true, finalAction: fallback.action };
      const logFile = await log.finalize({ status: error.type === "REQUEST_CANCELLED" ? "cancelled" : "fallback", parsedDecision: fallback, validation: log.validation });
      callbacks.onStatus?.("fallback", { requestId, logFile, error: serializeError(error, requestId, logFile).error });
      return { ok: true, gameId, handId, turnId, characterId, requestId, decision: fallback, fallback: true, error: serializeError(error, requestId, logFile).error, debug: { model: config.model, durationMs: log.metadata.durationMs, retryCount: Math.max(0, log.attempts.length - 1), rawContent: log.assembledContent, parsedDecision: fallback, finalAction: fallback.action, logFile } };
    }
    await serverLog(`FAILED request=${requestId} character=${characterId} type=${error.type ?? "UNKNOWN_ERROR"} message=${error.message}`);
    throw error;
  } finally {
    requestCoordinator.finish(requestId);
  }
}

export async function markStaleResponse(input) {
  await serverLog(`STALE_RESPONSE_DISCARDED request=${input.requestId} game=${input.gameId} hand=${input.handId} turn=${input.turnId} character=${input.characterId}`);
}
