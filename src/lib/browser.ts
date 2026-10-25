import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { BROWSER_DIR } from "./db";

const STATE_FILE = path.join(BROWSER_DIR, "state.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

type BrowserGlobal = {
  browser?: Browser;
  lock?: Promise<unknown>;
};

const g = globalThis as unknown as { __archiveBrowser?: BrowserGlobal };
if (!g.__archiveBrowser) g.__archiveBrowser = {};

/**
 * Serialize page work. Two concurrent browser sessions fighting over the same
 * storage state produce challenges and lost cookies, so everything queues here.
 */
export function withBrowserLock<T>(fn: () => Promise<T>): Promise<T> {
  const state = g.__archiveBrowser!;
  const run = (state.lock ?? Promise.resolve()).then(fn, fn);
  state.lock = run.catch(() => undefined);
  return run;
}

async function getBrowser(): Promise<Browser> {
  const state = g.__archiveBrowser!;
  if (state.browser?.isConnected()) return state.browser;
  state.browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      // Containers have no user namespaces; Chromium's sandbox cannot start.
      ...(process.env.ARCHIVE_NO_SANDBOX === "1"
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        : []),
    ],
  });
  return state.browser;
}

export async function closeBrowser(): Promise<void> {
  const state = g.__archiveBrowser!;
  if (!state.browser) return;
  await state.browser.close().catch(() => undefined);
  state.browser = undefined;
}

export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const storageState = fs.existsSync(STATE_FILE) ? STATE_FILE : undefined;
  const ctx = await browser.newContext({
    userAgent: UA,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    viewport: { width: 1280, height: 900 },
    storageState,
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return ctx;
}

export async function saveState(ctx: BrowserContext): Promise<void> {
  try {
    await ctx.storageState({ path: STATE_FILE });
  } catch {
    /* context already closed */
  }
}

/**
 * Loads a URL in a real browser, waits for client-side data to settle, and
 * hands the fully hydrated HTML back to the adapter.
 */
export async function loadPage(
  url: string,
  opts: { waitMs?: number; settle?: string } = {},
): Promise<{ finalUrl: string; html: string; status: number }> {
  return withBrowserLock(async () => {
    const ctx = await newContext();
    const page: Page = await ctx.newPage();
    try {
      const res = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
        referer: "https://www.google.com/",
      });
      await page.waitForTimeout(opts.waitMs ?? 3500);
      if (opts.settle) {
        await page
          .waitForSelector(opts.settle, { timeout: 12_000 })
          .catch(() => undefined);
      }
      const html = await page.content();
      return {
        finalUrl: page.url(),
        html,
        status: res?.status() ?? 200,
      };
    } finally {
      await saveState(ctx);
      await ctx.close().catch(() => undefined);
    }
  });
}

export interface LoadResult<T> {
  finalUrl: string;
  html: string;
  status: number;
  data: T | null;
  /** Set when the in-page extractor threw; surfaced instead of "no data". */
  error?: string;
}

/**
 * Loads a page and evaluates an extractor inside it. DOM reads are far more
 * stable than string-matching markup for sites that re-render constantly.
 *
 * The extractor is a raw JS expression string on purpose: the bundler's
 * name-keeping helper leaks into serialized functions and breaks them inside
 * the page.
 */
export async function loadPageWith<T>(
  url: string,
  extract: string,
  opts: { waitMs?: number; settle?: string; scrolls?: number } = {},
): Promise<LoadResult<T>> {
  return withBrowserLock(async () => {
    const ctx = await newContext();
    const page: Page = await ctx.newPage();
    try {
      const res = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
        referer: "https://www.google.com/",
      });
      await page.waitForTimeout(opts.waitMs ?? 3500);
      if (opts.settle) {
        await page.waitForSelector(opts.settle, { timeout: 12_000 }).catch(() => undefined);
      }
      for (let i = 0; i < (opts.scrolls ?? 0); i++) {
        await page.mouse.wheel(0, 1800).catch(() => undefined);
        await page.waitForTimeout(1200);
      }
      const html = await page.content();
      let error: string | undefined;
      const data = await page.evaluate(extract).catch((err) => {
        // An evaluator error looks exactly like an empty page, so carry the
        // reason out instead of swallowing it.
        error = (err as Error).message;
        try {
          fs.appendFileSync(
            path.join(BROWSER_DIR, "eval-errors.log"),
            `${new Date().toISOString()} ${error}\n`,
          );
        } catch {
          /* ignore */
        }
        return null;
      });
      return { finalUrl: page.url(), html, status: res?.status() ?? 200, data: data as T | null, error };
    } finally {
      await saveState(ctx);
      await ctx.close().catch(() => undefined);
    }
  });
}

/** Runs an extractor against stored HTML, no network involved. */
export async function evaluateOnHtml<T>(html: string, extract: string): Promise<T | null> {
  return withBrowserLock(async () => {
    const ctx = await newContext();
    const page: Page = await ctx.newPage();
    try {
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return (await page.evaluate(extract)) as T;
    } catch {
      return null;
    } finally {
      await ctx.close().catch(() => undefined);
    }
  });
}

/** Resolves redirect chains (share links) without rendering the whole page. */
export async function resolveUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9,en;q=0.8" },
    });
    return res.url || url;
  } catch {
    return url;
  }
}
