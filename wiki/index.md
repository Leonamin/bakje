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

- MVP 구현 완료: 3개 플랫폼 수집, 작성자 이어쓰기 사슬, 미디어 로컬 복제, 한국어 키워드 검색.
- 운영 배포: `/opt/bakje` 릴리스 + Docker Compose, 데이터는 `/var/lib/bakje`, tailnet `https://<기기이름>.<tailnet>.ts.net:8888`. 최신 릴리스 `20261025T122749Z`.
- 수집 우선 UI, 수집 작업 재시도·오프라인 대기열·서비스 워커. → [결정 010](./decisions/010-capture-first-ui.md), [결정 011](./decisions/011-resilient-capture-queue.md)
- 요청형 번역과 LLM 설정 화면 `/settings`. 운영에는 아직 키가 없어 번역을 쓸 수 없다. → [결정 013](./decisions/013-on-demand-translation-and-llm-settings.md)
- 바텀 시트 애니메이션·끌어내려 닫기, 이미지 뷰어 쓸어 닫기. → [UI 시스템](./concepts/ui-system.md)
- iOS 단축어 수집용 API 입력 확장과 도움말 `/help/shortcut`. → [iOS 단축어 수집](./concepts/ios-shortcut.md)

## 문서 지도

- [concepts/index.md](./concepts/index.md) — 제품 범위, 수집 규칙, 데이터 모델, 검색, 미디어, 번역, UI, 운영
- [decisions/index.md](./decisions/index.md) — 되돌리기 어려운 선택과 근거
- [references/index.md](./references/index.md) — 플랫폼 수집 경로와 디자인 레퍼런스
- [logs/index.md](./logs/index.md) — 변경 이력

## 다음 단계

- `/settings`에 실제 키를 넣고 연결 테스트 → 번역 품질 확인. OpenCode Go 프리셋은 실제 키로 검증 전이다.
- iPhone 실기기 검증: 단축어(동작 이름·허용 창·공유 메뉴 이름), 시트 끌기 감각(닫힘 기준값), 이미지 뷰어 쓸어 닫기, 클립보드 확인 말풍선, 노치·홈 인디케이터, 홈 화면 앱 오프라인 수집.
- 단축어 iCloud 공유 링크와 실제 캡처를 받아 도움말 페이지 그림 교체.
- 이미 번역된 글의 "다시 번역" 버튼(필요해지면).
- 의미 기반 검색(임베딩): `part.text_original` 청킹으로 붙일 수 있게 텍스트를 보존 중이다.
- 로그인 세션 기반 북마크 폴링 수집: X는 SSR 경로가 막힐 때의 대안이 된다.
- Threads 다단 타래 실물 검증, Reddit 차단 빈도 완화.

범위에서 뺀 것: 원문 삭제 감지. → [제품 범위](./concepts/product-scope.md)
