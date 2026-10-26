---
type: Concept
title: "플랫폼 어댑터"
description: "X·Threads·Reddit에서 게시글을 가져오는 실제 경로와 실패 모드"
tags: [adapter, x, threads, reddit, parsing]
timestamp: 2026-10-25
---

# 플랫폼 어댑터

`src/lib/adapters/`에 플랫폼별 fetch/parse를 한 파일씩 격리했다. 파서가 깨져도 다른 플랫폼과 저장된 데이터는 영향을 받지 않는다.

## X — 로그인 없이 SSR 페이로드

`x.com/i/status/<id>`를 일반 브라우저 UA로 요청하면 응답 HTML의 스트리밍 스크립트에 **TweetDetail GraphQL 응답이 JSON 문자열로 들어 있다**. 이걸 꺼내 파싱한다.

- 얻는 것: 본문(long note_tweet 포함), 작성자, 답글 타래, 부모, 인용, 좋아요·조회수, 미디어 variants
- 없는 것: 없음에 가깝다. 로그인·API 키·브라우저가 모두 불필요하다.
- 폴백: 페이로드가 없으면 `cdn.syndication.twimg.com/tweet-result`로 단일 글만 저장하고 `partial`로 표시한다.
- **Article(장문 뷰어)**: TweetDetail에는 제목·미리보기뿐이다. 본문은 *그 Article 트윗 자신의 페이지* SSR 스크립트의 `articleDocument.contentKey`(블록 목록 `[id, type, text]`)와 `highlights`(코드 블록)에 있다. 인용된 Article이면 그 트윗 페이지를 한 번 더 가져온다(`pipeline.ts`). 인라인 이미지·표지는 저장하지 않는다. 헤드리스 브라우저로는 x.com이 빈 페이지를 주므로 fetch로만 가져온다.
- **연령 제한 게시글**: 로그아웃에서는 본문 대신 `BlurredMediaTombstone`이 와서 가져올 수 없다. 설정 화면에 등록한 전용 계정의 `auth_token`·`ct0`로 Playwright를 열어 `TweetDetail` 응답을 가로채 `parseX`로 파싱한다(`src/lib/x-auth.ts`). 쿠키가 없거나 만료·잠금·정지면 사유를 구분해 안내한다. 이 경로는 Article 본문을 가져오지 않는다. → [결정 017](../decisions/017-x-age-restricted-cookie.md)
- 리스크: X가 SSR 구조를 바꾸면 즉시 깨진다. → [결정 004](../decisions/004-x-logged-out-ssr.md)

## Threads — 하이드레이션 후 Relay JSON

`threads.com/t/<code>`를 Playwright로 열고, 페이지의 `<script type="application/json">` 블록들에서 `code` + `caption`을 가진 post 객체를 모은다.

- 공유 링크(`/share/...`)는 브라우저 내비게이션으로 해소한다(fetch는 JS 리다이렉트라 실패).
- 미디어는 `image_versions2.candidates` 최대 해상도, 영상은 `video_versions`.
- **장문 글**: `caption`은 앞부분만 담고, 전문은 `text_post_app_info.snippet_attachment_info.text_fragments.fragments[].plaintext`에 있다. 별도 뷰어 요청은 필요 없다.
- 한계: 타래 복원 휴리스틱. 링크 프리뷰(OG 카드)는 미디어로 저장하지 않는다.

## Reddit — 브라우저 DOM 추출

`/r/<sub>/comments/<id>`를 Playwright로 열고 페이지 안에서 DOM을 읽어 구조화된 객체를 반환한다. `shreddit-post` 속성(제목·작성자·점수·타임스탬프·permalink), `[slot=text-body]`의 블록 요소, `shreddit-comment`를 사용한다.

- `.json` 엔드포인트는 현재 403이다. 브라우저 쿠키로도 막힌다.
- 첫 요청이 챌린지 페이지면 쿠키를 받은 뒤 최대 2회 재시도한다.
- 실패 시 `reddit_blocked`로 표시하고 저장하지 않는다. 파서 오류와 구분하기 위해서다.

## 입력 단계 거절

`/api/ingest`는 작업을 만들기 전에 각 링크를 `parseUrl`(`src/lib/canonical.ts`)로 검사한다. X·Threads·Reddit의 게시글 패턴(공유·단축 링크 포함)에 맞지 않으면 작업을 만들지 않는다.

| 입력 | 응답 |
|---|---|
| 빈 목록 | 400 `URL을 입력해주세요.` |
| 전부 지원하지 않는 링크 | 400 `error` + `rejected` 목록 |
| 일부만 지원 | 200 `jobs`(지원하는 링크) + `rejected` 목록 |

본문은 JSON `{urls}`·`{url}`·`{text}`와 일반 텍스트를 받고, 글에 섞인 링크를 골라낸다. 응답에는 한국어 `message`가 붙고, `?format=text`면 메시지만 항상 200으로 돌려준다. → [iOS 단축어 수집](./ios-shortcut.md)

패턴은 맞지만 실제 게시글을 찾지 못하는 경우(예: Threads 공유 링크 해소 실패)는 작업으로 들어간다. 입구 검사는 형식만 보고, 이런 실패는 [수집 작업 큐](./capture-queue.md)가 간격을 두고 최대 5회 재시도한다.

## 공통 원칙

1. **fetch와 parse를 분리**하고 원본을 저장한다.
2. 파싱 실패는 `error`, 원문 소실은 `deleted`, 부분 수집은 `partial`로 구분한다.
3. 어댑터 실패가 저장 자체를 실패시키지 않는다. X는 syndication, Threads는 og 메타로 격하한다.

## 검증 상태

- 2026-10-25 실제 URL 3건으로 수집 성공: X(본문+이어쓰기+이미지 4), Threads(본문), Reddit(본문+미디어 4).
- Reddit은 같은 날 반복 요청 중 차단이 여러 번 발생했다. 로컬 IP에서는 대체로 통과한다.
- Threads 다단 타래는 실물 검증 전이다.
- Threads 장문 첨부(1470자)와 X Article(인용된 글, 약 2.4만 자)은 파서 단위로 확인했다. 서버 재수집은 미검증이다. → [로그](../logs/2026-10-25-long-form-capture.md)
