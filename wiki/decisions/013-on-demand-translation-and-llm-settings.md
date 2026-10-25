---
type: Decision
title: "013. 요청형 번역과 LLM 설정 페이지"
description: "수집 시 자동 번역을 멈추고 사용자가 누를 때만 번역하며, 제공자·모델·키를 설정 화면에서 관리"
tags: [llm, translation, settings, ui]
timestamp: 2026-10-25
---

# 013. 요청형 번역과 LLM 설정 페이지

## Context

- 지금은 수집할 때 한국어가 아닌 글을 모두 자동 번역한다. 읽지 않을 글까지 번역해 LLM 사용량을 쓴다.
- 설정은 `/etc/bakje/bakje.env`의 `OPENAI_BASE_URL`·`OPENAI_API_KEY`·`OPENAI_MODEL` 한 벌뿐이다. 바꾸려면 컨테이너를 다시 만들어야 한다(`docker compose restart`로는 env 파일을 다시 읽지 않는다).
- 프로젝트 폴더의 `.env`는 `deploy.sh`의 tar 제외 목록과 `.dockerignore`에 있어 배포되지 않는다.
- `src/lib/llm.ts`는 Chat Completions만 호출하고 `response_format: json_object`를 항상 보낸다. 이 옵션을 거부하는 모델이면 번역 전체가 실패한다. Responses API는 지원하지 않는다.
- 사용자가 주로 쓰는 제공자는 OpenAI, OpenCode Go, OpenRouter다.
- 이미 저장된 글은 소급 번역되지 않는다. 번역은 수집 시에만 실행된다.

## Decision

**번역은 사용자가 요청할 때만 만든다.** X의 "게시물 번역하기"와 같은 방식이다.

- 수집 단계에서 자동 번역을 하지 않는다.
- 번역이 없는 비한국어 글: 제목과 본문 사이에 **번역하기** 버튼을 둔다. 누르면 번역을 만들어 저장하고 바로 보여준다.
- 번역이 있는 글: **한국어 번역을 먼저** 보여주고, 같은 자리에 **원문 보기** 토글을 둔다.
- 번역에 실패하면 같은 자리에 오류와 **다시 시도**를 보여준다. 미번역·실패 글의 재시도도 이 버튼 하나로 처리한다.

**LLM 설정은 설정 화면에서 관리한다.**

- 제공자 프리셋(OpenAI, OpenRouter, OpenCode Go, 직접 입력)에 따라 Base URL과 API 형식(Chat Completions / Responses)을 채운다.
- 모델 ID를 입력한다.
- 키는 쓰기 전용이다. 저장한 뒤에는 끝자리만 보여주고 화면으로 다시 내려보내지 않는다. 앱에 인증이 없어 tailnet 기기 누구나 설정 화면을 열 수 있기 때문이다.
- 연결 테스트 버튼으로 짧은 요청을 보내 성공 여부와 오류를 보여준다.
- 설정은 SQLite에 저장하고, 비어 있으면 env 값을 쓴다. 재배포 없이 바로 적용된다.
- JSON 모드를 거부하면 옵션을 빼고 한 번 더 요청한다.

## Consequences

- 읽는 글만 번역하므로 사용량이 줄어든다.
- 번역문은 검색 색인에 들어가므로, **번역하지 않은 해외 글은 한국어 검색으로 찾을 수 없다.** 원문 키워드로는 찾을 수 있다.
- 일괄 번역 버튼은 만들지 않는다. 필요해지면 추가한다.
- 미확정·후속 확인:
  - OpenCode Go의 엔드포인트와 Chat Completions·Responses 지원 여부는 구현할 때 문서로 확인한다.
  - 설정 화면 경로와 진입 위치(상단 메뉴, 라이브러리 등)는 구현할 때 정한다.

## Implementation (2026-10-25)

릴리스 `20261025T122749Z`로 배포했다.

- `POST /api/sources/[id]/translate`가 번역문·요약·번역 제목(`translation.title_ko`, 새 컬럼)을 저장하고 색인을 다시 만든다. 기존 번역이 있으면 덮어쓴다. 실패하면 502와 읽을 수 있는 메시지를 돌려준다.
- 상세 화면 순서: 작성자·지표 → 제목 → 번역 컨트롤 → 요약 → 본문. 하단 액션 바와 데스크톱 상단 바의 번역/원문 토글은 없앴다.
- 설정 화면 `/settings`. 모바일은 라이브러리 머리글, 데스크톱은 상단 바의 톱니 아이콘으로 들어간다. 연결 테스트는 저장 전 입력값으로 시험한다. 키는 GET·PUT 응답에 넣지 않고 끝 4자리와 출처(설정/환경 변수)만 보여준다.
- 400 응답이 `response_format`/`text.format`이나 `temperature`를 언급하면 그 필드를 빼고 한 번 더 요청한다.
- OpenCode Go 프리셋: `https://opencode.ai/inference/go/openai/v1` + Chat Completions. 외부 문서에 따르면 minimax·qwen 모델은 Anthropic 형식(`/v1/messages`)만 지원해 이 앱에서 쓸 수 없다. 실제 키로는 검증하지 않았다.
- 번역이 이미 있는 글을 다시 번역하는 버튼은 없다. 필요해지면 추가한다.

## Status

Accepted
