---
type: Concept
title: "번역과 요약"
description: "OpenAI 호환 API로 번역·요약을 붙이는 방식과 실패 격리"
tags: [llm, translation, summary]
timestamp: 2026-10-25
---

# 번역과 요약

## 요청형 번역

수집 시에는 번역하지 않는다. 상세 화면 제목 아래의 "번역하기"를 누를 때만 번역을 만들어 저장한다. 번역이 있으면 한국어(제목·요약·본문)를 먼저 보여주고 같은 자리에서 "원문 보기"로 바꾼다. 실패하면 오류와 "다시 시도"를, 설정 문제면 "번역 설정" 링크를 보여준다. 번역하지 않은 해외 글은 한국어 검색에 걸리지 않는다. → [결정 013](../decisions/013-on-demand-translation-and-llm-settings.md)

## 규칙

- **한국어가 아니면** 번역문과 요약을 만든다. 원문은 절대 덮어쓰지 않는다.
- 번역이 있으면 기본으로 번역을 보여주고 원문 보기로 전환한다.
- 번역문과 원문을 **둘 다 검색에 색인**한다. 한국어로 검색해도 해외 글이 잡혀야 번역이 의미를 갖는다.

## 언어 판별

`src/lib/lang.ts`에서 문자 비율로 판정한다. 한글 음절 비율이 12%를 넘으면 `ko`, 가나가 있으면 `ja`, 한자만 많으면 `zh`, 그 외 라틴 문자는 `en`. 정확한 언어 식별이 아니라 "한국어인가"만 필요하므로 이 정도로 충분하다.

X는 트윗 메타의 `lang`을 우선 신뢰한다.

## 호출

- OpenAI 호환 API의 Chat Completions(`/chat/completions`) 또는 Responses(`/responses`)에 JSON 모드로 요청한다. JSON 모드나 `temperature`를 거부하는 400 응답이면 그 필드를 빼고 한 번 더 요청한다.
- 입력: 제목(있으면) + 파트 텍스트 배열
- 출력: `{ title, parts[], summary }`
- 모델·프롬프트 버전을 `translation` 테이블에 남긴다.
- 실패해도 수집은 성공 상태를 유지한다. 번역은 부가 기능이므로 아카이브를 잃으면 안 된다.

## 설정

`/settings`에서 제공자 프리셋(OpenAI, OpenRouter, OpenCode Go, 직접 입력), Base URL, API 형식, 모델 ID, API 키를 관리하고 연결 테스트를 한다. 값은 SQLite `setting` 테이블에 저장되고 바로 적용된다. 키는 쓰기 전용이라 화면에는 끝 4자리만 보인다.

설정에서 비어 있는 항목은 아래 환경 변수로 대체한다.

## 환경 변수

```
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

이 값은 `/etc/bakje/bakje.env`에 둔다. 프로젝트 폴더의 `.env`는 배포에서 제외된다. 값을 바꾼 뒤에는 `docker compose up -d --force-recreate`(또는 `deploy.sh`)로 컨테이너를 다시 만들어야 한다.

키가 없으면 번역 단계만 건너뛴다. 수집·검색·열람은 전부 동작한다.

## 검증 상태

- 목 서버(`npm run mock-llm`)로 배관·저장·토글 UI까지 확인했다. 목 서버는 `/responses`와 JSON 모드 거부 흉내(`MOCK_LLM_REJECT_JSON=1`)도 지원한다.
- OpenRouter에 가짜 키로 요청해 401 오류가 화면에 표시되는 것을 확인했다.
- **실제 모델 품질과 비용은 검증하지 않았다.** 운영 환경은 키가 비어 있다.
- 프롬프트는 코드/URL/핸들을 번역하지 말고 톤을 유지하라고 지시하지만, 실제 출력 품질 평가는 남은 과제다.
