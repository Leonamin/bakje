import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, Info } from "lucide-react";
import { CopyField } from "@/components/copy-field";

export const metadata: Metadata = { title: "공유 시트로 저장하기 — 박제" };

// The tailnet address from wiki/concepts/operations.md. `?format=text` makes the reply a plain sentence.
const ENDPOINT = "https://<기기이름>.<tailnet>.ts.net:8888/api/ingest?format=text";

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

function Toggle({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <Row y={y} label={label} />
      <rect x="196" y={y + 8} width="38" height="20" rx="10" fill={C.accent} />
      <circle cx="224" cy={y + 18} r="8" fill="#fff" />
    </g>
  );
}

/** An action block in the shortcut editor. */
function Action({ y, title, lines = [], dim, strong }: { y: number; title: string; lines?: string[]; dim?: boolean; strong?: boolean }) {
  const h = 36 + lines.length * 20;
  return (
    <g opacity={dim ? 0.55 : 1}>
      <rect x="16" y={y} width="228" height={h} rx="12" fill={C.surface} stroke={strong ? C.accent : C.line} strokeWidth={strong ? 2 : 1} />
      <rect x="26" y={y + 10} width="16" height="16" rx="4" fill={C.accent} />
      <text x="50" y={y + 23} fill={C.ink} fontSize="12" fontWeight="700">
        {title}
      </text>
      {lines.map((line, i) => (
        <text key={line} x="28" y={y + 46 + i * 18} fill={C.muted} fontSize="11">
          {line}
        </text>
      ))}
    </g>
  );
}

/** Where to tap, for targets without text under them; rows and actions use `strong` instead. */
function Tap({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="16" fill="none" stroke={C.accent} strokeWidth="2.5" />
      <circle cx={x} cy={y} r="5" fill={C.accent} />
    </g>
  );
}

interface Step {
  title: string;
  body: React.ReactNode;
  figure: React.ReactNode;
  /** Path under public/ of a real screenshot that replaces the drawing. */
  capture?: string;
}

