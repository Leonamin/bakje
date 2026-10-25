---
type: Log
title: "다음 작업 3갈래 계획"
description: "요청형 번역·LLM 설정, 바텀 시트·모바일 인터랙션, iOS 단축어·도움말 페이지 착수와 삭제 감지 제외"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 다음 작업 3갈래 계획

구현·미구현 항목을 정리한 뒤 사용자와 다음 작업을 정했다. 세 갈래를 각각 별도 작업 브랜치(worktree)에서 동시에 진행한다.

1. **요청형 번역과 LLM 설정 페이지** → [결정 013](../decisions/013-on-demand-translation-and-llm-settings.md)
   - 번역은 "번역하기"를 누를 때만 만들고, 번역이 있으면 한국어를 먼저 보여주며 제목과 본문 사이에 "원문 보기"를 둔다. 실패하면 같은 자리에서 다시 시도한다.
   - 제공자 프리셋, 모델 ID, 쓰기 전용 키, Chat Completions·Responses 선택, 연결 테스트, JSON 모드 폴백.
2. **바텀 시트와 모바일 인터랙션**
   - Goodcase `Drawer`에는 진입·퇴장 애니메이션과 드래그가 없다(`overlays.css`의 `.gc-drawer`에 keyframes 없음). `Drawer` 한 곳을 고쳐 필터·정리·직접 입력 시트 전체에 적용한다.
   - 끌어내려 닫기(거리·속도 기준), 이미지 뷰어 끌어내려 닫기, 누름 피드백, `prefers-reduced-motion` 대응. 새 라이브러리는 쓰지 않는다.
   - Before/After 시안으로 범위를 맞춘 뒤 적용한다.
3. **iOS 단축어 수집과 도움말 페이지**
   - 공유 시트의 단축어가 URL을 `/api/ingest`로 보낸다. 접근은 지금처럼 tailnet으로 제한한다.
   - 단계별 그림과 설명이 있는 도움말 페이지를 함께 만든다. 실제 iOS 화면 캡처는 사용자가 제공해야 하며, 없으면 그림으로 대신한다.

범위에서 뺀 것: **원문 삭제 감지 스케줄러.** 아카이빙 이후 원글이 삭제됐는지는 추적하지 않는다.

함께 고친 위키 불일치:

- 루트 인덱스는 수집 큐의 운영 배포가 남았다고 적었지만, 이미 릴리스 `20261025T115726Z`로 배포됐다.
- 결정 012의 description이 "운영 경로·식별자는 이전 이름 유지"였지만, 본문대로 운영 경로까지 옮겼다.

- 추가: decisions/013-on-demand-translation-and-llm-settings.md, logs/2026-10-25-next-work-plan.md
- 갱신: index.md, decisions/index.md, decisions/012-service-name-bakje.md, concepts/product-scope.md, concepts/translation.md, logs/index.md
