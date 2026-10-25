---
type: Index
title: "Post Archive Wiki"
description: "개인 게시글 아카이빙 서비스의 기획·구현·운영 지식베이스"
scope: "."
okf_version: "0.1"
---

# Post Archive Wiki

X, Threads, Reddit 게시글을 링크 하나로 내 디스크에 복제하고 한국어로 다시 찾는 개인 아카이빙 도구.

## 현재 상태 (2026-10-25)

- MVP 구현 완료: 3개 플랫폼 수집, 작성자 이어쓰기 사슬, 미디어 로컬 복제, 한국어 키워드 검색, 번역·요약 파이프라인.
- 운영 배포 완료: `/opt/post-archive` 릴리스 + Docker Compose, 데이터는 `/var/lib/post-archive`.
- UI 개편 배포 완료(릴리스 `20261025T114214Z`): 수집을 가운데 탭과 "붙여넣고 저장" 버튼으로 올리고, 터미널풍 장식을 걷어내 읽기 중심으로 바꿨다. 지원하지 않는 링크는 `/api/ingest`에서 거절한다. → [결정 010](./decisions/010-capture-first-ui.md)
- 번역은 실제 API 키로 검증하지 않았다. 목 서버로 배관만 확인했고 운영 환경은 키가 비어 있어 번역을 건너뛴다.

## 문서 지도

- [concepts/index.md](./concepts/index.md) — 제품 범위, 수집 규칙, 데이터 모델, 검색, 미디어, 번역, UI, 운영
- [decisions/index.md](./decisions/index.md) — 되돌리기 어려운 선택과 근거
- [references/index.md](./references/index.md) — 플랫폼 수집 경로와 디자인 레퍼런스
- [logs/index.md](./logs/index.md) — 변경 이력

## 다음 단계

- 수집 안정화: 서버 재시도·자동 재개, 브라우저 오프라인 대기열, 오프라인 수집 화면(서비스 워커)을 구현했다. 운영 배포와 iPhone 실기기 검증이 남았다. → [결정 011](./decisions/011-resilient-capture-queue.md)
- iOS 단축어로 공유 시트에서 바로 수집: 단축어가 받은 URL을 `/api/ingest`로 보낸다. 운영 서버 접근 경로와 인증 방식을 먼저 정해야 한다.
- 실기기(iPhone) UI 검증: 클립보드 확인 말풍선, 노치·홈 인디케이터 영역, 이미지 뷰어 제스처.
- 의미 기반 검색(임베딩): `part.text_original` 청킹으로 붙일 수 있게 텍스트를 보존 중이다.
- 로그인 세션 기반 북마크 폴링 수집: X는 SSR 경로가 막힐 때의 대안이 된다.
- Threads 다단 타래 실물 검증, Reddit 차단 빈도 완화.
