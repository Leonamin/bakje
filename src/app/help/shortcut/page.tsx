import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, Info } from "lucide-react";
import { CopyField } from "@/components/copy-field";

export const metadata: Metadata = { title: "공유 시트로 저장하기 — 박제" };

// The address is taken from the request, so it shows whatever host this instance is opened on.
// `?format=text` makes the reply a plain sentence.

/* ---------- Illustrations ----------
 * Simplified drawings of the Shortcuts screens, not screenshots. To use a real capture,
 * put it in public/help/ and set `capture` on the step; the drawing is then replaced. */

const C = {
  bg: "#141922",
  surface: "#1d2431",
  surface2: "#242d3c",
  line: "#435068",
  ink: "#eef3e6",
  muted: "#93a1af",
  accent: "#b7d894",
};

function Phone({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 260 340" role="img" aria-label={label} className="mx-auto block h-auto w-full max-w-[260px]">
      <rect x="2" y="2" width="256" height="336" rx="30" fill={C.bg} stroke={C.line} strokeWidth="2" />
      <rect x="95" y="12" width="70" height="16" rx="8" fill="#000" />
      <text x="20" y="62" fill={C.ink} fontSize="18" fontWeight="700">
        {title}
      </text>
      {children}
    </svg>
  );
}

function Row({ y, label, value, strong }: { y: number; label: string; value?: string; strong?: boolean }) {
  return (
    <g>
      <rect x="16" y={y} width="228" height="36" rx="10" fill={strong ? "#2c3a2a" : C.surface2} stroke={strong ? C.accent : "none"} />
      <text x="28" y={y + 23} fill={strong ? C.accent : C.ink} fontSize="12" fontWeight={strong ? 700 : 400}>
        {label}
      </text>
      {value ? (
        <text x="232" y={y + 23} fill={C.muted} fontSize="11" textAnchor="end">
          {value}
        </text>
      ) : null}
    </g>
  );
}

interface Step {
  title: string;
  body: React.ReactNode;
  /** Drawing used when there is no real capture. */
  figure?: React.ReactNode;
  /** Path under public/ of a real screenshot (iOS 27, Korean UI); replaces the drawing. */
  capture?: string;
}

