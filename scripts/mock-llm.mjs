/**
 * Minimal OpenAI-compatible endpoint for local testing of the translation
 * stage. It does not translate anything: it prefixes each part and returns a
 * fixed summary, which is enough to verify wiring, storage and the UI toggle.
 *
 *   node scripts/mock-llm.mjs
 *   OPENAI_BASE_URL=http://127.0.0.1:4141/v1 OPENAI_API_KEY=test OPENAI_MODEL=mock npm run dev
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 4141);

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    let input = { title: null, parts: [] };
    try {
      const parsed = JSON.parse(body);
      const user = parsed.messages?.find((m) => m.role === "user");
      input = JSON.parse(user?.content ?? "{}");
    } catch {
      /* fall through to empty */
    }

    const parts = (input.parts ?? []).map((t) => `[번역] ${String(t).slice(0, 400)}`);
    const summary = `[요약] ${String(input.parts?.[0] ?? "").slice(0, 80)}…`;

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "mock",
        object: "chat.completion",
        model: "mock",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                title: input.title ? `[번역] ${input.title}` : null,
                parts,
                summary,
              }),
            },
            finish_reason: "stop",
          },
        ],
      }),
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock llm on http://127.0.0.1:${PORT}/v1`);
});
