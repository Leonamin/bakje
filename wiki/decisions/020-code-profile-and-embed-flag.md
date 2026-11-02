---
type: Decision
title: "020. 코드 항목은 요약(profile)만 임베딩하고 본문은 키워드 검색만"
description: "재활용 코드를 에이전트가 찾아 쓰도록 profile 요약·embed 표시·fidelity·신선도 출력을 둔 결정"
tags: [library, code, embedding, freshness, mcp]
timestamp: 2026-11-02
---

# 020. 코드 항목은 요약(profile)만 임베딩하고 본문은 키워드 검색만

## Context

사용자는 개발 중 재사용할 코드를 박제본으로 올려 두고, AI 개발 에이전트가 "OpenAI 호환 API로 OpenCode Go를 구현한 사례를 찾아 적용"처럼 지시받았을 때 인터넷 대신 이 코드를 먼저 쓰게 하려 한다. 에이전트가 낡은 인터넷 사례를 가져와 버그와 토큰 낭비가 생기는 것이 출발 문제다. 코드 본문은 질문(자연어)과 의미가 잘 맞지 않아 임베딩 가치가 낮다고 판단했다. 알고리즘처럼 오래 쓰는 코드와 서비스·버전에 묶인 코드는 신선도 기준이 달라야 한다.

## Decision

1. **항목 종류는 기존 `library_item.kind`에 `code`를 쓴다.** 새 테이블·컬럼은 없다. 파일이 여러 개면 구성요소를 파일별로 두어 원래 폴더 구조를 보존한다.
2. **요약은 등록하는 에이전트가 쓴다.** 서버는 LLM을 새로 호출하지 않는다. 틀은 `src/lib/profile-guide.ts`의 `PROFILE_GUIDE`이고 `register_library_items` 도구 설명에 붙는다. 제목은 `무엇 / 언제 쓰나 / 적용 방법 / 주의 / 결과물`이다. 요약은 `role: "profile"` 텍스트 구성요소로 저장되어 기존 임베딩·FTS를 탄다.
3. **코드 본문은 FTS에만 넣는다.** 구성요소 `metadata.embed=false`가 표시다. `kind=code`의 텍스트 구성요소는 설명 역할(`profile`, `doc`, `guide`, `pseudo`, `note`, `readme`)이 아니면 등록 시 자동으로 붙는다. 설명 문서(`doc`)는 임베딩한다. 첨부 파일(`kind=file`, `role=attachment`)은 원래 임베딩 대상이 아니다. 이미지(`diagram`, `result`)는 임베딩하며 필요하면 `embed=false`로 끈다. 등록 시점과 `embed.ts`의 `reconcileLegacy`, 실행 중 작업의 `stillCurrent` 세 곳에서 확인한다.
4. **통제권 순서는 사용자·에이전트의 `edit_library_components` `embed` 값, 매니페스트 명시값, 서버 기본 규칙 순이다.** 끄면 벡터와 대기 작업을 지우고, 켜면 큐에 다시 넣는다.
5. **`metadata.fidelity`(runnable/partial/pseudo)로 코드가 그대로 도는지, 일부인지, 슈도코드인지 표시한다.** 슈도코드를 실동작 코드로 복사하지 않게 하려는 것이며 `freshness` 출력에 함께 나온다. `PROFILE_VERSION`은 2다.
6. **신선도는 `metadata`의 `durability`(timeless/versioned), `depends_on`, `verified_at`, `profile_version`으로 표현한다.** `freshness()`가 `search_library`와 `get_library_item` 결과에 붙는다. versioned이면서 `verified_at`이 없거나 180일을 넘으면 `stale`이다. 메타데이터가 없으면 `unknown`이고 versioned처럼 다룬다. 판단이 애매하면 versioned을 쓴다.
7. **`search_library`에 `kind` 필터를 더했다.**
8. **코드 항목은 박제 기본저장소(managed)가 아니라 연결 폴더(linked)에 등록한다.** `registerItem`이 managed를 거부한다. 에이전트가 폴더에 파일(정리 문서, 코드·슈도코드, 다이어그램 등 첨부)을 쓰고 `register_library_items`로 등록한다. 요약 틀은 문서 구조(목표/전제/구현 단계/코드 또는 슈도코드/함정/확인 방법)와 "이 문서만 보고 구현할 수 있게" 쓰는 지침을 포함한다.

## Consequences

- `kind=code`에 `profile` 구성요소나 `metadata`가 없으면 `register_library_items` 결과에 `warnings`가 나오지만 등록은 막지 않는다.
- 요약 품질이 곧 검색 품질이다. 프롬프트 개선은 `PROFILE_GUIDE`와 `PROFILE_VERSION`을 고치는 것으로 시작한다. 낮은 버전 항목을 일괄 재작성하는 서버 작업은 만들지 않았다.
- `depends_on`과 프로젝트 lockfile의 비교는 에이전트가 한다. 서버는 비교하지 않는다.
- 180일(`STALE_DAYS`)은 임의로 정한 값이다.
- 사용자가 말한 사용 방식: "OpenAI 호환 API 코드와 OpenCode Go 주의사항을 정리해 그것만 봐도 구현할 수 있는 문서"를 코드와 함께 등록한다. 실동작 코드부터 슈도코드까지 섞이고, 다이어그램(예: [stack-diagram](https://github.com/caru-ini/stack-diagram)의 HTML·PNG) 같은 첨부 파일이 여러 가지 붙는다. stack-diagram은 README 요약만 확인했다.
- 한계: `expected_revision`을 붙인 재등록은 `embed`를 기본 규칙으로 되돌릴 수 있다. 구조 변경 `undo`는 지워진 벡터를 복원하지 않는다. UI 토글은 없다.
- 미검증: 실제 코드 항목을 등록해 에이전트가 요약을 잘 쓰고 검색에서 찾는지 확인하지 않았다. 자기 점검과 `scripts/test-embed-flag.ts`, 기존 라이브러리 시험만 통과했다.

## Status

Accepted
