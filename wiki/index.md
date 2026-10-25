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
- 번역은 실제 API 키로 검증하지 않았다. 목 서버로 배관만 확인했고 운영 환경은 키가 비어 있어 번역을 건너뛴다.

## 문서 지도

- [concepts/index.md](./concepts/index.md) — 제품 범위, 수집 규칙, 데이터 모델, 검색, 미디어, 번역, UI, 운영
- [decisions/index.md](./decisions/index.md) — 되돌리기 어려운 선택과 근거
- [references/index.md](./references/index.md) — 플랫폼 수집 경로와 디자인 레퍼런스
- [logs/index.md](./logs/index.md) — 변경 이력

## 다음 단계

- 의미 기반 검색(임베딩): `part.text_original` 청킹으로 붙일 수 있게 텍스트를 보존 중이다.
- 로그인 세션 기반 북마크 폴링 수집: X는 SSR 경로가 막힐 때의 대안이 된다.
- Threads 다단 타래 실물 검증, Reddit 차단 빈도 완화.
