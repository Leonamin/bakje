---
type: Log
title: "입력창 글자 크기 원인과 카드 썸네일"
description: "레이어 밖 CSS가 Tailwind 유틸리티를 이겨 입력창이 14px이던 문제, 카드 썸네일 webp 캐시, 뒤로가기 깜빡임 완화"
timestamp: 2026-10-25
okf_version: "0.1"
---

# 입력창 글자 크기 원인과 카드 썸네일

1. **입력창 14px**: `text-[16px]`가 적용되지 않던 원인은 `global.css`의 레이어 밖 `font: inherit`이다. 처음에는 클래스만 보고 "이미 16px"이라고 잘못 판단했고, 사용자가 computed style을 확인해 바로잡았다. `bridge.css`에 입력 요소 `font-size: 16px`를 직접 넣어 해결했다. 상세와 더 깔끔한 대안(미적용)은 [UI 시스템](../concepts/ui-system.md).
2. **카드 썸네일**: 미디어 라우트에 `?w=`를 더해 sharp로 webp를 만들고 `thumbs/`에 캐시한다. → [미디어 파이프라인](../concepts/media-pipeline.md)
3. **뒤로가기 깜빡임**: 라이브러리가 `force-dynamic`이라 뒤로 갈 때마다 다시 받았다. `staleTimes.dynamic: 30`으로 30초간 재사용한다. 그동안 새로 저장한 글이 목록에 늦게 보일 수 있다. 실기기 확인은 미검증.
4. **미결정**: 리셋 CSS를 `layer(base)`로 옮기는 안은 도움말 이미지 크기가 바뀌어 보류했다.

- 갱신: concepts/ui-system.md, concepts/media-pipeline.md, concepts/index.md, logs/index.md
- 추가: logs/2026-10-25-css-cascade-and-thumbnails.md
