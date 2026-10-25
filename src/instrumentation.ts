export async function register() {
  // The job queue lives in the Node server process; the edge runtime has no SQLite.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startQueue } = await import("./lib/queue");
    startQueue();
  }
}
