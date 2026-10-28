---
type: Decision
title: "연결 폴더 허용 루트 제한"
description: "폴더 연결을 LIBRARY_ALLOWED_ROOTS 아래로 제한하고 MCP 토큰 권한 분리는 후속 과제로 남긴다"
tags: [security, mcp, library, deploy]
timestamp: 2026-10-28
---

# 018. 연결 폴더 허용 루트 제한

## Context

통합 라이브러리 커밋 리뷰(2026-10-28)에서 두 가지가 맞물려 위험으로 드러났다.

- `MCP_TOKEN` 하나가 검색뿐 아니라 폴더 연결(`connect_library_folder`), 파일 읽기(`read_library_text`, `inspect_library_image`), 자료 편집, 원본 이동까지 모든 도구를 보호한다.
- `connectStorage`는 컨테이너 안의 임의 절대 경로를 받았다. 쓰기 가능한 `/data` 볼륨도 연결할 수 있었고, 연결 뒤에는 2MB 이하 파일을 읽을 수 있었다. `/data`에는 `archive.db`와 원본 스냅샷(`raw`)이 있다.

토큰이 새거나, 에이전트가 읽은 파일 내용에 심어진 지시에 속으면 이 길로 데이터 볼륨을 읽을 수 있다. 도구 설명이 파일 내용을 "신뢰할 수 없는 자료"라고 경고하고 `confirm=true`를 요구하지만, 둘 다 모델이 지키는 약속이고 서버가 막지 않는다.

## Decision

- `connectStorage`는 `LIBRARY_ALLOWED_ROOTS`(`:`로 구분, 기본 `/library`)와 `<데이터>/exports` 아래 폴더만 연결한다. 경로는 `realpath`로 풀어 비교하므로 심볼릭 링크로 빠져나갈 수 없다. 웹 `POST /api/library`와 MCP가 같은 함수를 쓴다.
- `<데이터>/exports`는 허용한다. 내보낸 묶음을 다시 가져오는 흐름(`test:library`)이 여기를 연결하기 때문이다.
- 이미 연결된 저장소는 그대로 둔다. 제한은 새 연결에만 적용한다.
- MCP 토큰은 **나누지 않았다.** 사용자의 에이전트가 같은 토큰으로 자료를 등록하고 있어서, 나누면 기존 등록이 깨진다.

## Consequences

- `/library` 밖에 새 폴더를 마운트하면 `LIBRARY_ALLOWED_ROOTS`에 경로를 추가해야 연결할 수 있다. 오류 문구가 이 변수를 안내한다.
- 읽기·쓰기 토큰 분리는 **후속 과제(미결정)**다. 분리 전까지 토큰을 가진 쪽은 허용 루트 안의 파일 읽기와 원본 이동(쓰기 마운트일 때)까지 할 수 있다.
- 검증은 `pnpm test:review-fixes`(허용 루트 밖 거절, `..` 우회 거절). 기존 통합 테스트는 `LIBRARY_ALLOWED_ROOTS`를 임시 폴더로 지정해 통과한다.

## Status

Accepted. 토큰 분리는 Proposed(미착수).
