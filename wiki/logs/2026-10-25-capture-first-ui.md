---
type: Log
title: "수집 우선 UI 개편과 재배포"
description: "피드백 기반 전면 UI 개편, 수집 API 입력 검증, 운영 재배포와 위키 반영"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 수집 우선 UI 개편과 재배포

사용자 피드백(수집 진입이 어렵다, 글자가 작다, 불필요한 정보가 많다, 이어쓰기 원문 링크가 안 보인다, 모바일 이미지 뷰어가 조밀하다, 검색 썸네일이 작다)을 바탕으로 UI를 개편했다. 구현 전에 현재 화면 캡처와 HTML After 시안으로 Before/After를 비교해 방향을 합의했다.

## 구현 (커밋 `c6685b4`)

- Pretendard Variable을 `next/font/local`로 서빙하고 글자 크기를 11 · 12 · 14 · 16 · 20 · 24px로 통일
- 하단 탭을 라이브러리 · 수집 · 검색으로 바꾸고 수집을 가운데 원형 버튼으로 배치
- 수집 화면 하단에 `[직접 입력] [붙여넣고 저장]` 고정
- `/api/ingest`가 지원하지 않는 링크를 작업으로 만들지 않고 거절
- 상세 화면: 하단 액션 바, 파트 인덱스 바, 이어쓰기 카드 분리, 600자 초과 파트 접기
- 모바일 이미지 뷰어 단순화, 글자 기호를 Lucide 아이콘으로 교체
- 검색 결과 썸네일 16:9 확대, 미디어 없는 카드는 본문 7줄
- 통계 줄·모노 라벨·격자 배경·안내 박스 제거, 토스트를 상단으로 이동
- 데스크톱 정리 패널의 저장 버튼 누락 수정

검증 과정에서 하단 토스트가 저장 버튼을 가리는 문제와, 모달 배경 규칙이 이미지 뷰어에 걸리는 문제를 찾아 함께 고쳤다.

## 배포

`./scripts/deploy.sh`로 릴리스 `20261025T114214Z`를 배포했다. 컨테이너 healthy, 주요 화면 200, 폰트 파일 서빙, 지원하지 않는 링크 거절(400)을 운영 포트에서 확인했다. 직전 릴리스 `20261025T082710Z`는 보존 개수 정책에 따라 정리됐다.

## 위키

- 추가: decisions/010-capture-first-ui.md, logs/2026-10-25-capture-first-ui.md
- 갱신: concepts/ui-system.md, concepts/platform-adapters.md, concepts/index.md, references/design-references.md, decisions/index.md, logs/index.md, index.md
