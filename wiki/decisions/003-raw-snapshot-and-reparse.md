---
type: Decision
title: "003. fetch/parse 분리와 원본 스냅샷"
description: "파서가 깨져도 데이터를 살리는 구조"
tags: [parsing, snapshot, resilience]
timestamp: 2026-10-25
---

# 003. fetch/parse 분리와 원본 스냅샷

## Context

플랫폼 마크업은 예고 없이 바뀐다. 파서를 고쳐도 이미 저장한 데이터가 정규화된 필드뿐이면 복구할 방법이 없다. 삭제된 글은 다시 받을 수도 없다.

## Decision

가져오기(fetch)와 해석(parse)을 분리하고, **파싱 직전 원본을 그대로 저장**한다.

- `raw/<platform>/<id>-<ts>.html`: 서버가 준 HTML
- `raw/<platform>/<id>-<ts>.json`: Reddit처럼 DOM 추출이 필요한 경우 추출 결과
- `snapshot` 테이블에 시각·경로·`parser_version` 기록
- `npm run reparse`로 네트워크 없이 전체 재파싱

## Consequences

- 파서를 고치면 과거 데이터 전체에 소급 적용된다. 이미 삭제된 글도 살릴 수 있다.
- 디스크 사용량이 늘어난다(글당 수백 KB~1MB). 개인 아카이브 규모에서는 감수할 비용이다.
- reparse는 플랫폼별로 원본 형식이 다르다는 사실을 감당해야 한다. Reddit은 저장된 HTML을 브라우저에 올려 다시 추출하고, 실패하면 저장된 JSON으로 폴백한다.
- 원본에는 광고·추천 영역도 함께 들어간다. 개인 보관 용도이며 재배포하지 않는다.

## Status

Accepted
