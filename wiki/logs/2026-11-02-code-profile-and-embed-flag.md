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

MCP 컨텍스트 절감: 요약 틀 약 2,050자가 `register_library_items` 설명에 들어가 있었다(다른 도구 설명 합계 약 5,600자). 전체 틀을 스킬로 옮기고 MCP에는 `PROFILE_HINT` 한 줄만 남겼다. 호스트의 `/library`는 `BAKJE_LIBRARY_ROOT`를 읽기 전용으로 마운트한 것이며, 현재 연결 폴더는 opennana·ai-costume·ai-pose뿐이고 코드용 폴더는 없다. 운영 컨테이너는 폴더마다 `/etc/bakje/compose.override.yml`로 따로 바인드 마운트하므로(`/home/leonamin/Library/<이름>` → `/library/<이름>`), 새 폴더는 컨테이너 재생성이 필요하다.

운영 반영(2026-11-02): 코드용 폴더 `/home/leonamin/Library/code-notes`를 만들고 `/etc/bakje/compose.override.yml`에 `/library/code-notes` 바인드 마운트를 추가한 뒤 웹 컨테이너만 재생성했다(백업 `compose.override.yml.bak-20261102`). 사용자 `1000:1000`, 재시작 정책 `unless-stopped`, 네트워크 `bakje_default`, 볼륨 4개(`/data`, opennana, ai-costume, ai-pose)는 전후가 같았다. 재생성은 새 빌드 없이 기존 이미지(`bakje-web:latest`)로 했으므로 운영 코드는 PR #26 이전이다. `connect_library_folder`로 저장소 5번 `code-notes`를 연결했다. 첫 예시 `openai-compatible-llm-client`(`src/lib/llm.ts` 발췌)의 파일은 폴더에 두었고 등록은 PR #26 배포 뒤로 미뤘다. 배포 전에는 `embed` 규칙이 없어 코드 파일이 임베딩되기 때문이다.

배포와 첫 등록(2026-11-03): PR #26을 병합하고 `scripts/deploy.sh`로 웹만 배포했다(릴리스 `20261103T011720Z`). 사용자 `1000:1000`, `unless-stopped`, `bakje_default`, 마운트 5개는 배포 전후가 같았고 healthy였다. 항목 19915 `openai-compatible-llm-client`를 저장소 5번에 `kind=code`로 등록했고 `warnings`는 없었다. 운영 DB에서 `entry`·`helper`는 `embed=false`에 벡터 0개, `profile`은 벡터 1개, `doc`은 벡터 2개임을 확인했다. "OpenCode Go OpenAI 호환 API 구현" 검색에서 1위(점수 0.85)였고 `freshness`가 `versioned`·`runnable`·`stale`(`verified_at` 없음)로 나왔다. 미확인: 실제 OpenCode 서버 호출(mock 서버로만 시험), `kind` 필터(세션의 MCP 도구 정의가 배포 전 상태여서 못 씀), 에이전트가 이 항목을 찾아 구현에 쓰는 흐름.

에이전트 시험(2026-11-03): 임시 가짜 프로젝트(AGENTS.md에 박제 우선 검색 규칙, `summarize()` 빈 함수)를 만들고 새 `claude -p` 세션에 "OpenAI Compatible API 형식으로 OpenCode GO 구현한 사례 찾아서 구현해줘"라고 시켰다. 웹 도구는 막았다. 에이전트는 `search_library`에 `kind=code`를 넣어 항목 19915를 찾고 `get_library_item`으로 읽어 `x-opencode-session` 헤더와 temperature 거부 재시도를 구현했다. `freshness.stale=true`를 보고 그대로 복사하지 않았고, 원본과 다른 점과 "실서버 미확인"을 보고했으며 항목 id를 밝혔다(비용 약 $0.16). 구현한 코드를 실행해 보지는 않았다. 임시 프로젝트는 삭제했다. 이 시험은 AGENTS.md 규칙이 있는 조건이다. 규칙이 없을 때 에이전트가 박제를 먼저 찾는지는 시험하지 않았다.

남은 일: 실제 OpenCode 호출 성공 후 `verified_at` 기록, 에이전트 쪽 AGENTS.md에 "구현 전에 박제를 먼저 검색" 규칙과 신선도 규칙 추가, 재등록 시 `embed` 값 유지, 프롬프트 개선과 일괄 재작성.

- 추가: `decisions/020-code-profile-and-embed-flag.md`
- 갱신: `concepts/embedding-pipeline.md`, `decisions/index.md`, `logs/index.md`
- 추가: `logs/2026-11-02-code-profile-and-embed-flag.md`, `.agents/skills/bakje-code/SKILL.md`

스킬 이름 변경(2026-11-03): `bakje-register-code`를 `bakje-code`로 바꿨다. 이 스킬은 등록과 먼저 찾기를 모두 다루기 때문이다. 위 기록의 옛 이름은 모두 새 이름으로 고쳤다. MCP 힌트와 `warnings` 문구도 새 이름을 안내하며 웹 배포로 반영했다.
