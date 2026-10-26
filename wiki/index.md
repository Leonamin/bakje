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
- 운영 배포: `/opt/bakje` 릴리스 + Docker Compose, 데이터는 `/var/lib/bakje`, tailnet `https://<기기이름>.<tailnet>.ts.net:8888`. 최신 릴리스 `20261025T154002Z`.
- 수집 우선 UI, 수집 작업 재시도·오프라인 대기열·서비스 워커. → [결정 010](./decisions/010-capture-first-ui.md), [결정 011](./decisions/011-resilient-capture-queue.md)
- 요청형 번역과 LLM 설정 화면 `/settings`. 실제 키로 번역을 실사용해 확인했다(2026-10-26). → [결정 013](./decisions/013-on-demand-translation-and-llm-settings.md)
- 바텀 시트 애니메이션·끌어내려 닫기, 이미지 뷰어 쓸어 닫기. → [UI 시스템](./concepts/ui-system.md)
- iOS 단축어 수집용 API 입력 확장과 도움말 `/help/shortcut`(iOS 27 실기기 캡처, 동작 확인). → [iOS 단축어 수집](./concepts/ios-shortcut.md)
- 이미 저장된 링크를 다시 붙여넣으면 수집 화면에서 다시 가져오기를 승인·거부한다. → [수집 작업 큐](./concepts/capture-queue.md)
- 패키지 매니저는 pnpm(`pnpm-lock.yaml`, `pnpm-workspace.yaml`의 `allowBuilds`). npm 락 파일은 쓰지 않는다.
- 라이브러리·수집 머리글의 새로고침 버튼(홈 화면 웹앱용). → [UI 시스템](./concepts/ui-system.md)

## 문서 지도

- [concepts/index.md](./concepts/index.md) — 제품 범위, 수집 규칙, 데이터 모델, 검색, 미디어, 번역, UI, 운영
- [decisions/index.md](./decisions/index.md) — 되돌리기 어려운 선택과 근거
- [references/index.md](./references/index.md) — 플랫폼 수집 경로와 디자인 레퍼런스
- [logs/index.md](./logs/index.md) — 변경 이력

## 다음 단계

- 의미 기반 검색(임베딩): 글·이미지 임베딩과 하이브리드 검색 구현 완료, 운영 배포 전. → [결정 014](./decisions/014-semantic-search-embedder-sidecar.md). 남은 일: 배포, 영상 여러 프레임 임베딩, 임계값 조정. 아래는 사전 실험 기록이다.
   이 PC(CPU 16코어, 램 26GB, NVIDIA GPU 없음)에서 `google/embeddinggemma-2`(텍스트 백본 270M, 768차원·MRL 256까지, 입력 8192토큰, Apache 2.0)를 CPU로 돌려 하이브리드(키워드+벡터) 검색을 붙이는 안을 실험 중이다. 2026-10-26 실험: 운영 DB 20건(한·영·일·중 혼합)에 한국어 질의 10개를 던져 top1 10/10 적중, 임베딩은 CPU fp32로 문서당 약 1.6초(2000자 잘라 256차원, 워밍업 포함). 표본이 작아 일반화는 미검증, ONNX/Node 실행 가능 여부도 미검증. 실행에는 `sentence-transformers`+`pillow`+`torchvision`가 필요했다. `part.text_original` 청킹으로 붙일 수 있게 텍스트를 보존 중이다.
- 단축어 iCloud 공유 링크를 `/help/shortcut` 페이지에 반영하고, 도움말 7~8단계 그림(아직 SVG)을 실기기 캡처로 바꾸기.
- Threads 다단 타래 실물 검증, Reddit 차단 빈도 완화.

완료 확인(2026-10-26, 사용자): 번역 실사용(키 입력·품질), iPhone 실기기 검증 전반, 단축어 iCloud 공유 링크 생성.

보류: 이미 번역된 글의 "다시 번역" 버튼(다시 번역할 일이 드물다), 로그인 세션 기반 북마크 폴링 수집.

범위에서 뺀 것: 원문 삭제 감지. → [제품 범위](./concepts/product-scope.md)
