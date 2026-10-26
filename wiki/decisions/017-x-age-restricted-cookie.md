---
type: Decision
title: "017. 연령 제한 X 게시글은 전용 계정 쿠키로만 가져온다"
description: "로그아웃 수집이 막히는 연령 제한 게시글에 한해 전용 계정의 auth_token·ct0 쿠키로 Playwright를 열어 TweetDetail을 가로챈다"
tags: [x, auth, cookie, playwright, settings]
timestamp: 2026-10-26
---

# 017. 연령 제한 X 게시글은 전용 계정 쿠키로만 가져온다

## Context

X 게시글 3건(`rei_aitech`, `Rooolls_Royce_`, `wolfbeauty_ai`)이 "파싱하지 못했습니다. 비공개이거나 삭제되었을 수 있습니다."로 실패했다. 원인은 파서가 아니라 **연령 제한(성인 콘텐츠)**이다. 로그아웃 상태의 `x.com/i/status/<id>`는 HTTP 200과 정상 JSON을 주지만 본문 대신 `TweetTombstone`(`BlurredMediaTombstone`)을 담고, 대체 경로인 syndication도 같은 tombstone을 준다. `parseX`는 `nodes.get(nativeId)`에서 null을 낸다. → [결정 004](./004-x-logged-out-ssr.md)의 로그아웃 수집으로는 구조상 가져올 수 없다.

## Decision

1. **실패 사유를 먼저 구분한다.** `isAgeRestricted(payload)`가 `BlurredMediaTombstone`을 찾으면 일반 오류 대신 연령 제한 안내를 낸다. 이 경우 syndication 폴백은 건너뛴다.
2. **연령 제한 게시글에서만 쿠키를 쓴다.** 일반 게시글은 계속 로그아웃으로 가져와 계정 제재 위험과 요청 수를 줄인다.
3. **쿠키 2개를 설정 화면에 등록한다.** 전용 계정의 `auth_token`(로그인 상태)과 `ct0`(CSRF). DB `setting` 테이블의 `x.auth_token`, `x.ct0`에 저장하고 API로 다시 내보내지 않는다. 화면에는 `auth_token` 끝 4자리만 보인다. 전용 계정은 "민감한 콘텐츠 표시"를 켜야 한다.
4. **가져오는 방법은 Playwright다.** 쿠키를 넣은 컨텍스트로 `x.com/i/status/<id>`를 열고 페이지가 부르는 `TweetDetail` 응답을 가로챈다. 구조가 로그아웃 응답과 같아 `parseX`를 그대로 쓴다. 내부 GraphQL을 직접 부르는 방법은 요청 식별자가 자주 바뀌어 택하지 않았다. 로그인 상태의 HTML에는 SSR 페이로드가 없다고 가정했고 확인하지 않았다.
5. **실패 사유를 구분해 보여준다.** 만료·무효, 잠금, 정지, 알 수 없음. 쿠키가 무효하면 X가 로그인 화면이 아니라 로그아웃 화면으로 보내므로, 계정 메뉴(`SideNav_AccountSwitcher_Button`)가 없으면 만료로 판단한다.
6. **`ct0` 갱신을 보관한다.** 응답이 새 `ct0`를 주면 저장한다. 설정 화면의 "쿠키 확인"은 `x.com/home`이 열리는지만 본다.

자동 로그인(ID·비밀번호·2FA)은 만들지 않았다. 캡차·이메일 인증에 걸리기 쉽고 제재 위험이 가장 크다.

## Consequences

- 연령 제한 게시글 3건이 모두 수집되고(본문, 이어지는 글, 미디어) 로컬에서 확인했다. 쿠키 없음·잘못된 쿠키·올바른 쿠키 세 상태의 안내 문구도 확인했다.
- 계정 정지는 **미리 알 수 없다.** 실패한 시점에 사유를 구분해 보여주는 것까지만 가능하다. 주기 점검은 요청이 늘어 제재 위험을 키우므로 넣지 않았다.
- `auth_token` 만료는 대략 1년으로 알고 있으나 미검증이다. 만료되면 설정에서 다시 넣는다. 쿠키 자동 입력은 불가능하다(쿠키가 브라우저 안에 있다).
- 로그인 경로는 Article 본문을 따로 가져오지 않는다. Article이 있는 연령 제한 게시글은 본문이 빠질 수 있다.
- 잠금·정지 판별(URL과 화면 문구)은 실제 잠긴 계정으로 시험하지 못했다. 가정이다.
- 운영 서버 컨테이너 안의 Chromium으로 로그인 경로를 돌려보는 것은 미검증이다. Reddit 수집이 같은 브라우저를 쓴다.
- 자동화된 스크래핑이 X 약관에 어긋날 수 있다. 본 계정은 쓰지 않고 전용 계정만 쓴다.

## Status

Accepted
