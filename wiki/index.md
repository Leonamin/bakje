---
type: Index
title: "박제 Wiki"
description: "개인 게시글 아카이빙 서비스의 기획·구현·운영 지식베이스"
scope: "."
okf_version: "0.1"
---

# 박제 Wiki

X, Threads, Reddit 게시글을 링크 하나로 내 디스크에 복제하고 한국어로 다시 찾는 개인 아카이빙 도구. 서비스 이름은 **박제**이고, 패키지·폴더·운영 경로·식별자는 모두 `bakje`다. → [결정 012](./decisions/012-service-name-bakje.md)

## 현재 상태 (2026-10-25)

- MVP 구현 완료: 3개 플랫폼 수집, 작성자 이어쓰기 사슬, 미디어 로컬 복제, 한국어 키워드 검색, 번역·요약 파이프라인.
- 운영 배포 완료: `/opt/bakje` 릴리스 + Docker Compose, 데이터는 `/var/lib/bakje`.
- UI 개편 배포 완료(릴리스 `20261025T114214Z`): 수집을 가운데 탭과 "붙여넣고 저장" 버튼으로 올리고, 터미널풍 장식을 걷어내 읽기 중심으로 바꿨다. 지원하지 않는 링크는 `/api/ingest`에서 거절한다. → [결정 010](./decisions/010-capture-first-ui.md)
- 번역은 실제 API 키로 검증하지 않았다. 목 서버로 배관만 확인했고 운영 환경은 키가 비어 있어 번역을 건너뛴다.

## 문서 지도

- [concepts/index.md](./concepts/index.md) — 제품 범위, 수집 규칙, 데이터 모델, 검색, 미디어, 번역, UI, 운영
- [decisions/index.md](./decisions/index.md) — 되돌리기 어려운 선택과 근거
- [references/index.md](./references/index.md) — 플랫폼 수집 경로와 디자인 레퍼런스
- [logs/index.md](./logs/index.md) — 변경 이력

## 다음 단계

진행 중(2026-10-25 착수, 세 갈래 동시 진행) → [계획 로그](./logs/2026-10-25-next-work-plan.md)

1. 요청형 번역과 LLM 설정 페이지: "번역하기"를 누를 때만 번역하고, 한국어 우선·원문 보기 토글, 제공자·모델·키 설정 화면. → [결정 013](./decisions/013-on-demand-translation-and-llm-settings.md)
2. 바텀 시트와 모바일 인터랙션: 진입·퇴장 애니메이션, 끌어내려 닫기(시트·이미지 뷰어), 누름 피드백.
3. iOS 단축어 수집과 도움말 페이지: 공유 시트 → `/api/ingest`, 접근은 tailnet으로 제한, 단계별 그림 설명.

남은 과제:

- 수집 안정화는 운영 배포(릴리스 `20261025T115726Z`)까지 마쳤다. iPhone 실기기 검증이 남았다. → [결정 011](./decisions/011-resilient-capture-queue.md)
- 실기기(iPhone) UI 검증: 클립보드 확인 말풍선, 노치·홈 인디케이터 영역, 이미지 뷰어 제스처.
- 의미 기반 검색(임베딩): `part.text_original` 청킹으로 붙일 수 있게 텍스트를 보존 중이다.
- 로그인 세션 기반 북마크 폴링 수집: X는 SSR 경로가 막힐 때의 대안이 된다.
- Threads 다단 타래 실물 검증, Reddit 차단 빈도 완화.
