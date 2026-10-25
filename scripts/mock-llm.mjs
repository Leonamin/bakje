/**
 * Minimal OpenAI-compatible endpoint for local testing of the translation
 * stage. It does not translate anything: it prefixes each part and returns a
 * fixed summary, which is enough to verify wiring, storage and the UI toggle.
 * Serves both /chat/completions and /responses.
 *
 *   node scripts/mock-llm.mjs
 *   OPENAI_BASE_URL=http://127.0.0.1:4141/v1 OPENAI_API_KEY=test OPENAI_MODEL=mock npm run dev
 *
 * MOCK_LLM_REJECT_JSON=1 answers 400 to requests that ask for JSON mode, like
 * providers that do not support it.
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 4141);
const REJECT_JSON = process.env.MOCK_LLM_REJECT_JSON === "1";

function fakeTranslation(input) {
  return JSON.stringify({
    title: input.title ? `[번역] ${input.title}` : null,
    parts: (input.parts ?? []).map((t) => `[번역] ${String(t).slice(0, 400)}`),
    summary: `[요약] ${String(input.parts?.[0] ?? "").slice(0, 80)}…`,
  });
}

const server = http.createServer((req, res) => {
  const chat = req.url?.endsWith("/chat/completions");
  const responses = req.url?.endsWith("/responses");
  if (req.method !== "POST" || !(chat || responses)) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    let parsed = {};
    let input = { title: null, parts: [] };
    try {
      parsed = JSON.parse(body);
      const user = chat ? parsed.messages?.find((m) => m.role === "user")?.content : parsed.input;
      input = JSON.parse(user ?? "{}");
    } catch {
      /* fall through to empty */
    }

    if (REJECT_JSON && (parsed.response_format || parsed.text)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "response_format json_object is not supported by this model" } }));
      return;
    }

    const content = fakeTranslation(input);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify(
        chat
          ? {
              id: "mock",
              object: "chat.completion",
              model: "mock",
              choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
            }
          : {
              id: "mock",
              object: "response",
              model: "mock",
              output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: content }] }],
            },
      ),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock llm on http://127.0.0.1:${PORT}/v1${REJECT_JSON ? " (rejects JSON mode)" : ""}`);
});
