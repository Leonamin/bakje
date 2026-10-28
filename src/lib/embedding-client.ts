/** One HTTP dispatcher per web process. Search jumps ahead of queued background inference. */
const URL = process.env.EMBEDDER_URL?.replace(/\/$/, "");
export const embedderEnabled = Boolean(URL);
interface RequestJob {
  endpoint: string; body: unknown; foreground: boolean; expires: number;
  resolve: (value: Float32Array[]) => void; reject: (error: unknown) => void;
}
const globalRequests = globalThis as unknown as { __embeddingRequests?: { running: boolean; pending: RequestJob[] } };
const requests = globalRequests.__embeddingRequests ??= { running: false, pending: [] };
async function pump() {
  if (requests.running) return;
  requests.running = true;
  try {
    while (requests.pending.length) {
      const firstSearch = requests.pending.findIndex(r => r.foreground);
      const job = requests.pending.splice(firstSearch < 0 ? 0 : firstSearch, 1)[0];
      const remaining = job.expires - Date.now();
      if (remaining <= 0) { job.reject(new Error("임베딩 요청 대기 시간 초과")); continue; }
      try {
        const response = await fetch(`${URL}${job.endpoint}`, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(job.body), signal: AbortSignal.timeout(remaining) });
        if (!response.ok) throw new Error(`embedder ${response.status}`);
        const result = await response.json() as { vectors: number[][] };
        if (!Array.isArray(result.vectors) || result.vectors.some(v => !Array.isArray(v) || v.length !== 256 || v.some(n => !Number.isFinite(n)))) throw new Error("임베딩 응답 규격 오류");
        job.resolve(result.vectors.map(v => Float32Array.from(v)));
      } catch (err) { job.reject(err); }
    }
  } finally { requests.running = false; }
}
function request(endpoint: string, body: unknown, foreground = false) {
  if (!embedderEnabled) return Promise.reject(new Error("임베딩 서버가 설정되지 않았습니다."));
  return new Promise<Float32Array[]>((resolve, reject) => {
    const timeout = foreground ? 5000 : 120_000;
    const job: RequestJob = {
      endpoint, body, foreground, expires: Date.now() + timeout,
      resolve: value => { clearTimeout(timer); resolve(value); },
      reject: error => { clearTimeout(timer); reject(error); },
    };
    // Deadline includes queue time. An expired search never waits for a long background inference.
    const timer = setTimeout(() => {
      const at = requests.pending.indexOf(job);
      if (at >= 0) requests.pending.splice(at, 1);
      job.reject(new Error("임베딩 요청 시간 초과"));
    }, timeout);
    timer.unref();
    requests.pending.push(job);
    void pump();
  });
}
export async function embedTexts(texts: string[], kind: "document" | "query" = "document") {
  const vectors = await request("/embed", { texts, kind }, kind === "query");
  if (vectors.length !== texts.length) throw new Error("텍스트 임베딩 수 불일치");
  return vectors;
}
export async function embedImage(jpeg: Buffer) {
  const vectors = await request("/embed-image", { images: [jpeg.toString("base64")] });
  if (vectors.length !== 1) throw new Error("이미지 임베딩 수 불일치");
  return vectors[0];
}
export async function queryVector(q: string) { return (await embedTexts([q], "query"))[0]; }
