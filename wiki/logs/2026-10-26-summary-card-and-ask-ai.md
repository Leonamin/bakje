---
type: Log
title: "Summary Card and Ask AI"
description: "요약카드 상시 표시·접기와 AI 질문 프롬프트 복사 기능 추가"
timestamp: 2026-10-26
okf_version: "0.1"
---

# Summary Card and Ask AI

- 요약카드: 요약이 있으면 원문 보기에서도 표시한다(이전에는 번역을 볼 때만 보였다). 접기·펼치기를 넣었고 상태는 전체 공통으로 `localStorage`에 저장한다.
- AI에게 질문: 번역 줄 옆 버튼이 제목·작성자·URL·요약·본문을 묶은 프롬프트를 복사한다. 템플릿은 코드에 고정하되 `src/lib/ask-prompt.ts`에 모아 나중에 설정으로 분리하기 쉽게 했다.
- 결정: 접힘 상태는 글별이 아닌 전체 공통. 챗 서비스 `?q=` 링크는 URL 길이 때문에 보류.
- 확인: 타입체크와 `lint:ui` 통과. 브라우저·실기기 동작과 배포는 미검증.

- 추가: logs/2026-10-26-summary-card-and-ask-ai.md
- 갱신: concepts/translation.md, concepts/ui-system.md, concepts/index.md, logs/index.md
