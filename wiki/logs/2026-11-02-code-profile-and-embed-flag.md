---
type: Log
title: "코드 항목 프로필, 임베딩 제외 표시, 신선도 출력"
description: "재활용 코드용 profile 요약 틀, metadata.embed 표시와 편집, freshness 출력·kind 필터 구현 기록"
timestamp: 2026-11-02
okf_version: "0.1"
---

# 코드 항목 프로필, 임베딩 제외 표시, 신선도 출력

LLM 위키 사례를 조사한 뒤 박제를 강화하는 쪽으로 정했다. 비교한 오픈소스는 Karpathy식 LLM 위키 패턴과 MCP 지식 저장소(Leon4s4/knowledge-base-mcp, NocturnLabs/opencode-personal-knowledge, willynikes2/knowledge-base-server 등)다. 각 README 요약만 보았고 직접 설치해 검증하지 않았다. 박제에 있는 SNS 원문 보존, 이미지 검색, 한국어 검색은 그 프로젝트들에 없다.

결정은 [020](../decisions/020-code-profile-and-embed-flag.md)에 있다. 구현은 다음과 같다.

- `profile-guide.ts`: 요약 틀, 메타데이터 스키마, 경고, `freshness()`.
- `register_library_items`: 설명에 틀을 붙이고 결과에 `warnings`를 더했다.
- 코드 본문 구성요소는 `metadata.embed=false`로 FTS에만 들어간다.
- `edit_library_components`에 `embed` 값을 더했다. 끄면 벡터와 대기 작업을 지운다.
- `search_library`에 `kind` 필터와 `freshness` 출력을 더했다. `get_library_item`에도 `freshness`를 붙였다.
- 시험: `scripts/test-embed-flag.ts` 추가. `test-library-management.ts`, `test-library.ts` 통과.

작업 중 명령에 불필요한 `cat >> /tmp/x`를 넣어 멈춘 일이 있었다. 만들어진 빈 파일은 지웠고 프로젝트 파일에는 영향이 없었다.

후속 변경(같은 날): 코드 등록은 연결 폴더에만 된다는 점을 확인했다. 사용자가 정리 문서를 코드와 함께 올리는 방식이라, 임베딩 제외 기본 규칙을 "profile 외 모두"에서 "설명 역할(profile·doc·guide·pseudo·note·readme) 외 모두"로 고쳤다. `metadata.fidelity`를 추가하고 `PROFILE_VERSION`을 2로 올렸으며, 요약 틀에 구현 문서 구조와 첨부 파일 규칙(`kind=file`, `role=attachment`, 임베딩 안 함)을 넣었다. 자기 점검은 `console.assert` 대신 `node:assert`로 바꿨다. 앞서 쓴 `console.assert`는 실패해도 종료 코드가 바뀌지 않는 약한 검사였다.

MCP 컨텍스트 절감: 요약 틀 약 2,050자가 `register_library_items` 설명에 들어가 있었다(다른 도구 설명 합계 약 5,600자). 전체 틀을 스킬로 옮기고 MCP에는 `PROFILE_HINT` 한 줄만 남겼다. 호스트의 `/library`는 `BAKJE_LIBRARY_ROOT`를 읽기 전용으로 마운트한 것이며, 현재 연결 폴더는 opennana·ai-costume·ai-pose뿐이고 코드용 폴더는 없다.

남은 일: 실제 코드 항목 등록 시험, 에이전트 쪽 AGENTS.md에 "구현 전에 박제를 먼저 검색" 규칙과 신선도 규칙 추가, 재등록 시 `embed` 값 유지, 프롬프트 개선과 일괄 재작성.

- 추가: `decisions/020-code-profile-and-embed-flag.md`
- 갱신: `concepts/embedding-pipeline.md`, `decisions/index.md`, `logs/index.md`
- 추가: `logs/2026-11-02-code-profile-and-embed-flag.md`, `.agents/skills/bakje-register-code/SKILL.md`
