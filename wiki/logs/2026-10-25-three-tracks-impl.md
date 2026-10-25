---
type: Log
title: "요청형 번역·바텀 시트·iOS 단축어 구현과 배포"
description: "세 갈래 작업을 worktree에서 병렬 구현, master 병합, 릴리스 20261025T122749Z 배포"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 요청형 번역·바텀 시트·iOS 단축어 구현과 배포

[계획 로그](./2026-10-25-next-work-plan.md)의 세 갈래를 각각 worktree 브랜치에서 구현해 master에 병합했다. 충돌은 없었다. `tsc`와 `next build`를 통과한 뒤 릴리스 `20261025T122749Z`로 배포했다.

1. **요청형 번역과 LLM 설정** (커밋 `33b0abb`): 수집 시 자동 번역 중단, `POST /api/sources/[id]/translate`, 제목 아래 번역하기·원문 보기·다시 시도, `/settings`(프리셋·쓰기 전용 키·연결 테스트), Chat Completions·Responses 지원과 JSON 모드 폴백. 결정 013을 Accepted로 바꿨다. → [결정 013](../decisions/013-on-demand-translation-and-llm-settings.md)
2. **바텀 시트와 모바일 인터랙션** (커밋 `3adae35`): 시트·대화상자 진입·퇴장 모션, 끌어내려 닫기, 이미지 뷰어 쓸어 닫기, 칩 누름 피드백, 토스트 밀어 닫기, 동작 줄이기 대응. 시트를 닫은 뒤 포커스가 페이지 맨 앞으로 빠지던 버그도 고쳤다. → [UI 시스템](../concepts/ui-system.md)
3. **iOS 단축어와 도움말** (커밋 `5c10b1d`): `/api/ingest`가 텍스트 본문과 `?format=text`를 받고, `/help/shortcut`에 7단계 SVG 안내를 넣었다. → [iOS 단축어 수집](../concepts/ios-shortcut.md)

함께 바꾼 것: `.claude/`(worktree)를 `.gitignore`·`.dockerignore`·`deploy.sh` tar 제외 목록에 추가했다. 빼 두지 않으면 worktree 사본이 릴리스와 이미지 빌드 맥락에 들어간다.

## 운영 확인

- tailnet `:8888`에서 `/`, `/add`, `/search`, `/settings`, `/help/shortcut`, `/api/health`, `/api/settings/llm` 응답 200
- 운영 DB에 `setting` 테이블과 `translation.title_ko`가 자동 추가됐고, 게시글 3건은 그대로다.
- 설정 API 응답에 키가 들어 있지 않다(`tail: null`, 키 미설정).
- `?format=text`로 지원하지 않는 링크를 보내면 한국어 한 줄이 돌아온다.

남은 일은 [위키 첫 화면](../index.md)의 다음 단계에 있다. 운영 키 입력, iPhone 실기기 검증, 단축어 iCloud 링크·캡처가 남았다.

- 추가: concepts/ios-shortcut.md, logs/2026-10-25-three-tracks-impl.md
- 갱신: index.md, concepts/index.md, concepts/translation.md, concepts/ui-system.md, concepts/data-model.md, concepts/platform-adapters.md, decisions/013-on-demand-translation-and-llm-settings.md, decisions/index.md, logs/index.md