const makeSteps = (endpoint: string, host: string): Step[] => [
  {
    title: "새 단축어 만들기",
    capture: "/help/shortcut-all.webp",
    body: (
      <>
        iPhone에 기본으로 들어 있는 <b>단축어</b> 앱을 열고 <b>모든 단축어</b> 화면 아래 가운데에 떠 있는 <b>+</b>를
        누릅니다.
      </>
    ),
  },
  {
    title: "편집 화면 열기",
    capture: "/help/shortcut-describe.webp",
    body: (
      <>
        “단축어로 어떤 동작을 실행하겠습니까?” 입력창이 나오면 쓰지 말고 오른쪽 위 <b>편집</b>을 누릅니다. 위쪽{" "}
        <b>새로운 단축어</b>를 눌러 이름을 <b>박제하기</b>로 바꿉니다.
      </>
    ),
  },
  {
    title: "첫 동작 추가하기",
    capture: "/help/shortcut-search-url.webp",
    body: (
      <>
        아래 검색창에 <b>URL</b>을 입력하고 목록에서 <b>URL 콘텐츠 가져오기</b>를 누릅니다.
        <p className="mt-2 text-[var(--muted)]">
          동작이 하나 있어야 아래 도구 막대(↶ ↷ <b>ⓘ</b> ⇪ ▶)가 나타납니다. 검색 시트가 펼쳐져 있으면 막대가 가려지니
          시트를 아래로 내리세요.
        </p>
      </>
    ),
  },
  {
    title: "공유 시트에 나오게 하기",
    capture: "/help/shortcut-details.webp",
    body: (
      <>
        도구 막대의 <b>ⓘ</b>를 눌러 <b>세부사항</b>을 열고 <b>공유 시트에서 보기</b>를 켠 뒤 오른쪽 위 ✓를 누릅니다. 그러면
        맨 위에 <b>“공유 시트에서 … 받기”</b> 블록이 생깁니다. 받는 종류(<b>앱 및 18개</b>)를 눌러 <b>URL</b>과{" "}
        <b>텍스트</b>만 남기면 다른 앱의 공유 목록이 깔끔해집니다.
      </>
    ),
  },
  {
    title: "박제 주소와 보내는 방법 정하기",
    capture: "/help/shortcut-url-action.webp",
    body: (
      <>
        <b>URL 콘텐츠 가져오기</b> 제목의 파란 <b>URL</b> 칸에 아래 주소를 붙여넣고, 오른쪽 <b>⌄</b>를 눌러 펼칩니다.
        <span className="mt-3 block">
          <CopyField value={endpoint} label="박제 수집 주소" />
        </span>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <b>메소드</b>: POST
          </li>
          <li>
            <b>본문 요청</b>: JSON
          </li>
          <li>
            <b>새로운 필드 추가</b>를 눌러 만든 줄의 <b>키</b> 칸(그림의 빨간 테두리)에{" "}
            <code className="font-mono text-[var(--accent-strong)]">url</code>을 직접 입력하고, 값은{" "}
            <b>단축어 입력</b>으로 둡니다.
          </li>
        </ul>
        <p className="mt-2 font-semibold text-[var(--warn)]">
          키 칸을 비워 두면 박제가 링크를 찾지 못해 “URL을 입력해주세요.”가 뜹니다.
        </p>
        <p className="mt-2 text-[var(--muted)]">
          공유된 내용이 “글 내용 + 링크”처럼 텍스트로 와도 박제가 그 안의 링크만 골라냅니다.
        </p>
      </>
    ),
  },
  {
    title: "결과 알림 띄우기",
    capture: "/help/shortcut-notify.webp",
    body: (
      <>
        <b>알림 보기</b> 동작을 추가하고 본문에 <b>URL 콘텐츠</b>를 넣습니다. 이제 저장할 때마다 “박제를 시작했습니다.”
        같은 한 줄이 뜹니다. 위 그림처럼 세 블록이 차례로 놓이면 완성입니다. 위쪽 ‹로 나가면 저장됩니다.
      </>
    ),
  },
  {
    title: "앱에서 공유해 저장하기",
    body: (
      <>
        X, Threads, Reddit에서 게시글의 <b>공유</b> 버튼을 누르고, 앱 자체 메뉴가 먼저 뜨면 <b>더 보기</b>(또는{" "}
        <b>다음으로 공유…</b>)를 눌러 iPhone 공유 시트를 엽니다. 목록 아래쪽의 <b>박제하기</b>을 누르면 끝입니다.
        <p className="mt-2 text-[var(--muted)]">
          자주 쓰면 공유 시트 맨 아래 <b>작업 편집…</b>에서 즐겨찾기에 넣어 위로 올려 두세요.
        </p>
      </>
    ),
    figure: (
      <Phone title="공유" label="게시글 공유 시트 목록에서 박제하기을 누르는 그림">
        {[40, 92, 144, 196].map((cx) => (
          <circle key={cx} cx={cx} cy={104} r="20" fill={C.surface2} />
        ))}
        <Row y={146} label="링크 복사" />
        <Row y={186} label="박제하기" strong />
        <Row y={226} label="작업 편집…" />
      </Phone>
    ),
  },
  {
    title: "처음 한 번은 허용하기",
    body: (
      <>
        처음 실행하면 “‘박제하기’ 단축어가 {host}에 접근하도록 허용하겠습니까?” 같은 확인 창이 뜹니다.{" "}
        <b>항상 허용</b>을 누르면 다음부터는 묻지 않습니다. 그다음 위에서 결과 알림이 내려옵니다.
      </>
    ),
    figure: (
      <Phone title="" label="처음 실행할 때 뜨는 접근 허용 창과 결과 알림 그림">
        <rect x="16" y="40" width="228" height="54" rx="14" fill={C.surface} stroke={C.line} />
        <rect x="28" y="54" width="26" height="26" rx="6" fill={C.accent} />
        <text x="64" y="64" fill={C.ink} fontSize="11" fontWeight="700">
          박제하기
        </text>
        <text x="64" y="82" fill={C.muted} fontSize="11">
          박제를 시작했습니다.
        </text>
        <rect x="30" y="130" width="200" height="150" rx="16" fill={C.surface2} />
        <text x="130" y="166" fill={C.ink} fontSize="12" fontWeight="700" textAnchor="middle">
          접근을 허용하겠습니까?
        </text>
        <text x="130" y="186" fill={C.muted} fontSize="10" textAnchor="middle">
          {host}
        </text>
        <line x1="30" y1="204" x2="230" y2="204" stroke={C.line} />
        <text x="130" y="222" fill={C.muted} fontSize="12" textAnchor="middle">
          한 번 허용
        </text>
        <line x1="30" y1="232" x2="230" y2="232" stroke={C.line} />
        <rect x="70" y="236" width="120" height="24" rx="8" fill="none" stroke={C.accent} strokeWidth="2" />
        <text x="130" y="252" fill={C.accent} fontSize="12" fontWeight="700" textAnchor="middle">
          항상 허용
        </text>
      </Phone>
    ),
  },
];

