# 박제

X, Threads, Reddit 게시글을 링크 하나로 내 디스크에 복제하고, 한국어로 다시 찾는 개인 아카이빙 도구. 지워지기 전에 원문째 "박제"해 둔다는 뜻으로 이름을 붙였다.

북마크의 원래 문제는 **원문이 사라진다**는 것이다. 이 도구는 본문·작성자 이어쓰기·미디어·원본 HTML 스냅샷을 전부 로컬에 남기므로, 원문이 삭제되어도 계속 읽을 수 있다.

---

## 실행

```bash
pnpm install
pnpm exec playwright install chromium   # 이미 있으면 생략
cp .env.example .env.local        # 번역용 OpenAI 호환 키 입력 (선택)
pnpm dev                       # http://localhost:3000
```

`.env.local`:

```
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

번역 설정은 앱의 **설정** 화면(`/settings`)에서도 바꿀 수 있다. 제공자(OpenAI·OpenRouter·OpenCode Go·직접 입력), 모델 ID, API 키, API 형식(Chat Completions·Responses)을 저장하면 SQLite에 들어가고 env 값보다 우선한다. 키는 저장 후 끝 4자리만 보여준다. 운영 환경의 env 파일은 `/etc/bakje/bakje.env`다.

키가 없어도 수집·검색·열람은 전부 동작한다. 번역은 게시글 화면에서 **번역하기**를 누를 때만 만든다.

데이터는 `./data`에 쌓인다 (`ARCHIVE_DATA_DIR`로 변경 가능).

```
data/
  archive.db          SQLite (WAL)
  media/<sha256>.jpg  원본 미디어 (30MB 초과는 저장하지 않음)
  raw/x/<id>-<ts>.html  파싱 직전 원본 응답
  raw/x/<id>-<ts>.json  Reddit DOM 추출 결과
  browser/state.json  브라우저 세션 (Reddit 챌린지 통과 쿠키)
