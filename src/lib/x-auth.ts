import type { BrowserContext, Page } from "playwright";
import { db } from "./db";
import { newContext, withBrowserLock } from "./browser";

/**
 * 연령 제한 게시글용 X 로그인 쿠키(전용 계정). 로그아웃 상태로 읽히지 않을 때만 쓴다.
 * 저장한 값은 API로 다시 내보내지 않는다.
 */
export interface XCookies {
  authToken: string;
  ct0: string;
}

export type XAuthFailure = "expired" | "locked" | "suspended" | "unknown";

export const X_AUTH_MESSAGE: Record<XAuthFailure, string> = {
  expired: "X 로그인 쿠키가 만료되었거나 무효입니다. 설정에서 다시 등록해주세요.",
  locked: "X 전용 계정이 잠겼거나 추가 확인을 요구합니다. X에 직접 로그인해 확인해주세요.",
  suspended: "X 전용 계정이 정지되었습니다.",
  unknown: "X에 로그인했지만 게시글 데이터를 받지 못했습니다.",
};

const upsert = "INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";

export function xCookies(): XCookies | null {
  const rows = db().prepare("SELECT key, value FROM setting WHERE key IN ('x.auth_token', 'x.ct0')").all() as {
    key: string;
    value: string;
  }[];
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return v["x.auth_token"] && v["x.ct0"] ? { authToken: v["x.auth_token"], ct0: v["x.ct0"] } : null;
}

export function saveXCookies(patch: Partial<XCookies>): void {
  const stmt = db().prepare(upsert);
  if (patch.authToken) stmt.run("x.auth_token", patch.authToken.trim());
  if (patch.ct0) stmt.run("x.ct0", patch.ct0.trim());
}

/** 저장된 쿠키의 끝 4자리만. 값 자체는 노출하지 않는다. */
export function xCookieInfo(): { tail: string | null } {
  const c = xCookies();
  return { tail: c ? c.authToken.slice(-4) : null };
}

async function openSession(c: XCookies): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await newContext();
  await ctx.addCookies([
    { name: "auth_token", value: c.authToken, domain: ".x.com", path: "/", secure: true, httpOnly: true },
    { name: "ct0", value: c.ct0, domain: ".x.com", path: "/", secure: true },
  ]);
  return { ctx, page: await ctx.newPage() };
}

/** 응답이 갱신한 ct0를 보관한다. auth_token은 서버가 바꾸지 않는다. */
async function keepRefreshed(ctx: BrowserContext, c: XCookies): Promise<void> {
  const ct0 = (await ctx.cookies("https://x.com")).find((k) => k.name === "ct0")?.value;
  if (ct0 && ct0 !== c.ct0) saveXCookies({ ct0 });
}

async function diagnose(page: Page): Promise<XAuthFailure | null> {
  const url = page.url();
  if (/\/(i\/flow\/)?login|\/logout/.test(url)) return "expired";
  if (/account\/access|i\/flow\/consent/.test(url)) return "locked";
  const body = await page.locator("body").innerText({ timeout: 2000 }).catch(() => "");
  if (/account is suspended|계정이 정지/i.test(body)) return "suspended";
  return null;
}

/** 계정 메뉴가 보이면 로그인 상태다. */
const isLoggedIn = async (page: Page) =>
  (await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').count()) > 0;

export async function fetchXLoggedIn(
  nativeId: string,
  c: XCookies,
): Promise<{ payload: any | null; html: string; failure?: XAuthFailure }> {
  return withBrowserLock(async () => {
    const { ctx, page } = await openSession(c);
    try {
      let payload: any = null;
      page.on("response", async (r) => {
        if (!r.url().includes("/TweetDetail") || payload) return;
        const json = await r.json().catch(() => null);
        if (json?.data?.threaded_conversation_with_injections_v2) payload = json;
      });
      await page.goto(`https://x.com/i/status/${nativeId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      for (let i = 0; i < 30 && !payload; i++) {
        await page.waitForTimeout(500);
        if (i % 4 === 3 && (await diagnose(page))) break;
      }
      const html = await page.content();
      await keepRefreshed(ctx, c);
      if (payload) return { payload, html };
      // 무효한 쿠키는 로그인 화면이 아니라 로그아웃 상태 화면으로 이어진다. 계정 메뉴가 없으면 만료로 본다.
      return { payload: null, html, failure: (await diagnose(page)) ?? ((await isLoggedIn(page)) ? "unknown" : "expired") };
    } finally {
      await ctx.close().catch(() => undefined);
    }
  });
}

/** 설정 화면의 "쿠키 확인": 홈 화면이 열리는지만 본다. */
export async function checkXCookies(c: XCookies): Promise<{ ok: true } | { ok: false; failure: XAuthFailure }> {
  return withBrowserLock(async () => {
    const { ctx, page } = await openSession(c);
    try {
      await page.goto("https://x.com/home", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(4000);
      const failure = await diagnose(page);
      if (failure) return { ok: false as const, failure };
      const home = await page
        .waitForSelector('[data-testid="primaryColumn"]', { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!home) return { ok: false as const, failure: (await isLoggedIn(page)) ? ("unknown" as const) : ("expired" as const) };
      await keepRefreshed(ctx, c);
      return { ok: true as const };
    } finally {
      await ctx.close().catch(() => undefined);
    }
  });
}
