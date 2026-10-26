---
type: Log
title: "X Age-Restricted Cookie"
description: "연령 제한 X 게시글이 파싱되지 않던 원인 규명과 전용 계정 쿠키 수집 구현"
timestamp: 2026-10-26
okf_version: "0.1"
---

# X Age-Restricted Cookie

X 게시글 3건이 파싱되지 않던 문제를 조사하고 고쳤다. → [결정 017](../decisions/017-x-age-restricted-cookie.md)

- 원인: 연령 제한 게시글. 로그아웃 응답은 200이지만 본문 대신 `BlurredMediaTombstone`이고 syndication도 같다. 파서 버그나 X 구조 변경이 아니다. 3건 모두 같은 원인임을 확인했다.
- 1차 수정(커밋 `2ddffd1`): `isAgeRestricted`로 사유를 구분해 "연령 제한 게시글" 안내를 낸다.
- 2차 수정(커밋 `d197f48`): 설정 화면에 `auth_token`·`ct0` 입력과 "쿠키 확인", 연령 제한일 때만 Playwright 로그인 경로로 수집. 실험으로 `TweetDetail` 응답이 로그아웃 응답과 같은 구조임을 확인했다.
- 시행착오: `!` 명령은 키 입력을 받지 못해 `read -s`가 빈 값을 저장했다(파일 17바이트로 발견). 별도 터미널에서 다시 저장했다.
- 시행착오: 무효한 쿠키는 로그인 화면이 아니라 로그아웃 화면으로 이어져 처음에는 "알 수 없음"으로 나왔다. 계정 메뉴 유무로 만료를 판단하도록 고쳤다.
- 확인: 임시 DB로 쿠키 없음·올바른 쿠키(3건 성공)·잘못된 쿠키(만료 안내)와 쿠키 확인 버튼(ok/expired)을 확인했다. 릴리스 `20261026T072114Z`.
- 미검증: 잠금·정지 판별, 운영 컨테이너 안 Chromium 실행, 운영 설정 화면에서의 실제 등록, Article 본문.

- 추가: decisions/017-x-age-restricted-cookie.md, logs/2026-10-26-x-age-restricted-cookie.md
- 갱신: decisions/index.md, decisions/004-x-logged-out-ssr.md, concepts/platform-adapters.md, index.md, logs/index.md