const STEPS: Step[] = [
  {
    title: "새 단축어 만들기",
    body: (
      <>
        iPhone에 기본으로 들어 있는 <b>단축어</b> 앱을 열고 오른쪽 위 <b>+</b>를 누릅니다. 맨 위 이름을 눌러{" "}
        <b>박제에 저장</b>으로 바꿉니다.
      </>
    ),
    figure: (
      <Phone title="단축어" label="단축어 앱 첫 화면에서 오른쪽 위 더하기 버튼을 누르는 그림">
        <text x="226" y="62" fill={C.accent} fontSize="24" textAnchor="middle">
          +
        </text>
        <Tap x={226} y={55} />
        <rect x="16" y="90" width="110" height="80" rx="14" fill={C.surface2} />
        <rect x="134" y="90" width="110" height="80" rx="14" fill={C.surface2} />
        <rect x="16" y="178" width="110" height="80" rx="14" fill={C.surface2} />
        <text x="28" y="160" fill={C.muted} fontSize="11">
          기존 단축어
        </text>
      </Phone>
    ),
  },
  {
    title: "공유 시트에 나오게 하기",
    body: (
      <>
        편집 화면 아래의 <b>ⓘ</b>(또는 맨 위 이름 → <b>세부사항</b>)을 열고 <b>공유 시트에서 보기</b>를 켭니다. 그러면
        편집 화면 맨 위에 <b>“공유 시트에서 입력 받기”</b> 블록이 생깁니다. 받는 종류를 눌러 <b>URL</b>과{" "}
        <b>텍스트</b>만 남기면 다른 앱의 공유 목록이 깔끔해집니다.
      </>
    ),
    figure: (
      <Phone title="세부사항" label="세부사항에서 공유 시트에서 보기를 켜는 그림">
        <Row y={84} label="홈 화면에 추가" />
        <Toggle y={128} label="공유 시트에서 보기" />
        <Row y={172} label="Mac 메뉴 막대에 고정" />
        <Action y={232} title="공유 시트에서 입력 받기" lines={["받는 종류: URL, 텍스트"]} />
      </Phone>
    ),
  },
  {
    title: "박제 주소로 보내는 동작 추가",
    body: (
      <>
        아래 검색창에서 <b>URL의 콘텐츠 가져오기</b>를 찾아 추가하고, URL 칸에 아래 주소를 붙여넣습니다.
        <span className="mt-3 block">
          <CopyField value={ENDPOINT} label="박제 수집 주소" />
        </span>
      </>
    ),
    figure: (
      <Phone title="박제에 저장" label="공유 시트 입력 블록 아래에 URL의 콘텐츠 가져오기 동작을 추가한 그림">
        <Action y={84} title="공유 시트에서 입력 받기" dim />
        <Action y={130} title="URL의 콘텐츠 가져오기" lines={["<기기이름>.<tailnet>.ts.net:8888", "/api/ingest?format=text"]} strong />
        <rect x="16" y="290" width="228" height="32" rx="10" fill={C.surface2} />
        <text x="30" y="311" fill={C.muted} fontSize="11">
          동작 검색
        </text>
      </Phone>
    ),
  },
  {
    title: "보내는 방법 정하기",
    body: (
      <>
        동작의 <b>›</b>(더 보기)를 눌러 펼칩니다.
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <b>방법</b>: POST
          </li>
          <li>
            <b>요청 본문</b>: JSON
          </li>
          <li>
            <b>새로운 필드 추가 → 텍스트</b>: 키에 <code className="font-mono text-[var(--accent-strong)]">url</code>, 값에는
            키보드 위 변수 막대에서 <b>단축어 입력</b>을 고릅니다.
          </li>
        </ul>
        <p className="mt-2 text-[var(--muted)]">
          공유된 내용이 “글 내용 + 링크”처럼 텍스트로 와도 박제가 그 안의 링크만 골라냅니다.
        </p>
      </>
    ),
    figure: (
      <Phone title="박제에 저장" label="URL의 콘텐츠 가져오기 동작을 펼쳐 POST와 JSON 본문을 설정한 그림">
        <Action y={84} title="URL의 콘텐츠 가져오기" />
        <Row y={128} label="방법" value="POST" />
        <Row y={168} label="헤더" value="없음" />
        <Row y={208} label="요청 본문" value="JSON" />
        <Row y={248} label="url · 텍스트" value="단축어 입력" strong />
      </Phone>
    ),
  },
  {
    title: "결과 알림 띄우기",
    body: (
      <>
        <b>알림 보기</b> 동작을 추가하고 본문을 비운 뒤 변수 막대에서 <b>URL의 콘텐츠</b>를 넣습니다. 이제 저장할 때마다
        “박제를 시작했습니다.” 같은 한 줄이 알림으로 뜹니다. 오른쪽 위 <b>완료</b>를 눌러 저장합니다.
      </>
    ),
    figure: (
      <Phone title="박제에 저장" label="알림 보기 동작에 URL의 콘텐츠를 넣은 그림">
        <Action y={84} title="공유 시트에서 입력 받기" dim />
        <Action y={130} title="URL의 콘텐츠 가져오기" dim />
        <Action y={176} title="알림 보기" lines={["본문: URL의 콘텐츠"]} strong />
      </Phone>
    ),
  },
  {
    title: "앱에서 공유해 저장하기",
    body: (
      <>
        X, Threads, Reddit에서 게시글의 <b>공유</b> 버튼을 누르고, 앱 자체 메뉴가 먼저 뜨면 <b>더 보기</b>(또는{" "}
        <b>다음으로 공유…</b>)를 눌러 iPhone 공유 시트를 엽니다. 목록 아래쪽의 <b>박제에 저장</b>을 누르면 끝입니다.
        <p className="mt-2 text-[var(--muted)]">
          자주 쓰면 공유 시트 맨 아래 <b>작업 편집…</b>에서 즐겨찾기에 넣어 위로 올려 두세요.
        </p>
      </>
    ),
    figure: (
      <Phone title="공유" label="게시글 공유 시트 목록에서 박제에 저장을 누르는 그림">
        {[40, 92, 144, 196].map((cx) => (
          <circle key={cx} cx={cx} cy={104} r="20" fill={C.surface2} />
        ))}
        <Row y={146} label="링크 복사" />
        <Row y={186} label="박제에 저장" strong />
        <Row y={226} label="작업 편집…" />
      </Phone>
    ),
  },
  {
    title: "처음 한 번은 허용하기",
    body: (
      <>
        처음 실행하면 “박제에 저장이(가) <기기이름>…에 접근하도록 허용하겠습니까?” 같은 확인 창이 뜹니다.{" "}
        <b>항상 허용</b>을 누르면 다음부터는 묻지 않습니다. 그다음 위에서 결과 알림이 내려옵니다.
      </>
    ),
    figure: (
      <Phone title="" label="처음 실행할 때 뜨는 접근 허용 창과 결과 알림 그림">
        <rect x="16" y="40" width="228" height="54" rx="14" fill={C.surface} stroke={C.line} />
        <rect x="28" y="54" width="26" height="26" rx="6" fill={C.accent} />
        <text x="64" y="64" fill={C.ink} fontSize="11" fontWeight="700">
          박제에 저장
        </text>
        <text x="64" y="82" fill={C.muted} fontSize="11">
          박제를 시작했습니다.
        </text>
        <rect x="30" y="130" width="200" height="150" rx="16" fill={C.surface2} />
        <text x="130" y="166" fill={C.ink} fontSize="12" fontWeight="700" textAnchor="middle">
          접근을 허용하겠습니까?
        </text>
        <text x="130" y="186" fill={C.muted} fontSize="10" textAnchor="middle">
          <기기이름>.<tailnet>.ts.net
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
    q: "공유 시트에 “박제에 저장”이 없어요",
    a: (
      <>
        2단계의 <b>공유 시트에서 보기</b>가 켜져 있는지, 받는 종류에 <b>URL</b>이 들어 있는지 확인하세요. 그래도 없으면
        공유 시트 맨 아래 <b>작업 편집…</b>에서 찾아 켭니다.
      </>
    ),
  },
  {
    q: "허용 창에서 실수로 “허용 안 함”을 눌렀어요",
    a: (
      <>
        단축어 앱에서 <b>박제에 저장</b>을 길게 눌러 세부사항(또는 <b>개인 정보 보호</b>)으로 들어가 접근 권한을
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

export default function ShortcutHelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-2 md:px-6 md:pt-10">
      <Link href="/add" className="-ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-[14px] text-[var(--muted)] hover:text-[var(--ink)]">
        <ChevronLeft size={18} />
        수집
      </Link>
      <h1 className="mt-2 text-[24px] font-bold tracking-tight">공유 시트로 바로 저장하기</h1>
      <p className="mt-2 text-[16px] leading-[1.7] text-[var(--muted)]">
        iPhone 단축어를 한 번 만들어 두면, X·Threads·Reddit에서 <b className="text-[var(--ink)]">공유 → 박제에 저장</b>{" "}
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
