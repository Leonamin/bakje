/**
 * Parser health check. Fetches the most recent archived post per platform and
 * reports whether the current parser still produces a usable result. Run it
 * when a platform redesign is rumoured, before trusting the archive. The same
 * check runs daily in production through /api/health/parsers.
 *
 *   pnpm check
 */
import { closeBrowser } from "../src/lib/browser";
import { checkParsers } from "../src/lib/parser-check";

const label = { ok: "정상", fail: "실패", skip: "건너뜀" };
for (const r of await checkParsers()) {
  console.log(`${r.platform.toUpperCase().padEnd(8)} ${label[r.status]}  ${r.ms}ms  ${r.detail}`);
}

await closeBrowser();
process.exit(0);