const TROUBLES: { q: string; a: React.ReactNode }[] = [
  {
    q: "“URL을 입력해주세요.”라고 나와요",
    a: (
      <>
        박제가 받은 요청에서 링크를 찾지 못했다는 뜻입니다. 두 가지를 확인하세요. 5단계의 <b>키</b> 칸에{" "}
        <code className="font-mono text-[var(--accent-strong)]">url</code>이 적혀 있는지, 그리고 단축어 앱의 ▶로 직접 실행하지
        않았는지입니다. ▶로 실행하면 공유된 내용이 없어 같은 메시지가 뜹니다. 반드시 X·Threads·Reddit의 공유 시트에서
        실행하세요.
      </>
    ),
  },
  {
    q: "“서버에 연결할 수 없습니다” 같은 오류가 떠요",
    a: (
      <>
        박제는 내 tailnet 안에서만 열립니다. iPhone의 <b>Tailscale</b>이 켜져 있는지 확인하고 다시 공유하세요. 단축어는
        연결이 안 되면 링크를 맡아 두지 않습니다. 당장 연결할 수 없으면 링크를 복사해 두었다가 박제 앱의{" "}
        <b>붙여넣고 저장</b>을 쓰세요. 앱은 오프라인일 때 링크를 대기열에 넣었다가 연결되면 보냅니다.
      </>
    ),
  },
  {
    q: "“지원하지 않는 링크입니다”라고 나와요",
    a: (
      <>
        X, Threads, Reddit의 <b>게시글</b> 링크만 저장합니다. 프로필, 검색 결과, 다른 사이트 링크는 받지 않습니다.
        게시글을 연 상태에서 공유했는지 확인하세요.
      </>
    ),
  },
  {
    q: "“이미 저장된 게시글입니다”라고 나와요",
    a: <>이미 박제한 글입니다. 라이브러리에서 바로 찾을 수 있고 새로 저장되지는 않습니다.</>,
  },
  {
    q: "공유 시트에 “박제하기”가 없어요",
    a: (
      <>
        4단계의 <b>공유 시트에서 보기</b>가 켜져 있는지, 받는 종류에 <b>URL</b>이 들어 있는지 확인하세요. 그래도 없으면
        공유 시트 맨 아래 <b>작업 편집…</b>에서 찾아 켭니다.
      </>
    ),
  },
  {
    q: "허용 창에서 실수로 “허용 안 함”을 눌렀어요",
    a: (
      <>
        단축어 앱에서 <b>박제하기</b>을 길게 눌러 세부사항(또는 <b>개인 정보 보호</b>)으로 들어가 접근 권한을
        재설정하면 다음 실행 때 다시 묻습니다.
      </>
    ),
  },
  {
    q: "공유했는데 저장이 안 된 것 같아요",
    a: (
      <>
        “박제를 시작했습니다”는 접수됐다는 뜻입니다. 실제 저장은 서버에서 몇 초~몇십 초 걸리고, 실패하면 간격을 두고 다시
        시도합니다. 박제 앱의 <b>수집</b> 화면 최근 작업에서 진행 상황을 볼 수 있습니다.
      </>
    ),
  },
];

