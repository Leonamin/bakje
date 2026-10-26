---
type: Decision
title: "016. 게시글은 지우지 않고 숨긴다"
description: "휴지통 대신 source.hidden_at 숨김으로 목록·검색에서 제외하고, 서버 액션으로 라우터 캐시를 무효화"
tags: [library, hide, cache]
timestamp: 2026-10-26
---

# 016. 게시글은 지우지 않고 숨긴다

## Context

이미 수집했지만 더는 필요 없는 글을 목록에서 치우고 싶었다. 휴지통은 보관 기간·비우기·복구 화면까지 필요해 과하고, 행을 삭제하면 같은 URL을 다시 수집할 때 새 글로 되살아난다.

## Decision

`source.hidden_at`(ISO 시각, `NULL`이면 보임)로 숨긴다. 행·미디어·임베딩은 그대로 둔다.

- 목록·검색(키워드·의미 검색)·태그 집계는 `buildFilters` 한 곳의 `hidden_at IS NULL`로 제외한다. 필터 `?hidden=1`이면 숨긴 글만 보인다.
- 숨긴 글의 URL을 다시 수집해도 중복 확인(`platform`+`native_id`)에 걸려 숨김이 유지된다.
- 진입점은 상세의 정리 패널 맨 아래 "이 글 숨기기" 행이다. 확인 다이얼로그 없이 숨기고, 토스트의 "되돌리기"로 해제한다. 숨긴 글을 보는 곳은 필터 시트의 "숨긴 글만 보기"다.
- 숨김·해제는 서버 액션 `setSourceHidden`(`src/app/actions.ts`)이 DB를 고친 뒤 `revalidatePath("/", "layout")`을 부른다. 숨긴 뒤에는 `router.back()`으로 필터·스크롤을 유지한 채 목록으로 돌아가고, 되돌리기에서는 `router.refresh()`를 직접 부른다.

## Consequences

- `staleTimes.dynamic: 30`(뒤로가기 깜빡임 방지) 때문에 상태를 바꾼 뒤 돌아가는 목록이 옛 캐시로 보이는 문제가 있었다. `router.push("/")`, `refresh()` 후 `back()`은 모두 부족했고(히스토리의 목록이 캐시에서 복원됨), 서버 액션의 `revalidatePath`로 해결했다. 같은 패턴이 필요한 다른 변경 동작도 이 방식을 따른다.
- 토스트의 되돌리기는 상세 화면을 떠난 뒤 실행되므로 액션의 무효화만으로는 현재 목록이 갱신되지 않아 `router.refresh()`가 따로 필요했다.
- 영구 삭제, 일괄 숨기기, 목록 카드의 스와이프·길게 누르기는 만들지 않았다. 필요해지면 "숨긴 글 보기" 안에서 영구 삭제부터 연다.
- 실기기(iPhone) 동작은 미검증이다. 데스크톱 브라우저에서 사용자가 확인했다.

## Status

Accepted
