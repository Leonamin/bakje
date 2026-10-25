---
type: Concept
title: "번역과 요약"
description: "OpenAI 호환 API로 번역·요약을 붙이는 방식과 실패 격리"
tags: [llm, translation, summary]
timestamp: 2026-10-25
---

# 번역과 요약

## 예정된 변경

수집 시 자동 번역을 멈추고, 사용자가 "번역하기"를 누를 때만 번역을 만든다. 번역이 있으면 한국어를 먼저 보여주고 제목과 본문 사이에 "원문 보기"를 둔다. 제공자·모델·키는 설정 화면에서 관리한다. → [결정 013](../decisions/013-on-demand-translation-and-llm-settings.md)

## 규칙

- **한국어가 아니면** 번역문과 요약을 만든다. 원문은 절대 덮어쓰지 않는다.
- 화면은 원문/번역 토글, 기본값은 번역.
- 번역문과 원문을 **둘 다 검색에 색인**한다. 한국어로 검색해도 해외 글이 잡혀야 번역이 의미를 갖는다.

## 언어 판별

`src/lib/lang.ts`에서 문자 비율로 판정한다. 한글 음절 비율이 12%를 넘으면 `ko`, 가나가 있으면 `ja`, 한자만 많으면 `zh`, 그 외 라틴 문자는 `en`. 정확한 언어 식별이 아니라 "한국어인가"만 필요하므로 이 정도로 충분하다.

X는 트윗 메타의 `lang`을 우선 신뢰한다.

## 호출

- OpenAI 호환 `/chat/completions`에 JSON 모드로 요청한다.
- 입력: 제목(있으면) + 파트 텍스트 배열
- 출력: `{ title, parts[], summary }`
- 모델·프롬프트 버전을 `translation` 테이블에 남긴다.
- 실패해도 수집은 성공 상태를 유지한다. 번역은 부가 기능이므로 아카이브를 잃으면 안 된다.

## 환경 변수

```
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
```

이 값은 `/etc/bakje/bakje.env`에 둔다. 프로젝트 폴더의 `.env`는 배포에서 제외된다. 값을 바꾼 뒤에는 `docker compose up -d --force-recreate`(또는 `deploy.sh`)로 컨테이너를 다시 만들어야 한다.

키가 없으면 번역 단계만 건너뛴다. 수집·검색·열람은 전부 동작한다.

## 검증 상태

- 목 서버(`npm run mock-llm`)로 배관·저장·토글 UI까지 확인했다.
- **실제 모델 품질과 비용은 검증하지 않았다.** 운영 환경은 키가 비어 있다.
- 프롬프트는 코드/URL/핸들을 번역하지 말고 톤을 유지하라고 지시하지만, 실제 출력 품질 평가는 남은 과제다.
