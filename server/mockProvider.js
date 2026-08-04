import express from "express";
import { fileURLToPath } from "node:url";

const MODELS = ["mock-normal", "mock-markdown", "mock-stream", "mock-reasoning", "mock-401", "mock-404", "mock-429", "mock-500", "mock-timeout", "mock-disconnect", "mock-garbled", "mock-invalid-action", "mock-invalid-amount"];

function decisionFor(model) {
  if (model === "mock-invalid-action") return { action: "dance", amount: 0, table_talk: "这个动作不太对，我得重新考虑一下。" };
  if (model === "mock-invalid-amount") return { action: "raise", amount: 999999999, table_talk: "这一轮我想把压力再提高一些，看看你是否愿意继续。" };
  return { action: "check", amount: 0, table_talk: "现在没有必要急着扩大底池，我想先看看后面的牌面变化。你可以继续行动，不过我还没有打算轻易退出这一局。" };
}

export function createMockProvider() {
  const app = express();
  app.use(express.json());
  app.get("/v1/models", (_req, res) => res.json({ object: "list", data: MODELS.map((id) => ({ id, object: "model" })) }));
  app.post("/v1/chat/completions", async (req, res) => {
    const model = req.body?.model ?? "mock-normal";
    if (model === "mock-401") return res.status(401).json({ error: { message: "invalid key" } });
    if (model === "mock-404") return res.status(404).json({ error: { message: "model not found" } });
    if (model === "mock-429") return res.status(429).json({ error: { message: "rate limited" } });
    if (model === "mock-500") return res.status(500).json({ error: { message: "provider failure" } });
    if (model === "mock-timeout") { await new Promise((resolve) => setTimeout(resolve, 1000)); }
    if (model === "mock-disconnect") { res.socket?.destroy(); return; }
    if (model === "mock-garbled") return res.type("text/plain").send("\u0000\u0001not-json");
    const decision = decisionFor(model);
    const content = model === "mock-markdown" ? `Here is the decision:\n\n\`\`\`json\n${JSON.stringify(decision)}\n\`\`\`` : JSON.stringify(decision);
    if (req.body?.stream || model === "mock-stream") {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      const middle = Math.ceil(content.length / 2);
      res.write(`data: ${JSON.stringify({ id: "mock", choices: [{ delta: { content: content.slice(0, middle), reasoning_content: model === "mock-reasoning" ? "Private provider reasoning." : "" } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: "mock", choices: [{ delta: { content: content.slice(middle) }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } })}\n\n`);
      res.end("data: [DONE]\n\n");
      return;
    }
    return res.json({ id: "mock", object: "chat.completion", model, choices: [{ message: { content, reasoning_content: model === "mock-reasoning" ? "Private provider reasoning." : "" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } });
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createMockProvider().listen(3999, "127.0.0.1", () => console.log("Mock Provider: http://127.0.0.1:3999/v1"));
}
