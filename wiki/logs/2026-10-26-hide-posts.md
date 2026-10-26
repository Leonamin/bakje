---
type: Log
title: "Hide Posts"
description: "게시글 숨김 기능 구현과 숨긴 뒤 목록이 갱신되지 않던 버그 수정"
timestamp: 2026-10-26
okf_version: "0.1"
---

# Hide Posts

이미 수집한 글을 휴지통 없이 목록에서 치우는 숨김 기능을 만들고 배포했다. → [결정 016](../decisions/016-hide-posts.md)

- 구현: `source.hidden_at`, `buildFilters`·`topTags`의 제외 조건, 정리 패널 숨기기 행, 필터 시트 "숨긴 글만 보기", 숨긴 글 상세 안내.
- 버그: 숨긴 뒤 목록으로 돌아가도 그 글이 남아 있었다(새로고침하면 사라짐). 원인은 `staleTimes.dynamic: 30`의 클라이언트 캐시와 `router.push("/")`. 시도 순서는 `push("/")` → `refresh()` 후 `back()`(여전히 옛 목록, 히스토리의 목록이 캐시에서 복원됨) → 서버 액션 `revalidatePath("/", "layout")` 후 `back()`(해결).
- 버그: 토스트 "되돌리기"는 상세를 떠난 뒤 실행되어 현재 목록이 갱신되지 않았다. 해제 뒤 `router.refresh()`를 직접 호출해 해결했다. 원인은 추정이다.
- 확인: 사용자가 숨김 → 자동 뒤로 이동 → 목록에서 제외, 되돌리기 → 목록 복귀를 확인했다. 릴리스 `20261026T060330Z`. 실기기는 미검증.
- 정정: 최신 릴리스 표기를 `20261026T060330Z`로 고쳤다.

- 추가: decisions/016-hide-posts.md, logs/2026-10-26-hide-posts.md
- 갱신: decisions/index.md, concepts/data-model.md, concepts/ui-system.md, index.md, logs/index.md
