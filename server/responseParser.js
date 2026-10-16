const ACTION_ALIASES = new Map([
  ["all-in", "all-in"], ["all_in", "all-in"], ["allin", "all-in"],
  ["fold", "fold"], ["check", "check"], ["call", "call"], ["bet", "bet"], ["raise", "raise"],
]);

export function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("API Base URL 不能为空");
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("API Base URL 仅支持 http 或 https");
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function buildProviderUrl(baseUrl, endpoint) {
  const normalized = normalizeBaseUrl(baseUrl);
  const url = new URL(normalized);
  const path = url.pathname.replace(/\/+$/, "");
  const suffix = String(endpoint).replace(/^\/+/, "");
  url.pathname = /\/v1$/i.test(path) ? `${path}/${suffix}` : `${path}/v1/${suffix}`;
  return url.toString();
}

function collectText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") return item.text ?? item.content ?? item.output_text ?? "";
    return "";
  }).join("");
}

export function extractProviderContent(payload) {
  const choice = payload?.choices?.[0] ?? {};
  const message = choice.message ?? {};
  const delta = choice.delta ?? {};
  const content = collectText(delta.content) || collectText(message.content) || collectText(payload?.output_text) || collectText(payload?.content);
  const reasoning = collectText(delta.reasoning_content) || collectText(delta.reasoning) || collectText(message.reasoning_content) || collectText(message.reasoning) || collectText(payload?.reasoning_content) || collectText(payload?.reasoning);
  return { content, reasoning, finishReason: choice.finish_reason ?? payload?.finish_reason ?? null, usage: payload?.usage ?? null };
}

export function parseModelList(payload) {
  const candidates = Array.isArray(payload) ? payload : payload?.data ?? payload?.models ?? payload?.items ?? [];
  if (!Array.isArray(candidates)) return [];
  return [...new Set(candidates.map((item) => typeof item === "string" ? item : item?.id ?? item?.name ?? item?.model).filter(Boolean))].sort();
}

function balancedObject(text) {
  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") { if (start < 0) start = index; depth += 1; }
    else if (character === "}" && start >= 0) { depth -= 1; if (depth === 0) return text.slice(start, index + 1); }
  }
  return "";
}

function repairJson(text) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => `: "${value.replace(/"/g, '\\"')}"`);
}

export function extractJsonObject(input) {
  const text = String(input ?? "").trim();
  const attempts = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) attempts.push(fenced.trim());
  const object = balancedObject(text);
  if (object) attempts.push(object);
  for (const candidate of attempts) {
    for (const value of [candidate, repairJson(candidate)]) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { value: parsed, repaired: value !== candidate };
      } catch { /* try the next representation */ }
    }
  }
  throw new Error("无法从模型输出中提取合法 JSON 对象");
}

export function safeFallback(legalActions) {
  for (const action of ["check", "call", "fold"]) {
    if (legalActions?.actions?.includes(action)) return { action, amount: 0, table_talk: "" };
  }
  const action = legalActions?.actions?.[0] ?? "fold";
  const amount = action === "bet" || action === "raise" ? legalActions.minRaiseTo ?? 0 : 0;
  return { action, amount, table_talk: "" };
}

export function validateDecision(rawDecision, legalActions) {
  const repairs = [];
  const action = ACTION_ALIASES.get(String(rawDecision?.action ?? "").toLowerCase());
  if (!action || !legalActions?.actions?.includes(action)) {
    return { valid: false, jsonValid: true, actionValid: false, amountValid: false, repairs, errorType: "INVALID_AI_ACTION" };
  }
  let amount = Number(rawDecision?.amount ?? 0);
  if (!Number.isFinite(amount)) amount = 0;
  amount = Math.round(amount);
  let amountValid = true;
  if (action === "bet" || action === "raise") {
    const minimum = Number(legalActions.minRaiseTo ?? 0);
    const maximum = Number(legalActions.maxRaiseTo ?? minimum);
    if (amount < minimum || amount > maximum) {
      amount = Math.min(maximum, Math.max(minimum, amount || minimum));
      repairs.push(`Clamped amount to legal range ${minimum}-${maximum}.`);
    }
    amountValid = amount >= minimum && amount <= maximum;
  } else {
    if (amount !== 0) repairs.push("Reset amount to 0 for a non-betting action.");
    amount = 0;
  }
  const decision = {
    action,
    amount,
    table_talk: String(rawDecision?.table_talk ?? "").slice(0, 500),
  };
  return { valid: amountValid, jsonValid: true, actionValid: true, amountValid, repaired: repairs.length > 0, repairs, decision, errorType: amountValid ? null : "INVALID_BET_AMOUNT" };
}

export function mergeStreamText(current, incoming, cumulative = false) {
  if (!incoming) return current;
  return cumulative ? incoming : current + incoming;
}