```

---

## 동작

1. 링크를 넣으면 플랫폼을 판별하고 공유 링크를 실제 게시글로 해소한다.
2. 게시글을 가져와 **본문 + 작성자의 이어쓰기 사슬**을 파싱한다.
3. 미디어를 내려받고 영상은 ffmpeg으로 포스터 프레임을 만든다.
4. 본문·작성자·태그를 trigram FTS5에 색인한다.
5. 한국어가 아닌 글은 읽을 때 **번역하기**를 누르면 번역문과 요약을 만들고 색인에 더한다. 원문은 그대로 보존한다.

### 댓글 수집 규칙

"대댓글은 파싱하지 않는다"를 깊이 제한으로 구현하면 X의 여러 단짜리 타래가 두 번째에서 잘린다. 그래서 **깊이가 아니라 소유권**으로 자른다.

| 수집 | 제외 |
|---|---|
| 원글 | 타인이 단 댓글 |
| 작성자가 자기 글에 이어 붙인 글 전체 (타래) | 작성자가 남의 글에 단 댓글 |
| 원글이 답글이면 그 부모 (맥락) | 댓글의 댓글 (대화 오염) |
| 인용/리포스트 원본 | |

### 플랫폼별 수집 방식

| 플랫폼 | 방법 | 로그인 |
|---|---|---|
| X | 로그아웃 상태의 SSR HTML에 포함된 TweetDetail GraphQL 페이로드 | 불필요 |
| Threads | Playwright로 하이드레이션 후 Relay JSON 추출, 실패 시 og 메타 | 불필요 (브라우저 필요) |
| Reddit | Playwright + DOM 추출 (`shreddit-post`, `shreddit-comment`) | 불필요, 단 IP 차단 잦음 |

X는 2026년 현재 `x.com/i/status/<id>`를 일반 브라우저 UA로 요청하면 전체 대화 페이로드가 HTML에 실려 온다. 덕분에 API 키도, 로그인도, 헤드리스 브라우저도 필요 없다. 이 경로가 막히면 syndication 엔드포인트로 단일 글만 저장하고 `partial`로 표시한다.

---

## 검색

키워드 검색만 구현되어 있다. 임베딩 검색은 이후 단계다.

한국어는 조사가 붙으면 토큰이 달라져 기본 FTS5로는 `북마크`로 `북마크를`을 찾지 못한다. 그래서 `trigram` 토크나이저를 쓴다.

- 3글자 이상: FTS5 trigram (부분 문자열 일치)
- 2글자 이하: `LIKE` 스캔 (trigram의 최소 길이 제약)

번역한 글은 번역문과 원문을 함께 색인하므로 한국어로 검색해도 잡힌다. 번역하지 않은 해외 글은 원문 키워드로만 찾을 수 있다.

---

## 운영

```bash
pnpm check              # 플랫폼별 최신 1건을 실제로 다시 긁어 파서 상태 확인
pnpm reparse            # 저장된 스냅샷만으로 전체 재파싱 (네트워크 없음)
pnpm reparse -- 12 15   # 특정 게시글만
pnpm gc                 # 참조되지 않는 미디어 정리 + 사라진 포스터 복구
```

API 키 없이 번역 경로를 확인하려면 목 서버를 띄우고 주소를 바꾼다.

```bash
pnpm mock-llm           # http://127.0.0.1:4141/v1 (/chat/completions, /responses)
MOCK_LLM_REJECT_JSON=1 pnpm mock-llm   # JSON 모드를 거부하는 제공자 흉내
OPENAI_BASE_URL=http://127.0.0.1:4141/v1 OPENAI_API_KEY=test OPENAI_MODEL=mock pnpm dev
```

**`reparse`가 이 구조의 핵심이다.** 파서를 고치거나 플랫폼 마크업이 바뀌면, 이미 저장된 원본 HTML로 다시 파싱한다. 이미 삭제된 글도 살릴 수 있다. 파서 버전은 `source.parser_version`에 남는다.

### 원문 삭제 감지

상세 화면의 `원문 재확인`으로 수동 확인한다. 404/410이면 `deleted`로 표시하고 저장본은 그대로 열람된다. 파싱 실패는 `error`로 분리해 두었다 — 파서가 깨졌을 때 아카이브 전체가 "삭제됨"으로 물드는 사고를 막기 위해서다.

---

## 구조

```
src/lib/adapters/    플랫폼별 fetch/parse (교체 가능한 단일 파일)
src/lib/pipeline.ts  fetch → 스냅샷 → 파싱 → 저장 → 번역 → 색인
src/lib/queue.ts     인프로세스 작업 큐, 재시작 복구 포함
src/lib/media.ts     스트리밍 다운로드, 30MB 상한, 해시 중복 제거, 포스터
src/lib/search.ts    FTS5 + 필터
src/lib/llm.ts       OpenAI 호환 번역·요약 (JSON 모드, 실패 시 수집은 유지)
```

`fetch`와 `parse`를 분리한 이유는 하나다. **원본을 남기지 않으면 파서를 고칠 수 없다.**

---

## 알려진 한계

- **Threads 타래 복원은 휴리스틱이다.** 같은 작성자 + 자기 글에 대한 답글 + 시간 순으로 이어 붙인다. 페이지가 타래 전체를 렌더링하지 않으면 원글만 남는다.
- **Reddit은 IP 차단이 잦다.** 첫 요청이 챌린지 페이지로 오면 쿠키를 받은 뒤 한 번 재시도한다. 계속 실패하면 `reddit_blocked`로 표시하고 저장하지 않는다.
- **X 조회수는 스냅샷 시점 값**이다. 재확인할 때마다 갱신된다.
- **번역은 원문 언어 판별에 의존한다.** 짧은 글은 오판 가능성이 있다.
- **미디어 30MB 상한**은 초과분을 저장하지 않고 `too_large`로 남긴다(원본 링크는 보존).
- **Reddit 영상은 HLS다.** 세그먼트가 한 CMAF 파일의 바이트 범위라 파일 단위로 받아 ffmpeg으로 오디오와 합친다. 이 환경의 정적 ffmpeg 빌드는 네트워크 입력에서 죽기 때문에 다운로드는 Node가 담당한다.
- **단일 사용자 로컬 전용.** 인증이 없다. 외부에 노출하지 말 것.

---

## 다음

- 의미 기반 검색 (임베딩은 `part.text_original` 청킹만 얹으면 된다)
- 로그인 세션으로 북마크 폴링 자동 수집
- 브라우저 공유 시트/익스텐션
- 삭제 감지 스케줄러 (지수 백오프)

---

## 운영 배포

호스트의 다른 서비스(puri, nanuri)와 같은 릴리스 방식이다.

```
/opt/bakje/
  releases/20261025T082710Z/   배포 시점의 소스 스냅샷
  current -> releases/...      지금 실행 중인 릴리스
