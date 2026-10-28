export async function register() {
  // The job queue lives in the Node server process; the edge runtime has no SQLite.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startQueue } = await import("./lib/queue");
    startQueue();
    const { startEmbedSweep } = await import("./lib/embed");
    startEmbedSweep();
    const { startLibraryWorker } = await import("./lib/library-import");
    startLibraryWorker();
    const { startOrganizationWorker } = await import("./lib/library-organization");
    startOrganizationWorker();
  }
}
