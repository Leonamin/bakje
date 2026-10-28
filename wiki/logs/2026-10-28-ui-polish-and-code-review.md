---
type: Log
title: "라이브러리 UI 개선과 통합 라이브러리 코드 리뷰"
description: "선택 모드·필터 툴바·로딩 표시 개선, 리뷰에서 나온 검색 쓰기 실패와 폴더 연결 범위 문제 수정, 배포 5회"
timestamp: 2026-10-28
okf_version: "0.1"
---

# 라이브러리 UI 개선과 통합 라이브러리 코드 리뷰

운영 화면을 캡처해 문제를 찾고, 공동 작업자 표기가 없던 통합 라이브러리 커밋 5개(`dfa2322`~`0f05b11`)를 리뷰했다. PR #2~#4로 `main`에 합치고 web만 5번 배포했다.

## UI

- 필터 드롭다운 4개가 모바일 화면의 3분의 1을 차지하던 문제를 접이식 "필터"로 해결했다. 이후 범위 칩 줄 끝의 공용 `Chip` 토글로 옮겼다.
- 선택 모드: 카드 어디를 눌러도 선택, 썸네일 왼쪽 위 체크 원(Immich 방식), sticky 툴바(PC는 내비 아래 16px 띄움), `ConfirmDialog` 확인, 쪽 이동 중 선택 유지(최대 100개), 선택 아이콘을 셔플 옆으로 이동.
- 확인 창의 구분선 두 줄 겹침 수정(본문이 없으면 본문 영역을 그리지 않음), 눌린 아이콘 버튼 강조, `chip`을 공용 `Chip` 컴포넌트로 통일.
- 검색·셔플·쪽 이동의 로딩 표시: 상단 진행 막대, 목록 흐림, 스피너. 0.3초 이상일 때만 보인다.

## 코드 리뷰에서 고친 것

- **major**: 의미 검색이 `iterate()` 중 `await`로 양보해 다른 쓰기가 `database connection is busy`로 실패 → 동기 순회로 수정. 연결 폴더를 임의 경로로 열 수 있던 문제 → 허용 루트 제한([결정 018](../decisions/018-linked-root-allowlist.md)). 상세 페이지마다 전체 벡터를 비교하던 연관 자료 → 10분 캐시.
- **minor**: 합치고 남은 빈 자료의 일괄 숨김 해제 차단, 휴지통 자료 수정 거절, 검색 결과 id 전달을 `json_each`로 변경, `/search?debug=1` 유사도 복구.
- 원본 정리의 적용·되돌림 코드는 덮어쓰기 금지·해시 검증·재개 가능 구조로 결함을 찾지 못했다.
- 선택 모드에서 필터가 바뀌면 화면에 없는 자료까지 숨김·삭제되던 문제를 같이 고쳤다.

## 검증과 남은 위험

- 임시 데이터 130건으로 쪽 이동 유지·100개 상한·sticky 위치(390·820·1280px)·로딩 표시(이동 요청 1.5초 지연)를 확인했다. `tsc`, `lint:ui`, `test:trash`, `test:library`, `test:library-management`, 새 `test:review-fixes` 통과.
- **미검증**: 검색 중 쓰기 실패 수정의 운영 확인(로그의 `busy` 지켜보기), 실제 터치 기기, 3쪽 이상 연속 이동, `check:library`(실제 OpenNana 폴더 인자 필요). MCP 토큰 읽기·쓰기 분리는 후속 과제다.
- 이전에 `window.confirm`으로 묻던 삭제 확인과, 위키의 `/`·`/search` 화면 설명이 구현과 어긋나 있어 코드를 기준으로 고쳤다.

- 추가: `decisions/018-linked-root-allowlist.md`, `logs/2026-10-28-ui-polish-and-code-review.md`.
- 갱신: `concepts/ui-system.md`, `concepts/operations.md`, `concepts/data-model.md`, `concepts/unified-library.md`, `references/design-references.md`, `decisions/index.md`, `index.md`, `logs/index.md`.