/var/lib/bakje/         SQLite · 미디어 · 원본 스냅샷 (배포와 무관)
/etc/bakje/
  bakje.env             시크릿·LLM 설정 (0600)
```

- **데이터는 릴리스 밖에 있다.** 배포는 프로그램만 교체하고 `/var/lib/bakje`는 건드리지 않는다.
- **매 배포마다 새 릴리스 디렉터리**를 만들고 `current` 심볼릭 링크를 원자적으로 바꾼다. 이전 빌드 산출물을 재사용하지 않고 이미지를 새로 빌드해 컨테이너를 `--force-recreate`로 갈아끼운다.
- 최근 `ARCHIVE_KEEP_RELEASES`(기본 3)개만 남기고 오래된 릴리스는 지운다. `current`가 가리키는 릴리스는 항상 보존한다.
- 배포는 `flock`으로 중복 실행을 막고, 실패하면 해당 릴리스 디렉터리를 진단용으로 남긴다(자동 롤백 없음).

### 최초 준비 (root)

```bash
sudo ARCHIVE_UID=$(id -u) ARCHIVE_GID=$(id -g) ./scripts/prepare-host.sh
sudo vi /etc/bakje/bakje.env     # OPENAI_API_KEY 입력
```

sudo가 없는 환경(이 호스트)에서는 Docker로 같은 상태를 만든다.

```bash
docker run --rm -v /opt:/opt -v /var/lib:/var/lib -v /etc:/etc alpine sh -c '
  mkdir -p /opt/bakje/releases /var/lib/bakje /etc/bakje
  chown -R 1000:1000 /opt/bakje /var/lib/bakje /etc/bakje'
```

### 배포

```bash
./scripts/deploy.sh
```

Docker 데몬 접근 권한만 있으면 된다(root 불필요). Playwright 이미지에 Chromium과 ffmpeg가 들어 있어 호스트에 별도 설치할 것이 없다. 컨테이너는 `--no-sandbox`로 Chromium을 띄운다(`ARCHIVE_NO_SANDBOX=1`).

### 운영 확인

```bash
docker compose -f /opt/bakje/current/compose.yml ps
docker compose -f /opt/bakje/current/compose.yml logs -f web
curl -s http://127.0.0.1:3020/api/health
```

### 접속

- 호스트 로컬: `http://127.0.0.1:3020`
- tailnet: `https://<기기이름>.<tailnet>.ts.net:8888` (`tailscale serve --bg --https=8888 http://127.0.0.1:3020`)

앱에는 로그인·인증이 없다. 그래서 인터넷에 공개하지 않고 **tailnet 전용**으로만 노출한다. 컨테이너 포트는 `127.0.0.1`에만 바인딩되어 같은 LAN에서도 직접 접근할 수 없고, `tailscale serve`(funnel 아님)로 내 tailnet 기기에서만 HTTPS로 연다. tailnet을 다른 사람과 공유하면 그 사람도 열 수 있으므로, 공유한다면 Tailscale ACL로 이 포트를 막거나 앱에 인증을 붙여야 한다.

### 백업

```bash
tar czf bakje-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /var/lib bakje
```

SQLite는 WAL 모드이므로 서비스 중 백업하려면 `sqlite3 /var/lib/bakje/archive.db ".backup /tmp/archive.db"`를 쓰고 미디어 디렉터리를 함께 복사한다.

### 릴리스 정리

```bash
./scripts/prune-releases.sh --keep 2
```