export default async function ShortcutHelpPage() {
  const h = await headers();
  const hostWithPort = h.get("host") ?? "localhost:3000";
  const endpoint = `${h.get("x-forwarded-proto") ?? "https"}://${hostWithPort}/api/ingest?format=text`;
  const STEPS = makeSteps(endpoint, hostWithPort.split(":")[0]);
  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-2 md:px-6 md:pt-10">
      <Link href="/add" className="-ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]">
        <ChevronLeft size={18} />
        수집
      </Link>
      <h1 className="mt-2 text-[24px] font-bold tracking-tight">공유 시트로 바로 저장하기</h1>
      <p className="mt-2 text-[16px] leading-[1.7] text-[var(--muted)]">
        iPhone 단축어를 한 번 만들어 두면, X·Threads·Reddit에서 <b className="text-[var(--ink)]">공유 → 박제하기</b>{" "}
        두 번만 눌러 게시글을 보관할 수 있습니다. 만드는 데 3분쯤 걸립니다.
      </p>

      <div className="plate mt-6 flex gap-3 p-4 text-[14px] leading-relaxed">
        <Info size={20} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <div>
          <p>
            준비물: <b>단축어</b> 앱(기본 설치)과 켜져 있는 <b>Tailscale</b>. 박제는 내 tailnet 기기에서만 열립니다.
          </p>
          {/* ponytail: no iCloud link yet — it has to be shared from a real iPhone. Put it here when it exists. */}
          <p className="mt-1 text-[var(--muted)]">바로 받을 수 있는 단축어 링크는 아직 없어서, 아래 순서대로 직접 만듭니다.</p>
        </div>
      </div>

      <ol className="mt-8 space-y-10">
        {STEPS.map((step, i) => (
          <li key={step.title} className="grid gap-5 md:grid-cols-[1fr_260px] md:items-start md:gap-8">
            <div>
              <p className="label">{i + 1}단계</p>
              <h2 className="mt-1 text-[20px] font-bold tracking-tight">{step.title}</h2>
              <div className="mt-2 text-[16px] leading-[1.7]">{step.body}</div>
            </div>
            <figure className="rounded-2xl bg-[var(--surface)] p-4">
              {step.capture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={step.capture} alt={`${step.title} 화면`} className="mx-auto w-full max-w-[260px] rounded-2xl" />
              ) : (
                step.figure
              )}
            </figure>
          </li>
        ))}
      </ol>

      <section className="mt-14">
        <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight">
          <CircleAlert size={20} className="text-[var(--warn)]" />
          잘 안 될 때
        </h2>
        <div className="mt-4 space-y-2">
          {TROUBLES.map((t) => (
            <details key={t.q} className="plate group p-4">
              <summary className="cursor-pointer list-none text-[14px] font-semibold marker:hidden">
                <ChevronRight size={16} className="mr-1 inline-block align-[-3px] text-[var(--muted)] transition-transform group-open:rotate-90" />
                {t.q}
              </summary>
              <div className="mt-2 text-[14px] leading-relaxed text-[var(--ink)]">{t.a}</div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
